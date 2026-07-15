import type { StockQuote } from "@stock247/shared";
import type { BatchQuoteResult, StockQuoteProvider } from "./types.js";

function deterministicPrice(symbol: string): number {
  const hash = [...symbol].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return Number((50 + (hash % 450) + (hash % 100) / 100).toFixed(2));
}

export class MockStockProvider implements StockQuoteProvider {
  readonly name = "mock-development";
  readonly configured = true;

  async getQuote(symbol: string, companyName = symbol): Promise<StockQuote> {
    const price = deterministicPrice(symbol);
    return {
      symbol,
      companyName,
      price,
      previousClose: price * 0.995,
      updatedAt: new Date().toISOString(),
      isDelayed: true,
      marketOpen: null,
      source: this.name
    };
  }

  async getQuotes(symbols: Array<{ symbol: string; companyName?: string }>): Promise<BatchQuoteResult> {
    const quotes = new Map<string, StockQuote>();
    for (const item of symbols) quotes.set(item.symbol, await this.getQuote(item.symbol, item.companyName));
    return { quotes, errors: {} };
  }
}
