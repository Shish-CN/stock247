# 24/7 Stock Contract Board

一个可部署到 Vercel 的零依赖前后端网站：

- Vercel Serverless Functions 使用 Kraken 公共 REST API 动态发现 xStocks 股票代币交易对。
- 单只查询如果 Kraken 未返回该交易对，会回退到 Backed/xStocks 公共价格接口。
- `/api/top` 返回最近 24 小时按估算美元成交额排序的 Top 10。
- `/api/quote?symbol=AAPL` 返回单只股票合约行情。
- 前端自动把输入代码转成大写，并过滤无效字符。

## Vercel 部署

如果仓库根目录不是本目录，在 Vercel 的 Project Settings 里把 Root Directory 设为：

```text
stock-contract-247-site
```

推荐设置：

```text
Framework Preset: Other
Build Command: 留空
Output Directory: 留空
Install Command: npm install
```

`public/` 会作为静态前端发布，`api/` 会作为 Serverless Functions 发布。

## 本地运行

```powershell
cd C:\Users\xsp\stock-contract-247-site
npm start
```

打开 `http://localhost:5174`。

## 数据源说明

Kraken xStocks 和 Backed xStocks 属于代币化股票行情，不等同于传统交易所股票实时报价。应用只展示行情，不构成投资建议。后端对交易对发现、Top 10 和单只报价分别做了短缓存，适合低频访问。
