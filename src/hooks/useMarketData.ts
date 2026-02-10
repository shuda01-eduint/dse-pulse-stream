import { useState, useEffect, useCallback } from "react";
import { Stock, MarketStatus } from "@/types/market";
import { supabase } from "@/integrations/supabase/client";

const REFRESH_INTERVAL = 30000; // 30 seconds

export interface DSEXIndex {
  value: number;
  change: number;
  changePercent: number;
}

export function useMarketData() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [dsexIndex, setDsexIndex] = useState<DSEXIndex | null>(null);
  const [status, setStatus] = useState<MarketStatus>({
    isOpen: false,
    lastUpdated: new Date(),
    message: "Loading...",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [nextRefresh, setNextRefresh] = useState<number>(REFRESH_INTERVAL / 1000);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('market-data');
      
      if (invokeError) {
        throw new Error(invokeError.message);
      }
      
      if (data && data.data) {
        // Transform API response to match Stock type
        const transformedStocks: Stock[] = data.data.map((stock: any) => ({
          symbol: stock.symbol,
          name: stock.name,
          ltp: Number(stock.ltp) || 0,
          change: Number(stock.change) || 0,
          changePercent: Number(stock.changePercent) || 0,
          volume: Number(stock.volume) || 0,
          high: Number(stock.high) || 0,
          low: Number(stock.low) || 0,
          // DSE fields: CLOSEP and YCP
          open: Number(stock.closep ?? stock.open) || 0,
          previousClose: Number(stock.ycp ?? stock.previousClose) || 0,
          valueMn: Number(stock.valueMn) || 0,
          trade: Number(stock.trade) || 0,
          // New fields
          sector: stock.sector || "",
          category: stock.category || "",
        }));

        setStocks(transformedStocks);

        if (data.dsexIndex) {
          setDsexIndex(data.dsexIndex);
        }

        const isOpen = data.marketOpen;
        setStatus({
          isOpen,
          lastUpdated: new Date(data.timestamp),
          message: isOpen ? "Market is Open" : "Market is Closed",
        });
      }
      
      setLastRefresh(new Date());
      setNextRefresh(REFRESH_INTERVAL / 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch market data";
      setError(`${errorMessage}. Retrying...`);
      console.error("Market data fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh countdown
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setNextRefresh(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, []);

  // Auto-refresh data
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL);

    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    stocks,
    dsexIndex,
    status,
    isLoading,
    error,
    lastRefresh,
    nextRefresh,
    refresh,
  };
}
