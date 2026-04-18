export interface Item {
  name: string;
  required: number;
  total: number;
  raw: number;
  rawStacks?: number[]; // [normal, silver, gold, unused, iridium]
  hasWrongQuality?: boolean; // Has stacks but not in the correct quality tier
}

export interface ItemWithCalculations extends Item {
  percentage: number;
}

export function calculatePercentage(item: Item): number {
  if (item.required === 0) return 0;
  // If item has wrong quality, it's 0% complete (don't have items in correct tier)
  if (item.hasWrongQuality) return 0;
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
