import { getQuote } from "../lib/market-data.mjs";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ ok: false, message: "Method not allowed" });
    return;
  }

  try {
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=15");
    res.status(200).json(await getQuote(req.query.symbol));
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(error.status || 502).json({
      ok: false,
      message: error.message || "行情服务暂时不可用。"
    });
  }
}
