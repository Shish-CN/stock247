import { NON_STOCK_SYMBOLS, SYMBOL_MAPPINGS } from "./symbol-map.js";
import type { SymbolMapping } from "./types.js";

export function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeContractSymbol(value: string): string {
  return normalizeText(value).replace(/^XYZ:/, "").replace(/\s+/g, "");
}

export function normalizeSearchQuery(value: string): string {
  return normalizeContractSymbol(value).replace(/\s+/g, "");
}

function comparable(value: string): string {
  return normalizeSearchQuery(value).replace(/[.-]/g, "");
}

export function findSymbolMapping(value: string): SymbolMapping | null {
  const target = comparable(value);
  const mapping = SYMBOL_MAPPINGS.find((entry) => {
    const candidates = [entry.contractSymbol, entry.stockSymbol, ...entry.aliases];
    return candidates.some((candidate) => comparable(candidate) === target);
  });
  return mapping ?? null;
}

export function isLikelyStockSymbol(value: string): boolean {
  const normalized = normalizeContractSymbol(value);
  return /^[A-Z][A-Z0-9.-]{0,7}$/.test(normalized) && !NON_STOCK_SYMBOLS.has(normalized);
}

export function resolveSymbolMapping(value: string): SymbolMapping | null {
  const known = findSymbolMapping(value);
  if (known) return known;

  const normalized = normalizeContractSymbol(value);
  if (!isLikelyStockSymbol(normalized)) return null;

  return {
    contractSymbol: normalized,
    stockSymbol: normalized.replace(".", "-"),
    aliases: [],
    companyName: normalized,
    assetType: "stock"
  };
}
