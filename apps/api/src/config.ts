import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HYPERLIQUID_API_BASE: z.string().url().default("https://api.hyperliquid.xyz"),
  STOCK_PROVIDER: z.enum(["finnhub", "alpha-vantage", "mock", ""]).default(""),
  STOCK_API_KEY: z.string().default(""),
  CORS_ORIGINS: z.string().default(""),
  CACHE_TTL_CHAIN_SECONDS: z.coerce.number().int().positive().default(10),
  CACHE_TTL_STOCK_SECONDS: z.coerce.number().int().positive().default(45),
  PORT: z.coerce.number().int().positive().default(8787)
});

export type AppConfig = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(source);
  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean)
  };
}
