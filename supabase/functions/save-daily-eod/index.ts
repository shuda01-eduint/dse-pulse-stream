import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getTodayDateBD(): string {
  const now = new Date();
  const bdTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return `${bdTime.getFullYear()}-${String(bdTime.getMonth() + 1).padStart(2, "0")}-${String(bdTime.getDate()).padStart(2, "0")}`;
}

function isTradingDay(): boolean {
  const now = new Date();
  const bdTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  const day = bdTime.getDay();
  return day >= 0 && day <= 4; // Sun-Thu
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!isTradingDay()) {
      return new Response(
        JSON.stringify({ success: true, message: "Not a trading day", saved: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch market data
    const marketRes = await fetch(`${supabaseUrl}/functions/v1/market-data`, {
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        "Content-Type": "application/json",
      },
    });

    if (!marketRes.ok) throw new Error(`Market data fetch failed: ${marketRes.status}`);
    const marketData = await marketRes.json();
    const stocks = marketData.data || [];

    if (stocks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No stock data", saved: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch fundamentals from DB for total_shares, category, sector
    const { data: fundamentals } = await supabase
      .from("stock_fundamentals")
      .select("symbol, total_shares, category, sector");

    const fundMap = new Map<string, { total_shares: number | null; category: string | null; sector: string | null }>();
    if (fundamentals) {
      for (const f of fundamentals) {
        fundMap.set(f.symbol.toUpperCase().trim(), {
          total_shares: f.total_shares,
          category: f.category,
          sector: f.sector,
        });
      }
    }

    const todayDate = getTodayDateBD();
    const records = stocks
      .filter((s: any) => s.symbol && s.ltp > 0)
      .map((s: any) => {
        const sym = s.symbol.toUpperCase().trim();
        const fund = fundMap.get(sym);
        return {
          symbol: sym,
          date: todayDate,
          close: Math.round(s.ltp * 10) / 10,
          volume: Math.max(0, Math.floor(s.volume || 0)),
          total_shares: fund?.total_shares ?? null,
          category: fund?.category ?? null,
          sector: fund?.sector ?? null,
        };
      });

    const { error } = await supabase
      .from("daily_stock_eod")
      .upsert(records, { onConflict: "symbol,date", ignoreDuplicates: false });

    if (error) throw new Error(error.message);

    console.log(`Saved ${records.length} EOD records for ${todayDate}`);
    return new Response(
      JSON.stringify({ success: true, saved: records.length, date: todayDate }),
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
