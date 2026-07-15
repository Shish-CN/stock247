import { searchSymbols } from "@stock247/shared";
import { HyperliquidProvider } from "../providers/hyperliquid.js";

export class SearchService {
  constructor(private readonly hyperliquid: HyperliquidProvider) {}

  async search(query: string) {
    const { markets } = await this.hyperliquid.getMarkets();
    return searchSymbols(query, markets.map((market) => market.symbol), 10);
  }
}
