import { fetchTradeXyzCandles, jsonResponse, normalizeSymbol } from "../lib/hyperliquid.mjs";

const MAX_SYMBOLS = 24;

export default async function handler(request, response) {
  if (request.method !== "GET") return jsonResponse(response, 405, { ok: false, error: "method_not_allowed" });
  const url = new URL(request.url || "/api/sparklines", "https://stock247.local");
  const symbols = [...new Set(String(url.searchParams.get("symbols") || "")
    .split(",")
    .map(normalizeSymbol)
    .filter(Boolean))]
    .slice(0, MAX_SYMBOLS);

  if (!symbols.length) return jsonResponse(response, 400, { ok: false, error: "missing_symbols" });

  const results = await Promise.all(symbols.map(async (symbol) => {
    try {
      const points = await fetchTradeXyzCandles(symbol);
      return [symbol, points];
    } catch {
      return [symbol, []];
    }
  }));

  return jsonResponse(response, 200, {
    ok: true,
    updatedAt: new Date().toISOString(),
    items: Object.fromEntries(results)
  }, "s-maxage=60, stale-while-revalidate=300");
}
