import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("STOCK_API_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const date = url.searchParams.get("date"); // optional: specific date
    const symbol = url.searchParams.get("symbol"); // optional: specific symbol
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "5000"), 10000);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("daily_stock_eod")
      .select("symbol, date, close, volume, total_shares, category, sector, pe")
      .order("date", { ascending: false })
      .limit(limit);

    if (date) query = query.eq("date", date);
    if (symbol) query = query.eq("symbol", symbol.toUpperCase().trim());

    // If no date specified, get latest date's data
    if (!date && !symbol) {
      const { data: latest } = await supabase
        .from("daily_stock_eod")
        .select("date")
        .order("date", { ascending: false })
        .limit(1);
      if (latest?.length) {
        query = query.eq("date", latest[0].date);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true, count: data?.length || 0, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
