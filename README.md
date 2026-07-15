# Stock247 · trade.xyz Only

一个只展示 trade.xyz / Hyperliquid `xyz` DEX 永续合约行情的轻量网站。

本版本已经彻底移除：

- 股票现货报价
- Finnhub
- Alpha Vantage
- React / Vite / TypeScript
- pnpm Monorepo
- Vitest / Playwright / Tailwind

项目使用原生 HTML、CSS、JavaScript 和零依赖 Vercel Functions，目的是降低部署复杂度并避免 workspace 缺包问题。

## 数据接口

后端调用 Hyperliquid 官方 Info API：

```http
POST https://api.hyperliquid.xyz/info
Content-Type: application/json

{"type":"metaAndAssetCtxs","dex":"xyz"}
```

接口输出：

```text
GET /api/markets?limit=20
GET /api/quote?symbol=AAPL
GET /api/top?limit=20
GET /api/health
```

价格按以下顺序选择：

```text
markPx → midPx → oraclePx
```

首页默认按 `dayNtlVlm` 由高到低展示 TOP20，并提供搜索和排序。

## Vercel 部署

直接从仓库根目录创建一个 Vercel Project：

```text
Root Directory: 留空
Framework Preset: Other
Build Command: npm run build
Output Directory: public
Install Command: 留空或 npm install
```

项目没有第三方 npm 依赖，因此不会再需要安装 Vite、Vitest、Playwright、Tailwind 或 workspace 包。

可选环境变量：

```text
HYPERLIQUID_API_BASE=https://api.hyperliquid.xyz
```

部署后检查：

```text
https://YOUR-DOMAIN.vercel.app/
https://YOUR-DOMAIN.vercel.app/api/health
https://YOUR-DOMAIN.vercel.app/api/markets?limit=20
```

## 本地验证

```bash
npm test
npm run build
```

## 缓存和容错

- 上游请求超时：6.5 秒。
- API CDN 缓存：10 秒。
- `stale-while-revalidate`：60 秒。
- Hyperliquid 网络失败或异常响应时返回结构化 502。
- 不使用传统股票行情作为 fallback。

## 免责声明

本网站仅提供链上合约行情展示，不构成投资、交易、税务或法律建议。合约价格可能受流动性、资金费率、预言机和市场结构影响。请以 trade.xyz / Hyperliquid 正式行情为准。
