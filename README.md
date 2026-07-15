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
└─ .github/workflows/ci.yml
```

前端只能调用本项目后端。股票 API Key 只存在于 `apps/api` 的 Vercel 环境变量中。

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

- `finnhub`：生产环境 Provider。
- `mock`：仅允许非生产环境使用。
- `not-configured`：生产环境缺少 Provider 或 API Key 时启用，接口明确标记股票数据未配置，不生成假行情。

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
| `STOCK_PROVIDER` | 生产使用 `finnhub`；本地可用 `mock` |
| `STOCK_API_KEY` | 股票行情服务端密钥 |
| `CORS_ORIGINS` | 允许的前端域名，多个用逗号分隔 |
| `CACHE_TTL_CHAIN_SECONDS` | 链上缓存，默认 10 秒 |
| `CACHE_TTL_STOCK_SECONDS` | 股票缓存，默认 45 秒 |

### Web

| 变量 | 说明 |
|---|---|
| `VITE_API_BASE_URL` | 后端 Vercel 正式域名 |

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
- 股票请求超时：6 秒。
- 链上缓存：默认 10 秒；失败时可回退 60 秒旧缓存并标记 `stale`。
- 股票缓存：默认 45 秒；失败时可回退 5 分钟旧缓存并标记延迟。
- 同一缓存 Key 通过 in-flight Promise 去重，避免缓存击穿。
- 股票批量查询采用有限并发并逐项记录失败，不因单个代码失败导致 TOP20 整体报错。
- 搜索接口包含基础 IP 频率限制、长度限制和 Zod 校验。

## 测试和 CI

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions 在 Push 和 Pull Request 上依次执行 install、lint、typecheck、test 和 build。测试覆盖代码标准化、特殊映射、非股票过滤、价差计算、颜色状态、模糊搜索和主要 API 路由。Playwright 配置包含桌面端和移动端项目。

## Vercel 部署

从同一 GitHub 仓库创建两个 Vercel Project。

### 后端

```text
Root Directory: apps/api
```

配置 API 环境变量后验证：

```text
https://YOUR-API.vercel.app/health
https://YOUR-API.vercel.app/v1/markets/top?limit=20
```

### 前端

```text
Root Directory: apps/web
```

设置：

```text
VITE_API_BASE_URL=https://YOUR-API.vercel.app
```

再将前端正式域名加入后端：

```text
CORS_ORIGINS=https://YOUR-WEB.vercel.app
```

当前仓库不包含 Vercel Token 或股票 API Key。部署完成后，应把正式前端和后端 URL 补充到 README。

## 安全边界

- API Key 不进入浏览器 bundle，也不提交 GitHub。
- 后端日志不打印 Token、Cookie 或敏感查询参数。
- 用户输入只用于受控股票代码查询，不执行任意 URL 或代码。
- 项目不包含钱包连接、签名、下单或交易功能。

## 免责声明

本网站仅提供行情数据对比，不构成投资、交易、税务或法律建议。链上永续合约价格与股票现货价格可能因交易时段、流动性、资金费率、数据延迟及市场结构不同而出现明显偏差。请以各数据源的正式行情为准。

链上合约数据：trade.xyz / Hyperliquid。股票行情数据：当前配置的股票行情服务商。本项目不是 trade.xyz 官方网站，也不是官方股票报价网站。
