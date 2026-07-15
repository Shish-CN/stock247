import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchComparison } from "../api";
import { formatPrice, formatSigned, formatTimestamp, formatVolume } from "../lib/format";

export function SymbolPage() {
  const { symbol = "" } = useParams();
  const query = useQuery({ queryKey: ["comparison", symbol], queryFn: () => fetchComparison(symbol), refetchInterval: 30_000 });
  if (query.isLoading) return <main className="mx-auto max-w-5xl p-8">正在加载 {symbol}…</main>;
  if (query.isError) return <main className="mx-auto max-w-5xl p-8"><Link to="/" className="text-blue-600">← 返回首页</Link><div className="mt-6 rounded-xl bg-red-50 p-5 text-red-800">{query.error.message}</div></main>;
  const item = query.data!;
  const cards = [
    ["合约价格", formatPrice(item.contractPrice), "trade.xyz Mark Price"],
    ["股票现货", formatPrice(item.stockPrice), item.stockIsDelayed ? "延迟行情" : "行情"],
    ["绝对价差", formatPrice(item.difference), "合约价格 - 股票价格"],
    ["百分比价差", formatSigned(item.differencePercent, "%"), "相对股票现货"],
    ["24H成交额", formatVolume(item.volume24h), "名义成交额"],
    ["合约24H涨跌", formatSigned(item.contractChangePercent24h, "%"), "相对 prevDayPx"],
    ["持仓量", item.openInterest?.toLocaleString() ?? "暂无", "Open Interest"],
    ["Funding Rate", item.funding === null ? "暂无" : item.funding.toExponential(4), "资金费率"]
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link to="/" className="text-sm font-semibold text-blue-600">← 返回首页</Link>
      <header><h1 className="text-4xl font-bold">{item.symbol}</h1><p className="mt-1 text-slate-500">{item.companyName}</p></header>
      {item.warning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{item.warning}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, note]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-slate-400">{note}</div></div>)}</div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel"><h2 className="font-bold">数据状态</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">链上更新时间</dt><dd>{formatTimestamp(item.contractUpdatedAt)}</dd></div><div><dt className="text-slate-500">股票更新时间</dt><dd>{formatTimestamp(item.stockUpdatedAt)}</dd></div><div><dt className="text-slate-500">股票市场</dt><dd>{item.stockMarketOpen === null ? "未知" : item.stockMarketOpen ? "开盘" : "休市"}</dd></div><div><dt className="text-slate-500">数据状态</dt><dd>{item.isStale ? "可能延迟" : "正常"}</dd></div></dl></section>
    </main>
  );
}
