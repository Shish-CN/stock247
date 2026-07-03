const KRAKEN_API = "https://api.kraken.com/0/public";
const BACKED_API = "https://api.backed.fi/api/v2/public";
const DISCOVERY_TTL_MS = 15 * 60 * 1000;
const TOP_TTL_MS = 45 * 1000;
const QUOTE_TTL_MS = 20 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const QUOTE_KRAKEN_TIMEOUT_MS = 2500;

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

let discoveryCache = null;
let topCache = null;
const quoteCache = new Map();

function normalize(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sanitizeSymbol(raw) {
  const cleaned = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/^\$/, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Z.]/g, "");

  if (!cleaned || cleaned.length > 8) return null;
  return cleaned.replace(".", "");
}

function fromCache(cache) {
  if (!cache || Date.now() > cache.expiresAt) return null;
  return cache.value;
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
      error.status = response.status === 404 ? 404 : 502;
      throw error;
    }

    const payload = await response.json();
    if (Array.isArray(payload.error) && payload.error.length) {
      throw new Error(payload.error.join(", "));
    }

    return payload.result ?? payload;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`上游请求超时：${new URL(url).hostname}`);
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function stripQuote(value) {
  let next = normalize(value);
  for (const quote of ["USDT", "USDC", "ZUSD", "USD"]) {
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
      name: STOCK_META.get(symbol) || `${symbol} stock`,
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

function toMarketQuote(contract, tickerPayload) {
  const price = Number(tickerPayload?.c?.[0]);
  const open = Number(tickerPayload?.o);
  const bid = Number(tickerPayload?.b?.[0]);
  const ask = Number(tickerPayload?.a?.[0]);
  const baseVolume24h = Number(tickerPayload?.v?.[1] ?? tickerPayload?.v?.[0]);
  const trades24h = Number(tickerPayload?.t?.[1] ?? tickerPayload?.t?.[0]);
  const high24h = Number(tickerPayload?.h?.[1] ?? tickerPayload?.h?.[0]);
  const low24h = Number(tickerPayload?.l?.[1] ?? tickerPayload?.l?.[0]);
  const quoteVolume24h = Number.isFinite(price * baseVolume24h) ? price * baseVolume24h : null;

  return {
    symbol: contract.symbol,
    name: contract.name,
    price: Number.isFinite(price) ? price : null,
    bid: Number.isFinite(bid) ? bid : null,
    ask: Number.isFinite(ask) ? ask : null,
    high24h: Number.isFinite(high24h) ? high24h : null,
    low24h: Number.isFinite(low24h) ? low24h : null,
    change24h: Number.isFinite(price - open) ? price - open : null,
    changePercent24h: Number.isFinite(((price - open) / open) * 100)
      ? ((price - open) / open) * 100
      : null,
    baseVolume24h: Number.isFinite(baseVolume24h) ? baseVolume24h : null,
    quoteVolume24h,
    trades24h: Number.isFinite(trades24h) ? trades24h : null,
    contract: contract.wsname,
    pairKey: contract.pairKey,
    source: "Kraken xStocks",
    updatedAt: new Date().toISOString()
  };
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

async function getBackedQuote(symbol) {
  const assetSymbol = `${symbol}x`;

  try {
    const priceData = await fetchJson(
      `${BACKED_API}/assets/${encodeURIComponent(assetSymbol)}/price-data`
    );
    const price = Number(priceData?.quote);

    if (!Number.isFinite(price)) {
      const error = new Error(`${symbol} 的 xStocks 价格接口暂时没有返回有效价格。`);
      error.status = 502;
      throw error;
    }

    return {
      symbol,
      name: STOCK_META.get(symbol) || `${symbol} stock`,
      price,
      bid: null,
      ask: null,
      high24h: null,
      low24h: null,
      change24h: null,
      changePercent24h: null,
      baseVolume24h: null,
      quoteVolume24h: null,
      trades24h: null,
      contract: assetSymbol,
      pairKey: assetSymbol,
      source: "Backed xStocks public API",
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error.status === 404 || String(error.message || "").includes("404")) return null;
    throw error;
  }
}

export async function getTopMarkets() {
  const cached = fromCache(topCache);
  if (cached) return cached;

  const discovery = await discoverContracts();
  const contracts = [...discovery.contracts.values()];

  if (!contracts.length) {
    throw new Error("No supported stock contracts were discovered from the upstream source.");
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
  const symbol = sanitizeSymbol(rawSymbol);
  if (!symbol) {
    const error = new Error("请输入 1-8 位股票代码，例如 AAPL。");
    error.status = 400;
    throw error;
  }

  const cached = fromCache(quoteCache.get(symbol));
  if (cached) return cached;

  const backedQuote = await getBackedQuote(symbol);
  if (backedQuote) {
    const value = {
      ok: true,
      item: backedQuote
    };

    quoteCache.set(symbol, {
      expiresAt: Date.now() + QUOTE_TTL_MS,
      value
    });

    return value;
  }

  try {
    const discovery = await discoverContracts(QUOTE_KRAKEN_TIMEOUT_MS);
    const contract = discovery.contracts.get(symbol);

    if (contract) {
      const tickerResult = await fetchTicker([contract.pairKey], QUOTE_KRAKEN_TIMEOUT_MS);
      const quote = toMarketQuote(contract, matchTicker(contract, tickerResult));
      const value = {
        ok: true,
        item: quote
      };

      quoteCache.set(symbol, {
        expiresAt: Date.now() + QUOTE_TTL_MS,
        value
      });

      return value;
    }
  } catch {
    // Single-symbol lookup must still work when Kraken is slow or temporarily unavailable.
  }

  const error = new Error(`暂未在 Kraken 或 xStocks 官方接口发现 ${symbol} 的股票合约。`);
  error.status = 404;
  throw error;
}
