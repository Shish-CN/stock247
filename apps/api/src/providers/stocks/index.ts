import type { AppConfig } from "../../config.js";
import { AlphaVantageStockProvider } from "./alpha-vantage.js";
import { FinnhubStockProvider } from "./finnhub.js";
import { MockStockProvider } from "./mock.js";
import type { StockQuoteProvider } from "./types.js";
import { UnconfiguredStockProvider } from "./unconfigured.js";

export function createStockProvider(config: AppConfig): StockQuoteProvider {
  if (config.STOCK_PROVIDER === "finnhub" && config.STOCK_API_KEY) return new FinnhubStockProvider(config);
  if (config.STOCK_PROVIDER === "alpha-vantage" && config.STOCK_API_KEY) return new AlphaVantageStockProvider(config);
  if (config.STOCK_PROVIDER === "mock" && config.NODE_ENV !== "production") return new MockStockProvider();
  return new UnconfiguredStockProvider();
}

export type { StockQuoteProvider } from "./types.js";
