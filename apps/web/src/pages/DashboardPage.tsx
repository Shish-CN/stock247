import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchTopMarkets } from "../api";
import { LoadingRows } from "../components/Loading";
import { MarketCards } from "../components/MarketCards";
import { MarketTable } from "../components/MarketTable";
import { SearchBox } from "../components/SearchBox";
import { StatusHeader } from "../components/StatusHeader";
import { sortMarkets, type SortDirection, type SortKey } from "../lib/sort";

export function DashboardPage() {
  const [sortKey, setSortKey] = useState<SortKey>("volume24h");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const query = useQuery({
    queryKey: ["top-markets"],
    queryFn: fetchTopMarkets,
    refetchInterval: 30_000,
    staleTime: 10_000
  });
  const items = useMemo(() => sortMarkets(query.data?.data ?? [], sortKey, direction), [direction, query.data?.data, sortKey]);
  const onSort = (key: SortKey) => {
    if (key === sortKey) setDirection((value) => value === "desc" ? "asc" : "desc");
    else { setSortKey(key); setDirection("desc"); }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2"><div className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">Stock × Perp</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">美股现货与链上永续合约价差</h1><p className="max-w-3xl text-slate-600">对比美股现货行情与 trade.xyz 链上合约价格。合约价格按 Mark Price → Mid Price → Oracle Price 选择。</p></header>
      {query.data && <StatusHeader meta={query.data.meta} firstItem={query.data.data[0]} />}
      {!query.data?.meta.stockProviderConfigured && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">股票行情数据源尚未配置。当前仅展示链上合约数据，不会把模拟价格伪装为生产行情。</div>}
      {query.isLoading && <LoadingRows />}
      {query.isError && <div className="rounded-2xl border border-red-200 bg-red-50 p-6"><h2 className="font-bold text-red-800">行情加载失败</h2><p className="mt-1 text-sm text-red-700">{query.error.message}</p><button className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => query.refetch()}>重新加载</button></div>}
      {query.data && <><MarketTable items={items} sortKey={sortKey} direction={direction} onSort={onSort} /><MarketCards items={items} /></>}
      <SearchBox />
    </main>
  );
}
