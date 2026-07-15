import { describe, expect, it } from "vitest";
import type { MarketComparison, TopMarketsResponse } from "@stock247/shared";
import { createApp } from "./app.js";
import type { AppConfig } from "./config.js";
import type { MarketServiceLike } from "./services/market-service.js";

const item: MarketComparison = {
  rank: 1,
  symbol: "NVDA",
  companyName: "NVIDIA Corporation",
  contractSymbol: "xyz:NVDA",
  contractPrice: 180.25,
  contractPriceType: "mark",
  stockPrice: 179.8,
  difference: 0.45,
  differencePercent: 0.2503,
  contractChange24h: 2.25,
  contractChangePercent24h: 1.264,
  volume24h: 12_500_000,
  openInterest: 53_000,
  funding: 0.000012,
  contractUpdatedAt: "2026-07-15T00:00:00.000Z",
  stockUpdatedAt: "2026-07-15T00:00:00.000Z",
  stockIsDelayed: true,
  stockMarketOpen: false,
  isStale: false,
  status: "complete"
};

const top: TopMarketsResponse = {
  data: [item],
  meta: {
    limit: 20,
    generatedAt: "2026-07-15T00:00:00.000Z",
    contractSource: "Hyperliquid",
    stockSource: "mock",
    stockProviderConfigured: true,
    partialFailures: {}
  }
};

const service: MarketServiceLike = {
  getTopMarkets: async () => top,
  getComparison: async () => item,
  getSymbols: async () => [{ symbol: "NVDA", contractSymbol: "xyz:NVDA", companyName: "NVIDIA Corporation" }],
  search: async () => [{ symbol: "NVDA", matchType: "exact" }]
};

const config: AppConfig = {
  NODE_ENV: "test",
  HYPERLIQUID_API_BASE: "https://api.hyperliquid.xyz",
  STOCK_PROVIDER: "mock",
  STOCK_API_KEY: "",
  CORS_ORIGINS: "",
  CACHE_TTL_CHAIN_SECONDS: 10,
  CACHE_TTL_STOCK_SECONDS: 45,
  PORT: 8787,
  corsOrigins: []
};

const app = createApp({ config, marketService: service });

describe("API routes", () => {
  it("serves health", async () => {
    expect((await app.request("/health")).status).toBe(200);
  });

  it("serves top markets", async () => {
    const response = await app.request("/v1/markets/top?limit=20");
    expect(response.status).toBe(200);
    expect((await response.json()).data[0].symbol).toBe("NVDA");
  });

  it("serves a comparison", async () => {
    expect((await app.request("/v1/compare/NVDA")).status).toBe(200);
  });

  it("serves search results", async () => {
    const response = await app.request("/v1/search?q=nvda");
    expect((await response.json()).data[0].symbol).toBe("NVDA");
  });
});
