import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "-").replace(/&mdash;/g, "-").trim();
}

function parseNumber(text: string): number {
  const cleaned = text.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (LovableCloud) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

function extract52WeekRange(html: string): { high?: number; low?: number } {
  const patterns = [
    /52\s*[Ww]eeks['']?\s*[Mm]oving\s*[Rr]ange[^<]*<\/t[hd]>\s*<td[^>]*>\s*([\d,.]+)\s*-\s*([\d,.]+)/i,
    /52\s*[Ww]eeks['']?\s*[Mm]oving\s*[Rr]ange[^|]*\|\s*([\d,.]+)\s*-\s*([\d,.]+)/i,
    />52\s*[Ww]eeks['']?\s*[Mm]oving\s*[Rr]ange<[^>]*>[^<]*<[^>]*>\s*([\d,.]+)\s*-\s*([\d,.]+)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1] && m?.[2]) {
      const v1 = parseNumber(m[1]), v2 = parseNumber(m[2]);
      return { low: Math.min(v1, v2), high: Math.max(v1, v2) };
    }
  }
  return {};
}

function extractPERatio(html: string): number {
  const patterns = [
    /Current\s*P\/E\s*[Rr]atio\s*using\s*Basic\s*EPS[^<]*<\/td>((?:\s*<td[^>]*>[^<]*<\/td>)+)/i,
    /Trailing\s*P\/E\s*[Rr]atio[^<]*<\/td>((?:\s*<td[^>]*>[^<]*<\/td>)+)/i,
    /Current\s*P\/E\s*[Rr]atio[^<]*<\/td>((?:\s*<td[^>]*>[^<]*<\/td>)+)/i,
  ];
  for (const p of patterns) {
    const rowMatch = html.match(p);
    if (rowMatch?.[1]) {
      const tdValues = rowMatch[1].match(/<td[^>]*>([^<]*)<\/td>/gi);
      if (tdValues) {
        for (let i = tdValues.length - 1; i >= 0; i--) {
          const vm = tdValues[i].match(/<td[^>]*>([^<]*)<\/td>/i);
          if (vm?.[1]) { const v = parseNumber(vm[1]); if (v > 0 && v < 10000) return v; }
        }
      }
    }
  }
  const simple = html.match(/P\/E\s*[Rr]atio[^<]*(?:<[^>]+>)+\s*([\d,.]+)/i);
  if (simple) { const v = parseNumber(simple[1]); if (v > 0 && v < 10000) return v; }
  return 0;
}

function extractEPSandNAV(html: string): { eps?: number; nav?: number } {
  const result: { eps?: number; nav?: number } = {};
  const section = html.match(/Financial\s*Performance\s*as\s*per\s*Audited[\s\S]*?(<table[\s\S]*?<\/table>)/i);
  if (section) {
    const rows = section[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const yearMatch = rows[i].match(/<td[^>]*>\s*(20[2-3]\d)\s*<\/td>/i);
      if (yearMatch) {
        const cells = rows[i].match(/<td[^>]*>([^<]*)<\/td>/gi) || [];
        if (cells.length >= 8) {
          const epsM = cells[4]?.match(/<td[^>]*>([^<]*)<\/td>/i);
          const navM = cells[7]?.match(/<td[^>]*>([^<]*)<\/td>/i);
          if (epsM) result.eps = parseNumber(epsM[1]);
          if (navM) result.nav = parseNumber(navM[1]);
          if (result.eps || result.nav) return result;
        }
      }
    }
  }
  // Fallbacks
  for (const p of [/EPS\s*\([Bb]asic\)[^<]*(?:<[^>]+>)+\s*([\d,.()-]+)/i, /[Ee]arning[s]?\s*[Pp]er\s*[Ss]hare[^<]*(?:<[^>]+>)+\s*([\d,.()-]+)/i]) {
    const m = html.match(p);
    if (m?.[1] && !result.eps) { result.eps = parseNumber(m[1]); break; }
  }
  for (const p of [/NAV[^<]*(?:<[^>]+>)+\s*([\d,.()-]+)/i, /[Nn]et\s*[Aa]sset\s*[Vv]alue[^<]*(?:<[^>]+>)+\s*([\d,.()-]+)/i]) {
    const m = html.match(p);
    if (m?.[1] && !result.nav) { result.nav = parseNumber(m[1]); break; }
  }
  return result;
}

