import { differenceTone, type MarketComparison } from "@stock247/shared";
import { useNavigate } from "react-router-dom";
import { formatPrice, formatSigned, formatTimestamp, formatVolume } from "../lib/format";
import type { SortDirection, SortKey } from "../lib/sort";

function toneClass(value: number | null) {
  const tone = differenceTone(value);
  return tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-red-600" : "text-slate-500";
}

export function MarketTable({
  items,
  sortKey,
  direction,
  onSort
}: {
  items: MarketComparison[];
  sortKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const navigate = useNavigate();
  const heading = (label: string, key?: SortKey) => (
    <button className="font-medium text-slate-600 hover:text-slate-950" onClick={() => key && onSort(key)}>
      {label}{key === sortKey ? (direction === "desc" ? " ↓" : " ↑") : ""}
    </button>
  );

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-panel md:block">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left">
          <tr>
            <th className="px-4 py-3">排名</th><th className="px-4 py-3">标的</th><th className="px-4 py-3">合约价格</th>
            <th className="px-4 py-3">股票价格</th><th className="px-4 py-3">{heading("价差", "difference")}</th>
            <th className="px-4 py-3">{heading("价差率", "differencePercent")}</th><th className="px-4 py-3">24H涨跌</th>
            <th className="px-4 py-3">{heading("24H成交额", "volume24h")}</th><th className="px-4 py-3">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.symbol} tabIndex={0} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => navigate(`/symbol/${item.symbol}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/symbol/${item.symbol}`)}>
              <td className="px-4 py-4 text-slate-500">{item.rank}</td>
              <td className="px-4 py-4"><div className="font-semibold">{item.symbol}</div><div className="max-w-44 truncate text-xs text-slate-500">{item.companyName}</div></td>
              <td className="px-4 py-4"><div>{formatPrice(item.contractPrice)}</div><div className="text-xs text-slate-500">Mark Price</div></td>
              <td className="px-4 py-4">{formatPrice(item.stockPrice)}</td>
              <td className={`px-4 py-4 font-semibold ${toneClass(item.difference)}`}>{item.difference === null ? "暂无" : `${item.difference > 0 ? "+" : ""}${formatPrice(item.difference)}`}</td>
              <td className={`px-4 py-4 font-semibold ${toneClass(item.differencePercent)}`}>{formatSigned(item.differencePercent, "%")}</td>
              <td className={toneClass(item.contractChangePercent24h)}>{formatSigned(item.contractChangePercent24h, "%")}</td>
              <td className="px-4 py-4">{formatVolume(item.volume24h)}</td>
              <td className="px-4 py-4 text-xs text-slate-500"><div>链 {formatTimestamp(item.contractUpdatedAt)}</div><div>股 {formatTimestamp(item.stockUpdatedAt)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
