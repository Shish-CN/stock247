const KRAKEN_API = "https://api.kraken.com/0/public";
const BACKED_API = "https://api.backed.fi/api/v2/public";
const DISCOVERY_TTL_MS = 15 * 60 * 1000;
const TOP_TTL_MS = 45 * 1000;
const QUOTE_TTL_MS = 20 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const QUOTE_KRAKEN_TIMEOUT_MS = 1800;
const BACKED_QUOTE_TIMEOUT_MS = 1800;

const STOCK_META = new Map(
  [
    ["AAPL", "Apple"],
    ["MSFT", "Microsoft"],
    ["NVDA", "NVIDIA"],
    ["TSLA", "Tesla"],
    ["AMZN", "Amazon"],
    ["GOOGL", "Alphabet A"],
    ["GOOG", "Alphabet C"],
    ["META", "Meta"],
    ["AVGO", "Broadcom"],
    ["AMD", "AMD"],
    ["MU", "Micron Technology"],
    ["SNDK", "SanDisk Corporation"],
    ["NFLX", "Netflix"],
    ["PLTR", "Palantir"],
    ["COIN", "Coinbase"],
    ["MSTR", "MicroStrategy"],
    ["HOOD", "Robinhood"],
    ["ORCL", "Oracle"],
    ["INTC", "Intel"],
    ["IBM", "IBM"],
    ["CRM", "Salesforce"],
    ["ADBE", "Adobe"],
    ["PYPL", "PayPal"],
    ["UBER", "Uber"],
    ["ABNB", "Airbnb"],
    ["DIS", "Disney"],
    ["BABA", "Alibaba"],
    ["NKE", "Nike"],
    ["SBUX", "Starbucks"],
    ["WMT", "Walmart"],
    ["COST", "Costco"],
    ["JPM", "JPMorgan Chase"],
    ["GS", "Goldman Sachs"],
    ["V", "Visa"],
    ["MA", "Mastercard"],
    ["UNH", "UnitedHealth"],
    ["JNJ", "Johnson & Johnson"],
    ["LLY", "Eli Lilly"],
    ["XOM", "Exxon Mobil"],
    ["CVX", "Chevron"],
    ["PG", "Procter & Gamble"],
    ["KO", "Coca-Cola"],
    ["PEP", "PepsiCo"],
    ["BRKB", "Berkshire Hathaway"],
    ["BA", "Boeing"],
    ["GE", "GE Aerospace"],
    ["GM", "General Motors"],
    ["F", "Ford"],
    ["PFE", "Pfizer"],
    ["MRNA", "Moderna"],
    ["SHOP", "Shopify"],
    ["SNOW", "Snowflake"],
    ["SQ", "Block"],
    ["RBLX", "Roblox"],
    ["SOFI", "SoFi"],
    ["CRCL", "Circle"]
  ].sort((a, b) => b[0].length - a[0].length)
);

const ETF_SYMBOLS = new Set(["SPY", "QQQ", "GLD", "SLV", "VOO", "IWM"]);
const USD_QUOTES = ["USDT", "USDC", "ZUSD", "USD"];

let discoveryCache = null;
let topCache = null;
let quoteTickerCache = null;
const quoteCache = new Map();

function normalize(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeRequestedSymbol(raw) {
  const requestedSymbol = String(raw || "").trim();
  let cleaned = requestedSymbol
    .toUpperCase()
    .replace(/^\$/, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9/_\-.]/g, "");

  if (!cleaned || cleaned.length > 24) return null;

  const pairParts = cleaned.split(/[/_\-]/).filter(Boolean);
  if (pairParts.length > 1 && USD_QUOTES.includes(pairParts.at(-1))) {
    cleaned = pairParts.slice(0, -1).join("");
  }

  cleaned = cleaned.replace(/[^A-Z0-9]/g, "");
  for (const quote of USD_QUOTES) {
    if (cleaned.endsWith(quote)) {
      cleaned = cleaned.slice(0, -quote.length);
      break;
    }
  }

  cleaned = cleaned.replace(/XSTOCKS?$/, "").replace(/STOCKS?$/, "");
  if (cleaned.endsWith("X") && cleaned.length > 1) cleaned = cleaned.slice(0, -1);

  if (!/^[A-Z0-9]{1,8}$/.test(cleaned)) return null;

  return {
    baseSymbol: cleaned,
    assetSymbol: `${cleaned}x`,
    requestedSymbol
  };
}

