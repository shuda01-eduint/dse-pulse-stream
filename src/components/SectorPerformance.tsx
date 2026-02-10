import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Stock } from "@/types/market";
import { 
  SECTOR_COLORS, 
  formatValue,
  SectorData 
} from "@/lib/sectorUtils";

interface SectorPerformanceProps {
  stocks: Stock[];
}

export function SectorPerformance({ stocks }: SectorPerformanceProps) {
  const { barData, sectorSummary } = useMemo(() => {
    const sectors: Record<string, { 
      value: number; 
      stocks: Stock[];
      categoryValues: Record<string, number>;
    }> = {};

    stocks.forEach(stock => {
      const sector = stock.sector?.trim() || "Others";
      const category = stock.category?.trim() || "N";
      if (!sectors[sector]) {
        sectors[sector] = { value: 0, stocks: [], categoryValues: {} };
      }
      sectors[sector].value += stock.valueMn;
      sectors[sector].stocks.push(stock);
      sectors[sector].categoryValues[category] = (sectors[sector].categoryValues[category] || 0) + stock.valueMn;
    });

    const summary = Object.entries(sectors)
      .map(([name, data]) => {
        const advancers = data.stocks.filter(s => s.change > 0).length;
        const decliners = data.stocks.filter(s => s.change < 0).length;
        const unchanged = data.stocks.filter(s => s.change === 0).length;
        const avgChange = data.stocks.length > 0 
          ? data.stocks.reduce((sum, s) => sum + s.changePercent, 0) / data.stocks.length
          : 0;
        
        return {
          name,
          value: data.value,
          stockCount: data.stocks.length,
          advancers,
          decliners,
          unchanged,
          avgChange,
          A: data.categoryValues["A"] || 0,
          B: data.categoryValues["B"] || 0,
          N: data.categoryValues["N"] || 0,
          Z: data.categoryValues["Z"] || 0,
        };
      })
      .sort((a, b) => b.value - a.value);

    return { barData: summary, sectorSummary: summary };
  }, [stocks]);

  const totalValue = barData.reduce((sum, s) => sum + s.value, 0);

  const CATEGORY_COLORS: Record<string, string> = {
    A: "hsl(142, 71%, 45%)",
    B: "hsl(271, 81%, 56%)",
    N: "hsl(217, 91%, 55%)",
    Z: "hsl(0, 84%, 55%)",
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sector = sectorSummary.find(s => s.name === label);
      if (!sector) return null;
      const percentage = totalValue > 0 ? ((sector.value / totalValue) * 100).toFixed(1) : "0";
      
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="font-semibold text-foreground">{label}</p>
          <div className="mt-2 space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Value: </span>
              <span className="font-mono font-semibold">{formatValue(sector.value)} Tk ({percentage}%)</span>
            </p>
            <p>
              <span className="text-muted-foreground">Stocks: </span>
              <span className="font-mono">{sector.stockCount}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Avg Change: </span>
              <span className={`font-mono ${sector.avgChange > 0 ? 'text-price-up' : sector.avgChange < 0 ? 'text-price-down' : 'text-price-neutral'}`}>
                {sector.avgChange > 0 ? '+' : ''}{sector.avgChange.toFixed(2)}%
              </span>
            </p>
            <div className="flex gap-3 pt-1 text-xs">
              {sector.A > 0 && <span style={{ color: CATEGORY_COLORS.A }}>A: {formatValue(sector.A)}</span>}
              {sector.B > 0 && <span style={{ color: CATEGORY_COLORS.B }}>B: {formatValue(sector.B)}</span>}
              {sector.N > 0 && <span style={{ color: CATEGORY_COLORS.N }}>N: {formatValue(sector.N)}</span>}
              {sector.Z > 0 && <span style={{ color: CATEGORY_COLORS.Z }}>Z: {formatValue(sector.Z)}</span>}
            </div>
            <div className="flex gap-3 pt-1">
              <span className="text-price-up">↑{sector.advancers}</span>
              <span className="text-price-down">↓{sector.decliners}</span>
              <span className="text-price-neutral">→{sector.unchanged}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (barData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked Bar Chart */}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 60 }}>
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              angle={-45}
              textAnchor="end"
              interval={0}
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => formatValue(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: 12 }}
              iconType="square"
            />
            <Bar dataKey="A" stackId="a" fill={CATEGORY_COLORS.A} name="A" />
            <Bar dataKey="B" stackId="a" fill={CATEGORY_COLORS.B} name="B" />
            <Bar dataKey="N" stackId="a" fill={CATEGORY_COLORS.N} name="N" />
            <Bar dataKey="Z" stackId="a" fill={CATEGORY_COLORS.Z} name="Z" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sector List - sorted by performance */}
      <div className="space-y-1.5 sm:space-y-2 overflow-auto pr-1 sm:pr-2 max-h-48 sm:max-h-64">
        {[...sectorSummary].sort((a, b) => b.avgChange - a.avgChange).map((sector) => {
          const percentage = totalValue > 0 ? ((sector.value / totalValue) * 100).toFixed(1) : "0";
          return (
            <div
              key={sector.name}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-1.5 sm:p-2 transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <div
                  className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SECTOR_COLORS[sector.name] || SECTOR_COLORS["Others"] }}
                />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground truncate">{sector.name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{sector.stockCount} stocks</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="font-mono text-xs sm:text-sm font-semibold text-foreground">
                  {formatValue(sector.value)}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{percentage}%</span>
                  <span
                    className={`text-[10px] sm:text-xs font-mono ${
                      sector.avgChange > 0
                        ? "text-price-up"
                        : sector.avgChange < 0
                        ? "text-price-down"
                        : "text-price-neutral"
                    }`}
                  >
                    {sector.avgChange > 0 ? "+" : ""}
                    {sector.avgChange.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
