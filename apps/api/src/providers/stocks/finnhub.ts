import type { StockQuote } from "@stock247/shared";
import type { AppConfig } from "../../config.js";
import { AsyncTtlCache } from "../../lib/cache.js";
import { fetchJson } from "../../lib/http.js";
import type { BatchQuoteResult, StockQuoteProvider } from "./types.js";

type FinnhubQuote = { c?: number; pc?: number; t?: number };
type FinnhubMarketStatus = { isOpen?: boolean };

export class FinnhubStockProvider implements StockQuoteProvider {
  readonly name = "finnhub";
  readonly configured: boolean;
  private readonly quoteCache = new AsyncTtlCache<StockQuote>();
  private readonly statusCache = new AsyncTtlCache<boolean | null>();

  constructor(private readonly config: AppConfig) {
    this.configured = Boolean(config.STOCK_API_KEY);
  }

  private withToken(path: string): string {
    const url = new URL(`https://finnhub.io/api/v1${path}`);
    url.searchParams.set("token", this.config.STOCK_API_KEY);
    return url.toString();
  }

  private async getMarketOpen(): Promise<boolean | null> {
    if (!this.configured) return null;
    const result = await this.statusCache.getOrLoad("US", 60_000, 5 * 60_000, async () => {
      const payload = await fetchJson<FinnhubMarketStatus>(this.withToken("/stock/market-status?exchange=US"), {}, 5000);
      return typeof payload.isOpen === "boolean" ? payload.isOpen : null;
    });
    return result.value;
  }

  async getQuote(symbol: string, companyName = symbol): Promise<StockQuote> {
    if (!this.configured) throw new Error("stock_provider_not_configured");
    const ttl = this.config.CACHE_TTL_STOCK_SECONDS * 1000;
    const result = await this.quoteCache.getOrLoad(symbol, ttl, 5 * 60_000, async () => {
      const payload = await fetchJson<FinnhubQuote>(this.withToken(`/quote?symbol=${encodeURIComponent(symbol)}`), {}, 6000);
      if (!payload.c || payload.c <= 0) throw new Error("quote_not_available");
      return {
        symbol,
        companyName,
        price: payload.c,
        previousClose: payload.pc && payload.pc > 0 ? payload.pc : null,
        updatedAt: payload.t ? new Date(payload.t * 1000).toISOString() : new Date().toISOString(),
        isDelayed: true,
        marketOpen: await this.getMarketOpen(),
        source: this.name
      };
    });
    return { ...result.value, isDelayed: result.value.isDelayed || result.stale };
  }

  async getQuotes(symbols: Array<{ symbol: string; companyName?: string }>): Promise<BatchQuoteResult> {
    const quotes = new Map<string, StockQuote>();
    const errors: Record<string, string> = {};
    const queue = [...symbols];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) return;
        try {
          quotes.set(item.symbol, await this.getQuote(item.symbol, item.companyName));
        } catch (error) {
          errors[item.symbol] = error instanceof Error ? error.message : "quote_failed";
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(5, queue.length || 1) }, worker));
    return { quotes, errors };
  }
}
