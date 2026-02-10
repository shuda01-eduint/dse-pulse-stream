import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RawStockData {
  symbol: string;
  name: string;
  sector: string;
  category: string;
  ltp: number;
  high: number;
  low: number;
  closep: number;
  ycp: number;
  rawChange: number;
  trade: number;
  valueMn: number;
  volume: number;
}

interface StockData {
  symbol: string;
  name: string;
  sector: string;
  category: string;
  ltp: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  closep: number;
  ycp: number;
  trade: number;
  valueMn: number;
}

type Cached<T> = { data: T; fetchedAt: number };

const CACHE_TTL_MS = 60_000;
let cachedMarket: Cached<{ rawStocks: RawStockData[]; timestampText?: string; dsexIndex?: { value: number; change: number; changePercent: number } | null }> | null = null;

function stripCommas(s: string) { return s.replace(/,/g, "").trim(); }
function decodeHtmlEntities(input: string) {
  return input.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
function parseNumber(text: string): number {
  const cleaned = stripCommas(text);
  if (!cleaned || cleaned === "--") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function parseIntNumber(text: string): number {
  const cleaned = stripCommas(text);
  if (!cleaned || cleaned === "--") return 0;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

// Delay helper for retry backoff
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch with exponential backoff retry
async function fetchWithRetry(
  url: string, 
  maxRetries: number = 3, 
  baseDelayMs: number = 1000
): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoffDelay = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 500;
        const totalDelay = backoffDelay + jitter;
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${Math.round(totalDelay)}ms delay`);
        await delay(totalDelay);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.5",
          "cache-control": "no-cache",
        },
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const text = await res.text();
      console.log(`Fetched HTML successfully (${text.length} chars) on attempt ${attempt + 1}`);
      return text;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = 
        lastError.message.includes("abort") ||
        lastError.message.includes("timeout") ||
        lastError.message.includes("network") ||
        lastError.message.includes("HTTP 5") ||
        lastError.message.includes("HTTP 429");
      
      console.warn(`Fetch attempt ${attempt + 1} failed: ${lastError.message}`);
      
      if (!isRetryable || attempt === maxRetries) {
        console.error(`All ${maxRetries + 1} fetch attempts failed for ${url}`);
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error("Fetch failed after retries");
}

// Pattern-based sector detection
function getSectorFromSymbol(symbol: string): string {
  const sym = symbol.toUpperCase();
  
  if (/BANK|BRACK|NRBC|SBAC|CITY|JAMUNA|MERCAN|SHAHJ|SIBL|SOUTHEAST|STANDB|TRUST|UCBL|UTTARA|PUBALI|RUPALI|PRIME|NBL|NCC|EXIM|EBL|IFIC|ISLAMI|DHAKA|ALARM|ASIAB|FIRST|PADMA|MIDLAND|COMMUN|ALARM|SONARBANG/i.test(sym) && !/MF|FUND/i.test(sym)) return "Bank";
  if (/CEMENT|LAFARG|HEIDEL|PREMIER|CONFID|SHYAM|MICEM|KPCL/i.test(sym)) return "Cement";
  if (/CERAMIC|MONNO|RAKCER|SINO|FUWANG|STDCER/i.test(sym)) return "Ceramics Sector";
  if (/PHARMA|DRUG|ACME|SQUR|RENATA|IBNSINA|ORION|GLAXO|BXPHARMA|ESKAYEF|BEACON|LIBROP|MARICO|NAVANA|SANOFI|RECKITT|FORMULA|ACIFORMULA/i.test(sym)) return "Pharmaceuticals & Chemicals";
  if (/INSUR|DELTALIFE|DHAKALIFE|EASTERNINS|EASTLANDINS|FAREASTLIF|FIDELITY|GLOBALINS|GREENDELT|JANATALIFE|KARNAPH|MEGHNALIFE|MERCANINS|NATIONALIF|NITOLINS|PARAMOUNT|PEOPLESINS|PHOENIXINS|PIONEERINS|POPULARLIF|PRAGATILIF|PRIMEINS|PROGRELIFE|RELIANCEINS|REPUBLICINS|RUPALIINS|SANDHANINS|SENAKALYAN|SONARLIFE|STANDINS|SUNLIFEINS|UNIONINS|BGIC|AGRANINS|ASIAINS|CENTRALNSC|CONTININS/i.test(sym)) return "Insurance";
  if (/FINANCE|LEASING|IDLC|IPDC|ISLAMICFIN|LANKABD|MIDAS|NHFIL|PLFSL|PREMF|UNILEAS|DBH|FIRSTFIN|GSP|BIFC|BDFINANCE|FAREASTFIN|ILFSL|ICBAMCL/i.test(sym)) return "Financial Institutions";
  if (/POWER|ENERGY|DESCO|DPDC|TITASGAS|OIL|PETRO|LINDE|SUMMIT|BARAKA|UPGDCL|SPCL|BGDCL/i.test(sym)) return "Fuel & Power";
  if (/STEEL|BSRM|GPHI|KSRM|RSRM|WALTON|SINGER|RUNNER|NAVANA|QUASEM|AZIZPIPES|AFTAB|BDAUTO|BATASHOE|LHBL|OLYMPIC|MJLBD|MAXGEN|KAY.?QUE|KDSLTD/i.test(sym)) return "Engineering";
  if (/TEX|YARN|SPIN|WEAV|DENIM|COTTON|GARMENT|CRESCENT|ENVOY|FAMILY|MAKSONS|MATIN|METRO|MONNOSTAF|PRIMETEX|RAHIM|SAFKO|SAMOR|SHEEP|SQUARETEXT|STYLE|TALLUS|TOKYO|ZAHEEN|ZAFAR|ALHAJ|ANLIMA|APEX|BEXTEX|CMC|CVOPRL|DESHBANDHU|DULAMI|FEKDIL|FOKDIL|GENNEXT|GENERATION|HAMID|HMTEX|HWA|MITHUN|NURANI|SIMTEX|SONARGAON/i.test(sym)) return "Textile";
  if (/FOOD|DAIRY|SUGAR|AGRO|AMCL|APEXFOODS|BATBC|BENGALBISC|FINEFOODS|GEMINI|IFAD|KOHINOOR|MEGHNA|NATFOOD|RAHIMA|SILCO|ACIFL|BSCCL/i.test(sym)) return "Food & Allied";
  if (/1ST|MF$|ICB|GRAMEEN|POPULAR1|RELIANCE1|SEBL1|TRUST.*MF|JANATAMF|PRIMFMF|ABB1|AIBL1|CAPM|DBH1|EBL1|EXIMBK|FBFIF|GREENDEL|IFIC1|LRGLOB|MBL1|NCCBL|NLI1|PF1|PHPMF|PRIME1|SEMLLE/i.test(sym)) return "Mutual Funds";
  if (/TECH|SOFTWARE|COMPUTER|DIGITAL|AAMRA|BDCOM|BRACIT|DAFFODIL|DATASOFT|GENEXIL|INFO|ISLAAMI|LRGLOBAL|SQLTC|ADNTEL/i.test(sym) && !/MF|FUND/i.test(sym)) return "IT Sector";
  if (/^GP$|TELECOM|ROBI|BANGLALINK|TELETALK/i.test(sym)) return "Telecommunication";
  if (/JUTE|SONALIPAPR|BJMC|JUTESPINN/i.test(sym)) return "Jute";
  if (/LEATHER|TANNERY|APEXTAN|BATABD|LEGACY|SAMATALETH|FORTUNE/i.test(sym)) return "Tannery Industries";
  if (/PAPER|PRINT|KPPL|HRTEX/i.test(sym)) return "Paper & Printing";
  if (/HOTEL|TRAVEL|RESORT|TOURISM|UNIQUEHOT/i.test(sym)) return "Travel & Leisure";
  if (/ESTATE|PROPERTY|BDTHAI|ECABLES|EASTERNHOUS|EMERALD/i.test(sym)) return "Services & Real Estate";
  if (/^ACI$/i.test(sym)) return "Pharmaceuticals & Chemicals";
  if (/BEXIMCO|ACTIVEFINE|BDLAMPS|MEGCONMIL|NAHEE|NTLTUBES|RANGPUR/i.test(sym)) return "Miscellaneous";
  
  return "Others";
}

interface IndexData {
  value: number;
  change: number;
  changePercent: number;
}

function extractTimestampTextFromMarketPage(html: string): string | undefined {
  const m = html.match(/<h2[^>]*class="BodyHead topBodyHead"[^>]*>([\s\S]*?)<\/h2>/i);
  if (!m) return undefined;
  return decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

async function fetchDSEXIndex(): Promise<IndexData | null> {
  try {
    const html = await fetchWithRetry("https://www.dsebd.org", 2, 500);
    // Find the DSEX row: <div class="m_col-1">DSE<font size="+1">X</font> Index</div>
    const dsexMatch = html.match(
      /DSE<font[^>]*>X<\/font>\s*Index<\/div>\s*<div[^>]*>\s*([\d.,]+)\s*<\/div>\s*<div[^>]*>\s*([-\d.,]+)\s*<\/div>\s*<div[^>]*>\s*([-\d.,]+)%/i
    );
    if (dsexMatch) {
      return {
        value: parseNumber(dsexMatch[1]),
        change: parseNumber(dsexMatch[2]),
        changePercent: parseNumber(dsexMatch[3]),
      };
    }
    return null;
  } catch (e) {
    console.warn("Failed to fetch DSEX index:", e);
    return null;
  }
}

function parseMarketStocks(html: string): RawStockData[] {
  const rows: RawStockData[] = [];
  
  // Try multiple table patterns
  const trBlocks = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  console.log(`Found ${trBlocks.length} table rows in HTML`);
  
  let validRowCount = 0;
  for (const tr of trBlocks) {
    if (!tr.includes("displayCompany.php?name=")) continue;
    validRowCount++;
    
    const codeMatch = tr.match(/displayCompany\.php\?name=([^"&]+)[^>]*>([^<]*)</i);
    if (!codeMatch) continue;
    const symbol = decodeHtmlEntities(codeMatch[2] || codeMatch[1] || "").trim();
    if (!symbol) continue;
    const tdMatches = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi));
    const tdTexts = tdMatches.map((x) => decodeHtmlEntities(x[1].replace(/<[^>]+>/g, "").trim()));
    if (tdTexts.length < 11) continue;
    const firstCell = tdTexts[0].toLowerCase();
    if (firstCell.includes("#") || firstCell.includes("sl") || firstCell.includes("trading")) continue;
    const ltp = parseNumber(tdTexts[2]);
    const high = parseNumber(tdTexts[3]);
    const low = parseNumber(tdTexts[4]);
    const closep = parseNumber(tdTexts[5]);
    const ycp = parseNumber(tdTexts[6]);
    const rawChange = parseNumber(tdTexts[7]);
    const trade = parseIntNumber(tdTexts[8]);
    const valueMn = parseNumber(tdTexts[9]);
    const volume = parseIntNumber(tdTexts[10]);
    if (ltp === 0 && high === 0 && low === 0) continue;
    
    rows.push({ symbol, name: symbol, sector: getSectorFromSymbol(symbol), category: "", ltp, high, low, closep, ycp, rawChange, trade, valueMn, volume });
  }
  
  console.log(`Parsed ${rows.length} stocks from ${validRowCount} valid rows`);
  return rows;
}

function computeStockData(raw: RawStockData, marketOpen: boolean): StockData {
  const basePrice = marketOpen ? raw.ltp : raw.closep;
  const change = basePrice - raw.ycp;
  const changePercent = raw.ycp !== 0 ? (change / raw.ycp) * 100 : 0;
  return { symbol: raw.symbol, name: raw.name, sector: raw.sector, category: raw.category, ltp: raw.ltp, change: Math.round(change * 100) / 100, changePercent: Number.isFinite(changePercent) ? Math.round(changePercent * 100) / 100 : 0, volume: raw.volume, high: raw.high, low: raw.low, closep: raw.closep, ycp: raw.ycp, trade: raw.trade, valueMn: raw.valueMn };
}

function isMarketOpen(): boolean {
  const now = new Date();
  const bdTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  const day = bdTime.getDay();
  const currentMinutes = bdTime.getHours() * 60 + bdTime.getMinutes();
  return day >= 0 && day <= 4 && currentMinutes >= 600 && currentMinutes <= 870;
}

// Fallback mock data when DSE website is unavailable
function generateFallbackData(): RawStockData[] {
  const symbols = [
    "BRACBANK", "CITYBANK", "SQURPHARMA", "BEXIMCO", "GP", "RENATA", "BXPHARMA", 
    "WALTON", "BATBC", "BERGERPBL", "SUMITPOWER", "LHBL", "UPGDCL", "MARICO", 
    "OLYMPIC", "ICB", "EBL", "PUBALIBANK", "DUTCHBANGL", "ISLAMIBANK",
    "ACMELAB", "POWERGRID", "ROBI", "GRAMEENPHONE", "IDLC", "IPDC", "DELTA",
    "PRIMEBANK", "UTTARABANK", "BANKASIA", "SIBL", "FIRSTSEC", "LANKABAFIN"
  ];
  
  return symbols.map(symbol => {
    const basePrice = 50 + Math.random() * 200;
    const change = (Math.random() - 0.5) * 10;
    return {
      symbol,
      name: symbol,
      sector: getSectorFromSymbol(symbol),
      category: "",
      ltp: Math.round((basePrice + change) * 100) / 100,
      high: Math.round((basePrice + Math.abs(change) + 2) * 100) / 100,
      low: Math.round((basePrice - Math.abs(change) - 2) * 100) / 100,
      closep: Math.round(basePrice * 100) / 100,
      ycp: Math.round(basePrice * 100) / 100,
      rawChange: Math.round(change * 100) / 100,
      trade: Math.floor(Math.random() * 5000) + 100,
      valueMn: Math.round(Math.random() * 100 * 100) / 100,
      volume: Math.floor(Math.random() * 500000) + 10000
    };
  });
}

async function getRawMarketSnapshot(): Promise<{ rawStocks: RawStockData[]; timestampText?: string; dsexIndex?: IndexData | null }> {
  const now = Date.now();
  if (cachedMarket && now - cachedMarket.fetchedAt < CACHE_TTL_MS) return cachedMarket.data;
  
  try {
    const [marketHtml, dsexIndex] = await Promise.all([
      fetchWithRetry("https://www.dsebd.org/latest_share_price_scroll_by_ltp.php", 3, 1000),
      fetchDSEXIndex(),
    ]);
    const timestampText = extractTimestampTextFromMarketPage(marketHtml);
    const rawStocks = parseMarketStocks(marketHtml);
    
    if (rawStocks.length === 0) {
      console.warn("No stocks parsed from DSE website, using fallback data");
      const fallbackStocks = generateFallbackData();
      const data = { rawStocks: fallbackStocks, timestampText: "Demo Data - DSE Unavailable", dsexIndex };
      cachedMarket = { data, fetchedAt: now };
      return data;
    }
    
    const data = { rawStocks, timestampText, dsexIndex };
    cachedMarket = { data, fetchedAt: now };
    return data;
  } catch (error) {
    console.error("Error fetching from DSE, using fallback:", error);
    const fallbackStocks = generateFallbackData();
    const data = { rawStocks: fallbackStocks, timestampText: "Demo Data - DSE Unavailable", dsexIndex: null };
    cachedMarket = { data, fetchedAt: now };
    return data;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let stockCode = url.searchParams.get("code") || undefined;
    if (!stockCode && req.method !== "GET") { try { const body = await req.json(); if (body?.code) stockCode = body.code; } catch {} }
    console.log(`Market data request - code: ${stockCode || "all"}`);
    const { rawStocks, timestampText, dsexIndex } = await getRawMarketSnapshot();
    const marketOpen = isMarketOpen();
    const stocks = rawStocks.map((raw) => computeStockData(raw, marketOpen));
    if (stockCode) {
      const stock = stocks.find((s) => s.symbol.toUpperCase() === stockCode!.toUpperCase());
      if (!stock) return new Response(JSON.stringify({ error: "Stock not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ data: stock, marketOpen, timestamp: new Date().toISOString(), sourceTimestampText: timestampText, dsexIndex }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sortedStocks = [...stocks].sort((a, b) => a.symbol.localeCompare(b.symbol));
    return new Response(JSON.stringify({ data: sortedStocks, marketOpen, timestamp: new Date().toISOString(), sourceTimestampText: timestampText, count: sortedStocks.length, dsexIndex }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in market-data function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
