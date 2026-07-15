import { z } from "zod";

export const marketComparisonSchema = z.object({
  rank: z.number().int().positive().optional(),
  symbol: z.string(),
  companyName: z.string(),
  contractSymbol: z.string().nullable(),
  contractPrice: z.number().nullable(),
  contractPriceType: z.enum(["mark", "mid", "oracle"]).nullable(),
  stockPrice: z.number().nullable(),
  difference: z.number().nullable(),
  differencePercent: z.number().nullable(),
  contractChange24h: z.number().nullable(),
  contractChangePercent24h: z.number().nullable(),
  volume24h: z.number().nullable(),
  openInterest: z.number().nullable(),
  funding: z.number().nullable(),
  contractUpdatedAt: z.string().nullable(),
  stockUpdatedAt: z.string().nullable(),
  stockIsDelayed: z.boolean().nullable(),
  stockMarketOpen: z.boolean().nullable(),
  isStale: z.boolean(),
  status: z.enum(["complete", "stock_only", "contract_only", "not_found"]),
  warning: z.string().optional()
});

export const topMarketsResponseSchema = z.object({
  data: z.array(marketComparisonSchema),
  meta: z.object({
    limit: z.number(),
    generatedAt: z.string(),
    contractSource: z.string(),
    stockSource: z.string(),
    stockProviderConfigured: z.boolean(),
    partialFailures: z.record(z.string())
  })
});

export const searchResultSchema = z.object({
  symbol: z.string(),
  contractSymbol: z.string().nullable(),
  companyName: z.string(),
  matchType: z.enum(["exact", "contract", "alias", "prefix", "company", "fuzzy"]),
  hasContract: z.boolean(),
  assetType: z.enum(["stock", "etf", "index", "commodity", "fx", "other"])
});
