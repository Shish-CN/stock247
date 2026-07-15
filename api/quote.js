import { fetchTradeXyzMarkets, jsonResponse, normalizeSymbol } from "../lib/hyperliquid.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return jsonResponse(response, 405, { ok: false, error: "method_not_allowed" });
  }

  const url = new URL(request.url || "/api/quote", "https://stock247.local");
  const requestedSymbol = String(url.searchParams.get("symbol") || "").trim();
  const symbol = normalizeSymbol(requestedSymbol);
  if (!symbol) {
    return jsonResponse(response, 400, { ok: false, error: "invalid_symbol" });
  }

  try {
    const markets = await fetchTradeXyzMarkets();
    const item = markets.find((market) => market.symbol === symbol);
    if (!item) {
      return jsonResponse(response, 404, {
        ok: false,
        error: "trade_xyz_symbol_not_listed",
        requestedSymbol
      }, "s-maxage=10, stale-while-revalidate=30");
    }

    return jsonResponse(response, 200, {
      ok: true,
      requestedSymbol,
      item
    }, "s-maxage=10, stale-while-revalidate=60");
  } catch (error) {
    return jsonResponse(response, 502, {
      ok: false,
      error: "quote_unavailable",
      provider: "hyperliquid_xyz",
      reason: error instanceof Error ? error.message : "unknown_error"
    });
  }
}
