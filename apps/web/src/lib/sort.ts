import type { MarketComparison } from "@stock247/shared";

export type SortKey = "volume24h" | "difference" | "differencePercent";
export type SortDirection = "asc" | "desc";

export function sortMarkets(items: MarketComparison[], key: SortKey, direction: SortDirection): MarketComparison[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = a[key] ?? Number.NEGATIVE_INFINITY;
    const right = b[key] ?? Number.NEGATIVE_INFINITY;
    return (left - right) * multiplier;
  });
}
