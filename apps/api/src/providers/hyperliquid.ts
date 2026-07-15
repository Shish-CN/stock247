import { finiteNumber, normalizeContractSymbol, type ChainMarket, type ContractPriceType } from "@stock247/shared";
import type { AppConfig } from "../config.js";
import { AsyncTtlCache } from "../lib/cache.js";
import { fetchJson, UpstreamError } from "../lib/http.js";

type MetaResponse = {
  universe?: Array<{ name?: string }>;
};

type AssetContext = {
  markPx?: string | number | null;
  midPx?: string | number | null;
  oraclePx?: string | number | null;
  prevDayPx?: string | number | null;
  dayNtlVlm?: string | number | null;
  dayBaseVlm?: string | number | null;
  openInterest?: string | number | null;
  funding?: string | number | null;
};

type HyperliquidResponse = [MetaResponse, AssetContext[]];

function chooseContractPrice(context: AssetContext): { value: number | null; type: ContractPriceType | null } {
  const candidates: Array<[ContractPriceType, unknown]> = [
    ["mark", context.markPx],
    ["mid", context.midPx],
    ["oracle", context.oraclePx]
  ];

  for (const [type, raw] of candidates) {
    const value = finiteNumber(raw);
    if (value !== null) return { value, type };
  }

  return { value: null, type: null };
}

export class HyperliquidProvider {
  private readonly cache = new AsyncTtlCache<{ markets: ChainMarket[]; updatedAt: string }>();

  constructor(private readonly config: AppConfig) {}

  async getMarkets(): Promise<{ markets: ChainMarket[]; updatedAt: string; stale: boolean }> {
    const ttl = this.config.CACHE_TTL_CHAIN_SECONDS * 1000;
    const result = await this.cache.getOrLoad("xyz-markets", ttl, 60_000, async () => {
      const payload = await fetchJson<HyperliquidResponse>(
        `${this.config.HYPERLIQUID_API_BASE}/info`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" })
        },
        7000
      );

      if (!Array.isArray(payload) || !payload[0]?.universe || !Array.isArray(payload[1])) {
        throw new UpstreamError("Hyperliquid returned an unexpected payload", "invalid_payload");
      }

      const updatedAt = new Date().toISOString();
      const markets = payload[0].universe.map((meta, index): ChainMarket | null => {
        const context = payload[1][index];
        if (!meta?.name || !context) return null;
        const price = chooseContractPrice(context);
        return {
          symbol: normalizeContractSymbol(meta.name),
          contractSymbol: meta.name,
          contractPrice: price.value,
          contractPriceType: price.type,
          prevDayPrice: finiteNumber(context.prevDayPx),
          volume24h: finiteNumber(context.dayNtlVlm),
          baseVolume24h: finiteNumber(context.dayBaseVlm),
          openInterest: finiteNumber(context.openInterest),
          funding: finiteNumber(context.funding),
          updatedAt,
          stale: false
        };
      }).filter((market): market is ChainMarket => Boolean(market));

      return { markets, updatedAt };
    });

    return {
      markets: result.value.markets.map((market) => ({ ...market, stale: result.stale })),
      updatedAt: result.value.updatedAt,
      stale: result.stale
    };
  }
}
