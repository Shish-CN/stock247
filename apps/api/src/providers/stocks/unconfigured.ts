import type { StockQuote } from "@stock247/shared";
import type { BatchQuoteResult, StockQuoteProvider } from "./types.js";

export class UnconfiguredStockProvider implements StockQuoteProvider {
  readonly name = "not-configured";
  readonly configured = false;

  async getQuote(): Promise<StockQuote> {
    throw new Error("stock_provider_not_configured");
  }

  async getQuotes(symbols: Array<{ symbol: string }>): Promise<BatchQuoteResult> {
    return {
      quotes: new Map(),
      errors: Object.fromEntries(symbols.map(({ symbol }) => [symbol, "stock_provider_not_configured"]))
    };
  }
}
