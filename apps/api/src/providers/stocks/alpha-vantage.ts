import type { StockQuote } from "@stock247/shared";
import type { AppConfig } from "../../config.js";
import { AsyncTtlCache } from "../../lib/cache.js";
import { fetchJson } from "../../lib/http.js";
import type { BatchQuoteResult, StockQuoteProvider } from "./types.js";

type DailySeries = Record<string, { "4. close"?: string }>;

type AlphaVantageDailyResponse = {
  "Meta Data"?: {
    "2. Symbol"?: string;
    "3. Last Refreshed"?: string;
  };
  "Time Series (Daily)"?: DailySeries;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

export class AlphaVantageStockProvider implements StockQuoteProvider {
  readonly name = "alpha-vantage-eod";
  readonly configured: boolean;
  private readonly cache = new AsyncTtlCache<StockQuote>();

  constructor(private readonly config: AppConfig) {
    this.configured = Boolean(config.STOCK_API_KEY);
  }

  private endpoint(symbol: string): string {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "TIME_SERIES_DAILY");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("outputsize", "compact");
    url.searchParams.set("apikey", this.config.STOCK_API_KEY);
    return url.toString();
  }

  async getQuote(symbol: string, companyName = symbol): Promise<StockQuote> {
    if (!this.configured) throw new Error("stock_provider_not_configured");

    const ttlMs = Math.max(this.config.CACHE_TTL_STOCK_SECONDS * 1000, 12 * 60 * 60 * 1000);
    const result = await this.cache.getOrLoad(symbol, ttlMs, 24 * 60 * 60 * 1000, async () => {
      const payload = await fetchJson<AlphaVantageDailyResponse>(this.endpoint(symbol), {}, 7000);
      const providerError = payload["Error Message"] || payload.Note || payload.Information;
      if (providerError) throw new Error(providerError);

      const series = payload["Time Series (Daily)"];
      if (!series) throw new Error("daily_series_not_available");

      const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
      const latestDate = dates[0];
      const previousDate = dates[1];
      if (!latestDate) throw new Error("daily_series_empty");

      const price = Number(series[latestDate]?.["4. close"]);
      const previousClose = previousDate ? Number(series[previousDate]?.["4. close"]) : null;
      if (!Number.isFinite(price) || price <= 0) throw new Error("quote_not_available");

      return {
        symbol,
        companyName,
        price,
        previousClose: previousClose !== null && Number.isFinite(previousClose) ? previousClose : null,
        updatedAt: new Date(`${latestDate}T21:00:00.000Z`).toISOString(),
        isDelayed: true,
        marketOpen: false,
        source: this.name
      };
    });

    return { ...result.value, isDelayed: true };
  }

  async getQuotes(symbols: Array<{ symbol: string; companyName?: string }>): Promise<BatchQuoteResult> {
    const quotes = new Map<string, StockQuote>();
    const errors: Record<string, string> = {};

    for (const item of symbols) {
      try {
        quotes.set(item.symbol, await this.getQuote(item.symbol, item.companyName));
      } catch (error) {
        errors[item.symbol] = error instanceof Error ? error.message : "quote_failed";
      }
    }

    return { quotes, errors };
  }
}
