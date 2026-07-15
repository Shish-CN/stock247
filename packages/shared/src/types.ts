export type AssetType = "stock" | "etf" | "index" | "commodity" | "fx" | "other";

export type SymbolMapping = {
  contractSymbol: string;
  stockSymbol: string;
  aliases: string[];
  companyName?: string;
  assetType: AssetType;
};

export type ContractPriceType = "mark" | "mid" | "oracle";

export type ChainMarket = {
  symbol: string;
  contractSymbol: string;
  contractPrice: number | null;
  contractPriceType: ContractPriceType | null;
  prevDayPrice: number | null;
  volume24h: number | null;
  baseVolume24h: number | null;
  openInterest: number | null;
  funding: number | null;
  updatedAt: string;
  stale: boolean;
};

export type StockQuote = {
  symbol: string;
  companyName: string;
  price: number;
  previousClose: number | null;
  updatedAt: string;
  isDelayed: boolean;
  marketOpen: boolean | null;
  source: string;
};

export type MarketComparison = {
  rank?: number;
  symbol: string;
  companyName: string;
  contractSymbol: string | null;
  contractPrice: number | null;
  contractPriceType: ContractPriceType | null;
  stockPrice: number | null;
  difference: number | null;
  differencePercent: number | null;
  contractChange24h: number | null;
  contractChangePercent24h: number | null;
  volume24h: number | null;
  openInterest: number | null;
  funding: number | null;
  contractUpdatedAt: string | null;
  stockUpdatedAt: string | null;
  stockIsDelayed: boolean | null;
  stockMarketOpen: boolean | null;
  isStale: boolean;
  status: "complete" | "stock_only" | "contract_only" | "not_found";
  warning?: string;
};

export type TopMarketsResponse = {
  data: MarketComparison[];
  meta: {
    limit: number;
    generatedAt: string;
    contractSource: string;
    stockSource: string;
    stockProviderConfigured: boolean;
    partialFailures: Record<string, string>;
  };
};

export type SearchMatchType = "exact" | "contract" | "alias" | "prefix" | "company" | "fuzzy";

export type SearchResult = {
  symbol: string;
  contractSymbol: string | null;
  companyName: string;
  matchType: SearchMatchType;
  hasContract: boolean;
  assetType: AssetType;
};
