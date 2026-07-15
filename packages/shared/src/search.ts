import Fuse from "fuse.js";
import { SYMBOL_MAPPINGS } from "./symbol-map.js";
import { normalizeContractSymbol, normalizeSearchQuery, resolveSymbolMapping } from "./normalization.js";
import type { SearchMatchType, SearchResult, SymbolMapping } from "./types.js";

type SearchDocument = SymbolMapping & { hasContract: boolean };

function classify(query: string, doc: SearchDocument): SearchMatchType {
  const normalized = normalizeSearchQuery(query);
  const stock = normalizeSearchQuery(doc.stockSymbol);
  const contract = normalizeSearchQuery(doc.contractSymbol);
  const aliases = doc.aliases.map(normalizeSearchQuery);
  const company = normalizeSearchQuery(doc.companyName ?? "");

  if (normalized === stock) return "exact";
  if (normalized === contract) return "contract";
  if (aliases.includes(normalized)) return "alias";
  if (stock.startsWith(normalized) || contract.startsWith(normalized)) return "prefix";
  if (company.includes(normalized)) return "company";
  return "fuzzy";
}

export function buildSearchDocuments(contractSymbols: string[]): SearchDocument[] {
  const dynamic = contractSymbols
    .map((symbol) => resolveSymbolMapping(symbol))
    .filter((mapping): mapping is SymbolMapping => Boolean(mapping));
  const contractSet = new Set(dynamic.map((mapping) => normalizeContractSymbol(mapping.contractSymbol)));
  const byStock = new Map<string, SearchDocument>();

  for (const mapping of [...SYMBOL_MAPPINGS, ...dynamic]) {
    const key = normalizeSearchQuery(mapping.stockSymbol);
    byStock.set(key, {
      ...mapping,
      hasContract: contractSet.has(normalizeContractSymbol(mapping.contractSymbol))
    });
  }

  return [...byStock.values()];
}

export function searchSymbols(query: string, contractSymbols: string[], limit = 10): SearchResult[] {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];

  const documents = buildSearchDocuments(contractSymbols);
  const fuse = new Fuse(documents, {
    keys: ["stockSymbol", "contractSymbol", "aliases", "companyName"],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true
  });

  const direct = documents.filter((doc) => {
    const values = [doc.stockSymbol, doc.contractSymbol, ...doc.aliases, doc.companyName ?? ""];
    return values.some((value) => normalizeSearchQuery(value).includes(normalized));
  });
  const fuzzy = fuse.search(normalized).map((result) => result.item);
  const unique = new Map<string, SearchDocument>();
  for (const doc of [...direct, ...fuzzy]) unique.set(doc.stockSymbol, doc);

  return [...unique.values()]
    .map((doc) => ({
      symbol: doc.stockSymbol,
      contractSymbol: doc.hasContract ? `xyz:${doc.contractSymbol}` : null,
      companyName: doc.companyName ?? doc.stockSymbol,
      matchType: classify(query, doc),
      hasContract: doc.hasContract,
      assetType: doc.assetType
    }))
    .sort((a, b) => {
      const priority: Record<SearchMatchType, number> = { exact: 0, contract: 1, alias: 2, prefix: 3, company: 4, fuzzy: 5 };
      return priority[a.matchType] - priority[b.matchType] || a.symbol.localeCompare(b.symbol);
    })
    .slice(0, limit);
}
