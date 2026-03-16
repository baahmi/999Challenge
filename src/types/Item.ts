export interface Item {
  name: string;
  required: number;
  raw: number;
}

export interface ItemWithCalculations extends Item {
  total: number;
  percentage: number;
}

export function calculateTotal(item: Item): number {
  return item.raw;
}

export function calculatePercentage(item: Item): number {
  if (item.required === 0) return 0;
  return item.raw >= item.required ? 100 : (item.raw / item.required) * 100;
}

export function calculateCategoryTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.raw, 0);
}

export function enrichItemsWithCalculations(
  items: Item[],
  categoryTotal: number
): ItemWithCalculations[] {
  return items.map((item) => ({
    ...item,
    total: calculateTotal(item),
    percentage: calculatePercentage(item),
  }));
}
