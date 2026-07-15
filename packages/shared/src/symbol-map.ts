import type { SymbolMapping } from "./types.js";

export const SYMBOL_MAPPINGS: SymbolMapping[] = [
  { contractSymbol: "AAPL", stockSymbol: "AAPL", aliases: ["APPLE"], companyName: "Apple Inc.", assetType: "stock" },
  { contractSymbol: "NVDA", stockSymbol: "NVDA", aliases: ["NVIDIA"], companyName: "NVIDIA Corporation", assetType: "stock" },
  { contractSymbol: "TSLA", stockSymbol: "TSLA", aliases: ["TESLA"], companyName: "Tesla, Inc.", assetType: "stock" },
  { contractSymbol: "MSFT", stockSymbol: "MSFT", aliases: ["MICROSOFT"], companyName: "Microsoft Corporation", assetType: "stock" },
  { contractSymbol: "AMZN", stockSymbol: "AMZN", aliases: ["AMAZON"], companyName: "Amazon.com, Inc.", assetType: "stock" },
  { contractSymbol: "META", stockSymbol: "META", aliases: ["FACEBOOK"], companyName: "Meta Platforms, Inc.", assetType: "stock" },
  { contractSymbol: "GOOGL", stockSymbol: "GOOGL", aliases: ["ALPHABET A", "GOOGLE A"], companyName: "Alphabet Inc. Class A", assetType: "stock" },
  { contractSymbol: "GOOG", stockSymbol: "GOOG", aliases: ["ALPHABET C", "GOOGLE C"], companyName: "Alphabet Inc. Class C", assetType: "stock" },
  { contractSymbol: "AMD", stockSymbol: "AMD", aliases: ["ADVANCED MICRO DEVICES"], companyName: "Advanced Micro Devices, Inc.", assetType: "stock" },
  { contractSymbol: "MU", stockSymbol: "MU", aliases: ["MICRON"], companyName: "Micron Technology, Inc.", assetType: "stock" },
  { contractSymbol: "AVGO", stockSymbol: "AVGO", aliases: ["BROADCOM"], companyName: "Broadcom Inc.", assetType: "stock" },
  { contractSymbol: "NFLX", stockSymbol: "NFLX", aliases: ["NETFLIX"], companyName: "Netflix, Inc.", assetType: "stock" },
  { contractSymbol: "PLTR", stockSymbol: "PLTR", aliases: ["PALANTIR"], companyName: "Palantir Technologies Inc.", assetType: "stock" },
  { contractSymbol: "COIN", stockSymbol: "COIN", aliases: ["COINBASE"], companyName: "Coinbase Global, Inc.", assetType: "stock" },
  { contractSymbol: "MSTR", stockSymbol: "MSTR", aliases: ["MICROSTRATEGY", "STRATEGY"], companyName: "Strategy Inc.", assetType: "stock" },
  { contractSymbol: "HOOD", stockSymbol: "HOOD", aliases: ["ROBINHOOD"], companyName: "Robinhood Markets, Inc.", assetType: "stock" },
  { contractSymbol: "BABA", stockSymbol: "BABA", aliases: ["ALIBABA"], companyName: "Alibaba Group Holding Limited", assetType: "stock" },
  { contractSymbol: "BRK.B", stockSymbol: "BRK-B", aliases: ["BRKB", "BERKSHIRE B"], companyName: "Berkshire Hathaway Inc. Class B", assetType: "stock" },
  { contractSymbol: "SPY", stockSymbol: "SPY", aliases: ["S&P 500 ETF"], companyName: "SPDR S&P 500 ETF Trust", assetType: "etf" },
  { contractSymbol: "QQQ", stockSymbol: "QQQ", aliases: ["NASDAQ 100 ETF"], companyName: "Invesco QQQ Trust", assetType: "etf" }
];

export const NON_STOCK_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "HYPE", "GOLD", "SILVER", "OIL", "WTI", "BRENT", "EUR", "JPY", "GBP", "AUD", "CHF",
  "SPX", "NDX", "DJI", "VIX", "DXY", "US10Y", "US02Y", "COPPER", "NATGAS"
]);
