export interface Item {
  name: string;
  required: number;
  requiredStrict?: number;
  requiredFlexible?: number;
  total: number;
  totalStrict?: number;
  totalFlexible?: number;
  totalActual?: number; // crafting consumption without the challenge-target cap
  raw: number;
  rawStacks?: number[]; // [normal, silver, gold, unused, iridium]
  qualityTargets?: number[]; // Collection and quality-preserving recipe targets per tier
  qualityConsumed?: number[]; // Items of each tier already used in quality-preserving recipes
  hasWrongQuality?: boolean; // Has stacks but not in the correct quality tier
  correctQualityCount?: number; // Count of items in the correct quality tier
  excludeFromTotals?: boolean; // Synthetic availability rows; raw is already counted by source items
}

export interface ItemWithCalculations extends Item {
  percentage: number;
}

export function calculateObtainedCount(item: Item): number {
  if (item.qualityTargets) {
    const stacks = item.rawStacks ?? [item.raw, 0, 0, 0, 0];
    let requiredByQuality = 0;
    let coveredByQuality = 0;
    let reservedRaw = 0;
    for (const [tier, required] of item.qualityTargets.entries()) {
      const consumed = item.qualityConsumed?.[tier] ?? 0;
      const raw = stacks[tier] ?? 0;
      requiredByQuality += required;
      coveredByQuality += Math.min(required, raw + consumed);
      reservedRaw += Math.min(raw, Math.max(0, required - consumed));
    }
    const flexibleRequired = Math.max(0, item.required - requiredByQuality);
    const flexibleConsumed = item.totalFlexible ?? Math.max(0,
      item.total - (item.qualityConsumed?.reduce((sum, count) => sum + count, 0) ?? 0));
    return coveredByQuality + Math.min(flexibleRequired, flexibleConsumed + Math.max(0, item.raw - reservedRaw));
  }
  if (item.correctQualityCount !== undefined) {
    if (item.requiredStrict !== undefined || item.requiredFlexible !== undefined) {
      const requiredStrict = item.requiredStrict ?? 0;
      const requiredFlexible = item.requiredFlexible ?? 0;
      const totalStrict = item.totalStrict ?? 0;
      const totalFlexible = item.totalFlexible ?? 0;
      const baseRequired = Math.max(0, item.required - requiredStrict - requiredFlexible);
      const baseCovered = Math.min(item.correctQualityCount, baseRequired);
      const correctSurplus = Math.max(0, item.correctQualityCount - baseRequired);
      const strictRemaining = Math.max(0, requiredStrict - totalStrict);
      const strictRawCovered = Math.min(correctSurplus, strictRemaining);
      const anySurplus = Math.max(0, item.raw - baseRequired);
      const flexibleRemaining = Math.max(0, requiredFlexible - totalFlexible);
      const flexibleRawCovered = Math.min(Math.max(0, anySurplus - strictRawCovered), flexibleRemaining);
      return baseCovered + totalStrict + strictRawCovered + totalFlexible + flexibleRawCovered;
    }
    return item.correctQualityCount + item.total;
  }
  return item.raw + item.total;
}

export function calculateCappedObtainedCount(item: Item): number {
  return Math.min(item.required, calculateObtainedCount(item));
}

export function calculateNeededCount(item: Item): number {
  return Math.max(0, item.required - calculateCappedObtainedCount(item));
}

export function calculateTotalNeededCount(items: Item[]): number {
  return items.reduce((sum, item) => sum + calculateNeededCount(item), 0);
}

export function calculatePercentage(item: Item): number {
  if (item.required === 0) return 0;
  
  // If item has a required quality tier, use that tier for percentage.
  // Example: 500 gold + 500 normal cooking items = 50% (500 gold / 999 needed)
  const obtained = calculateObtainedCount(item);
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
