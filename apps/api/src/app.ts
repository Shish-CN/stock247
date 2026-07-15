import { Hono } from "hono";
import { z } from "zod";
import { loadConfig, type AppConfig } from "./config.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { HyperliquidProvider } from "./providers/hyperliquid.js";
import { createStockProvider } from "./providers/stocks/index.js";
import { MarketService, type MarketServiceLike } from "./services/market-service.js";
import { SearchService } from "./services/search-service.js";

function createDefaultService(config: AppConfig): MarketServiceLike {
  const hyperliquid = new HyperliquidProvider(config);
  const search = new SearchService(hyperliquid);
  return new MarketService(hyperliquid, createStockProvider(config), search);
}

function createRoutes(marketService: MarketServiceLike) {
  const routes = new Hono();

  routes.get("/health", (context) => context.json({ status: "ok", timestamp: new Date().toISOString() }));

  routes.get("/v1/markets/top", async (context) => {
    const parsed = z.coerce.number().int().min(1).max(20).catch(20).parse(context.req.query("limit"));
    const payload = await marketService.getTopMarkets(parsed);
    context.header("cache-control", "s-maxage=10, stale-while-revalidate=60");
    return context.json(payload);
  });

  routes.get("/v1/compare/:symbol", async (context) => {
    const symbol = z.string().min(1).max(24).parse(context.req.param("symbol"));
    const payload = await marketService.getComparison(symbol);
    return context.json({ data: payload, meta: { generatedAt: new Date().toISOString() } }, payload.status === "not_found" ? 404 : 200);
  });

  routes.get("/v1/search", rateLimit(), async (context) => {
    const query = z.string().trim().min(1).max(32).parse(context.req.query("q"));
    return context.json({ data: await marketService.search(query), meta: { query } });
  });

  routes.get("/v1/symbols", async (context) => context.json({ data: await marketService.getSymbols() }));
  return routes;
}

export function createApp(options: { config?: AppConfig; marketService?: MarketServiceLike } = {}) {
  const config = options.config ?? loadConfig();
  const marketService = options.marketService ?? createDefaultService(config);
  const app = new Hono();
  const routes = createRoutes(marketService);

  app.use("*", async (context, next) => {
    const origin = context.req.header("origin");
    const local = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    const allowed = !origin || local || config.corsOrigins.includes(origin);
    if (origin && allowed) context.header("access-control-allow-origin", origin);
    context.header("vary", "Origin");
    context.header("access-control-allow-methods", "GET, OPTIONS");
    context.header("access-control-allow-headers", "content-type");
    if (context.req.method === "OPTIONS") return context.body(null, allowed ? 204 : 403);
    if (!allowed) return context.json({ error: "cors_origin_denied" }, 403);
    await next();
  });

  app.route("/", routes);
  app.route("/api", routes);

  app.onError((error, context) => {
    const message = error instanceof z.ZodError ? "invalid_request" : "service_unavailable";
    return context.json({ error: message, detail: error.message }, error instanceof z.ZodError ? 400 : 502);
  });

  return app;
}
