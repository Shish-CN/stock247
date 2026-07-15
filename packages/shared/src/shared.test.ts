import { describe, expect, it } from "vitest";
import {
  calculateDifference,
  differenceTone,
  isLikelyStockSymbol,
  normalizeContractSymbol,
  normalizeSearchQuery,
  resolveSymbolMapping,
  searchSymbols
} from "./index.js";

describe("symbol normalization", () => {
  it("removes the xyz prefix", () => {
    expect(normalizeContractSymbol("xyz:NVDA")).toBe("NVDA");
  });

  it("handles full width, spaces and case", () => {
    expect(normalizeSearchQuery("  ｎｖｄａ ")).toBe("NVDA");
  });

  it("maps BRK.B to the provider symbol", () => {
    expect(resolveSymbolMapping("BRK.B")?.stockSymbol).toBe("BRK-B");
  });

  it("filters non-stock contracts", () => {
    expect(isLikelyStockSymbol("BTC")).toBe(false);
    expect(isLikelyStockSymbol("TSLA")).toBe(true);
  });
});

describe("comparison math", () => {
  it("calculates absolute and percentage differences", () => {
    expect(calculateDifference(151, 150)).toEqual({ difference: 1, differencePercent: 2 / 3 });
  });

  it("handles empty values", () => {
    expect(calculateDifference(null, 150)).toEqual({ difference: null, differencePercent: null });
  });

  it("returns the required color tone", () => {
    expect(differenceTone(1)).toBe("positive");
    expect(differenceTone(-1)).toBe("negative");
    expect(differenceTone(0)).toBe("neutral");
  });
});

describe("fuzzy search", () => {
  it("suggests nearby symbols without silently correcting them", () => {
    const result = searchSymbols("NVAD", ["NVDA", "TSLA"]);
    expect(result[0]?.symbol).toBe("NVDA");
    expect(result[0]?.matchType).toBe("fuzzy");
  });
});
