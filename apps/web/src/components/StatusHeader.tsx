import type { TopMarketsResponse } from "@stock247/shared";
import { formatTimestamp } from "../lib/format";

export function StatusHeader({ meta, firstItem }: { meta: TopMarketsResponse["meta"]; firstItem: TopMarketsResponse["data"][number] | undefined }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-panel sm:grid-cols-2 lg:grid-cols-4">
      <div><span className="text-slate-500">链上更新</span><div className="font-medium">{formatTimestamp(firstItem?.contractUpdatedAt ?? null)}</div></div>
      <div><span className="text-slate-500">股票更新</span><div className="font-medium">{formatTimestamp(firstItem?.stockUpdatedAt ?? null)}</div></div>
      <div><span className="text-slate-500">自动刷新</span><div className="font-medium">每 30 秒</div></div>
      <div>
        <span className="text-slate-500">股票行情源</span>
        <div className={meta.stockProviderConfigured ? "font-medium text-slate-900" : "font-medium text-amber-700"}>
          {meta.stockProviderConfigured ? meta.stockSource : "尚未配置"}
        </div>
      </div>
    </div>
  );
}
