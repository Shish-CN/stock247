export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateDifference(contractPrice: number | null, stockPrice: number | null) {
  if (contractPrice === null || stockPrice === null || stockPrice === 0) {
    return { difference: null, differencePercent: null };
  }

  const difference = contractPrice - stockPrice;
  return {
    difference,
    differencePercent: (difference / stockPrice) * 100
  };
}

export function calculateChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return { change: null, changePercent: null };
  }

  const change = current - previous;
  return { change, changePercent: (change / previous) * 100 };
}

export function differenceTone(value: number | null): "positive" | "negative" | "neutral" {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}
