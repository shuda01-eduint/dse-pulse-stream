import { useState, useMemo } from "react";
import { Stock } from "@/types/market";
import { useStockHistory, Timeframe, HistoricalDataPoint } from "@/hooks/useStockHistory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, TrendingDown, Download } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";

interface HistoricalChartProps {
  stock: Stock;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "10Y", label: "10Y" },
  { value: "Max", label: "Max" },
];

export function HistoricalChart({ stock }: HistoricalChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");

  const { data, isLoading, error, source } = useStockHistory({
    symbol: stock.symbol,
    timeframe,
    currentPrice: stock.ltp,
    highPrice: stock.high,
    lowPrice: stock.low,
    volume: stock.volume,
  });

  // Calculate chart metrics
  const chartMetrics = useMemo(() => {
    if (data.length < 2) return null;

    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    const change = lastPrice - firstPrice;
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
    const minPrice = Math.min(...data.map((d) => d.low));
    const maxPrice = Math.max(...data.map((d) => d.high));
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;

    return {
      change,
      changePercent,
      minPrice,
      maxPrice,
      avgVolume,
      isPositive: change >= 0,
    };
  }, [data]);

  // CSV download handler
  const handleDownloadCSV = () => {
    if (data.length === 0) return;

    const headers = ["Date", "Open", "High", "Low", "Close", "Volume"];
    const rows = data.map((point) => {
      const date = new Date(point.date).toISOString().split("T")[0];
      return [date, point.open, point.high, point.low, point.close, point.volume].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${stock.symbol}_historical_${timeframe}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format chart data
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      displayDate: formatDate(point.date, timeframe),
    }));
  }, [data, timeframe]);

  const isPositive = chartMetrics?.isPositive ?? stock.changePercent >= 0;
  const strokeColor = isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))";
  const fillColor = isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {stock.symbol} Price History
              {chartMetrics && (
                <span
                  className={cn(
                    "text-sm font-normal flex items-center gap-1",
                    chartMetrics.isPositive ? "text-success" : "text-destructive"
                  )}
                >
                  {chartMetrics.isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {chartMetrics.isPositive ? "+" : ""}
                  {chartMetrics.changePercent.toFixed(2)}%
                </span>
              )}
            </CardTitle>
            {source === "simulated" && !isLoading && (
              <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">
                Simulated Data
              </Badge>
            )}
            {(source === "dse" || source === "database") && !isLoading && (
              <Badge variant="outline" className="text-xs text-success border-success/30">
                {source === "database" ? "Database" : "Live DSE"}
              </Badge>
            )}
            {!isLoading && data.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleDownloadCSV}
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
            )}
          </div>

          {/* Timeframe Selector */}
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <Button
                key={tf.value}
                variant={timeframe === tf.value ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setTimeframe(tf.value)}
              >
                {tf.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>Failed to load chart data</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`gradient-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={fillColor} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `৳${value}`}
                    width={60}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
                  />
                  {stock.previousClose > 0 && (
                    <ReferenceLine
                      y={stock.previousClose}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                      label={{
                        value: "Prev Close",
                        position: "right",
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={strokeColor}
                    strokeWidth={2}
                    fill={`url(#gradient-${stock.symbol})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stats Row */}
            {chartMetrics && (
              <div className="grid grid-cols-4 gap-4 mt-4 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Period Change</p>
                  <p
                    className={cn(
                      "font-semibold",
                      chartMetrics.isPositive ? "text-success" : "text-destructive"
                    )}
                  >
                    {chartMetrics.isPositive ? "+" : ""}৳{chartMetrics.change.toFixed(2)}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Period High</p>
                  <p className="font-semibold">৳{chartMetrics.maxPrice.toFixed(2)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Period Low</p>
                  <p className="font-semibold">৳{chartMetrics.minPrice.toFixed(2)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Avg Volume</p>
                  <p className="font-semibold">{formatVolume(chartMetrics.avgVolume)}</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string, timeframe: Timeframe): string {
  const date = new Date(dateStr);
  
  if (timeframe === "1D") {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }
  
  if (timeframe === "1W" || timeframe === "1M") {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(0)}K`;
  return volume.toFixed(0);
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  const data: HistoricalDataPoint & { displayDate: string } = payload[0].payload;

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-2">{data.displayDate}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Open:</span>
        <span className="font-mono">৳{data.open.toFixed(2)}</span>
        <span className="text-muted-foreground">High:</span>
        <span className="font-mono">৳{data.high.toFixed(2)}</span>
        <span className="text-muted-foreground">Low:</span>
        <span className="font-mono">৳{data.low.toFixed(2)}</span>
        <span className="text-muted-foreground">Close:</span>
        <span className="font-mono font-semibold">৳{data.close.toFixed(2)}</span>
        <span className="text-muted-foreground">Volume:</span>
        <span className="font-mono">{formatVolume(data.volume)}</span>
      </div>
    </div>
  );
}
