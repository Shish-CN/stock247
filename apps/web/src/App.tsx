import { Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { SymbolPage } from "./pages/SymbolPage";

export function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Routes><Route path="/" element={<DashboardPage />} /><Route path="/symbol/:symbol" element={<SymbolPage />} /></Routes>
      <footer className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-7xl space-y-2 px-4 py-8 text-xs leading-6 text-slate-500 sm:px-6 lg:px-8"><p>本网站仅提供行情数据对比，不构成投资、交易、税务或法律建议。链上永续合约价格与股票现货价格可能因交易时段、流动性、资金费率、数据延迟及市场结构不同而出现明显偏差。请以各数据源的正式行情为准。</p><p>链上合约数据：trade.xyz / Hyperliquid　股票行情数据：当前配置的股票行情服务商</p></div></footer>
    </div>
  );
}
