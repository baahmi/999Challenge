import { CustomDataStore, VariantResolver } from './CustomDataStore';
import { calculateNeededCount, calculateObtainedCount, calculateSpareCount } from '../types/Item';
import notesData from './notes.json';
import pricesData from './prices.json';
import bundledItems from './items.json';
import { Config } from '../config/Config';
import type { Quality } from '../config/Config';
import type { ItemEntry, PartsEntry, YieldSpec } from "./CustomDataStore";

const TARGET = 999;

export interface BuyPrice {
  gold?: number;
  qiGem?: number;
}

export interface ShopEntry {
  shop: string;
  price: number;
  qty: number;
  currency?: string;
}

const priceMap = new Map<string, BuyPrice>();
const shopEntriesMap = new Map<string, ShopEntry[]>();
const PRICE_OVERRIDES: Record<string, BuyPrice> = {
  'Statue Of Endless Fortune': { gold: 1_000_000 },
};

(function buildPriceMap() {
  type RawEntry = [string, number, number, string, (string | undefined)?];
  const data = pricesData as unknown as Record<string, RawEntry[]>;
  for (const [key, entries] of Object.entries(data)) {
    // if (key.startsWith('FLAVORED_ITEM')) continue;
    const firstEntry = entries[0];
    if (!firstEntry) continue;
    const itemName: string = key.startsWith('(O)') ? firstEntry[3] : key;
    const bp: BuyPrice = priceMap.get(itemName) ?? {};
    const shopList: ShopEntry[] = shopEntriesMap.get(itemName) ?? [];
    const seen = new Set(shopList.map(e => `${e.shop}|${e.price}|${e.qty}|${e.currency ?? ''}`));
    for (const entry of entries) {
      const shop = entry[0];
      const price = entry[1];
      const qty = entry[2];
      const currency = entry[4];
      if (price < 0) continue;
      const unitPrice = qty > 1 ? price / qty : price;
      const dedupeKey = `${shop}|${price}|${qty}|${currency ?? ''}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        shopList.push({ shop, price, qty, currency });
      }
      if (currency === 'Qi Gem') {
        if (bp.qiGem === undefined || unitPrice < bp.qiGem) bp.qiGem = unitPrice;
      } else if (!currency) {
        if (!shop.startsWith('Festival ') && shop !== 'Casino') {
          if (bp.gold === undefined || unitPrice < bp.gold) bp.gold = unitPrice;
        }
      }
    }
    if (shopList.length > 0) shopEntriesMap.set(itemName, shopList);
    if (bp.gold !== undefined || bp.qiGem !== undefined) {
      priceMap.set(itemName, bp);
    }
  }

  for (const [itemName, override] of Object.entries(PRICE_OVERRIDES)) {
    priceMap.set(itemName, {
      ...priceMap.get(itemName),
      ...override,
    });
  }
})();

function avgYieldOf(spec: YieldSpec | undefined): number {
  if (spec === undefined) return 1;
  if (Array.isArray(spec)) return (spec[0] + spec[1]) / 2;
  return spec;
}

function applyArtifactTroveRequirements(
  troveItems: string[],
  inventoryMap: Map<string, number>,
  addPartRequirement: (name: string, requiredCount: number, totalCount: number, strict: boolean) => void
): void {
  if (troveItems.length === 0) {
    console.info('[trove] No trove items configured');
    return;
  }

  // Need TARGET opened troves per possible trove item. The lowest completed
  // trove-item count is the only defensible estimate of already opened troves.
  const troveCounts = troveItems.map(itemName => ({
    itemName,
    count: inventoryMap.get(itemName) ?? 0,
    hasInventoryKey: inventoryMap.has(itemName),
  }));
  const minTroveCount = Math.min(...troveCounts.map(item => item.count));
  const troveRequired = TARGET * troveItems.length;
  const troveTotal = minTroveCount * troveItems.length;

  console.info('[trove] Artifact Trove requirement calculation', {
    troveItemCount: troveItems.length,
    troveRequired,
    minTroveCount,
    troveTotal,
    missingItems: troveCounts.filter(item => !item.hasInventoryKey).map(item => item.itemName),
    zeroCountItems: troveCounts.filter(item => item.count === 0).map(item => item.itemName),
    troveCounts,
  });

  addPartRequirement("Artifact Trove", troveRequired, troveTotal, false);
}

function getArtifactTroveOpenedCount(
  troveItems: string[],
  inventoryMap: Map<string, number>,
  totalFromParts: Map<string, number>
): number {
  if (troveItems.length === 0) return 0;

  return Math.min(
    ...troveItems.map(itemName => Math.min(TARGET, (inventoryMap.get(itemName) ?? 0) + (totalFromParts.get(itemName) ?? 0)))
  );
}

const yieldMap = new Map<string, number>();
(function buildYieldMap() {
  for (const entry of CustomDataStore.getPartsData()) {
    const spec = entry[2];
    if (spec !== undefined) yieldMap.set(entry[0], avgYieldOf(spec));
  }
})();

export interface IngredientInfo {
  name: string;
  qty: number;
  available: number;
  done: boolean;
  neededForTarget?: number; // how many of this ingredient the remaining crafts still consume
}

export interface UsedByInfo {
  craftedName: string;
  groupedRecipes?: number;
  craftableCount: number;
  alreadyHave: number;
  done: boolean;
  recipe: IngredientInfo[];
}

export interface ItemTooltipData {
  count: number;
  note: string[] | null;
  recipe: IngredientInfo[] | null;
  craftableCount: number;
  limitingIngredient: string | null;
  done: boolean;
  usedBy: UsedByInfo[];
  shops: ShopEntry[];
  neededCount?: number; // how many of this item are still needed for the challenge
  spareCount?: number; // raw copies left after reserving those needed for the challenge
}

export interface ItemRow {
  name: string;
  sourceName?: string; // Canonical item identity when the table uses a display name
  namePercentage?: number; // Sapling collection progress, independent of quality upgrades
  qualityTiers?: number[]; // Quality columns needed for the collection target
  qualityTargets?: number[];
  qualityConsumed?: number[];
  itemId?: string;
  category?: string;
  required: number;
  requiredStrict?: number;
  requiredFlexible?: number;
  total: number;
  totalStrict?: number;
  totalFlexible?: number;
  totalActual?: number; // crafting consumption without the challenge-target cap
  raw: number;
  rawStacks?: number[]; // [normal, silver, gold, unused, iridium]
  buyPrice?: BuyPrice;
  tooltip: ItemTooltipData;
  hasWrongQuality?: boolean; // Has stacks but not in the correct quality tier
  hasUnfinishedDependents?: boolean; // Item is complete but has uncrafted dependencies
  correctQualityCount?: number; // Count of items in the correct quality tier
  excludeFromTotals?: boolean; // Synthetic availability rows; do not count raw again in summary totals
}

function isWildcard(id: string, name: string | null): boolean {
  if (name === null) return true;
  const numId = Number(id);
  return Number.isFinite(numId) && numId < 0;
}

const IRIDIUM_QUALITY_CATEGORIES = new Set([
  'Animal Products',
  'Fish',
  'Flowers',
  'Forage',
  'Fruits',
  'Wine',
]);

const QUALITY_PRESERVING_CRAFT_CATEGORIES = new Set([
  'Smoked Fish',
]);

const AGEABLE_CRAFT_ITEMS = new Set([
  'Beer',
  'Cheese',
  'Goat Cheese',
  'Mead',
  'Pale Ale',
]);

const IRIDIUM_QUALITY_ITEMS = new Set([
  'Clam',
  'Cockle',
  'Mussel',
  'Oyster',
  'Mayonnaise'
]);

const FRUIT_SAPLINGS = new Set([
  'Apple Sapling',
  'Apricot Sapling',
  'Banana Sapling',
  'Cherry Sapling',
  'Mango Sapling',
  'Orange Sapling',
  'Peach Sapling',
  'Pomegranate Sapling',
]);

const NO_QUALITY_ITEMS = new Set([
  'Cave Carrot',
  'Ginger',
]);

const NORMAL_ONLY_ITEMS = new Set(['Tea Leaves']);
const QUALITY_TIER_IDS: Partial<Record<Quality, number>> = { normal: 0, silver: 1, gold: 2, iridium: 4 };
const availableQualityTiersCache = new Map<string, number[]>();
let qualityItemsRef: ItemEntry[] | undefined;
let qualityPartsRef: PartsEntry[] | undefined;
let cookingItemsRef: ItemEntry[] | undefined;
let cookingPartsRef: PartsEntry[] | undefined;
let allCookingItems = new Set<string>();
let finalCookingItems = new Set<string>();
const bundledCategories = new Map<string, string>();
for (const [category, name, displayName] of bundledItems) {
  if (!category || !name) continue;
  bundledCategories.set(name, category);
  if (displayName) bundledCategories.set(displayName, category);
}

// not sure I want golden eggs in there. maybe make it configurable ?
const ANY_INGREDIENTS: Record<string, { name: string; category: string; candidates: string[] }> = {
  '-4': {
    name: 'Fish: Extra',
    category: 'Fish',
    candidates: [],
  },
  '-5': {
    name: 'Egg: Extra',
    category: 'Animal Products',
    candidates: ['Dinosaur Egg', 'Egg', 'Large Egg', 'Void Egg', 'Duck Egg', 'Ostrich Egg', 'Golden Egg',
                 'Egg: Dinosaur', 'Egg: Brown', 'Egg: White', 'Egg: Brown, Large', 'Egg: White, Large',
                 'Egg: Duck', 'Egg: Void', 'Egg: Ostrich'],
  },
  '-6': {
    name: 'Milk: Extra',
    category: 'Animal Products',
    candidates: ['Milk', 'Large Milk', 'Goat Milk', 'Large Goat Milk'],
  },
};

function getAnyIngredientInfo(id: string): { name: string; category: string; candidates: string[] } | undefined {
  const info = ANY_INGREDIENTS[id];
  if (!info) return undefined;
  if (id !== '-4') return info;
  const fishCandidates = CustomDataStore.getItemsData()
    .filter(item => item.category === 'Fish')
    .map(item => item.name);
  return { ...info, candidates: [...new Set(fishCandidates)] };
}

function getPartsDataConsumersFirst(): PartsEntry[] {
  const parts = CustomDataStore.getPartsData();
  const craftedNames = new Set(parts.map(([craftedName]) => craftedName));
  const incomingCounts = new Map<string, number>();
  const outgoingEdges = new Map<string, string[]>();

  for (const [craftedName] of parts) {
    incomingCounts.set(craftedName, 0);
    outgoingEdges.set(craftedName, []);
  }

  for (const [craftedName, ingredients] of parts) {
    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName] = ingredientEntry as [string | null, number];
      if (isWildcard(ingredientId, ingredientName)) continue;
      if (!craftedNames.has(ingredientName)) continue;

      outgoingEdges.get(craftedName)!.push(ingredientName);
      incomingCounts.set(ingredientName, (incomingCounts.get(ingredientName) ?? 0) + 1);
    }
  }

  const queue = parts
    .map(([craftedName]) => craftedName)
    .filter(craftedName => (incomingCounts.get(craftedName) ?? 0) === 0);
  const byName = new Map(parts.map(entry => [entry[0], entry] as const));
  const ordered: PartsEntry[] = [];
  const emitted = new Set<string>();

  for (let index = 0; index < queue.length; index++) {
    const craftedName = queue[index]!;
    if (emitted.has(craftedName)) continue;
    const entry = byName.get(craftedName);
    if (!entry) continue;

    ordered.push(entry);
    emitted.add(craftedName);

    for (const ingredientName of outgoingEdges.get(craftedName) ?? []) {
      const nextCount = (incomingCounts.get(ingredientName) ?? 0) - 1;
      incomingCounts.set(ingredientName, nextCount);
      if (nextCount === 0) queue.push(ingredientName);
    }
  }

  if (ordered.length !== parts.length) {
    console.warn('[parts.json] Cycle detected while ordering dependencies; falling back to source order for remaining recipes');
    for (const entry of parts) {
      if (!emitted.has(entry[0])) ordered.push(entry);
    }
  }

  return ordered;
}

// Static maps built once from partsData (never changes at runtime)
const recipeMap = new Map<string, Map<string, number>>(); // craftedName -> ingredient -> qty
const reverseMap = new Map<string, string[]>();           // ingredient -> [craftedNames]
const wildcardRecipeMap = new Map<string, Map<string, number>>(); // craftedName -> synthetic any ingredient -> qty
const wildcardReverseMap = new Map<string, string[]>();           // synthetic any ingredient -> [craftedNames]

// Global cache - computed once when data changes
let globalCraftableCache = new Map<string, { count: number; limiting: string | null }>();
let globalAnyIngredientAvailability = new Map<string, number>();
let lastCompactedRef: any = null;
let lastQuality: string | null = null;
let globalInventoryMap = new Map<string, number>();
let globalStacksMap = new Map<string, number[]>();

// All computed item rows - computed once, filtered by category in the view
let allComputedRows: ItemRow[] = [];

// Item/category edits (Manage Categories dialog, discovered variants) invalidate the cache
CustomDataStore.subscribe(() => {
  lastCompactedRef = null;
});

// Flag to prevent concurrent computations
let isComputing = false;

function buildInventoryMaps(compacted: Array<{ name: string; stack: number; quality?: number[] }>) {
  const inventoryMap = new Map<string, number>();
  const stacksMap = new Map<string, number[]>();
  for (const item of compacted) {
    const stacks = item.quality ?? [item.stack, 0, 0, 0, 0];
    inventoryMap.set(item.name, (inventoryMap.get(item.name) ?? 0) + stacks.reduce((sum, count) => sum + count, 0));
    const previous = stacksMap.get(item.name) ?? [0, 0, 0, 0, 0];
    stacksMap.set(item.name, previous.map((count, tier) => count + (stacks[tier] ?? 0)));
  }
  return { inventoryMap, stacksMap };
}

function computeRequirements(inventoryMap: Map<string, number>, stacksMap: Map<string, number[]>, quality: Quality) {
  const requiredFromPartsStrict = new Map<string, number>();
  const requiredFromPartsFlexible = new Map<string, number>();
  const totalFromPartsStrict = new Map<string, number>();
  const totalFromPartsFlexible = new Map<string, number>();
  const requiredFromParts = new Map<string, number>();
  const totalFromParts = new Map<string, number>();
  // Consumption without the challenge-target cap, to show surplus in the UI
  const totalFromPartsActual = new Map<string, number>();
  const requiredFromPartsQuality = new Map<string, number[]>();
  const totalFromPartsQuality = new Map<string, number[]>();

  const addPartRequirement = (name: string, requiredCount: number, totalCount: number, strict: boolean, actualTotalCount = totalCount) => {
    if (strict) {
      requiredFromPartsStrict.set(name, (requiredFromPartsStrict.get(name) ?? 0) + requiredCount);
      totalFromPartsStrict.set(name, (totalFromPartsStrict.get(name) ?? 0) + totalCount);
    } else {
      requiredFromPartsFlexible.set(name, (requiredFromPartsFlexible.get(name) ?? 0) + requiredCount);
      totalFromPartsFlexible.set(name, (totalFromPartsFlexible.get(name) ?? 0) + totalCount);
    }
    requiredFromParts.set(name, (requiredFromParts.get(name) ?? 0) + requiredCount);
    totalFromParts.set(name, (totalFromParts.get(name) ?? 0) + totalCount);
    totalFromPartsActual.set(name, (totalFromPartsActual.get(name) ?? 0) + actualTotalCount);
  };

  applyArtifactTroveRequirements(CustomDataStore.getTroveItems(), inventoryMap, addPartRequirement);

  for (const [craftedItemName, ingredients] of getPartsDataConsumersFirst()) {
    const avgYield = yieldMap.get(craftedItemName) ?? 1;
    const required = requiredFromParts.get(craftedItemName) ?? 0;
    const craftedCount = getDependencyInventoryCount(craftedItemName, inventoryMap, stacksMap, quality, required);
    const targetAmount = collectionTarget(craftedItemName, stacksMap, quality) + required;
    const totalCrafted = totalFromParts.get(craftedItemName) ?? 0;
    const strictIngredients = usesQualitySensitiveIngredients(craftedItemName);

    // How many of this crafted item do we have (inventory + what we've made/opened)
    const totalHave = Math.min(craftedCount + totalCrafted, targetAmount);
    const totalHaveActual = (quality === 'highest' ? craftedCount : (inventoryMap.get(craftedItemName) ?? 0))
      + (totalFromPartsActual.get(craftedItemName) ?? 0);

    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName, qty] = ingredientEntry as [string | null, number];
      const anyIngredient = getAnyIngredientInfo(ingredientId);
      if (isWildcard(ingredientId, ingredientName)) {
        if (!anyIngredient) continue;
        const requiredCount = Math.round((qty * targetAmount) / avgYield);
        const totalCount = Math.round((qty * totalHave) / avgYield);
        const actualCount = Math.round((qty * totalHaveActual) / avgYield);
        addPartRequirement(anyIngredient.name, requiredCount, totalCount, strictIngredients, actualCount);
        continue;
      }
      const name = ingredientName!;

      // Calculate total ingredients required (for the full targetAmount)
      const requiredCount = Math.round((qty * targetAmount) / avgYield);
      // Calculate ingredients already used (for what we have)
      const totalCount = Math.round((qty * totalHave) / avgYield);
      const actualCount = Math.round((qty * totalHaveActual) / avgYield);
      const qualitySensitivePart = strictIngredients && getAvailableQualityTiers(name).length > 1;
      if (qualitySensitivePart && quality !== 'highest') {
        const outputTargets = collectionQualityTargets(craftedItemName, stacksMap, quality)
          .map((count, tier) => count + (requiredFromPartsQuality.get(craftedItemName)?.[tier] ?? 0));
        const requiredByTier = outputTargets.map(count => Math.round(qty * count / avgYield));
        const consumedByTier = outputTargets.map((count, tier) => Math.round(qty * Math.min(count,
          (stacksMap.get(craftedItemName)?.[tier] ?? 0) + (totalFromPartsQuality.get(craftedItemName)?.[tier] ?? 0)) / avgYield));
        requiredFromPartsQuality.set(name, requiredByTier.map((count, tier) => count + (requiredFromPartsQuality.get(name)?.[tier] ?? 0)));
        totalFromPartsQuality.set(name, consumedByTier.map((count, tier) => count + (totalFromPartsQuality.get(name)?.[tier] ?? 0)));
        const strictRequired = requiredByTier.reduce((sum, count) => sum + count, 0);
        const strictTotal = consumedByTier.reduce((sum, count) => sum + count, 0);
        addPartRequirement(name, strictRequired, strictTotal, true, actualCount);
        addPartRequirement(name, requiredCount - strictRequired, Math.max(0, totalCount - strictTotal), false, 0);
      } else {
        addPartRequirement(name, requiredCount, totalCount, qualitySensitivePart, actualCount);
      }
    }
  }

  const troveItems = CustomDataStore.getTroveItems();
  if (troveItems.length > 0) {
    const previousTroveTotal = totalFromParts.get("Artifact Trove") ?? 0;
    const troveOpenedCount = getArtifactTroveOpenedCount(troveItems, inventoryMap, totalFromParts);
    const nextTroveTotal = troveOpenedCount * troveItems.length;

    if (nextTroveTotal !== previousTroveTotal) {
      totalFromParts.set("Artifact Trove", nextTroveTotal);
      totalFromPartsFlexible.set("Artifact Trove", nextTroveTotal);
      totalFromPartsActual.set("Artifact Trove", nextTroveTotal);

      const artifactTroveRecipe = recipeMap.get("Artifact Trove");
      const craftedCount = getDependencyInventoryCount("Artifact Trove", inventoryMap, stacksMap, quality);
      const targetAmount = TARGET + (requiredFromParts.get("Artifact Trove") ?? 0);
      const avgYield = yieldMap.get("Artifact Trove") ?? 1;
      const previousTotalHave = Math.min(craftedCount + previousTroveTotal, targetAmount);
      const nextTotalHave = Math.min(craftedCount + nextTroveTotal, targetAmount);

      for (const [ingredientName, qty] of artifactTroveRecipe ?? []) {
        const previousIngredientTotal = Math.round((qty * previousTotalHave) / avgYield);
        const nextIngredientTotal = Math.round((qty * nextTotalHave) / avgYield);
        const delta = nextIngredientTotal - previousIngredientTotal;
        if (delta === 0) continue;

        totalFromParts.set(ingredientName, (totalFromParts.get(ingredientName) ?? 0) + delta);
        totalFromPartsFlexible.set(ingredientName, (totalFromPartsFlexible.get(ingredientName) ?? 0) + delta);
        totalFromPartsActual.set(ingredientName, (totalFromPartsActual.get(ingredientName) ?? 0) + delta);
      }
    }
  }

  // Only the gold cooking collection target needs Qi Seasoning.
  if (quality !== 'any') {
    const seen = new Set<string>();
    for (const item of CustomDataStore.getItemsData()) {
      if (!requiresSeasoning(item.name, quality) || seen.has(item.name)) continue;
      seen.add(item.name);
      const dishProgress = stacksMap.get(item.name)?.[2] ?? 0;
      addPartRequirement(
        'Qi Seasoning',
        TARGET,
        Math.min(dishProgress, TARGET),
        false,
        dishProgress
      );
      // Cap at TARGET per cooking item
    }
  }

  return { requiredFromPartsStrict, requiredFromPartsFlexible, totalFromPartsStrict, totalFromPartsFlexible, requiredFromParts, totalFromParts, totalFromPartsActual, requiredFromPartsQuality, totalFromPartsQuality };
}

// Compute all items once - called when data changes
function computeAllItems(
  compacted: Array<{ name: string; stack: number; quality?: number[] }>,
  quality: Quality
): void {
  console.log(`[CACHE] Computing all items from scratch`);

  const { inventoryMap, stacksMap } = buildInventoryMaps(compacted);
  globalInventoryMap = inventoryMap;
  globalStacksMap = stacksMap;

  // Pre-compute ALL craftable counts upfront
  console.log(`[CACHE] Pre-computing all craftable counts`);
  globalCraftableCache.clear();
  for (const craftedName of recipeMap.keys()) {
    const cached = craftableCount(craftedName, globalInventoryMap, undefined, globalStacksMap, quality);
    globalCraftableCache.set(craftedName, cached);
  }
  console.log(`[CACHE] Pre-computed ${globalCraftableCache.size} craftable counts`);

  const { requiredFromPartsStrict, requiredFromPartsFlexible, totalFromPartsStrict, totalFromPartsFlexible, requiredFromParts, totalFromParts, totalFromPartsActual, requiredFromPartsQuality, totalFromPartsQuality } = computeRequirements(inventoryMap, stacksMap, quality);

  const completionMap = new Map<string, boolean>();
  const neededMap = new Map<string, number>();
  for (const item of CustomDataStore.getItemsData()) {
    const row: ItemRow = {
      name: item.name,
      required: collectionTarget(item.name, stacksMap, quality) + (requiredFromParts.get(item.name) ?? 0),
      requiredStrict: requiredFromPartsStrict.get(item.name) ?? 0,
      requiredFlexible: requiredFromPartsFlexible.get(item.name) ?? 0,
      total: totalFromParts.get(item.name) ?? 0,
      totalStrict: totalFromPartsStrict.get(item.name) ?? 0,
      totalFlexible: totalFromPartsFlexible.get(item.name) ?? 0,
      raw: inventoryMap.get(item.name) ?? 0,
      tooltip: undefined as any,
    };
    Object.assign(row, qualityProgressFields(row, item.name, stacksMap, quality, requiredFromPartsQuality, totalFromPartsQuality));
    const needed = calculateNeededCount(row);
    completionMap.set(item.name, needed === 0);
    neededMap.set(item.name, needed);
  }
  const anyIngredientAvailability = computeAnyIngredientAvailability(inventoryMap, stacksMap, quality, requiredFromParts, totalFromParts,
    requiredFromPartsQuality, totalFromPartsQuality);
  globalAnyIngredientAvailability = anyIngredientAvailability;

  // Helper to check if an item has unfinished dependents
  const hasUnfinishedDependents = (itemName: string): boolean => {
    const dependents = reverseMap.get(itemName) ?? [];
    if (dependents.length === 0) return false;
    
    if (!(completionMap.get(itemName) ?? false)) return false;

    // Check if any dependent is not complete
    return dependents.some(depName => {
      const depComplete = completionMap.get(depName) ?? false;
      return !depComplete;
    });
  };

  const source = CustomDataStore.getItemsData();
  const seen = new Set<string>();
  // ignore Qi fruit, even though we can have a count of it, it is too short.
  seen.add("Qi Fruit");
  allComputedRows = [];

  for (const item of source) {
    let itemKey = item.displayName || item.name;
    let lookupKey = itemKey;
    
    // For items with displayName that are NOT variants (like "Bouquet: Wilted"), use base name for lookup
    if (item.displayName !== null && !VariantResolver.hasColorVariants(item.name) && !VariantResolver.hasItemIdVariants(item.name)) {
      lookupKey = item.name;
    }
    
    // For base items with variants, check if base name exists in inventory
    if (item.displayName === null && VariantResolver.hasColorVariants(item.name)) {
      if (inventoryMap.has(item.name)) {
        // Base item has inventory - show as (Cart) variant
        itemKey = `${item.name} (Cart)`;
        lookupKey = item.name;
      } else {
        // No inventory for base item - skip it
        continue;
      }
    }

    if (item.displayName === null && VariantResolver.hasItemIdVariants(item.name) && !inventoryMap.has(item.name)) {
      continue;
    }
    
    // Track by display name to allow multiple variants of same base item
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    
    const raw = inventoryMap.get(lookupKey) ?? 0;
    const isFlower = VariantResolver.hasColorVariants(item.name);
    const row: ItemRow = {
      name: itemKey,
      sourceName: item.name,
      itemId: compacted.find(entry => entry.name === lookupKey || entry.name === itemKey)?.itemId,
      category: item.category,
      required: collectionTarget(lookupKey, stacksMap, quality) + (requiredFromParts.get(item.name) ?? 0),
      requiredStrict: requiredFromPartsStrict.get(item.name) ?? 0,
      requiredFlexible: requiredFromPartsFlexible.get(item.name) ?? 0,
      total: totalFromParts.get(item.name) ?? 0,
      totalStrict: totalFromPartsStrict.get(item.name) ?? 0,
      totalFlexible: totalFromPartsFlexible.get(item.name) ?? 0,
      totalActual: totalFromPartsActual.get(item.name) ?? 0,
      raw, 
      rawStacks: stacksMap.get(lookupKey), // Use lookupKey to get actual stacks
      buyPrice: priceMap.get(item.name), 
      tooltip: computeTooltipData(item.name, raw, inventoryMap, stacksMap, quality, completionMap, globalCraftableCache, anyIngredientAvailability, neededMap),
      hasUnfinishedDependents: hasUnfinishedDependents(item.name),
      ...(isFlower ? flowerCollectionFields(lookupKey, stacksMap, quality) : {}),
    };
    Object.assign(row, qualityProgressFields(row, lookupKey, stacksMap, quality,
      VariantResolver.hasColorVariants(item.name) ? undefined : requiredFromPartsQuality,
      VariantResolver.hasColorVariants(item.name) ? undefined : totalFromPartsQuality));
    if (isFlower || row.qualityTargets || FRUIT_SAPLINGS.has(item.name)) {
      row.tooltip.neededCount = calculateNeededCount(row);
      row.tooltip.done = row.tooltip.neededCount === 0;
    }
    allComputedRows.push(row);
  }

  for (const row of flowerExtraRows(source, allComputedRows, requiredFromParts, totalFromParts, totalFromPartsActual)) {
    const baseName = VariantResolver.getBaseName(row.name);
    row.tooltip = computeTooltipData(baseName, row.raw, inventoryMap, stacksMap, quality, completionMap, globalCraftableCache, anyIngredientAvailability, neededMap);
    row.tooltip.neededCount = calculateNeededCount(row);
    row.tooltip.done = row.tooltip.neededCount === 0;
    allComputedRows.push(row);
  }

  for (const [wildcardId, anyIngredient] of Object.entries(ANY_INGREDIENTS)) {
    const info = getAnyIngredientInfo(wildcardId)!;
    const recipeReq = requiredFromParts.get(info.name) ?? 0;
    if (recipeReq === 0) continue;
    const total = Math.min(totalFromParts.get(info.name) ?? 0, recipeReq);
    const raw = extraRawForAnyIngredient(info.candidates, allComputedRows);
    allComputedRows.push({
      name: anyIngredient.name,
      itemId: undefined,
      category: anyIngredient.category,
      required: recipeReq,
      total,
      raw,
      rawStacks: undefined,
      buyPrice: undefined,
      tooltip: computeAnyIngredientTooltipData(info.name, raw, inventoryMap, completionMap, anyIngredientAvailability),
      hasWrongQuality: false,
      hasUnfinishedDependents: raw + total >= recipeReq && total < recipeReq,
      correctQualityCount: undefined,
      excludeFromTotals: true,
    });
  }

  for (const row of allComputedRows) {
    row.tooltip.spareCount = calculateSpareCount(row);
  }
  allComputedRows.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[CACHE] Computed ${allComputedRows.length} items`);
}

// Cooked outputs cap at gold quality naturally (Qi Seasoning provides iridium).
// Cooking-category ingredients like Oil, Vinegar, and Wheat Flour are not cooked dishes.
function getCookingItems(includeIngredients = false): Set<string> {
  const items = CustomDataStore.getItemsData();
  const parts = CustomDataStore.getPartsData();
  if (items !== cookingItemsRef || parts !== cookingPartsRef) {
    const craftedNames = new Set(parts.map(([name]) => name));
    allCookingItems = new Set(items.filter(item => getPhysicalCategory(item.name) === 'Cooking' && craftedNames.has(item.name)).map(item => item.name));
    finalCookingItems = new Set([...allCookingItems].filter(name => !reverseMap.has(name)));
    cookingItemsRef = items;
    cookingPartsRef = parts;
  }
  return includeIngredients ? allCookingItems : finalCookingItems;
}

function getCrabpotItems(): Set<string> {
  return new Set<string>(
      ["Crab", "Crayfish", "Lobster", "Periwinkle", "Shrimp", "Snail"]
  )
}

// User-configured groups where any quality counts (see Config.qualityExemptions)
function isQualityExemptGroup(group: string): boolean {
  return Config.isQualityExempt(group);
}

function getQualityTargetTier(itemName: string): number | undefined {
  // Bare flower names are colorless Cart purchases, which only have normal quality.
  if (VariantResolver.hasColorVariants(itemName)) return 0;
  if (FRUIT_SAPLINGS.has(VariantResolver.getBaseName(itemName))) return 4;
  if (NO_QUALITY_ITEMS.has(VariantResolver.getBaseName(itemName))) return undefined;
  if (getCookingItems().has(itemName)) return isQualityExemptGroup('Cooking') ? undefined : 2;
  if (getCrabpotItems().has(itemName)) return isQualityExemptGroup('Fish') ? undefined : 1;
  if (IRIDIUM_QUALITY_ITEMS.has(VariantResolver.getBaseName(itemName))) {
    // Clam/Cockle/Mussel/Oyster are fish; Mayonnaise follows animal products
    const group = VariantResolver.getBaseName(itemName) === 'Mayonnaise' ? 'Animal Products' : 'Fish';
    return isQualityExemptGroup(group) ? undefined : 4;
  }
  const preservingCraftTier = getQualityPreservingCraftTargetTier(itemName);
  if (preservingCraftTier !== undefined) return preservingCraftTier;
  const category = getItemCategory(itemName);
  if (category && IRIDIUM_QUALITY_CATEGORIES.has(category)) return isQualityExemptGroup(category) ? undefined : 4;
  return undefined;
}

function getQualityPreservingCraftTargetTier(craftedName: string): number | undefined {
  if (!isQualityPreservingCraft(craftedName)) return undefined;
  const recipe = recipeMap.get(craftedName);
  if (!recipe || recipe.size === 0) return 4;
  const ingredientTiers = Array.from(recipe.keys())
    .map(ingredientName => getQualityTargetTier(ingredientName))
    .filter((tier): tier is number => tier !== undefined);
  // All quality-bearing ingredients are exempt (or none exist) -> the craft is exempt too
  if (ingredientTiers.length === 0) return undefined;
  return Math.max(...ingredientTiers);
}

function getItemCategory(itemName: string): string | undefined {
  const baseName = VariantResolver.getBaseName(itemName);
  return CustomDataStore.getItemsData().find(entry =>
    entry.name === itemName ||
    entry.displayName === itemName ||
    entry.name === baseName ||
    entry.displayName === baseName
  )?.category;
}

function getPhysicalCategory(itemName: string): string | undefined {
  return bundledCategories.get(VariantResolver.getBaseName(itemName)) ?? getItemCategory(itemName);
}

function getAvailableQualityTiers(itemName: string): number[] {
  const items = CustomDataStore.getItemsData();
  const parts = CustomDataStore.getPartsData();
  if (items !== qualityItemsRef || parts !== qualityPartsRef) {
    availableQualityTiersCache.clear();
    qualityItemsRef = items;
    qualityPartsRef = parts;
  }
  const cached = availableQualityTiersCache.get(itemName);
  if (cached) return cached;
  const tiers = computeAvailableQualityTiers(itemName);
  availableQualityTiersCache.set(itemName, tiers);
  return tiers;
}

function computeAvailableQualityTiers(itemName: string): number[] {
  if (VariantResolver.hasColorVariants(itemName)) return [0];
  const baseName = VariantResolver.getBaseName(itemName);
  if (NO_QUALITY_ITEMS.has(baseName) || NORMAL_ONLY_ITEMS.has(baseName)) return [0];
  if (getCookingItems(true).has(baseName)) return [0, 2];
  if (getCrabpotItems().has(baseName)) return [0, 1];
  if (isQualityPreservingCraft(itemName)) {
    const ingredients = recipeMap.get(itemName);
    const qualityIngredient = [...(ingredients?.keys() ?? [])].find(name => getAvailableQualityTiers(name).length > 1);
    return qualityIngredient ? getAvailableQualityTiers(qualityIngredient) : [0];
  }
  const category = getPhysicalCategory(itemName);
  if (FRUIT_SAPLINGS.has(baseName) || baseName === 'Coffee Bean' || AGEABLE_CRAFT_ITEMS.has(baseName)
    || IRIDIUM_QUALITY_ITEMS.has(baseName) || (category && IRIDIUM_QUALITY_CATEGORIES.has(category))
    || category === 'Vegetables') return [0, 1, 2, 4];
  return [0];
}

function getCollectionQualityTiers(itemName: string, stacksMap: Map<string, number[]>, quality: Quality): number[] {
  if (quality === 'highest') {
    const tier = getQualityTargetTier(itemName);
    if (tier !== undefined) return [tier];
  }
  const available = getAvailableQualityTiers(itemName);
  if (quality === 'all') return available;
  const requested = QUALITY_TIER_IDS[quality];
  if (requested !== undefined) return [available.filter(tier => tier <= requested).at(-1) ?? 0];
  const stacks = stacksMap.get(itemName) ?? [];
  // Any means one stack of a single quality, rather than a sum of mixed stacks.
  let best = available.reduce((best, tier) => (stacks[tier] ?? 0) > (stacks[best] ?? 0) ? tier : best, available[0]!);
  // Before any output has been collected, choose a preserving recipe's quality
  // from its surplus inputs instead of arbitrarily requiring normal output.
  if ((stacks[best] ?? 0) === 0 && isQualityPreservingCraft(itemName)) {
    let bestCrafts = -1;
    for (const tier of available) {
      let crafts = Infinity;
      for (const [name, qty] of recipeMap.get(itemName) ?? []) {
        const inputTier = getAvailableQualityTiers(name).length === 1 ? 0 : tier;
        const have = stacksMap.get(name)?.[inputTier] ?? 0;
        const reserve = getItemCategory(name) !== undefined && getCollectionQualityTiers(name, stacksMap, quality).includes(inputTier) ? TARGET : 0;
        crafts = Math.min(crafts, Math.floor(Math.max(0, have - reserve) / qty));
      }
      if (Number.isFinite(crafts) && crafts > bestCrafts) {
        best = tier;
        bestCrafts = crafts;
      }
    }
  }
  return [best];
}

function usesTierTargets(itemName: string, quality: Quality): boolean {
  return quality !== 'highest' || (getQualityTargetTier(itemName) === undefined && getAvailableQualityTiers(itemName).length > 1);
}

function collectionTarget(itemName: string, stacksMap: Map<string, number[]>, quality: Quality): number {
  return TARGET * getCollectionQualityTiers(itemName, stacksMap, quality).length;
}

function collectionQualityTargets(itemName: string, stacksMap: Map<string, number[]>, quality: Quality): number[] {
  const targets = [0, 0, 0, 0, 0];
  for (const tier of getCollectionQualityTiers(itemName, stacksMap, quality)) targets[tier] = TARGET;
  return targets;
}

function qualityProgressFields(
  row: ItemRow,
  lookupKey: string,
  stacksMap: Map<string, number[]>,
  quality: Quality,
  requiredByQuality = new Map<string, number[]>(),
  consumedByQuality = new Map<string, number[]>(),
) {
  if (!usesTierTargets(lookupKey, quality)) {
    const tier = getQualityTargetTier(lookupKey);
    const stacks = stacksMap.get(lookupKey);
    const count = tier === undefined ? undefined : (stacks?.[tier]
      ?? (VariantResolver.hasColorVariants(VariantResolver.getBaseName(lookupKey)) ? 0 : undefined));
    return {
      correctQualityCount: count,
      qualityTiers: tier === undefined ? undefined : [tier],
      hasWrongQuality: count !== undefined && count < TARGET && (stacks?.some(n => n >= TARGET) ?? false),
      ...saplingQualityFields(row, stacksMap, quality),
    };
  }
  const targets = collectionQualityTargets(lookupKey, stacksMap, quality)
    .map((count, tier) => count + (requiredByQuality.get(lookupKey)?.[tier] ?? 0));
  const stacks = stacksMap.get(lookupKey) ?? [row.raw, 0, 0, 0, 0];
  const tiers = getCollectionQualityTiers(lookupKey, stacksMap, quality);
  const baseCovered = tiers.reduce((sum, tier) => sum + Math.min(TARGET, stacks[tier] ?? 0), 0);
  return {
    qualityTargets: targets,
    qualityConsumed: consumedByQuality.get(lookupKey) ?? [0, 0, 0, 0, 0],
    qualityTiers: targets.flatMap((count, tier) => count > 0 ? [tier] : []),
    rawStacks: stacks,
    correctQualityCount: quality !== 'highest' && tiers.length === 1 ? (stacks[tiers[0]!] ?? 0) : undefined,
    hasWrongQuality: row.raw >= tiers.length * TARGET && baseCovered < tiers.length * TARGET,
    ...(FRUIT_SAPLINGS.has(row.name) ? {
      namePercentage: Math.min(100, (quality === 'all' ? row.raw / (tiers.length * TARGET) : Math.max(...stacks) / TARGET) * 100),
    } : {}),
  };
}

function isQualityPreservingCraft(craftedName: string): boolean {
  const category = getPhysicalCategory(craftedName);
  return category !== undefined && QUALITY_PRESERVING_CRAFT_CATEGORIES.has(category);
}

function getProgressInventoryCount(
  itemName: string,
  inventoryMap: Map<string, number>,
  stacksMap: Map<string, number[]>,
  quality: Quality,
  extraTarget = 0,
): number {
  if (quality !== 'highest') {
    const stacks = stacksMap.get(itemName) ?? [];
    const covered = getCollectionQualityTiers(itemName, stacksMap, quality)
      .reduce((sum, tier) => sum + Math.min(TARGET, stacks[tier] ?? 0), 0);
    return covered + Math.min(extraTarget, Math.max(0, (inventoryMap.get(itemName) ?? 0) - covered));
  }
  const correctTier = getQualityTargetTier(itemName);
  if (correctTier === undefined) {
    if (getAvailableQualityTiers(itemName).length > 1) {
      return Math.max(...(stacksMap.get(itemName) ?? [0]));
    }
    return inventoryMap.get(itemName) ?? 0;
  }
  return stacksMap.get(itemName)?.[correctTier] ?? 0;
}

function isAgeableCraft(itemName: string): boolean {
  if (AGEABLE_CRAFT_ITEMS.has(itemName)) return true;
  return getPhysicalCategory(itemName) === 'Wine';
}

function getDependencyInventoryCount(
  itemName: string,
  inventoryMap: Map<string, number>,
  stacksMap: Map<string, number[]>,
  quality: Quality,
  extraTarget = 0,
): number {
  if (isAgeableCraft(itemName)) {
    if (quality === 'highest' || quality === 'any') return inventoryMap.get(itemName) ?? 0;
    // Lower-quality products can be aged into a missing higher-quality stack.
    // Surplus iridium products cannot stand in for missing lower qualities.
    const remaining = [...(stacksMap.get(itemName) ?? [0, 0, 0, 0, 0])];
    let covered = 0;
    for (const targetTier of getCollectionQualityTiers(itemName, stacksMap, quality)) {
      let needed = TARGET;
      for (const tier of [4, 2, 1, 0].filter(tier => tier <= targetTier)) {
        const used = Math.min(needed, remaining[tier] ?? 0);
        remaining[tier] = (remaining[tier] ?? 0) - used;
        needed -= used;
        covered += used;
      }
    }
    return covered + Math.min(extraTarget, remaining.reduce((sum, count) => sum + count, 0));
  }
  return getProgressInventoryCount(itemName, inventoryMap, stacksMap, quality, extraTarget);
}

function requiresSeasoning(itemName: string, quality: Quality): boolean {
  if (!getCookingItems(quality !== 'highest').has(itemName)) return false;
  if (quality === 'highest') return !isQualityExemptGroup('Cooking');
  return quality === 'all' || quality === 'gold' || quality === 'iridium';
}

function usesQualitySensitiveIngredients(craftedItemName: string): boolean {
  return isQualityPreservingCraft(craftedItemName);
}

function getRecipeIngredientAvailability(
  craftedName: string,
  ingredientName: string,
  inventoryMap: Map<string, number>,
  stacksMap: Map<string, number[]>,
  quality: Quality,
): number {
  if (VariantResolver.hasColorVariants(ingredientName)) {
    return flowerSurplus(ingredientName, inventoryMap, stacksMap, quality);
  }
  if (!isQualityPreservingCraft(craftedName) || getAvailableQualityTiers(ingredientName).length === 1) {
    return inventoryMap.get(ingredientName) ?? 0;
  }
  if (quality !== 'highest') {
    return getCollectionQualityTiers(craftedName, stacksMap, quality)
      .reduce((sum, tier) => sum + (stacksMap.get(ingredientName)?.[tier] ?? 0), 0);
  }
  const targetTier = getQualityTargetTier(craftedName);
  if (targetTier === undefined) return inventoryMap.get(ingredientName) ?? 0;
  return stacksMap.get(ingredientName)?.[targetTier] ?? 0;
}

function flowerSurplus(baseName: string, inventoryMap: Map<string, number>, stacksMap: Map<string, number[]>, quality: Quality): number {
  let total = 0;
  for (const [name, count] of inventoryMap) {
    if (VariantResolver.getBaseName(name) !== baseName) continue;
    const reserved = getCollectionQualityTiers(name, stacksMap, quality)
      .reduce((sum, tier) => sum + Math.min(TARGET, stacksMap.get(name)?.[tier] ?? 0), 0);
    total += Math.max(0, count - reserved);
  }
  return total;
}

function computeAnyIngredientAvailability(
  inventoryMap: Map<string, number>,
  stacksMap: Map<string, number[]>,
  quality: Quality,
  requiredFromParts: Map<string, number>,
  totalFromParts: Map<string, number>,
  requiredByQuality = new Map<string, number[]>(),
  consumedByQuality = new Map<string, number[]>(),
): Map<string, number> {
  const availability = new Map<string, number>();
  for (const [wildcardId, anyIngredient] of Object.entries(ANY_INGREDIENTS)) {
    const info = getAnyIngredientInfo(wildcardId)!;
    let raw = 0;
    for (const candidateName of info.candidates) {
      const candidateRaw = inventoryMap.get(candidateName) ?? 0;
      if (candidateRaw === 0) continue;
      if (usesTierTargets(candidateName, quality)) {
        const row: ItemRow = {
          name: candidateName,
          required: collectionTarget(candidateName, stacksMap, quality) + (requiredFromParts.get(candidateName) ?? 0),
          total: totalFromParts.get(candidateName) ?? 0,
          raw: candidateRaw,
          tooltip: undefined as any,
        };
        Object.assign(row, qualityProgressFields(row, candidateName, stacksMap, quality, requiredByQuality, consumedByQuality));
        if (calculateNeededCount(row) === 0) raw += Math.max(0, candidateRaw - rawNeededForCompletion(row));
        continue;
      }
      const required = TARGET + (requiredFromParts.get(candidateName) ?? 0);
      const total = totalFromParts.get(candidateName) ?? 0;
      const neededForCompletion = Math.max(TARGET, required - total);
      const correctTier = getQualityTargetTier(candidateName);
      const availableForCompletion = quality === 'highest' && correctTier !== undefined
        ? stacksMap.get(candidateName)?.[correctTier] ?? 0
        : candidateRaw;
      if (availableForCompletion < neededForCompletion) continue;
      raw += Math.max(0, candidateRaw - neededForCompletion);
    }
    availability.set(anyIngredient.name, raw);
  }
  return availability;
}

function rawNeededForCompletion(row: ItemRow): number {
  if (row.qualityTargets) {
    const flexibleRequired = row.required - row.qualityTargets.reduce((sum, count) => sum + count, 0);
    const flexibleConsumed = row.totalFlexible ?? row.total - (row.qualityConsumed?.reduce((sum, count) => sum + count, 0) ?? 0);
    return reservedQualityRaw(row) + Math.max(0, flexibleRequired - flexibleConsumed);
  }
  return Math.max(TARGET, row.required - row.total);
}

function reservedQualityRaw(row: ItemRow): number {
  if (row.qualityTargets) return row.qualityTargets.reduce((sum, target, tier) => sum
    + Math.min(row.rawStacks?.[tier] ?? 0, Math.max(0, target - (row.qualityConsumed?.[tier] ?? 0))), 0);
  return Math.min(TARGET, row.correctQualityCount ?? row.raw);
}

function extraRawForAnyIngredient(candidateNames: string[], rows: ItemRow[]): number {
  let total = 0;
  const candidates = new Set(candidateNames);
  for (const row of rows) {
    if (!candidates.has(row.name) && !candidates.has(row.sourceName ?? '')
      && !candidates.has(VariantResolver.getBaseName(row.name))) continue;
    const availableForCompletion = row.correctQualityCount ?? row.raw;
    const complete = row.qualityTargets ? calculateNeededCount(row) === 0 : availableForCompletion >= rawNeededForCompletion(row);
    if (!complete) continue;
    total += Math.max(0, row.raw - rawNeededForCompletion(row));
  }
  return total;
}

function saplingQualityFields(row: ItemRow, stacksMap: Map<string, number[]>, quality: Quality) {
  if (!FRUIT_SAPLINGS.has(row.name)) return {};
  const tiers: Partial<Record<Quality, number>> = { highest: 4, normal: 0, silver: 1, gold: 2, iridium: 4 };
  const tier = tiers[quality];
  if (tier === undefined) return {};
  const stacks = stacksMap.get(row.name) ?? [0, 0, 0, 0, 0];
  const raw = stacks.reduce((sum, count) => sum + count, 0);
  const correctQualityCount = stacks[tier] ?? 0;
  return {
    raw,
    rawStacks: stacks,
    correctQualityCount,
    qualityTiers: [tier],
    hasWrongQuality: raw >= TARGET && correctQualityCount < TARGET,
    namePercentage: Math.min(100, Math.max(...stacks) / TARGET * 100),
  };
}

// Each flower color (including Cart) has its own collection target. Recipe
// requirements and consumed flowers belong exclusively to the shared Extra row.
function flowerCollectionFields(lookupKey: string, stacksMap: Map<string, number[]>, quality: Quality) {
  const stacks = stacksMap.get(lookupKey);
  const tier = quality === 'highest' ? getQualityTargetTier(lookupKey) : undefined;
  const correctQualityCount = tier === undefined ? undefined : (stacks?.[tier] ?? 0);
  return {
    required: collectionTarget(lookupKey, stacksMap, quality),
    requiredStrict: 0,
    requiredFlexible: 0,
    total: 0,
    totalStrict: 0,
    totalFlexible: 0,
    totalActual: 0,
    correctQualityCount,
    hasWrongQuality: correctQualityCount !== undefined && correctQualityCount < TARGET
      && (stacks?.some(count => count >= TARGET) ?? false),
    hasUnfinishedDependents: false,
  };
}

function flowerExtraRows(
  source: ItemEntry[],
  collectionRows: ItemRow[],
  requiredFromParts: Map<string, number>,
  totalFromParts: Map<string, number>,
  totalFromPartsActual = totalFromParts,
): ItemRow[] {
  const baseNames = new Set(source.filter(item => VariantResolver.hasColorVariants(item.name)).map(item => item.name));
  const rows: ItemRow[] = [];
  for (const baseName of baseNames) {
    const required = requiredFromParts.get(baseName) ?? 0;
    if (required === 0) continue;
    // Reserve up to 999 of the counting quality for each variant independently.
    // Other qualities can be used in recipes even while that variant is unfinished.
    const raw = collectionRows
      .filter(row => VariantResolver.getBaseName(row.name) === baseName)
      .reduce((sum, row) => sum + Math.max(0, row.raw - reservedQualityRaw(row)), 0);
    const total = Math.min(totalFromParts.get(baseName) ?? 0, required);
    rows.push({
      name: `${baseName} Extra`,
      category: source.find(item => item.name === baseName)?.category,
      required,
      total,
      totalActual: totalFromPartsActual.get(baseName) ?? 0,
      raw,
      buyPrice: priceMap.get(baseName),
      tooltip: undefined as any,
      hasWrongQuality: false,
      hasUnfinishedDependents: raw + total >= required && total < required,
      excludeFromTotals: true,
    });
  }
  return rows;
}

(function buildMaps() {
  for (const [craftedName, ingredients] of CustomDataStore.getPartsData()) {
    const recipe = new Map<string, number>();
    const wildcardRecipe = new Map<string, number>();
    for (const [id, entry] of Object.entries(ingredients)) {
      const [name, qty] = entry as [string | null, number];
      if (isWildcard(id, name)) {
        const anyIngredient = getAnyIngredientInfo(id);
        if (!anyIngredient) continue;
        wildcardRecipe.set(anyIngredient.name, qty);
        const rev = wildcardReverseMap.get(anyIngredient.name) ?? [];
        rev.push(craftedName);
        wildcardReverseMap.set(anyIngredient.name, rev);
        continue;
      }
      recipe.set(name!, qty);
      const rev = reverseMap.get(name!) ?? [];
      rev.push(craftedName);
      reverseMap.set(name!, rev);
    }
    if (recipe.size > 0) recipeMap.set(craftedName, recipe);
    if (wildcardRecipe.size > 0) wildcardRecipeMap.set(craftedName, wildcardRecipe);
  }
})();

function craftableCount(
  craftedName: string,
  inventoryMap: Map<string, number>,
  anyIngredientAvailability = new Map<string, number>(),
  stacksMap = new Map<string, number[]>(),
  quality: Quality = Config.getQuality(),
): { count: number; limiting: string | null } {
  const recipe = recipeMap.get(craftedName);
  const wildcardRecipe = wildcardRecipeMap.get(craftedName);
  if (!recipe && !wildcardRecipe) return { count: 0, limiting: null };
  let min = Infinity;
  let limiting: string | null = null;
  for (const [ingredient, qty] of recipe ?? []) {
    const have = getRecipeIngredientAvailability(craftedName, ingredient, inventoryMap, stacksMap, quality);
    const can = Math.floor(have / qty);
    if (can < min) { min = can; limiting = ingredient; }
  }
  for (const [ingredient, qty] of wildcardRecipe ?? []) {
    const have = anyIngredientAvailability.get(ingredient) ?? 0;
    const can = Math.floor(have / qty);
    if (can < min) { min = can; limiting = ingredient; }
  }
  return { count: min === Infinity ? 0 : min, limiting };
}

function computeTooltipData(
  itemName: string,
  count: number,
  inventoryMap: Map<string, number>,
  stacksMap: Map<string, number[]>,
  quality: Quality,
  completionMap: Map<string, boolean>,
  craftableCache: Map<string, { count: number; limiting: string | null }>,
  anyIngredientAvailability = new Map<string, number>(),
  neededMap = new Map<string, number>()
): ItemTooltipData {
  const note = (notesData as Record<string, string[]>)[itemName] ?? null;

  // Ingredients consumed by the crafts still needed to finish craftedName
  const ingredientNeed = (craftedName: string, qty: number): number => {
    const needed = neededMap.get(craftedName) ?? 0;
    if (needed <= 0) return 0;
    const avgYield = yieldMap.get(craftedName) ?? 1;
    return Math.ceil(needed / avgYield) * qty;
  };

  const ownRecipe = recipeMap.get(itemName);
  const ownWildcardRecipe = wildcardRecipeMap.get(itemName);
  let recipe: IngredientInfo[] | null = null;
  let canCraft = 0;
  let limitingIngredient: string | null = null;

  if (ownRecipe || ownWildcardRecipe) {
    let cached = craftableCache.get(itemName);
    if (ownWildcardRecipe || isQualityPreservingCraft(itemName)) {
      cached = craftableCount(itemName, inventoryMap, anyIngredientAvailability, stacksMap, quality);
    } else if (!cached) {
      cached = craftableCount(itemName, inventoryMap, anyIngredientAvailability, stacksMap, quality);
      craftableCache.set(itemName, cached);
    }
    const { count, limiting } = cached;
    // Multiply by yield to show total output (e.g., 408 fish → 3060 bait at 7.5 avg yield)
    const avgYield = yieldMap.get(itemName) ?? 1;
    canCraft = Math.floor(count * avgYield);
    limitingIngredient = limiting;
    recipe = [
      ...Array.from(ownWildcardRecipe?.entries() ?? []).map(([name, qty]) => ({
        name,
        qty,
        available: anyIngredientAvailability.get(name) ?? 0,
        done: (anyIngredientAvailability.get(name) ?? 0) >= qty,
        neededForTarget: ingredientNeed(itemName, qty),
      })),
      ...Array.from(ownRecipe?.entries() ?? []).map(([name, qty]) => ({
        name,
        qty,
        available: getRecipeIngredientAvailability(itemName, name, inventoryMap, stacksMap, quality),
        done: getRecipeIngredientAvailability(itemName, name, inventoryMap, stacksMap, quality) >= qty,
        neededForTarget: ingredientNeed(itemName, qty),
      })),
    ];
  }

  if (requiresSeasoning(itemName, quality)) {
    if (recipe === null) recipe = [];
    recipe.push({
      name: 'Qi Seasoning',
      qty: 1,
      available: inventoryMap.get('Qi Seasoning') ?? 0,
      done: completionMap.get('Qi Seasoning') ?? false,
    });
  }

  const cookingItems = new Set([...getCookingItems(true)].filter(name => requiresSeasoning(name, quality)));
  const usedBy: UsedByInfo[] = (reverseMap.get(itemName) ?? []).map(craftedName => {
    let cachedCrafted = craftableCache.get(craftedName);
    if (wildcardRecipeMap.has(craftedName) || isQualityPreservingCraft(craftedName)) {
      cachedCrafted = craftableCount(craftedName, inventoryMap, anyIngredientAvailability, stacksMap, quality);
    } else if (!cachedCrafted) {
      cachedCrafted = craftableCount(craftedName, inventoryMap, anyIngredientAvailability, stacksMap, quality);
      craftableCache.set(craftedName, cachedCrafted);
    }
    const { count } = cachedCrafted;
    // Multiply by yield to show total output
    const avgYield = yieldMap.get(craftedName) ?? 1;
    const totalOutput = Math.floor(count * avgYield);
    const alreadyHave = inventoryMap.get(craftedName) ?? 0;
    const done = completionMap.get(craftedName) ?? false;
    const depRecipe = recipeMap.get(craftedName);
    const depWildcardRecipe = wildcardRecipeMap.get(craftedName);
    const recipe: IngredientInfo[] = [
      ...Array.from(depWildcardRecipe?.entries() ?? []).map(([name, qty]) => ({
          name,
          qty,
          available: anyIngredientAvailability.get(name) ?? 0,
          done: (anyIngredientAvailability.get(name) ?? 0) >= qty,
          neededForTarget: ingredientNeed(craftedName, qty),
        })),
      ...Array.from(depRecipe?.entries() ?? []).map(([name, qty]) => ({
          name,
          qty,
          available: getRecipeIngredientAvailability(craftedName, name, inventoryMap, stacksMap, quality),
          done: getRecipeIngredientAvailability(craftedName, name, inventoryMap, stacksMap, quality) >= qty,
          neededForTarget: ingredientNeed(craftedName, qty),
        })),
    ];
    if (cookingItems?.has(craftedName)) {
      recipe.push({
        name: 'Qi Seasoning',
        qty: 1,
        available: inventoryMap.get('Qi Seasoning') ?? 0,
        done: completionMap.get('Qi Seasoning') ?? false,
      });
    }
    return { craftedName, craftableCount: totalOutput, alreadyHave, done, recipe };
  });

  const done = completionMap.get(itemName) ?? false;
  const shops = shopEntriesMap.get(itemName) ?? [];
  return { count, note, recipe, craftableCount: canCraft, limitingIngredient, done,
    usedBy: groupSmokedFishUses(itemName, usedBy), shops, neededCount: neededMap.get(itemName) ?? 0 };
}

function groupSmokedFishUses(itemName: string, uses: UsedByInfo[]): UsedByInfo[] {
  if (itemName !== 'Coal') return uses;
  const smoking = uses.filter(use => getPhysicalCategory(use.craftedName) === 'Smoked Fish');
  if (smoking.length < 2) return uses;
  const fuel = smoking[0]!.recipe.find(ingredient => ingredient.name === 'Coal');
  if (!fuel) return uses;
  const needed = smoking.reduce((sum, use) => sum
    + (use.recipe.find(ingredient => ingredient.name === 'Coal')?.neededForTarget ?? 0), 0);
  return [
    ...uses.filter(use => getPhysicalCategory(use.craftedName) !== 'Smoked Fish'),
    {
      craftedName: 'Smoked Fish',
      groupedRecipes: smoking.length,
      alreadyHave: smoking.reduce((sum, use) => sum + use.alreadyHave, 0),
      craftableCount: Math.min(Math.floor(fuel.available / fuel.qty), smoking.reduce((sum, use) => sum + use.craftableCount, 0)),
      done: smoking.every(use => use.done),
      recipe: [{ ...fuel, neededForTarget: needed, done: fuel.available >= needed }],
    },
  ];
}

function computeAnyIngredientTooltipData(
  itemName: string,
  count: number,
  inventoryMap: Map<string, number>,
  completionMap: Map<string, boolean>,
  anyIngredientAvailability = new Map<string, number>(),
): ItemTooltipData {
  const usedBy: UsedByInfo[] = (wildcardReverseMap.get(itemName) ?? []).map(craftedName => {
    const avgYield = yieldMap.get(craftedName) ?? 1;
    const alreadyHave = inventoryMap.get(craftedName) ?? 0;
    const done = completionMap.get(craftedName) ?? false;
    const wildcardRecipe = wildcardRecipeMap.get(craftedName) ?? new Map<string, number>();
    const concreteRecipe = recipeMap.get(craftedName) ?? new Map<string, number>();
    const wildcardQty = wildcardRecipe.get(itemName) ?? 1;
    const craftableCount = Math.floor(Math.floor(count / wildcardQty) * avgYield);
    const recipe: IngredientInfo[] = [
      ...Array.from(wildcardRecipe.entries()).map(([name, qty]) => ({
        name,
        qty,
        available: anyIngredientAvailability.get(name) ?? 0,
        done: (anyIngredientAvailability.get(name) ?? 0) >= qty,
      })),
      ...Array.from(concreteRecipe.entries()).map(([name, qty]) => ({
        name,
        qty,
        available: inventoryMap.get(name) ?? 0,
        done: completionMap.get(name) ?? false,
      })),
    ];
    return { craftedName, craftableCount, alreadyHave, done, recipe };
  });

  return {
    count,
    note: null,
    recipe: null,
    craftableCount: 0,
    limitingIngredient: null,
    done: false,
    usedBy,
    shops: [],
  };
}

export function hasTooltipContent(t: ItemTooltipData): boolean {
  return (t.spareCount ?? 0) > 0 || !!t.note || !!t.recipe || t.usedBy.length > 0 || t.shops.length > 0;
}

// Lightweight computation for historical/one-off data that doesn't use global cache
// Used by History dialog to compute past game states without polluting the main cache
export function computeCategoryItemsUncached(
  categoryName: string,
  compacted: Array<{ name: string; stack: number; quality?: number[] }>
): ItemRow[] {
  const quality = Config.getQuality();
  
  const { inventoryMap, stacksMap } = buildInventoryMaps(compacted);

  const { requiredFromPartsStrict, requiredFromPartsFlexible, totalFromPartsStrict, totalFromPartsFlexible, requiredFromParts, totalFromParts, totalFromPartsActual, requiredFromPartsQuality, totalFromPartsQuality } = computeRequirements(inventoryMap, stacksMap, quality);

  const source = CustomDataStore.getItemsData();
  const entries = categoryName === 'All' ? source : source.filter((item) => item.category === categoryName);
  const seen = new Set<string>();
  seen.add("Qi Fruit");
  const rows: ItemRow[] = [];

  for (const item of entries) {
    let itemKey = item.displayName || item.name;
    let lookupKey = itemKey;

    if (item.displayName !== null && !VariantResolver.hasColorVariants(item.name) && !VariantResolver.hasItemIdVariants(item.name)) {
      lookupKey = item.name;
    }
    
    // For base items with variants, check if base name exists in inventory
    if (item.displayName === null && VariantResolver.hasColorVariants(item.name)) {
      if (inventoryMap.has(item.name)) {
        // Base item has inventory - show as (Cart) variant
        itemKey = `${item.name} (Cart)`;
        lookupKey = item.name;
      } else {
        // No inventory for base item - skip it
        continue;
      }
    }

    if (item.displayName === null && VariantResolver.hasItemIdVariants(item.name) && !inventoryMap.has(item.name)) {
      continue;
    }
    
    // Track by display name to allow multiple variants of same base item
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    
    const raw = inventoryMap.get(lookupKey) ?? 0;
    const required = collectionTarget(lookupKey, stacksMap, quality) + (requiredFromParts.get(item.name) ?? 0);
    const total = totalFromParts.get(item.name) ?? 0;
    const row: ItemRow = {
      name: itemKey, 
      sourceName: item.name,
      itemId: compacted.find(entry => entry.name === lookupKey || entry.name === itemKey)?.itemId,
      category: item.category,
      required,
      requiredStrict: requiredFromPartsStrict.get(item.name) ?? 0,
      requiredFlexible: requiredFromPartsFlexible.get(item.name) ?? 0,
      total,
      totalStrict: totalFromPartsStrict.get(item.name) ?? 0,
      totalFlexible: totalFromPartsFlexible.get(item.name) ?? 0,
      raw,
      rawStacks: stacksMap.get(lookupKey), // Use lookupKey to get actual stacks
      buyPrice: priceMap.get(item.name),
      tooltip: undefined as any, // History doesn't need tooltips
      ...(VariantResolver.hasColorVariants(item.name) ? flowerCollectionFields(lookupKey, stacksMap, quality) : {}),
    };
    Object.assign(row, qualityProgressFields(row, lookupKey, stacksMap, quality,
      VariantResolver.hasColorVariants(item.name) ? undefined : requiredFromPartsQuality,
      VariantResolver.hasColorVariants(item.name) ? undefined : totalFromPartsQuality));
    rows.push(row);
  }

  rows.push(...flowerExtraRows(entries, rows, requiredFromParts, totalFromParts));

  for (const [wildcardId, anyIngredient] of Object.entries(ANY_INGREDIENTS)) {
    const info = getAnyIngredientInfo(wildcardId)!;
    const recipeReq = requiredFromParts.get(info.name) ?? 0;
    if (recipeReq === 0) continue;
    const total = Math.min(totalFromParts.get(info.name) ?? 0, recipeReq);
    const raw = extraRawForAnyIngredient(info.candidates, rows);
    rows.push({
      name: anyIngredient.name,
      itemId: undefined,
      category: anyIngredient.category,
      required: recipeReq,
      total,
      raw,
      rawStacks: undefined,
      buyPrice: undefined,
      tooltip: undefined as any,
      hasWrongQuality: false,
      hasUnfinishedDependents: raw + total >= recipeReq && total < recipeReq,
      correctQualityCount: undefined,
      excludeFromTotals: true,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function computeCategoryItems(
  categoryName: string,
  compacted: Array<{ name: string; stack: number; quality?: number[] }>
): ItemRow[] {
  const quality = Config.getQuality();
  const qualityKey = `${quality}|${Config.getQualityExemptions().join(',')}`;

  // Compute ALL items once when data, quality, or quality exemptions change
  if (compacted !== lastCompactedRef || qualityKey !== lastQuality) {
    // Set these FIRST so subsequent calls don't re-trigger
    lastCompactedRef = compacted;
    lastQuality = qualityKey;
    
    // Only compute if not already computing (prevents concurrent calls)
    if (!isComputing) {
      isComputing = true;
      try {
        computeAllItems(compacted, quality);
      } finally {
        isComputing = false;
      }
    }
  }
  
  // Just filter the pre-computed rows by category
  if (categoryName === 'All') {
    return allComputedRows;
  }
  
  // Filter by category - need to match against original item data
  // Build a set of both item.name AND item.displayName for matching
  const categoryItemIdentifiers = new Set<string>();
  for (const item of CustomDataStore.getItemsData()) {
    if (item.category === categoryName) {
      categoryItemIdentifiers.add(item.name);
      if (item.displayName) {
        categoryItemIdentifiers.add(item.displayName);
      }
    }
  }
  
  // Include rows where the base name OR the row name matches
  return allComputedRows.filter(row => {
    if (row.category === categoryName) return true;
    // For variants like "Blue Jazz (Cart)" or "Blue Jazz (35,127,255)", extract base name
    const baseName = VariantResolver.getBaseName(row.name);
    return categoryItemIdentifiers.has(baseName) || categoryItemIdentifiers.has(row.name);
  });
}

export interface FinishableItem {
  name: string;
  itemId?: string;
  category?: string;
  needed: number;      // remaining after the aging credit for ageable crafts
  producible: number;  // output craftable from surplus ingredients
  limiting: string | null;
  finishable: boolean;
  viaAging: boolean;   // covered (partly) by existing lower-quality output that only needs aging
}

// Surplus of an ingredient available for crafting craftedName, keeping a full base
// stack (in the counting quality tier) for the ingredient's own row.
// - quality-preserving crafts (smoked fish) only get target-tier surplus
// - target-tier surplus of ingredients that have a preserving consumer is reserved
//   for that (iridium fish never go into cooked dishes)
function surplusAvailableFor(craftedName: string, ingredientName: string, quality: Quality): number {
  if (VariantResolver.hasColorVariants(ingredientName)) {
    return flowerSurplus(ingredientName, globalInventoryMap, globalStacksMap, quality);
  }
  const total = globalInventoryMap.get(ingredientName) ?? 0;
  if (quality !== 'highest') {
    const reserved = getItemCategory(ingredientName) === undefined ? 0
      : getCollectionQualityTiers(ingredientName, globalStacksMap, quality)
        .reduce((sum, tier) => sum + Math.min(TARGET, globalStacksMap.get(ingredientName)?.[tier] ?? 0), 0);
    return Math.max(0, total - reserved);
  }
  const tier = quality === 'highest' ? getQualityTargetTier(ingredientName) : undefined;
  const stacks = globalStacksMap.get(ingredientName);
  if (tier === undefined || !stacks) {
    return Math.max(0, total - TARGET);
  }
  const tierCount = stacks[tier] ?? 0;
  const tierSurplus = Math.max(0, tierCount - TARGET);
  if (isQualityPreservingCraft(craftedName)) {
    return tierSurplus;
  }
  const nonTier = Math.max(0, total - tierCount);
  const hasPreservingConsumer = (reverseMap.get(ingredientName) ?? []).some(isQualityPreservingCraft);
  return nonTier + (hasPreservingConsumer ? 0 : tierSurplus);
}

function surplusAtTier(ingredientName: string, tier: number, quality: Quality): number {
  if (getAvailableQualityTiers(ingredientName).length === 1) tier = 0;
  const have = globalStacksMap.get(ingredientName)?.[tier] ?? 0;
  const reserved = getItemCategory(ingredientName) !== undefined
    && getCollectionQualityTiers(ingredientName, globalStacksMap, quality).includes(tier) ? TARGET : 0;
  return Math.max(0, have - reserved);
}

// Which unfinished craftable items can be finished right now from surplus ingredients.
// Deliberately simple: assumes 999 of every ingredient is kept, and does not let
// competing recipes fight over the same surplus.
export function computeFinishableItems(
  compacted: Array<{ name: string; stack: number; quality?: number[] }>
): FinishableItem[] {
  computeCategoryItems('All', compacted); // ensure global caches are current
  const quality = Config.getQuality();
  const results: FinishableItem[] = [];

  for (const row of allComputedRows) {
    if (row.excludeFromTotals) continue;
    if (!recipeMap.has(row.name) && !wildcardRecipeMap.has(row.name)) continue;
    let needed = calculateNeededCount(row);
    if (needed <= 0) continue;

    // Ageable artisan goods: lower-quality output on hand only needs aging
    let viaAging = false;
    if (isAgeableCraft(row.name)) {
      const projected = getDependencyInventoryCount(row.name, globalInventoryMap, globalStacksMap, quality,
        row.required - collectionTarget(row.name, globalStacksMap, quality));
      const agingCredit = Math.min(needed, Math.max(0, projected - calculateObtainedCount(row)));
      if (agingCredit > 0) {
        needed -= agingCredit;
        viaAging = true;
      }
    }

    const avgYield = yieldMap.get(row.name) ?? 1;
    if (row.qualityTargets && isQualityPreservingCraft(row.name)) {
      let producible = 0;
      let limiting: string | null = null;
      const sharedInputsUsed = new Map<string, number>();
      for (const [tier, target] of row.qualityTargets.entries()) {
        const missing = Math.max(0, target - (row.rawStacks?.[tier] ?? 0) - (row.qualityConsumed?.[tier] ?? 0));
        if (missing === 0) continue;
        let crafts = Infinity;
        for (const [name, qty] of recipeMap.get(row.name) ?? []) {
          const available = Math.floor(Math.max(0, surplusAtTier(name, tier, quality) - (sharedInputsUsed.get(name) ?? 0)) / qty);
          if (available < crafts) {
            crafts = available;
            if (available * avgYield < missing) limiting = name;
          }
        }
        if (Number.isFinite(crafts)) {
          const produced = Math.min(missing, Math.floor(crafts * avgYield));
          producible += produced;
          for (const [name, qty] of recipeMap.get(row.name) ?? []) {
            if (getAvailableQualityTiers(name).length === 1) {
              sharedInputsUsed.set(name, (sharedInputsUsed.get(name) ?? 0) + Math.ceil(produced / avgYield) * qty);
            }
          }
        }
      }
      results.push({ name: row.name, itemId: row.itemId, category: row.category, needed, producible, limiting,
        finishable: producible >= needed, viaAging: false });
      continue;
    }
    let minCrafts = Infinity;
    let limiting: string | null = null;
    for (const [ingredientName, qty] of recipeMap.get(row.name) ?? []) {
      const crafts = Math.floor(surplusAvailableFor(row.name, ingredientName, quality) / qty);
      if (crafts < minCrafts) { minCrafts = crafts; limiting = ingredientName; }
    }
    for (const [ingredientName, qty] of wildcardRecipeMap.get(row.name) ?? []) {
      const crafts = Math.floor((globalAnyIngredientAvailability.get(ingredientName) ?? 0) / qty);
      if (crafts < minCrafts) { minCrafts = crafts; limiting = ingredientName; }
    }
    if (requiresSeasoning(row.name, quality)) {
      const seasoningSurplus = Math.max(0, (globalInventoryMap.get('Qi Seasoning') ?? 0) - TARGET);
      if (seasoningSurplus < minCrafts) { minCrafts = seasoningSurplus; limiting = 'Qi Seasoning'; }
    }
    if (!Number.isFinite(minCrafts)) continue;

    const producible = Math.floor(minCrafts * avgYield);
    results.push({
      name: row.name,
      itemId: row.itemId,
      category: row.category,
      needed,
      producible,
      limiting,
      finishable: producible >= needed,
      viaAging,
    });
  }

  return results.sort((a, b) =>
    (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name));
}

export function logDataIssues(
  compacted: Array<{ name: string; stack: number }>
): void {
  const itemsList = CustomDataStore.getItemsData();
  const partsList = CustomDataStore.getPartsData();

  // Include both base names and display names (for variants)
  const knownItemNames = new Set(
    itemsList.flatMap((item) => [item.name, item.displayName].filter(Boolean))
  );
  const inventoryNames = new Set(compacted.map(i => i.name));

  for (const [craftedName, ingredients] of partsList) {
    if (!knownItemNames.has(craftedName)) {
      console.warn(`[parts.json] Crafted item "${craftedName}" not found in items.json (name mismatch?)`);
    }
    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName] = ingredientEntry as [string | null, number];
      if (ingredientName === null) continue;
      const numId = Number(ingredientId);
      if (Number.isFinite(numId) && numId < 0) continue;
      if (!knownItemNames.has(ingredientName)) {
        console.warn(`[parts.json] Ingredient "${ingredientName}" in recipe "${craftedName}" not found in items.json`);
      }
    }
  }

  // for (const invName of inventoryNames) {
  //   if (!knownItemNames.has(invName)) {
  //     console.info(`[inventory] "${invName}" is in the save file but not listed in items.json`);
  //   }
  // }
}

// -----------------------------------------
// test-only exports (excluded in production)
// -----------------------------------------
export const __test = {
  computeCategoryItems,
  craftableCount,
  computeTooltipData,
  isWildcard,
  getCookingItems,
  getCrabpotItems,
  avgYieldOf,
  applyArtifactTroveRequirements,
  recipeMap,
  reverseMap,
  yieldMap,
  priceMap,
  shopEntriesMap
};
