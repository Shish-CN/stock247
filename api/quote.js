const CACHE_CONTROL = "s-maxage=5, stale-while-revalidate=30";
const USER_AGENT =
  "stock247/1.0 (+https://stock247.vercel.app; tokenized quote)";

const PROVIDER_TIMEOUT_MS = {
  kraken: 3200,
  backed: 1600,
};

function normalizeInputSymbol(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (!raw || raw.length > 32) {
    return null;
  }

  if (!/^[A-Z0-9./:_-]+$/.test(raw)) {
    return null;
  }

  return raw;
}

function baseSymbol(symbol) {
  const compact = symbol
    .replace(/[_:-]/g, "/")
    .split("/")[0]
    .replace(/USD[TDC]?$/, "")
    .replace(/\.US$/, "");

  if (compact.endsWith("X") && compact.length > 1) {
    return compact.slice(0, -1);
  }

  return compact;
}

function backedAssetSymbol(symbol) {
  return `${baseSymbol(symbol)}x`;
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function percentChange(price, reference) {
  if (!Number.isFinite(price) || !Number.isFinite(reference) || reference === 0) {
    return null;
  }

  return ((price - reference) / reference) * 100;
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json,text/plain,*/*",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 180)}`);
    }

    if (!body) {
      throw new Error("empty response");
    }

    return JSON.parse(body);
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMarketName(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function pairBaseCandidates(symbol) {
  const base = baseSymbol(symbol);
  return new Set([base, `${base}X`, `${base}XSTOCK`].map(normalizeMarketName));
}

function pairQuoteRank(pairKey) {
  const normalized = normalizeMarketName(pairKey);

  if (normalized.endsWith("USD")) {
    return 0;
  }

  if (normalized.endsWith("USDC")) {
    return 1;
  }

  if (normalized.endsWith("USDT")) {
    return 2;
  }

  return 9;
}

function isPairForSymbol(pairKey, pair, symbol) {
  const candidates = pairBaseCandidates(symbol);
  const baseFields = [
    pair?.base,
    pair?.wsname?.split("/")?.[0],
    pair?.altname?.replace(/USD[TDC]?$/i, ""),
    pairKey?.split("/")?.[0],
    pairKey?.replace(/USD[TDC]?$/i, ""),
  ];

  return baseFields.some((field) => candidates.has(normalizeMarketName(field)));
}

function selectTicker(result, symbol) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const matches = Object.entries(result)
    .filter(([pairKey, ticker]) => isPairForSymbol(pairKey, ticker, symbol))
    .sort(([leftKey], [rightKey]) => pairQuoteRank(leftKey) - pairQuoteRank(rightKey));

  if (matches.length === 0) {
    return null;
  }

  const [pairKey, ticker] = matches[0];
  return { pairKey, ticker };
}

function tickerPayload({ symbol, pairKey, ticker, source }) {
  const price = asNumber(ticker?.c?.[0]);
  const open = asNumber(ticker?.o);

  if (price === null) {
    throw new Error("missing ticker price");
  }

  const change = open === null ? null : price - open;
  const changePercent = open === null ? null : percentChange(price, open);
  const bid = asNumber(ticker?.b?.[0]);
  const ask = asNumber(ticker?.a?.[0]);
  const volume = asNumber(ticker?.v?.[1] ?? ticker?.v?.[0]);

  return {
    symbol: backedAssetSymbol(symbol),
    requestedSymbol: symbol,
    pair: pairKey,
    name: backedAssetSymbol(symbol),
    price,
    last: price,
    close: price,
    regularMarketPrice: price,
    open,
    previousClose: open,
    change,
    dayChange: change,
    regularMarketChange: change,
    changePercent,
    dayChangePercent: changePercent,
    regularMarketChangePercent: changePercent,
    bid,
    ask,
    volume,
    currency: pairKey.includes("USDC") ? "USDC" : pairKey.includes("USDT") ? "USDT" : "USD",
    exchange: "Kraken",
    market: "Kraken",
    source,
    provider: source,
    assetType: "TOKENIZED_EQUITY",
    quoteType: "tokenized_asset",
    tradingHours: "24x7",
    changeBasis: "utc_day_open",
    timestamp: new Date().toISOString(),
  };
}

async function krakenTokenizedQuote(symbol) {
  const url =
    "https://api.kraken.com/0/public/Ticker?asset_class=tokenized_asset&assetVersion=1";
  const data = await fetchJson(url, PROVIDER_TIMEOUT_MS.kraken);

  if (Array.isArray(data?.error) && data.error.length > 0) {
    throw new Error(data.error.join("; "));
  }

  const selected = selectTicker(data?.result, symbol);

  if (!selected) {
    throw new Error(`tokenized pair not listed on Kraken for ${backedAssetSymbol(symbol)}`);
  }

  return tickerPayload({
    symbol,
    pairKey: selected.pairKey,
    ticker: selected.ticker,
    source: "kraken",
  });
}

function findDeepValue(value, keys) {
  const queue = [value];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        const found = current[key];
        if (found !== null && found !== undefined && found !== "") {
          return found;
        }
      }
    }

    for (const nested of Object.values(current)) {
      if (nested && typeof nested === "object") {
        queue.push(nested);
      }
    }
  }

  return null;
}

async function backedQuote(symbol) {
  const assetSymbol = backedAssetSymbol(symbol);
  const url = `https://api.backed.fi/api/v2/public/assets/${encodeURIComponent(
    assetSymbol
  )}/price-data`;
  const data = await fetchJson(url, PROVIDER_TIMEOUT_MS.backed);
  const price = asNumber(
    findDeepValue(data, [
      "price",
      "lastPrice",
      "currentPrice",
      "marketPrice",
      "close",
      "nav",
      "value",
    ])
  );
  const open = asNumber(findDeepValue(data, ["open", "previousClose", "prevClose"]));

  if (price === null) {
    throw new Error("missing Backed price");
  }

  const change = open === null ? null : price - open;
  const changePercent = open === null ? null : percentChange(price, open);

  return {
    symbol: assetSymbol,
    requestedSymbol: symbol,
    pair: `${assetSymbol}/USD`,
    name: assetSymbol,
    price,
    last: price,
    close: price,
    regularMarketPrice: price,
    open,
    previousClose: open,
    change,
    dayChange: change,
    regularMarketChange: change,
    changePercent,
    dayChangePercent: changePercent,
    regularMarketChangePercent: changePercent,
    currency: findDeepValue(data, ["currency", "quoteCurrency", "fiatCurrency"]) || "USD",
    exchange: "Backed",
    market: "Backed",
    source: "backed",
    provider: "backed",
    assetType: "TOKENIZED_EQUITY",
    quoteType: "tokenized_asset",
    tradingHours: "24x7",
    changeBasis: "provider_open",
    timestamp:
      findDeepValue(data, ["updatedAt", "timestamp", "time"]) ||
      new Date().toISOString(),
  };
}

function compactError(error) {
  const message =
    error && typeof error.message === "string"
      ? error.message
      : "unknown error";

  return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

async function resolveTokenizedQuote(symbol) {
  const providers = [krakenTokenizedQuote, backedQuote];
  const errors = [];

  for (const provider of providers) {
    try {
      return {
        quote: await provider(symbol),
        errors,
      };
    } catch (error) {
      errors.push({
        provider: provider.name.replace(/Quote$/i, "").replace("Tokenized", ""),
        message: compactError(error),
      });
    }
  }

  return { quote: null, errors };
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const symbol = normalizeInputSymbol(req.query?.symbol);

  res.setHeader("Cache-Control", CACHE_CONTROL);

  if (!symbol) {
    return res.status(400).json({
      error: "invalid_symbol",
      message: "Provide a tokenized stock symbol, for example /api/quote?symbol=AAPL.",
    });
  }

  const startedAt = Date.now();
  const { quote, errors } = await resolveTokenizedQuote(symbol);

  if (!quote) {
    const upstreamUnavailable = errors.some((error) =>
      /timeout|fetch failed|network|HTTP 5/i.test(error.message)
    );
    const definitelyUnlisted =
      !upstreamUnavailable &&
      errors.some((error) => /not listed on Kraken|HTTP 404/i.test(error.message));

    return res.status(definitelyUnlisted ? 404 : 502).json({
      error: definitelyUnlisted ? "tokenized_symbol_not_listed" : "quote_unavailable",
      message: `No 24x7 tokenized quote provider returned data for ${backedAssetSymbol(
        symbol
      )}.`,
      symbol: backedAssetSymbol(symbol),
      requestedSymbol: symbol,
      providers: errors,
      durationMs: Date.now() - startedAt,
    });
  }

  return res.status(200).json({
    ...quote,
    fallbackErrors: errors,
    durationMs: Date.now() - startedAt,
  });
}
