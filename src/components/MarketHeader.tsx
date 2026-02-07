import { RefreshCw, TrendingUp, Clock, Activity, Zap, Star, Eye, Briefcase, BarChart3, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { MarketStatus, Stock } from "@/types/market";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StockSearch } from "./StockSearch";
import { useWatchlist } from "@/hooks/useWatchlist";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useUserRole } from "@/hooks/useUserRole";

interface MarketHeaderProps {
  status: MarketStatus;
  lastRefresh: Date;
  nextRefresh: number;
  isLoading: boolean;
  onRefresh: () => void;
  stocks?: Stock[];
  onStockSelect?: (stock: Stock) => void;
}

export function MarketHeader({
  status,
  lastRefresh,
  nextRefresh,
  isLoading,
  onRefresh,
  stocks = [],
  onStockSelect,
}: MarketHeaderProps) {
  const { watchlist } = useWatchlist();
  const { portfolio } = usePortfolio();
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();

  return (
    <header className="border-b border-border/50 bg-gradient-to-r from-card via-card to-card/80 px-2 py-2 sm:px-4 sm:py-3 md:px-6 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-2 sm:gap-3">
          {/* Top Row - Logo & Market Status */}
          <div className="flex items-center justify-between">
            {/* Left Section - Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/25">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                <div className="absolute -right-0.5 -top-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-500 ring-2 ring-card animate-pulse" />
              </div>
              <div>
                <h1 className="text-sm sm:text-lg md:text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  EDUINT Capital
                </h1>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-muted-foreground">
                  Live Exchange Data
                </p>
              </div>
            </div>

            {/* Right - Status & Refresh */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Refresh Info */}
              <div className="flex items-center gap-1 sm:gap-2 rounded-full bg-secondary/60 px-2 py-1 sm:px-3 sm:py-1.5 border border-border/50">
                <span className="text-[10px] sm:text-xs font-mono text-muted-foreground">{nextRefresh}s</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="h-5 w-5 sm:h-6 sm:w-6 rounded-full p-0"
                >
                  <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                </Button>
              </div>

              {/* Market Status Badge */}
              <div className={cn(
                "flex items-center gap-1 sm:gap-2 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 font-medium text-[10px] sm:text-xs transition-all duration-300",
                status.isOpen 
                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" 
                  : "bg-rose-500/15 text-rose-500 border border-rose-500/30"
              )}>
                <Activity className={cn(
                  "h-3 w-3 sm:h-4 sm:w-4",
                  status.isOpen && "animate-pulse"
                )} />
                <span>{status.isOpen ? "Open" : "Closed"}</span>
              </div>
            </div>
          </div>

          {/* Bottom Row - Search & Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* Search */}
            <StockSearch stocks={stocks} onStockSelect={onStockSelect} />

            {/* Navigation Links */}
            <Link to="/watchlist">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 h-8 sm:h-9 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
              >
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline sm:inline">Watchlist</span>
                {watchlist.length > 0 && (
                  <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px] sm:text-[10px] font-bold">
                    {watchlist.length}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/portfolio">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 h-8 sm:h-9 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
              >
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline sm:inline">Portfolio</span>
                {portfolio.length > 0 && (
                  <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[8px] sm:text-[10px] font-bold">
                    {portfolio.length}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/birds-eye">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 h-8 sm:h-9 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
              >
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline sm:inline">Bird's Eye</span>
              </Button>
            </Link>
            <Link to="/historical">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 h-8 sm:h-9 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
              >
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline sm:inline">Historical</span>
              </Button>
            </Link>
            {!isRoleLoading && isAdmin && (
              <Link to="/admin">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 h-8 sm:h-9 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline sm:inline">Admin</span>
                </Button>
              </Link>
            )}

            {/* Desktop Update Info */}
            <div className="hidden lg:flex items-center gap-3 rounded-full bg-secondary/60 px-4 py-1.5 border border-border/50 ml-auto">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {lastRefresh.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Zap className={cn(
                  "h-3.5 w-3.5",
                  nextRefresh <= 5 ? "text-primary animate-pulse" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs font-mono font-medium",
                  nextRefresh <= 5 ? "text-primary" : "text-muted-foreground"
                )}>
                  {nextRefresh}s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
