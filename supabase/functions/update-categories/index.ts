import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const categoryMap = new Map<string, string>();
    const categories = ["A", "B", "G", "N", "Z"];

    // Fetch all category pages in parallel
    const fetches = categories.map(async (cat) => {
      const res = await fetch(`https://www.dsebd.org/latest_share_price_scroll_group.php?group=${cat}`, {
        headers: { "user-agent": "Mozilla/5.0 Chrome/120" },
      });
      const html = await res.text();
      const symbols: string[] = [];
      
      // Only extract from the main table section after the category header
      const catHeader = html.indexOf(`( Category - ${cat} )`);
      if (catHeader === -1) {
        console.log(`Category ${cat}: header not found`);
        return { cat, symbols };
      }
      const tableSection = html.substring(catHeader);
      
      // Match rows: each stock is in a <tr> with displayCompany link
      for (const m of tableSection.matchAll(/<tr[^>]*>\s*<td[^>]*>\d+<\/td>\s*<td[^>]*>\s*<a[^>]*displayCompany\.php\?name=([^"&]+)/gi)) {
        const sym = m[1].toUpperCase().trim();
        if (!symbols.includes(sym)) {
          symbols.push(sym);
          categoryMap.set(sym, cat);
        }
      }
      
      console.log(`Category ${cat}: ${symbols.length} symbols`);
      return { cat, symbols };
    });

    const results = await Promise.all(fetches);
    console.log(`Total: ${categoryMap.size} symbols with categories`);

    // Batch update by category (one update per category)
    let updated = 0;
    for (const { cat, symbols } of results) {
      if (symbols.length === 0) continue;
      
      // Update stock_fundamentals
      const { error: e1 } = await supabase
        .from("stock_fundamentals")
        .update({ category: cat })
        .in("symbol", symbols);
      
      // Update daily_stock_eod
      const { error: e2 } = await supabase
        .from("daily_stock_eod")
        .update({ category: cat })
        .in("symbol", symbols);

      if (!e1 && !e2) updated += symbols.length;
      else console.error(`Error updating cat ${cat}:`, e1?.message, e2?.message);
    }

    return new Response(
      JSON.stringify({ success: true, found: categoryMap.size, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
