import { differenceTone, type MarketComparison } from "@stock247/shared";
import { useNavigate } from "react-router-dom";
import { formatPrice, formatSigned, formatVolume } from "../lib/format";

export function MarketCards({ items }: { items: MarketComparison[] }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3 md:hidden">
      {items.map((item) => {
        const tone = differenceTone(item.difference);
        const color = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-500";
        return (
          <button key={item.symbol} onClick={() => navigate(`/symbol/${item.symbol}`)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-panel">
            <div className="flex items-start justify-between"><div><span className="mr-2 text-slate-400">#{item.rank}</span><span className="text-lg font-bold">{item.symbol}</span><div className="text-xs text-slate-500">{item.companyName}</div></div><div className={`text-right font-bold ${color}`}>{formatSigned(item.differencePercent, "%")}<div className="text-xs font-normal">价差率</div></div></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-slate-500">合约 Mark</span><div className="font-semibold">{formatPrice(item.contractPrice)}</div></div><div><span className="text-slate-500">股票现货</span><div className="font-semibold">{formatPrice(item.stockPrice)}</div></div><div><span className="text-slate-500">绝对价差</span><div className={color}>{formatPrice(item.difference)}</div></div><div><span className="text-slate-500">24H成交额</span><div>{formatVolume(item.volume24h)}</div></div></div>
          </button>
        );
      })}
    </div>
  );
}
