const state = { markets: [], query: "", sort: "volume", loading: false };

const $ = (selector) => document.querySelector(selector);
const elements = {
  loading: $("#loading"), panel: $("#market-panel"), notice: $("#notice"),
  tableBody: $("#market-table-body"), cards: $("#market-cards"),
  search: $("#search-input"), sort: $("#sort-select"), refresh: $("#refresh-button"),
  statusDot: $("#status-dot"), statusText: $("#status-text"),
  updatedAt: $("#updated-at"), resultCount: $("#result-count")
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

  return items.sort((a, b) => {
    if (state.sort === "symbol") return a.symbol.localeCompare(b.symbol);
    if (state.sort === "change") return (b.changePercent24h ?? -Infinity) - (a.changePercent24h ?? -Infinity);
    if (state.sort === "openInterest") return (b.openInterest ?? -Infinity) - (a.openInterest ?? -Infinity);
    return (b.volume24h ?? -Infinity) - (a.volume24h ?? -Infinity);
  }).slice(0, 20);
}

function render() {
  const items = visibleMarkets();
  elements.resultCount.textContent = `${items.length} 个合约`;

  if (!items.length) {
    elements.tableBody.innerHTML = '<tr><td colspan="8" class="empty">没有匹配的 trade.xyz 合约。</td></tr>';
    elements.cards.innerHTML = '<div class="empty-card">没有匹配的 trade.xyz 合约。</div>';
    return;
  }

  elements.tableBody.innerHTML = items.map((item, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.contractSymbol)}</small></td>
      <td><strong>${formatPrice(item.price)}</strong><small>${item.tradingHours}</small></td>
      <td class="${tone(item.changePercent24h)}"><strong>${formatSigned(item.changePercent24h, "%")}</strong><small>${formatSigned(item.change24h)}</small></td>
      <td>${formatCompact(item.volume24h, true)}</td>
      <td>${formatCompact(item.openInterest)}</td>
      <td>${item.funding == null ? "暂无" : `${(item.funding * 100).toFixed(5)}%`}</td>
      <td><span class="source-tag">${escapeHtml(item.priceSource || "暂无")}</span></td>
    </tr>`).join("");

  elements.cards.innerHTML = items.map((item, index) => `
    <article class="market-card">
      <div class="card-top">
        <div><span class="rank">#${index + 1}</span><strong>${escapeHtml(item.symbol)}</strong><small>${escapeHtml(item.contractSymbol)}</small></div>
        <div class="${tone(item.changePercent24h)}"><strong>${formatSigned(item.changePercent24h, "%")}</strong><small>24H</small></div>
      </div>
      <div class="card-grid">
        <div><span>合约价格</span><strong>${formatPrice(item.price)}</strong></div>
        <div><span>24H 成交额</span><strong>${formatCompact(item.volume24h, true)}</strong></div>
        <div><span>持仓量</span><strong>${formatCompact(item.openInterest)}</strong></div>
        <div><span>Funding</span><strong>${item.funding == null ? "暂无" : `${(item.funding * 100).toFixed(5)}%`}</strong></div>
      </div>
      <div class="card-footer">价格来源：${escapeHtml(item.priceSource || "暂无")}</div>
    </article>`).join("");
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
    const response = await fetch("/api/markets?limit=100", { headers: { accept: "application/json" } });
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
