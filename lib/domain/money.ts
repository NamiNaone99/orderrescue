const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function isWholeBaht(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function lineCostThb(unitCost: number, quantity: number): number {
  if (!isWholeBaht(unitCost) || unitCost < 0) {
    throw new RangeError("Expected a non-negative whole-baht unit cost");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError("Expected a positive whole quantity");
  }
  const total = unitCost * quantity;
  if (!isWholeBaht(total)) {
    throw new RangeError("Line cost exceeds the safe integer range");
  }
  return total;
}

export function formatThb(amount: number): string {
  if (!isWholeBaht(amount)) {
    throw new RangeError("Expected a safe integer amount in Thai baht");
  }
  return baht.format(amount);
}
