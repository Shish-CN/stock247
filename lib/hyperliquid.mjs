const DEFAULT_API_BASE = "https://api.hyperliquid.xyz";
const DEFAULT_TIMEOUT_MS = 6500;

export function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSymbol(value = "") {
  return String(value)
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/^XYZ:/, "")
    .replace(/[^A-Z0-9._-]/g, "");
}

export function selectPrice(context = {}) {
  const candidates = [["mark", context.markPx], ["mid", context.midPx], ["oracle", context.oraclePx]];
  for (const [source, rawValue] of candidates) {
    const value = finiteNumber(rawValue);
    if (value !== null) return { value, source };
  }
  return { value: null, source: null };
}

export function transformMarkets(payload, timestamp = new Date().toISOString()) {
  if (!Array.isArray(payload) || !payload[0] || !Array.isArray(payload[0].universe) || !Array.isArray(payload[1])) {
    throw new Error("invalid_hyperliquid_payload");
  }

  return payload[0].universe.map((meta, index) => {
    const context = payload[1][index];
    if (!meta?.name || !context || meta.isDelisted) return null;
    const symbol = normalizeSymbol(meta.name);
    const selected = selectPrice(context);
    const previous = finiteNumber(context.prevDayPx);
    const change = selected.value !== null && previous !== null ? selected.value - previous : null;
    const changePercent = change !== null && previous !== 0 ? (change / previous) * 100 : null;
    return {
      symbol,
      contractSymbol: String(meta.name).includes(":") ? String(meta.name) : `xyz:${meta.name}`,
      price: selected.value,
      priceSource: selected.source,
      markPrice: finiteNumber(context.markPx),
      midPrice: finiteNumber(context.midPx),
      oraclePrice: finiteNumber(context.oraclePx),
      previousDayPrice: previous,
      change24h: change,
      changePercent24h: changePercent,
      volume24h: finiteNumber(context.dayNtlVlm),
      baseVolume24h: finiteNumber(context.dayBaseVlm),
      openInterest: finiteNumber(context.openInterest),
      funding: finiteNumber(context.funding),
      maxLeverage: finiteNumber(meta.maxLeverage),
      updatedAt: timestamp,
      exchange: "trade.xyz / Hyperliquid",
      tradingHours: "24x7",
      quoteType: "perpetual_contract"
    };
  }).filter(Boolean).sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
}

async function fetchJson(url, options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "stock247/4.0",
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`hyperliquid_http_${response.status}`);
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("hyperliquid_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTradeXyzMarkets() {
  const base = (process.env.HYPERLIQUID_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const payload = await fetchJson(`${base}/info`, {
    method: "POST",
    body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" })
  });
  return transformMarkets(payload);
}

export function parseLimit(value, fallback = 20, maximum = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(1, parsed));
}

export function jsonResponse(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", cacheControl);
  response.setHeader("access-control-allow-origin", "*");
  response.end(JSON.stringify(payload));
}
