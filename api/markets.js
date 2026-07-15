import { fetchTradeXyzMarkets, jsonResponse, parseLimit } from "../lib/hyperliquid.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return jsonResponse(response, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const url = new URL(request.url || "/api/markets", "https://stock247.local");
    const limit = parseLimit(url.searchParams.get("limit"), 20, 100);
    const markets = await fetchTradeXyzMarkets();
    return jsonResponse(
      response,
      200,
      {
        ok: true,
        source: "trade.xyz / Hyperliquid xyz dex",
        updatedAt: new Date().toISOString(),
        count: Math.min(limit, markets.length),
        items: markets.slice(0, limit)
      },
      "s-maxage=10, stale-while-revalidate=60"
    );
  } catch (error) {
    return jsonResponse(response, 502, {
      ok: false,
      error: "market_data_unavailable",
      provider: "hyperliquid_xyz",
      reason: error instanceof Error ? error.message : "unknown_error"
    });
  }
}
