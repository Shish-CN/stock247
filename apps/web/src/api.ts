import {
  marketComparisonSchema,
  searchResultSchema,
  topMarketsResponseSchema,
  type MarketComparison,
  type SearchResult,
  type TopMarketsResponse
} from "@stock247/shared";
import { z } from "zod";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

export async function fetchTopMarkets(): Promise<TopMarketsResponse> {
  return topMarketsResponseSchema.parse(await getJson("/v1/markets/top?limit=20"));
}

export async function fetchComparison(symbol: string): Promise<MarketComparison> {
  const schema = z.object({ data: marketComparisonSchema });
  return schema.parse(await getJson(`/v1/compare/${encodeURIComponent(symbol)}`)).data;
}

export async function fetchSearch(query: string): Promise<SearchResult[]> {
  const schema = z.object({ data: z.array(searchResultSchema) });
  return schema.parse(await getJson(`/v1/search?q=${encodeURIComponent(query)}`)).data;
}
