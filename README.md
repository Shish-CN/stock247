# Stock × Perp

美股现货价格与 trade.xyz 链上股票永续合约价格对比网站。项目只提供行情展示，不连接钱包、不下单、不托管资产。

## 项目结构

```text
stock247/
├─ apps/
│  ├─ web/       React + TypeScript + Vite + Tailwind CSS
│  └─ api/       Hono + TypeScript + Vercel Functions
├─ packages/
│  └─ shared/    公共类型、Zod Schema、代码映射、搜索和计算逻辑
├─ api/           仓库根目录 Vercel 部署兼容入口
└─ .github/workflows/ci.yml
```

前端只能调用本项目后端。股票 API Key 只存在于后端 Vercel 环境变量中。

## 数据源

### trade.xyz / Hyperliquid

后端调用：

```http
POST https://api.hyperliquid.xyz/info
Content-Type: application/json

{"type":"metaAndAssetCtxs","dex":"xyz"}
```

`universe` 与 `assetCtxs` 按数组下标合并。合约价格严格按照 `markPx → midPx → oraclePx` 选择。首页按 `dayNtlVlm` 从高到低选取最多 20 个可映射的股票类合约。

### 股票现货

股票行情通过 `StockQuoteProvider` 适配层访问：

- `finnhub`：适合配置免费或付费 Finnhub API Key；返回延迟状态由 Provider 标注。
- `alpha-vantage`：免费 EOD 日线收盘价模式，明确标记为延迟行情。免费额度很低，只适合低流量或测试。
- `mock`：仅允许非生产环境使用。
- `not-configured`：生产环境缺少 Provider 或 API Key 时启用，不生成假行情。

Alpha Vantage 免费 EOD 配置示例：

```text
STOCK_PROVIDER=alpha-vantage
STOCK_API_KEY=你的免费APIKey
CACHE_TTL_STOCK_SECONDS=43200
```

该模式使用 `TIME_SERIES_DAILY`，页面显示的是上一交易日或最近交易日收盘价，不是盘中实时价。

## 本地运行

要求 Node.js 22+ 与 pnpm 10+。

```bash
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm dev:api
pnpm dev:web
```

默认地址：

- Web: `http://localhost:5173`
- API: `http://localhost:8787`

本地可设置 `NODE_ENV=development` 和 `STOCK_PROVIDER=mock`。Mock 行情不得作为正式生产行情。

## 环境变量

### API

| 变量 | 说明 |
|---|---|
| `HYPERLIQUID_API_BASE` | 默认 `https://api.hyperliquid.xyz` |
| `STOCK_PROVIDER` | `finnhub`、`alpha-vantage`；本地可用 `mock` |
| `STOCK_API_KEY` | 股票行情服务端密钥 |
| `CORS_ORIGINS` | 允许的前端域名，多个用逗号分隔 |
| `CACHE_TTL_CHAIN_SECONDS` | 链上缓存，默认 10 秒 |
| `CACHE_TTL_STOCK_SECONDS` | 股票缓存；Alpha Vantage 建议至少 43200 秒 |

### Web

| 变量 | 说明 |
|---|---|
| `VITE_API_BASE_URL` | 独立部署后端时填写后端正式域名；同一 Vercel Project 部署时可留空 |

## API

```text
GET /health
GET /v1/markets/top?limit=20
GET /v1/compare/:symbol
GET /v1/search?q=nvda
GET /v1/symbols
```

首页接口同时返回链上价格、股票价格、绝对价差、百分比价差、合约 24H 涨跌、成交额、持仓量、Funding、各数据源时间戳和过期状态。

## 缓存、超时和容错

- Hyperliquid 请求超时：7 秒。
- 股票请求超时：6 至 7 秒。
- 链上缓存：默认 10 秒；失败时可回退 60 秒旧缓存并标记 `stale`。
- Finnhub 缓存由 `CACHE_TTL_STOCK_SECONDS` 控制。
- Alpha Vantage Provider 强制至少缓存 12 小时，并允许回退 24 小时旧缓存。
- 同一缓存 Key 通过 in-flight Promise 去重，避免缓存击穿。
- 股票批量查询逐项记录失败，不因单个代码失败导致 TOP20 整体报错。
- 搜索接口包含基础 IP 频率限制、长度限制和 Zod 校验。

## 测试和 CI

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions 在 Push 和 Pull Request 上依次执行 install、lint、typecheck、test 和 build。

## Vercel 部署

### 推荐：两个独立 Project

Vercel Monorepo 应分别创建两个项目。

后端：

```text
Root Directory: apps/api
```

前端：

```text
Root Directory: apps/web
```

前端设置：

```text
VITE_API_BASE_URL=https://YOUR-API.vercel.app
```

后端设置：

```text
CORS_ORIGINS=https://YOUR-WEB.vercel.app
```

### 兼容：从仓库根目录直接部署

仓库根目录已经包含：

- `package.json` 的 `main: api/index.ts`
- `api/index.ts`
- `api/[...path].ts`
- 根目录 `vercel.json`

因此从仓库根目录导入时，Vercel 会构建 `apps/web`，并将 `/health`、`/v1/*` 路由到同一项目内的 API Function。生产环境未设置 `VITE_API_BASE_URL` 时，前端自动使用同源 API。

如果仍采用两个 Project，必须在 Vercel Dashboard 中正确设置 Root Directory，不能让 API Project 指向仓库根目录。

部署后验证：

```text
https://YOUR-DOMAIN.vercel.app/health
https://YOUR-DOMAIN.vercel.app/v1/markets/top?limit=20
```

## 安全边界

- API Key 不进入浏览器 bundle，也不提交 GitHub。
- 后端日志不打印 Token、Cookie 或敏感查询参数。
- 用户输入只用于受控股票代码查询，不执行任意 URL 或代码。
- 项目不包含钱包连接、签名、下单或交易功能。

## 免责声明

本网站仅提供行情数据对比，不构成投资、交易、税务或法律建议。链上永续合约价格与股票现货价格可能因交易时段、流动性、资金费率、数据延迟及市场结构不同而出现明显偏差。请以各数据源的正式行情为准。

链上合约数据：trade.xyz / Hyperliquid。股票行情数据：当前配置的股票行情服务商。本项目不是 trade.xyz 官方网站，也不是官方股票报价网站。