function fromCache(cache) {
  if (!cache || Date.now() > cache.expiresAt) return null;
  return cache.value;
}

function providerFailure(provider, error) {
  if (error?.notListed) {
    return {
      provider,
      status: "not_listed",
      reason: error.message || "tokenized asset not listed"
    };
  }

  return {
    provider,
    status: error?.isTimeout ? "timeout" : "failed",
    reason: error?.message || "provider request failed",
    httpStatus: error?.httpStatus || null
  };
}

function quoteError({ status, code, message, providers }) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.providers = providers;
  return error;
}

async function fetchJson(url, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "stock-contract-247-site/1.0"
      }
    });

    if (!response.ok) {
      const error = new Error(`Upstream responded ${response.status}`);
      error.httpStatus = response.status;
      error.status = response.status === 404 ? 404 : 502;
      throw error;
    }

    const payload = await response.json();
    if (Array.isArray(payload.error) && payload.error.length) {
      const error = new Error(payload.error.join(", "));
      error.status = 502;
      throw error;
    }

    return payload.result ?? payload;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`request timed out after ${timeoutMs}ms`);
      timeoutError.status = 502;
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function stripQuote(value) {
  let next = normalize(value);
  for (const quote of USD_QUOTES) {
    if (next.endsWith(quote)) {
      next = next.slice(0, -quote.length);
      break;
    }
  }
  return next.replace(/^XSTOCKS?/, "").replace(/^X/, "").replace(/X$/, "");
}

