import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSearch } from "../api";

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function SearchBox() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 220);
  const result = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => fetchSearch(debounced),
    enabled: debounced.length > 0,
    staleTime: 60_000
  });
  const items = useMemo(() => result.data ?? [], [result.data]);

  useEffect(() => setActive(0), [debounced]);
  const select = (symbol: string) => navigate(`/symbol/${symbol}`);

  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
      <label htmlFor="symbol-search" className="mb-2 block text-sm font-semibold">搜索其他美股</label>
      <input id="symbol-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, Math.max(0, items.length - 1))); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
        if (event.key === "Enter" && items[active]) select(items[active].symbol);
      }} placeholder="搜索美股代码，例如 NVDA、TSLA、AAPL" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-blue-500 focus:ring-2" autoComplete="off" />
      {query && (
        <div className="absolute left-5 right-5 z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {result.isLoading && <div className="p-4 text-sm text-slate-500">正在搜索…</div>}
          {!result.isLoading && items.length === 0 && <div className="p-4 text-sm text-slate-500">未找到相关美股代码，请检查输入。</div>}
          {items.map((item, index) => (
            <button key={`${item.symbol}-${item.matchType}`} onMouseEnter={() => setActive(index)} onClick={() => select(item.symbol)} className={`flex w-full items-center justify-between px-4 py-3 text-left ${active === index ? "bg-slate-100" : ""}`}>
              <span><strong>{item.symbol}</strong><span className="ml-2 text-sm text-slate-500">{item.companyName}</span></span>
              <span className="text-xs text-slate-400">{item.hasContract ? "有合约" : "仅股票"} · {item.matchType}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
