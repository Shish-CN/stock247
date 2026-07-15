import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("./api", () => ({
  fetchTopMarkets: async () => ({
    data: [{ rank: 1, symbol: "NVDA", companyName: "NVIDIA", contractSymbol: "xyz:NVDA", contractPrice: 181, contractPriceType: "mark", stockPrice: 180, difference: 1, differencePercent: 0.55, contractChange24h: 2, contractChangePercent24h: 1.1, volume24h: 1000000, openInterest: 100, funding: 0.0001, contractUpdatedAt: new Date().toISOString(), stockUpdatedAt: new Date().toISOString(), stockIsDelayed: true, stockMarketOpen: false, isStale: false, status: "complete" }],
    meta: { limit: 20, generatedAt: new Date().toISOString(), contractSource: "Hyperliquid", stockSource: "mock", stockProviderConfigured: true, partialFailures: {} }
  }),
  fetchSearch: async () => [],
  fetchComparison: async () => null
}));

describe("dashboard", () => {
  it("renders the top market", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><App /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findAllByText("NVDA")).not.toHaveLength(0);
    expect(screen.getByText("美股现货与链上永续合约价差")).toBeInTheDocument();
  });
});
