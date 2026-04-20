export interface Item {
  name: string;
  required: number;
  total: number;
  raw: number;
  rawStacks?: number[]; // [normal, silver, gold, unused, iridium]
  hasWrongQuality?: boolean; // Has stacks but not in the correct quality tier
  correctQualityCount?: number; // Count of items in the correct quality tier
  excludeFromTotals?: boolean; // Synthetic availability rows; raw is already counted by source items
}

export interface ItemWithCalculations extends Item {
  percentage: number;
}

export function calculatePercentage(item: Item): number {
  if (item.required === 0) return 0;
  
  // If item has a required quality tier, use that tier for percentage.
  // Example: 500 gold + 500 normal cooking items = 50% (500 gold / 999 needed)
  if (item.correctQualityCount !== undefined) {
    const obtained = item.correctQualityCount + item.total;
    return Math.min(100, (obtained / item.required) * 100);
  }
  
  const obtained = item.raw + item.total;
  // Cap at 100%
  return Math.min(100, (obtained / item.required) * 100);
}

export function calculateCategoryTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.raw, 0);
}

export function enrichItemsWithCalculations(
  items: Item[],
  _categoryTotal: number
): ItemWithCalculations[] {
  return items.map((item) => ({
    ...item,
    percentage: calculatePercentage(item),
  }));
}
