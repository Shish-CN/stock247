import {
  calculateChange,
  calculateDifference,
  normalizeSearchQuery,
  resolveSymbolMapping,
  type ChainMarket,
  type MarketComparison,
  type TopMarketsResponse
} from "@stock247/shared";
import { HyperliquidProvider } from "../providers/hyperliquid.js";
import type { StockQuoteProvider } from "../providers/stocks/index.js";

export interface MarketServiceLike {
  getTopMarkets(limit: number): Promise<TopMarketsResponse>;
  getComparison(symbol: string): Promise<MarketComparison>;
  getSymbols(): Promise<Array<{ symbol: string; contractSymbol: string; companyName: string }>>;
  search(query: string): Promise<unknown[]>;
}

function comparisonFrom(chain: ChainMarket | null, stock: Awaited<ReturnType<StockQuoteProvider["getQuote"]>> | null, rank?: number): MarketComparison {
  const mapping = resolveSymbolMapping(chain?.symbol ?? stock?.symbol ?? "");
  const symbol = mapping?.stockSymbol ?? stock?.symbol ?? chain?.symbol ?? "";
  const companyName = mapping?.companyName ?? stock?.companyName ?? symbol;
  const difference = calculateDifference(chain?.contractPrice ?? null, stock?.price ?? null);
  const change = calculateChange(chain?.contractPrice ?? null, chain?.prevDayPrice ?? null);
  const status = chain && stock ? "complete" : chain ? "contract_only" : stock ? "stock_only" : "not_found";
  const warning = status === "contract_only"
    ? "已找到链上合约，但暂时无法获得对应股票行情。"
    : status === "stock_only"
      ? "已找到该美股，但目前没有对应的 trade.xyz 链上合约。"
      : stock?.marketOpen === false
        ? "股票市场当前休市，价差可能包含盘后价格发现因素。"
        : undefined;

  return {
    ...(rank ? { rank } : {}),
    symbol,
    companyName,
    contractSymbol: chain?.contractSymbol ?? null,
    contractPrice: chain?.contractPrice ?? null,
    contractPriceType: chain?.contractPriceType ?? null,
    stockPrice: stock?.price ?? null,
    difference: difference.difference,
    differencePercent: difference.differencePercent,
    contractChange24h: change.change,
    contractChangePercent24h: change.changePercent,
    volume24h: chain?.volume24h ?? null,
    openInterest: chain?.openInterest ?? null,
    funding: chain?.funding ?? null,
    contractUpdatedAt: chain?.updatedAt ?? null,
    stockUpdatedAt: stock?.updatedAt ?? null,
    stockIsDelayed: stock?.isDelayed ?? null,
    stockMarketOpen: stock?.marketOpen ?? null,
    isStale: Boolean(chain?.stale),
    status,
    ...(warning ? { warning } : {})
  };
}

export class MarketService implements MarketServiceLike {
  constructor(
    private readonly hyperliquid: HyperliquidProvider,
    private readonly stocks: StockQuoteProvider,
    private readonly searcher: { search(query: string): Promise<unknown[]> }
  ) {}

  private async mappedMarkets(): Promise<ChainMarket[]> {
    const chain = await this.hyperliquid.getMarkets();
    return chain.markets.filter((market) => {
      const mapping = resolveSymbolMapping(market.symbol);
      return mapping?.assetType === "stock" || mapping?.assetType === "etf";
    });
  }

  async getTopMarkets(limit: number): Promise<TopMarketsResponse> {
    const safeLimit = Math.min(20, Math.max(1, limit));
    const markets = (await this.mappedMarkets())
      .sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1))
      .slice(0, safeLimit);

    const requested = markets.map((market) => {
      const mapping = resolveSymbolMapping(market.symbol)!;
      return mapping.companyName
        ? { symbol: mapping.stockSymbol, companyName: mapping.companyName }
        : { symbol: mapping.stockSymbol };
    });
    const batch = await this.stocks.getQuotes(requested);
    const data = markets.map((market, index) => {
      const mapping = resolveSymbolMapping(market.symbol)!;
      return comparisonFrom(market, batch.quotes.get(mapping.stockSymbol) ?? null, index + 1);
    });

    return {
      data,
      meta: {
        limit: safeLimit,
        generatedAt: new Date().toISOString(),
        contractSource: "trade.xyz / Hyperliquid xyz dex",
        stockSource: this.stocks.name,
        stockProviderConfigured: this.stocks.configured,
        partialFailures: batch.errors
      }
    };
  }

  async getComparison(rawSymbol: string): Promise<MarketComparison> {
    const normalized = normalizeSearchQuery(rawSymbol);
    const mapping = resolveSymbolMapping(normalized);
    const markets = await this.mappedMarkets();
    const chain = markets.find((market) => {
      const current = resolveSymbolMapping(market.symbol);
      return current?.stockSymbol === mapping?.stockSymbol || market.symbol === normalized;
    }) ?? null;

    let stock = null;
    if (mapping) {
      try {
        stock = await this.stocks.getQuote(mapping.stockSymbol, mapping.companyName);
      } catch {
        stock = null;
      }
    }

    return comparisonFrom(chain, stock);
  }

  async getSymbols() {
    const markets = await this.mappedMarkets();
    return markets.map((market) => {
      const mapping = resolveSymbolMapping(market.symbol)!;
      return {
        symbol: mapping.stockSymbol,
        contractSymbol: market.contractSymbol,
        companyName: mapping.companyName ?? mapping.stockSymbol
      };
    });
  }

  search(query: string) {
    return this.searcher.search(query);
  }
}
