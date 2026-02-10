import { BarChart3, Activity, DollarSign, TrendingUp, TrendingDown, LineChart } from "lucide-react";
import { Stock } from "@/types/market";
import { DSEXIndex } from "@/hooks/useMarketData";

interface MarketSummaryProps {
  stocks: Stock[];
  dsexIndex?: DSEXIndex | null;
}

export function MarketSummary({ stocks, dsexIndex }: MarketSummaryProps) {
  const totalTrade = stocks.reduce((sum, s) => sum + s.trade, 0);
  const totalVolume = stocks.reduce((sum, s) => sum + s.volume, 0);
  const totalValueMn = stocks.reduce((sum, s) => sum + s.valueMn, 0);
  const advancers = stocks.filter((s) => s.change > 0).length;
  const decliners = stocks.filter((s) => s.change < 0).length;

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) return (volume / 1000000000).toFixed(2) + "B";
    if (volume >= 1000000) return (volume / 1000000).toFixed(2) + "M";
    if (volume >= 1000) return (volume / 1000).toFixed(2) + "K";
    return volume.toLocaleString();
  };

  const formatValue = (valueMn: number) => {
    if (valueMn >= 1000) return (valueMn / 1000).toFixed(2) + "B";
    return valueMn.toFixed(2) + "M";
  };

  const dsexIsUp = dsexIndex ? dsexIndex.change >= 0 : true;

  const stats = [
    ...(dsexIndex
      ? [
          {
            label: "DSEX Index",
            value: dsexIndex.value.toFixed(2),
            subValue: `${dsexIsUp ? "+" : ""}${dsexIndex.change.toFixed(2)} (${dsexIsUp ? "+" : ""}${dsexIndex.changePercent.toFixed(2)}%)`,
            icon: LineChart,
            color: dsexIsUp ? "text-emerald-400" : "text-rose-400",
            bgColor: dsexIsUp ? "bg-emerald-500/20" : "bg-rose-500/20",
            borderColor: dsexIsUp ? "border-emerald-500/40" : "border-rose-500/40",
          },
        ]
      : []),
    {
      label: "Total Trade",
      value: formatVolume(totalTrade),
      icon: Activity,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      borderColor: "border-amber-500/40",
    },
    {
      label: "Total Volume",
      value: formatVolume(totalVolume),
      icon: BarChart3,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-500/40",
    },
    {
      label: "Total Value (Mn)",
      value: formatValue(totalValueMn),
      icon: DollarSign,
      color: "text-violet-400",
      bgColor: "bg-violet-500/20",
      borderColor: "border-violet-500/40",
    },
    {
      label: "Advancers",
      value: advancers,
      icon: TrendingUp,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/40",
    },
    {
      label: "Decliners",
      value: decliners,
      icon: TrendingDown,
      color: "text-rose-400",
      bgColor: "bg-rose-500/20",
      borderColor: "border-rose-500/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:grid-cols-3 md:grid-cols-6 md:gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-lg border-2 p-2 xs:p-3 transition-all hover:scale-[1.02] md:p-4 ${stat.bgColor} ${stat.borderColor}`}
        >
          <div className="flex items-center gap-1.5 xs:gap-2 md:gap-3">
            <div className={`rounded-lg xs:rounded-xl ${stat.bgColor} p-1.5 xs:p-2 md:p-2.5`}>
              <stat.icon className={`h-3.5 w-3.5 xs:h-4 xs:w-4 md:h-5 md:w-5 ${stat.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[8px] xs:text-[10px] font-medium text-muted-foreground md:text-xs">{stat.label}</p>
              <p className={`font-mono text-xs xs:text-sm font-bold md:text-lg ${stat.color}`}>
                {stat.value}
              </p>
              {"subValue" in stat && stat.subValue && (
                <p className={`font-mono text-[8px] xs:text-[9px] md:text-xs font-semibold ${stat.color}`}>
                  {stat.subValue}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}