import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSymbol, selectPrice, transformMarkets } from "../lib/hyperliquid.js";

test("normalizes xyz symbols", () => {
  assert.equal(normalizeSymbol(" xyz:Aapl "), "AAPL");
});

test("selects mark, then mid, then oracle price", () => {
  assert.deepEqual(selectPrice({ markPx: "101", midPx: "100", oraclePx: "99" }), { value: 101, source: "mark" });
  assert.deepEqual(selectPrice({ markPx: null, midPx: "100", oraclePx: "99" }), { value: 100, source: "mid" });
  assert.deepEqual(selectPrice({ markPx: null, midPx: null, oraclePx: "99" }), { value: 99, source: "oracle" });
});

test("transforms and sorts xyz market contexts", () => {
  const payload = [
    { universe: [{ name: "AAPL", maxLeverage: 5 }, { name: "NVDA", maxLeverage: 5 }] },
    [
      { markPx: "200", prevDayPx: "190", dayNtlVlm: "1000", openInterest: "8", funding: "0.0001" },
      { markPx: "150", prevDayPx: "155", dayNtlVlm: "5000", openInterest: "12", funding: "-0.0002" }
    ]
  ];

  const markets = transformMarkets(payload, "2026-07-15T00:00:00.000Z");
  assert.equal(markets[0].symbol, "NVDA");
  assert.equal(markets[1].symbol, "AAPL");
  assert.equal(markets[1].change24h, 10);
  assert.ok(Math.abs(markets[1].changePercent24h - 5.2631578947) < 0.000001);
});
