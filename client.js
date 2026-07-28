const state = { markets: [], query: "", sort: "volume", loading: false, sparklines: new Map(), sparklineRequest: 0 };

const $ = (selector) => document.querySelector(selector);
const elements = {
  loading: $("#loading"), panel: $("#market-panel"), notice: $("#notice"),
  tableBody: $("#market-table-body"), search: $("#search-input"), sort: $("#sort-select"), refresh: $("#refresh-button"),
  statusDot: $("#status-dot"), statusText: $("#status-text"), updatedAt: $("#updated-at"), resultCount: $("#result-count")
};

function normalize(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase().replace(/^XYZ:/, "");
}

function formatPrice(value) {
  if (value == null) return "暂无";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 6
  }).format(value);
}

function formatCompact(value, currency = false) {
  if (value == null) return "暂无";
  return new Intl.NumberFormat("en-US", {
    ...(currency ? { style: "currency", currency: "USD" } : {}),
    notation: "compact", maximumFractionDigits: 2
  }).format(value);
}

function formatSigned(value, suffix = "") {
  if (value == null) return "暂无";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}${suffix}`;
}

function tone(value) {
  if (value == null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function visibleMarkets() {
  const query = normalize(state.query);
  const items = query
    ? state.markets.filter((item) => normalize(item.symbol).includes(query) || normalize(item.contractSymbol).includes(query))
    : [...state.markets];

  const sorted = items.sort((a, b) => {
    if (state.sort === "symbol") return a.symbol.localeCompare(b.symbol);
    if (state.sort === "change") return (b.changePercent24h ?? -Infinity) - (a.changePercent24h ?? -Infinity);
    if (state.sort === "openInterest") return (b.openInterest ?? -Infinity) - (a.openInterest ?? -Infinity);
    return (b.volume24h ?? -Infinity) - (a.volume24h ?? -Infinity);
  });

  return query ? sorted.slice(0, 100) : sorted.slice(0, 20);
}

function sparklineSvg(item) {
  const points = state.sparklines.get(item.symbol);
  if (!points) return '<span class="sparkline-loading">加载中</span>';
  if (points.length < 2) return '<span class="sparkline-empty">暂无</span>';

  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 92;
  const height = 34;
  const padding = 2;
  const range = max - min || 1;
  const path = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg class="sparkline ${tone(item.changePercent24h)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(item.symbol)} 24小时走势"><path d="${path}" /></svg>`;
}

async function loadSparklines(items) {
  const missing = items.map((item) => item.symbol).filter((symbol) => !state.sparklines.has(symbol));
  if (!missing.length) return;
  const requestId = ++state.sparklineRequest;

  for (let index = 0; index < missing.length; index += 24) {
    const batch = missing.slice(index, index + 24);
    try {
      const response = await fetch(`/api/sparklines?symbols=${encodeURIComponent(batch.join(","))}`, { headers: { accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      for (const symbol of batch) state.sparklines.set(symbol, payload.items?.[symbol] || []);
    } catch {
      for (const symbol of batch) state.sparklines.set(symbol, []);
    }
  }

  if (requestId === state.sparklineRequest) render(false);
}

function render(fetchSparklines = true) {
  const items = visibleMarkets();
  const query = normalize(state.query);
  elements.resultCount.textContent = query ? `${items.length} 个匹配合约` : `${items.length} / ${state.markets.length} 个合约`;

  if (!items.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="9" class="empty">没有匹配的 trade.xyz 合约。</td></tr>';
    return;
  }

  elements.tableBody.innerHTML = items.map((item, index) => `
    <tr>
      <td class="rank sticky-rank">${index + 1}</td>
      <td class="sticky-symbol symbol-cell"><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.contractSymbol)}</small></td>
      <td class="price-cell"><strong>${formatPrice(item.price)}</strong><small>${item.tradingHours}</small></td>
      <td class="sparkline-cell">${sparklineSvg(item)}</td>
      <td class="volume-cell">${formatCompact(item.volume24h, true)}</td>
      <td class="change-cell ${tone(item.changePercent24h)}"><strong>${formatSigned(item.changePercent24h, "%")}</strong><small>${formatSigned(item.change24h)}</small></td>
      <td>${formatCompact(item.openInterest)}</td>
      <td>${item.funding == null ? "暂无" : `${(item.funding * 100).toFixed(5)}%`}</td>
      <td><span class="source-tag">${escapeHtml(item.priceSource || "暂无")}</span></td>
    </tr>`).join("");

  if (fetchSparklines) loadSparklines(items);
}

function setStatus(type, text, updatedAt = null) {
  elements.statusDot.className = `status-dot ${type}`;
  elements.statusText.textContent = text;
  elements.updatedAt.textContent = updatedAt
    ? `更新于 ${new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(updatedAt))}`
    : "尚未更新";
}

async function loadMarkets() {
  if (state.loading) return;
  state.loading = true;
  elements.refresh.disabled = true;
  elements.notice.hidden = true;
  setStatus("loading", "正在刷新");
  if (!state.markets.length) { elements.loading.hidden = false; elements.panel.hidden = true; }

  try {
    const response = await fetch("/api/markets?limit=500", { headers: { accept: "application/json" } });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.reason || payload.error || `HTTP ${response.status}`);
    state.markets = payload.items || [];
    elements.loading.hidden = true;
    elements.panel.hidden = false;
    setStatus("online", "行情正常", payload.updatedAt);
    render();
  } catch (error) {
    elements.loading.hidden = true;
    elements.notice.hidden = false;
    elements.notice.textContent = `行情加载失败：${error instanceof Error ? error.message : "未知错误"}`;
    setStatus("error", "连接失败");
  } finally {
    state.loading = false;
    elements.refresh.disabled = false;
  }
}

elements.search.addEventListener("input", (event) => { state.query = event.target.value; render(); });
elements.sort.addEventListener("change", (event) => { state.sort = event.target.value; render(); });
elements.refresh.addEventListener("click", loadMarkets);
loadMarkets();
setInterval(loadMarkets, 30_000);