async function fetchOneFundamental(symbol: string) {
  const url = `https://www.dsebd.org/displayCompany.php?name=${encodeURIComponent(symbol)}`;
  const html = await fetchHtml(url);
  const f: Record<string, unknown> = { symbol: symbol.toUpperCase() };

  // Sector
  for (const p of [/Sector[:\s]*<\/th>\s*<td[^>]*>([^<]+)</i, /Sector[:\s]*<\/td>\s*<td[^>]*>([^<]+)</i]) {
    const m = html.match(p); if (m?.[1]) { f.sector = decodeHtmlEntities(m[1]); break; }
  }
  // Category
  for (const p of [/(?:Share\s*)?Category[:\s]*<\/th>\s*<td[^>]*>([^<]+)</i]) {
    const m = html.match(p); if (m?.[1]) { f.category = decodeHtmlEntities(m[1]); break; }
  }
  // Market Cap
  for (const p of [/Market\s*Cap(?:italization)?\s*\(mn\)[^<]*<\/t[hd]>\s*<td[^>]*>\s*([\d,.-]+)/i, /Market\s*Cap(?:italization)?[^<]*<\/th>\s*<td[^>]*>\s*([\d,.-]+)/i]) {
    const m = html.match(p); if (m?.[1]) { f.market_cap = parseNumber(m[1]); break; }
  }
  // Authorized Cap
  const ac = html.match(/Authorized\s*Capital[^<]*<\/th>\s*<td[^>]*>\s*([\d,.-]+)/i);
  if (ac) f.authorized_cap = parseNumber(ac[1]);
  // Paid-up Cap
  const pu = html.match(/Paid[- ]?up\s*Capital[^<]*<\/th>\s*<td[^>]*>\s*([\d,.-]+)/i);
  if (pu) f.paid_up_cap = parseNumber(pu[1]);
  // Face Value
  const fv = html.match(/Face(?:\/Par)?\s*Value[^<]*<\/th>\s*<td[^>]*>\s*([\d,.-]+)/i);
  if (fv) f.face_value = parseNumber(fv[1]);
  // Total Shares
  if (f.paid_up_cap && f.face_value && (f.face_value as number) > 0) {
    f.total_shares = Math.round(((f.paid_up_cap as number) * 1_000_000) / (f.face_value as number));
  }
  // Listing Year
  const ly = html.match(/Listing\s*Year[^<]*<\/th>\s*<td[^>]*>\s*(\d{4})/i);
  if (ly) f.listing_year = parseInt(ly[1], 10);
  // P/E
  const pe = extractPERatio(html);
  if (pe) f.pe = pe;
  // EPS & NAV
  const en = extractEPSandNAV(html);
  if (en.eps) f.eps = en.eps;
  if (en.nav) f.nav = en.nav;
  // 52W range
  const range = extract52WeekRange(html);
  if (range.high) f.year_high = range.high;
  if (range.low) f.year_low = range.low;
  // Last AGM
  const agm = html.match(/(?:Last\s*)?AGM\s*[Hh]eld\s*[Oo]n[^<]*<\/th>\s*<td[^>]*>([^<]+)</i);
  if (agm?.[1]) {
    const v = decodeHtmlEntities(agm[1]);
    if (/\d/.test(v) && !v.includes('function')) f.last_agm = v;
  }

  return f;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get list of all symbols from market-data
    const marketRes = await fetch(`${supabaseUrl}/functions/v1/market-data`, {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
    });
    const marketJson = await marketRes.json();
    const symbols: string[] = (marketJson.data || []).map((s: { symbol: string }) => s.symbol);

    console.log(`Fetching fundamentals for ${symbols.length} stocks...`);

    let saved = 0;
    let failed = 0;
    const batchSize = 5;

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(sym => fetchOneFundamental(sym))
      );

      const rows = results
        .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === "fulfilled")
        .map(r => r.value);

      if (rows.length > 0) {
        const { error } = await supabase
          .from("stock_fundamentals")
          .upsert(rows, { onConflict: "symbol" });

        if (error) {
          console.error(`Upsert error for batch starting ${batch[0]}:`, error.message);
          failed += batch.length;
        } else {
          saved += rows.length;
          failed += batch.length - rows.length;
        }
      } else {
        failed += batch.length;
      }

      console.log(`Progress: ${Math.min(i + batchSize, symbols.length)}/${symbols.length} (saved: ${saved}, failed: ${failed})`);
      
      // Rate limit: wait between batches
      if (i + batchSize < symbols.length) await delay(1000);
    }

    return new Response(
      JSON.stringify({ success: true, saved, failed, total: symbols.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in save-fundamentals:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