function identifyStock(pairKey, info) {
  const quote = normalize(info.quote || "");
  const quoteName = normalize(info.quote_name || "");
  const names = [pairKey, info.altname, info.wsname, info.base, info.base_name].filter(Boolean);

  const hasUsdQuote =
    quote.includes("USD") ||
    quoteName.includes("USD") ||
    names.some((name) => /[/_-]USD[TC]?$/.test(String(name).toUpperCase()));

  if (!hasUsdQuote) return null;

  const baseHints = names.map(stripQuote);
  for (const [symbol] of STOCK_META) {
    if (ETF_SYMBOLS.has(symbol)) continue;

    if (
      baseHints.some(
        (hint) =>
          hint === symbol ||
          hint === `${symbol}X` ||
          hint === `X${symbol}` ||
          hint.startsWith(`${symbol}STOCK`) ||
          hint.startsWith(`${symbol}XSTOCK`)
      )
    ) {
      return symbol;
    }
  }

  for (const hint of baseHints) {
    const candidate = hint.replace(/XSTOCKS?$/, "").replace(/STOCKS?$/, "").replace(/X$/, "");
    if (/^[A-Z]{1,6}$/.test(candidate) && !ETF_SYMBOLS.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function contractScore(info) {
  const joined = normalize(
    [info.altname, info.wsname, info.base, info.quote, info.status].filter(Boolean).join(" ")
  );
  let score = 0;
  if (joined.includes("XSTOCK")) score += 5;
  if (joined.includes("USD")) score += 4;
  if (joined.includes("USDT") || joined.includes("USDC")) score += 2;
  if (String(info.status || "").toLowerCase() === "online") score += 2;
  return score;
}

async function discoverContracts(timeoutMs = REQUEST_TIMEOUT_MS) {
  const cached = fromCache(discoveryCache);
  if (cached) return cached;

  const pairs = await fetchJson(
    `${KRAKEN_API}/AssetPairs?aclass_base=tokenized_asset&assetVersion=1`,
    { timeoutMs }
  );
  const contracts = new Map();

  for (const [pairKey, info] of Object.entries(pairs || {})) {
    if (info.status && String(info.status).toLowerCase() !== "online") continue;

    const symbol = identifyStock(pairKey, info);
    if (!symbol) continue;

    const candidate = {
      pairKey,
      symbol,
      assetSymbol: `${symbol}x`,
      name: STOCK_META.get(symbol) || `${symbol} tokenized stock`,
      altname: info.altname || pairKey,
      wsname: info.wsname || info.altname || pairKey,
      score: contractScore(info)
    };

    const current = contracts.get(symbol);
    if (!current || candidate.score > current.score) {
      contracts.set(symbol, candidate);
    }
  }

  const value = {
    contracts,
    discoveredAt: new Date().toISOString(),
    source: "Kraken public REST API"
  };

  discoveryCache = {
    expiresAt: Date.now() + DISCOVERY_TTL_MS,
    value
  };

  return value;
}

async function fetchTicker(pairKeys, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (!pairKeys.length) return {};
  const batches = [];

  for (let index = 0; index < pairKeys.length; index += 20) {
    batches.push(pairKeys.slice(index, index + 20));
  }

  const responses = await Promise.all(
    batches.map((batch) =>
      fetchJson(
        `${KRAKEN_API}/Ticker?asset_class=tokenized_asset&assetVersion=1&pair=${encodeURIComponent(
          batch.join(",")
        )}`,
        { timeoutMs }
      )
    )
  );

  return Object.assign({}, ...responses);
}

async function fetchAllTokenizedTickers(timeoutMs = QUOTE_KRAKEN_TIMEOUT_MS) {
  const cached = fromCache(quoteTickerCache);
  if (cached) return cached;

  const value = await fetchJson(
    `${KRAKEN_API}/Ticker?asset_class=tokenized_asset&assetVersion=1`,
    { timeoutMs }
  );

  quoteTickerCache = {
    expiresAt: Date.now() + 5 * 1000,
    value
  };

  return value;
}

function tickerBaseCandidates(pairKey, tickerPayload) {
  return [pairKey, tickerPayload?.altname, tickerPayload?.wsname, tickerPayload?.base]
    .filter(Boolean)
    .map((value) => stripQuote(value));
}

function matchTokenizedTicker(baseSymbol, tickerResult) {
  const target = normalize(baseSymbol);
  const targetAsset = normalize(`${baseSymbol}x`);

  for (const [pairKey, tickerPayload] of Object.entries(tickerResult || {})) {
    const normalizedPair = normalize(pairKey);
    const candidates = tickerBaseCandidates(pairKey, tickerPayload);
    const matches =
      candidates.includes(target) ||
      candidates.includes(targetAsset) ||
      normalizedPair.startsWith(targetAsset) ||
      normalizedPair.startsWith(target);

    if (matches) {
      return {
        pairKey,
        tickerPayload
      };
    }
  }

  return null;
}

function percentChange(price, previousClose) {
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) return null;
  return ((price - previousClose) / previousClose) * 100;
}

function buildQuote({ baseSymbol, assetSymbol, requestedSymbol, pair, name, tickerPayload, source, exchange }) {
  const price = Number(tickerPayload?.c?.[0] ?? tickerPayload?.quote ?? tickerPayload?.price);
  const open = Number(tickerPayload?.o ?? tickerPayload?.open);
  const previousClose = Number(tickerPayload?.p?.[1] ?? tickerPayload?.p?.[0] ?? tickerPayload?.previousClose);
  const bid = Number(tickerPayload?.b?.[0] ?? tickerPayload?.bid);
  const ask = Number(tickerPayload?.a?.[0] ?? tickerPayload?.ask);
  const high24h = Number(tickerPayload?.h?.[1] ?? tickerPayload?.h?.[0]);
  const low24h = Number(tickerPayload?.l?.[1] ?? tickerPayload?.l?.[0]);
  const baseVolume24h = Number(tickerPayload?.v?.[1] ?? tickerPayload?.v?.[0]);
  const trades24h = Number(tickerPayload?.t?.[1] ?? tickerPayload?.t?.[0]);
  const close = Number.isFinite(previousClose) ? previousClose : price;
  const changeBase = Number.isFinite(previousClose) ? previousClose : open;
  const change = Number.isFinite(price - changeBase) ? price - changeBase : null;
  const changePercent = percentChange(price, changeBase);
  const quoteVolume24h = Number.isFinite(price * baseVolume24h) ? price * baseVolume24h : null;
  const timestamp = new Date().toISOString();

  return {
    symbol: assetSymbol,
    requestedSymbol,
    pair,
    name,
    price: Number.isFinite(price) ? price : null,
    last: Number.isFinite(price) ? price : null,
    close: Number.isFinite(close) ? close : null,
    regularMarketPrice: Number.isFinite(price) ? price : null,
    open: Number.isFinite(open) ? open : null,
    previousClose: Number.isFinite(previousClose) ? previousClose : null,
    change,
    changePercent,
    bid: Number.isFinite(bid) ? bid : null,
    ask: Number.isFinite(ask) ? ask : null,
    currency: "USD",
    exchange,
    quoteType: "tokenized_asset",
    tradingHours: "24x7",
    timestamp,
    high24h: Number.isFinite(high24h) ? high24h : null,
    low24h: Number.isFinite(low24h) ? low24h : null,
    change24h: change,
    changePercent24h: changePercent,
    baseVolume24h: Number.isFinite(baseVolume24h) ? baseVolume24h : null,
    quoteVolume24h,
    trades24h: Number.isFinite(trades24h) ? trades24h : null,
    contract: pair,
    pairKey: pair,
    source,
    updatedAt: timestamp,
    baseSymbol
  };
}

function toMarketQuote(contract, tickerPayload) {
  return buildQuote({
    baseSymbol: contract.symbol,
    assetSymbol: contract.assetSymbol || `${contract.symbol}x`,
    requestedSymbol: contract.assetSymbol || `${contract.symbol}x`,
    pair: contract.wsname || contract.altname || contract.pairKey,
    name: contract.name,
    tickerPayload,
    source: "Kraken xStocks",
    exchange: "Kraken"
  });
}

function matchTicker(contract, tickerResult) {
  const direct =
    tickerResult[contract.pairKey] || tickerResult[contract.altname] || tickerResult[contract.wsname];
  if (direct) return direct;

  const aliases = [contract.pairKey, contract.altname, contract.wsname].map(normalize);
  const fuzzy = Object.entries(tickerResult).find(([key]) => aliases.includes(normalize(key)));
  if (fuzzy) return fuzzy[1];

  const entries = Object.values(tickerResult);
  return entries.length === 1 ? entries[0] : null;
}

async function getKrakenQuote(normalized) {
  const tickerResult = await fetchAllTokenizedTickers(QUOTE_KRAKEN_TIMEOUT_MS);
  const match = matchTokenizedTicker(normalized.baseSymbol, tickerResult);

  if (!match) {
    const error = new Error(`${normalized.assetSymbol} is not listed by Kraken tokenized assets`);
    error.notListed = true;
    throw error;
  }

  const quote = buildQuote({
    baseSymbol: normalized.baseSymbol,
    assetSymbol: normalized.assetSymbol,
    requestedSymbol: normalized.requestedSymbol,
    pair: match.pairKey,
    name: STOCK_META.get(normalized.baseSymbol) || `${normalized.baseSymbol} tokenized stock`,
    tickerPayload: match.tickerPayload,
    source: "Kraken tokenized asset ticker",
    exchange: "Kraken"
  });

  if (!Number.isFinite(quote.price)) {
    const error = new Error("Kraken returned ticker without a valid last price");
    error.status = 502;
    throw error;
  }

  return quote;
}

async function getBackedQuote(normalized) {
  const assetSymbol = normalized.assetSymbol;

  try {
    const priceData = await fetchJson(
      `${BACKED_API}/assets/${encodeURIComponent(assetSymbol)}/price-data`,
      { timeoutMs: BACKED_QUOTE_TIMEOUT_MS }
    );
    const price = Number(priceData?.quote ?? priceData?.price ?? priceData?.last);

    if (!Number.isFinite(price)) {
      const error = new Error(`${assetSymbol} price-data did not include a valid price`);
      error.status = 502;
      throw error;
    }

    return buildQuote({
      baseSymbol: normalized.baseSymbol,
      assetSymbol,
      requestedSymbol: normalized.requestedSymbol,
      pair: assetSymbol,
      name: STOCK_META.get(normalized.baseSymbol) || `${normalized.baseSymbol} tokenized stock`,
      tickerPayload: {
        quote: price,
        previousClose: price
      },
      source: "Backed Finance price-data fallback",
      exchange: "Backed Finance"
    });
  } catch (error) {
    if (error.status === 404 || error.httpStatus === 404 || String(error.message || "").includes("404")) {
      const notListed = new Error(`${assetSymbol} is not listed by Backed Finance`);
      notListed.notListed = true;
      throw notListed;
    }

    throw error;
  }
}

function cacheQuote(cacheKey, item) {
  const value = {
    ok: true,
    item
  };

  quoteCache.set(cacheKey, {
    expiresAt: Date.now() + QUOTE_TTL_MS,
    value
  });

  return value;
}

export async function getTopMarkets() {
  const cached = fromCache(topCache);
  if (cached) return cached;

  const discovery = await discoverContracts();
  const contracts = [...discovery.contracts.values()];

  if (!contracts.length) {
    throw new Error("No supported tokenized stock contracts were discovered from Kraken.");
  }

  const tickerResult = await fetchTicker(contracts.map((contract) => contract.pairKey));
  const quotes = contracts
    .map((contract) => {
      const ticker = matchTicker(contract, tickerResult);
      return ticker ? toMarketQuote(contract, ticker) : null;
    })
    .filter((quote) => quote && Number.isFinite(quote.price))
    .sort((a, b) => (b.quoteVolume24h || 0) - (a.quoteVolume24h || 0))
    .slice(0, 10);

  const value = {
    ok: true,
    source: discovery.source,
    discoveredAt: discovery.discoveredAt,
    updatedAt: new Date().toISOString(),
    items: quotes
  };

  topCache = {
    expiresAt: Date.now() + TOP_TTL_MS,
    value
  };

  return value;
}

export async function getQuote(rawSymbol) {
  const normalized = normalizeRequestedSymbol(rawSymbol);
  if (!normalized) {
    const error = new Error("请输入股票代币代码，例如 AAPL、AAPLx 或 AAPL/USD。");
    error.status = 400;
    error.code = "invalid_symbol";
    throw error;
  }

  const cached = fromCache(quoteCache.get(normalized.assetSymbol));
  if (cached) return cached;

  const providers = [];
  let hasProviderFailure = false;

  try {
    const krakenQuote = await getKrakenQuote(normalized);
    providers.push({ provider: "kraken", status: "ok" });
    return cacheQuote(normalized.assetSymbol, krakenQuote);
  } catch (error) {
    const failure = providerFailure("kraken", error);
    providers.push(failure);
    if (failure.status !== "not_listed") hasProviderFailure = true;
  }

  try {
    const backedQuote = await getBackedQuote(normalized);
    providers.push({ provider: "backed_finance", status: "ok" });
    return cacheQuote(normalized.assetSymbol, backedQuote);
  } catch (error) {
    const failure = providerFailure("backed_finance", error);
    providers.push(failure);
    if (failure.status !== "not_listed") hasProviderFailure = true;
  }

  if (!hasProviderFailure && providers.every((provider) => provider.status === "not_listed")) {
    throw quoteError({
      status: 404,
      code: "tokenized_symbol_not_listed",
      message: `${normalized.assetSymbol} is not listed by the configured tokenized stock providers.`,
      providers
    });
  }

  throw quoteError({
    status: 502,
    code: "quote_unavailable",
    message: `${normalized.assetSymbol} tokenized quote is unavailable from upstream providers.`,
    providers
  });
}
