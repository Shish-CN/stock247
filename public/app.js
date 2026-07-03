const topRows = document.querySelector("#topRows");
const lastUpdated = document.querySelector("#lastUpdated");
const refreshButton = document.querySelector("#refreshButton");
const statusBadge = document.querySelector(".status");
const statusText = document.querySelector("#statusText");
const lookupForm = document.querySelector("#lookupForm");
const symbolInput = document.querySelector("#symbolInput");
const quoteResult = document.querySelector("#quoteResult");

const state = {
  topItems: [],
  loadingTop: false,
  loadingQuote: false
};

function formatUsd(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 2 : digits,
    minimumFractionDigits: value < 10 ? Math.min(digits, 4) : 2
  }).format(value);
}

function formatCompact(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusBadge.classList.toggle("is-error", isError);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || "请求失败");
  }
  return payload;
}

function renderTopRows(items) {
  if (!items.length) {
    topRows.innerHTML = `<tr><td colspan="6" class="empty">当前数据源没有返回股票合约</td></tr>`;
    return;
  }

  const maxVolume = Math.max(...items.map((item) => item.quoteVolume24h || 0), 1);
  topRows.innerHTML = items
    .map((item, index) => {
      const changeClass = item.changePercent24h >= 0 ? "up" : "down";
      const spread =
        Number.isFinite(item.ask) && Number.isFinite(item.bid) ? item.ask - item.bid : null;
      const barWidth = Math.max(6, ((item.quoteVolume24h || 0) / maxVolume) * 100);

      return `
        <tr>
          <td>
            <div class="symbol-cell">
              <span class="rank">${index + 1}</span>
              <div>
                <div class="ticker">${item.symbol}</div>
                <div class="company">${item.name}</div>
              </div>
            </div>
          </td>
          <td class="price">${formatUsd(item.price, 4)}</td>
          <td class="change ${changeClass}">${formatPercent(item.changePercent24h)}</td>
          <td class="volume-cell">
            <div>${formatUsd(item.quoteVolume24h, 0)}</div>
            <div class="volume-bar" aria-hidden="true"><span style="width:${barWidth}%"></span></div>
          </td>
          <td>${formatUsd(spread, 4)}</td>
          <td class="contract">${item.contract}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadTop() {
  if (state.loadingTop) return;
  state.loadingTop = true;
  refreshButton.disabled = true;
  setStatus("刷新中");

  try {
    const payload = await fetchJson("/api/top");
    state.topItems = payload.items || [];
    renderTopRows(state.topItems);
    lastUpdated.textContent = `更新 ${formatTime(payload.updatedAt)} · ${payload.source}`;
    setStatus("已连接");
  } catch (error) {
    topRows.innerHTML = `<tr><td colspan="6" class="empty">${error.message}</td></tr>`;
    lastUpdated.textContent = "刷新失败";
    setStatus("连接异常", true);
  } finally {
    state.loadingTop = false;
    refreshButton.disabled = false;
  }
}

function renderQuote(item) {
  const changeClass = item.changePercent24h >= 0 ? "up" : "down";
  quoteResult.className = "quote-result";
  quoteResult.innerHTML = `
    <div class="quote-main">
      <strong>${item.symbol} · ${formatUsd(item.price, 4)}</strong>
      <span>${item.name} · ${item.contract} · ${formatTime(item.updatedAt)}</span>
    </div>
    <div class="metric">
      <span>24h</span>
      <strong class="change ${changeClass}">${formatPercent(item.changePercent24h)}</strong>
    </div>
    <div class="metric">
      <span>买价</span>
      <strong>${formatUsd(item.bid, 4)}</strong>
    </div>
    <div class="metric">
      <span>卖价</span>
      <strong>${formatUsd(item.ask, 4)}</strong>
    </div>
    <div class="metric">
      <span>成交额</span>
      <strong>${formatCompact(item.quoteVolume24h)}</strong>
    </div>
  `;
}

function renderQuoteMessage(message, isError = false) {
  quoteResult.className = `quote-result ${isError ? "is-error" : "is-idle"}`;
  quoteResult.innerHTML = `<span>${message}</span>`;
}

async function lookup(symbol) {
  const normalized = symbol.trim().toUpperCase().replace(/^\$/, "").replace(/[^A-Z.]/g, "");
  if (!normalized) {
    renderQuoteMessage("请输入有效代码", true);
    return;
  }

  state.loadingQuote = true;
  lookupForm.querySelector("button").disabled = true;
  renderQuoteMessage("查询中");

  try {
    const payload = await fetchJson(`/api/quote?symbol=${encodeURIComponent(normalized)}`);
    renderQuote(payload.item);
  } catch (error) {
    renderQuoteMessage(error.message, true);
  } finally {
    state.loadingQuote = false;
    lookupForm.querySelector("button").disabled = false;
  }
}

symbolInput.addEventListener("input", () => {
  const start = symbolInput.selectionStart;
  const end = symbolInput.selectionEnd;
  symbolInput.value = symbolInput.value.toUpperCase().replace(/^\$/, "").replace(/[^A-Z.]/g, "");
  symbolInput.setSelectionRange(start, end);
});

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  lookup(symbolInput.value);
});

refreshButton.addEventListener("click", loadTop);

loadTop();
setInterval(loadTop, 60 * 1000);
