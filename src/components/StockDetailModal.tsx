import { TrendingUp, TrendingDown, Minus, BarChart3, Activity, DollarSign, ArrowUpDown, Building2, Tag, Loader2, Star, Newspaper, Calendar } from "lucide-react";
import { Stock } from "@/types/market";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMemo, useEffect, useState } from "react";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import { useStockNews } from "@/hooks/useStockNews";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HistoricalChart } from "@/components/watchlist/HistoricalChart";
import { useWatchlist } from "@/hooks/useWatchlist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockNews } from "@/types/market";

interface StockDetailModalProps {
  stock: Stock | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper components defined before main component to ensure they're available
function DetailCard({ 
  label, 
  value, 
  valueClass,
  icon
}: { 
  label: string; 
  value: string; 
  valueClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2 sm:p-3">
      <div className="flex items-center gap-1">
        {icon}
        <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={cn("font-mono text-xs sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1", valueClass)}>
        {value}
      </p>
    </div>
  );
}

function FundamentalCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
      <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-xs sm:text-sm font-semibold text-foreground mt-0.5 sm:mt-1 truncate", valueClass)}>
        {value}
      </p>
    </div>
  );
}

function NewsCard({ news, symbol }: { news: StockNews; symbol: string }) {
  return (
    <div className="rounded-lg border-b border-border bg-background py-3 last:border-b-0">
      {/* Symbol Title - Green colored like reference */}
      <h4 className="text-sm sm:text-base font-semibold text-primary mb-2">
        {news.title.startsWith(symbol) ? news.title : `${symbol}`}
        {news.title.includes(" - ") && (
          <span className="text-primary"> - {news.title.split(" - ").slice(1).join(" - ")}</span>
        )}
      </h4>
      
      {/* Full news content */}
      <p className="text-xs sm:text-sm text-foreground leading-relaxed mb-2">
        {news.summary || news.title}
      </p>
      
      {/* Date at the bottom */}
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        {news.publishedAt}
      </div>
    </div>
  );
}

