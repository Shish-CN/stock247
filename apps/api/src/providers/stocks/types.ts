import type { StockQuote } from "@stock247/shared";

export type BatchQuoteResult = {
  quotes: Map<string, StockQuote>;
  errors: Record<string, string>;
};

export interface StockQuoteProvider {
  readonly name: string;
  readonly configured: boolean;
  getQuote(symbol: string, companyName?: string): Promise<StockQuote>;
  getQuotes(symbols: Array<{ symbol: string; companyName?: string }>): Promise<BatchQuoteResult>;
}