export function StockDetailModal({ stock, isOpen, onClose }: StockDetailModalProps) {
  const { fundamentals, isLoading: loadingFundamentals, fetchFundamentals, clearFundamentals } = useStockFundamentals();
  const { news, isLoading: loadingNews, fetchNews, clearNews } = useStockNews();
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const [activeTab, setActiveTab] = useState("fundamentals");

  // Fetch fundamentals and news when modal opens
  useEffect(() => {
    if (isOpen && stock) {
      fetchFundamentals(stock.symbol);
      fetchNews(stock.symbol);
    } else {
      clearFundamentals();
      clearNews();
      setActiveTab("fundamentals");
    }
  }, [isOpen, stock?.symbol, fetchFundamentals, clearFundamentals, fetchNews, clearNews]);

  // Calculate day range position (0-100)
  const dayRangePosition = useMemo(() => {
    if (!stock) return 50;
    if (stock.high === stock.low) return 50;
    return Math.min(100, Math.max(0, ((stock.ltp - stock.low) / (stock.high - stock.low)) * 100));
  }, [stock?.ltp, stock?.high, stock?.low]);

  // Calculate volatility indicator
  const volatility = useMemo(() => {
    if (!stock || stock.previousClose === 0) return 0;
    return ((stock.high - stock.low) / stock.previousClose) * 100;
  }, [stock?.high, stock?.low, stock?.previousClose]);

  if (!stock) return null;

  const isPositive = stock.change > 0;
  const isNegative = stock.change < 0;
  const inWatchlist = isInWatchlist(stock.symbol);

  const formatNumber = (num: number) => num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return (volume / 1000000).toFixed(2) + "M";
    if (volume >= 1000) return (volume / 1000).toFixed(1) + "K";
    return volume.toLocaleString();
  };

  const formatValue = (valueMn: number) => {
    if (valueMn >= 1000) return (valueMn / 1000).toFixed(2) + "B";
    if (valueMn >= 1) return valueMn.toFixed(2) + "M";
    return (valueMn * 1000).toFixed(2) + "K";
  };

  const formatMarketCap = (cap?: number) => {
    if (!cap) return "—";
    if (cap >= 1000) return (cap / 1000).toFixed(2) + " B";
    return cap.toFixed(2) + " M";
  };

  const formatSharesCount = (shares?: number) => {
    if (!shares) return "—";
    if (shares >= 1_000_000_000) return (shares / 1_000_000_000).toFixed(2) + "B";
    if (shares >= 1_000_000) return (shares / 1_000_000).toFixed(2) + "M";
    if (shares >= 1_000) return (shares / 1_000).toFixed(2) + "K";
    return shares.toLocaleString();
  };

  const getPerformanceLabel = () => {
    if (stock.changePercent >= 5) return { label: "Strong Gainer", color: "text-price-up bg-success/20" };
    if (stock.changePercent >= 2) return { label: "Gainer", color: "text-price-up bg-success/10" };
    if (stock.changePercent <= -5) return { label: "Strong Loser", color: "text-price-down bg-destructive/20" };
    if (stock.changePercent <= -2) return { label: "Loser", color: "text-price-down bg-destructive/10" };
    return { label: "Stable", color: "text-price-neutral bg-muted" };
  };

  const performance = getPerformanceLabel();

  const getCategoryColor = (category?: string) => {
    switch (category?.toUpperCase()) {
      case "A": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "B": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "N": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Z": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const sector = fundamentals?.sector || stock.sector;
  const category = fundamentals?.category || stock.category;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-border bg-card sm:max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="text-lg sm:text-2xl font-bold text-foreground">{stock.symbol}</span>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-sm font-medium",
                    isPositive && "bg-success/10 text-price-up",
                    isNegative && "bg-destructive/10 text-price-down",
                    !isPositive && !isNegative && "bg-muted text-price-neutral"
                  )}
                >
                  {isPositive && <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />}
                  {isNegative && <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                  {!isPositive && !isNegative && <Minus className="h-3 w-3 sm:h-4 sm:w-4" />}
                  {isPositive && "+"}
                  {stock.changePercent.toFixed(2)}%
                </span>
              </DialogTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{stock.name}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleWatchlist(stock.symbol)}
              className={cn(
                "gap-1 text-xs sm:text-sm h-7 sm:h-8 px-2 sm:px-3 shrink-0",
                inWatchlist && "text-yellow-500 border-yellow-500/50 hover:text-yellow-500"
              )}
            >
              <Star className={cn("h-3 w-3 sm:h-4 sm:w-4", inWatchlist && "fill-yellow-500")} />
              <span className="hidden xs:inline">{inWatchlist ? "In Watchlist" : "Add to Watchlist"}</span>
              <span className="xs:hidden">{inWatchlist ? "Saved" : "Add"}</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Performance Badge & Tags */}
          <div className="flex items-center justify-between flex-wrap gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {sector && (
                <Badge variant="outline" className="flex items-center gap-1 text-[10px] sm:text-xs bg-muted/50 px-1.5 sm:px-2 py-0.5">
                  <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {sector}
                </Badge>
              )}
              {category && (
                <Badge variant="outline" className={cn("flex items-center gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5", getCategoryColor(category))}>
                  <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Category {category}
                </Badge>
              )}
            </div>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-medium", performance.color)}>
              {performance.label}
            </span>
          </div>

          {/* Price Section */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
            <div className="rounded-lg bg-muted/50 p-3 sm:p-4 flex-1">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Last Traded Price</p>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-bold text-foreground">
                  ৳{formatNumber(stock.ltp)}
                </span>
                <span
                  className={cn(
                    "font-mono text-base sm:text-lg font-semibold",
                    isPositive && "text-price-up",
                    isNegative && "text-price-down",
                    !isPositive && !isNegative && "text-price-neutral"
                  )}
                >
                  {isPositive && "+"}
                  {formatNumber(stock.change)}
                </span>
              </div>
            </div>

            {/* Trading Stats */}
            <div className="grid grid-cols-2 sm:block gap-x-4 gap-y-1 text-xs sm:text-sm sm:text-right sm:space-y-1">
              <div className="flex justify-between sm:gap-4">
                <span className="text-muted-foreground">Open:</span>
                <span className="font-mono">৳{formatNumber(stock.open)}</span>
              </div>
              <div className="flex justify-between sm:gap-4">
                <span className="text-muted-foreground">High:</span>
                <span className="font-mono text-price-up">৳{formatNumber(stock.high)}</span>
              </div>
              <div className="flex justify-between sm:gap-4">
                <span className="text-muted-foreground">Low:</span>
                <span className="font-mono text-price-down">৳{formatNumber(stock.low)}</span>
              </div>
              <div className="flex justify-between sm:gap-4">
                <span className="text-muted-foreground">Prev Close:</span>
                <span className="font-mono">৳{formatNumber(stock.previousClose)}</span>
              </div>
            </div>
          </div>

          {/* Day Range Visual */}
          <div className="space-y-1.5 sm:space-y-2 rounded-lg border border-border bg-background p-2 sm:p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">Day Range</p>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Volatility: <span className="font-mono font-medium text-foreground">{volatility.toFixed(2)}%</span>
              </span>
            </div>
            <div className="relative h-2.5 sm:h-3 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 overflow-hidden">
              <div
                className="absolute top-1/2 h-4 sm:h-5 w-1 sm:w-1.5 -translate-y-1/2 rounded-full bg-white shadow-lg border border-gray-300 transition-all duration-300"
                style={{ left: `calc(${dayRangePosition}% - 3px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] sm:text-xs">
              <span className="font-mono text-price-down">৳{formatNumber(stock.low)}</span>
              <span className="text-muted-foreground">Current: ৳{formatNumber(stock.ltp)}</span>
              <span className="font-mono text-price-up">৳{formatNumber(stock.high)}</span>
            </div>
          </div>

          <Separator />

          {/* Historical Chart */}
          <HistoricalChart stock={stock} />

          <Separator />

          {/* Trading Analytics */}
          <div>
            <h3 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3 uppercase tracking-wider text-muted-foreground">Trading Activity</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <DetailCard 
                label="Volume" 
                value={formatVolume(stock.volume)}
                icon={<BarChart3 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-400" />}
              />
              <DetailCard 
                label="Trades" 
                value={stock.trade.toLocaleString()}
                icon={<Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-purple-400" />}
              />
              <DetailCard 
                label="Value (Mn)" 
                value={formatValue(stock.valueMn)}
                icon={<DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-400" />}
              />
              <DetailCard 
                label="Change %" 
                value={`${isPositive ? "+" : ""}${stock.changePercent.toFixed(2)}%`}
                valueClass={cn(isPositive && "text-price-up", isNegative && "text-price-down")}
                icon={<ArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary" />}
              />
            </div>
          </div>

          <Separator />

          {/* Tabs for Fundamentals and News */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="fundamentals" className="text-xs sm:text-sm gap-1.5">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                Fundamentals
              </TabsTrigger>
              <TabsTrigger value="news" className="text-xs sm:text-sm gap-1.5">
                <Newspaper className="h-3 w-3 sm:h-4 sm:w-4" />
                News
              </TabsTrigger>
            </TabsList>

            {/* Fundamentals Tab */}
            <TabsContent value="fundamentals" className="mt-0">
              <div>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fundamentals</h3>
                  {loadingFundamentals && <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />}
                </div>
                
                {loadingFundamentals ? (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="animate-pulse rounded-lg bg-muted/50 p-2 sm:p-3">
                        <div className="h-2.5 w-10 bg-muted rounded mb-1.5"></div>
                        <div className="h-4 w-14 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : fundamentals ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <FundamentalCard label="Market Cap" value={formatMarketCap(fundamentals.marketCap)} />
                    <FundamentalCard label="Shares" value={fundamentals.totalShares ? formatSharesCount(fundamentals.totalShares) : "—"} />
                    <FundamentalCard label="52W High" value={fundamentals.yearHigh ? `৳${formatNumber(fundamentals.yearHigh)}` : "—"} valueClass="text-price-up" />
                    <FundamentalCard label="52W Low" value={fundamentals.yearLow ? `৳${formatNumber(fundamentals.yearLow)}` : "—"} valueClass="text-price-down" />
                    <FundamentalCard label="P/E Ratio" value={fundamentals.pe ? fundamentals.pe.toFixed(2) : "—"} />
                    <FundamentalCard label="EPS" value={fundamentals.eps ? `৳${fundamentals.eps.toFixed(2)}` : "—"} valueClass={fundamentals.eps ? (fundamentals.eps < 0 ? "text-price-down" : fundamentals.eps > 0 ? "text-price-up" : "") : ""} />
                    <FundamentalCard label="NAV" value={fundamentals.nav ? `৳${fundamentals.nav.toFixed(2)}` : "—"} />
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">Fundamental data unavailable</p>
                )}
              </div>
            </TabsContent>

            {/* News Tab */}
            <TabsContent value="news" className="mt-0">
              <div>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest News & Announcements</h3>
                  {loadingNews && <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin text-muted-foreground" />}
                </div>
                
                {loadingNews ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse rounded-lg bg-muted/50 p-3">
                        <div className="h-3 w-3/4 bg-muted rounded mb-2"></div>
                        <div className="h-2 w-1/2 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : news && news.length > 0 ? (
                  <div className="divide-y divide-border max-h-[350px] overflow-y-auto pr-1">
                    {news.map((item, index) => (
                      <NewsCard key={index} news={item} symbol={stock.symbol} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">No news available</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
