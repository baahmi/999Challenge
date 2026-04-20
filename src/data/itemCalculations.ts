import { CustomDataStore, VariantResolver } from './CustomDataStore';
import notesData from './notes.json';
import pricesData from './prices.json';
import { Config } from '../config/Config';
import type { Quality } from '../config/Config';
import type { PartsEntry, YieldSpec } from "./CustomDataStore";

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
})();

function avgYieldOf(spec: YieldSpec | undefined): number {
  if (spec === undefined) return 1;
  if (Array.isArray(spec)) return (spec[0] + spec[1]) / 2;
  return spec;
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
}

export interface UsedByInfo {
  craftedName: string;
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
}

export interface ItemRow {
  name: string;
  required: number;
  total: number;
  raw: number;
  rawStacks?: number[]; // [normal, silver, gold, unused, iridium]
  buyPrice?: BuyPrice;
  tooltip: ItemTooltipData;
  hasWrongQuality?: boolean; // Has stacks but not in the correct quality tier
  hasUnfinishedDependents?: boolean; // Item is complete but has uncrafted dependencies
  correctQualityCount?: number; // Count of items in the correct quality tier
}

function isWildcard(id: string, name: string | null): boolean {
  if (name === null) return true;
  const numId = Number(id);
  return Number.isFinite(numId) && numId < 0;
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

// Global cache - computed once when data changes
let globalCraftableCache = new Map<string, { count: number; limiting: string | null }>();
let lastCompactedRef: any = null;
let lastQuality: string | null = null;
let globalInventoryMap = new Map<string, number>();
let globalStacksMap = new Map<string, number[]>();

// All computed item rows - computed once, filtered by category in the view
let allComputedRows: ItemRow[] = [];

// Flag to prevent concurrent computations
let isComputing = false;

// Compute all items once - called when data changes
function computeAllItems(
  compacted: Array<{ name: string; stack: number; quality?: number[] }>,
  quality: Quality
): void {
  console.log(`[CACHE] Computing all items from scratch`);
  
  // Build inventory and stacks maps
  globalInventoryMap.clear();
  globalStacksMap.clear();
  for (const item of compacted) {
    let  maxTier = (quality === 'highest' && getCookingItems().has(item.name)) ? 2 : 4;
    maxTier = (quality === 'highest' && getCrabpotItems().has(item.name)) ? 1 : maxTier;
    const count = item.quality
      ? getQualityFilteredCount(item.quality, quality, maxTier)
      : item.stack;
    globalInventoryMap.set(item.name, (globalInventoryMap.get(item.name) ?? 0) + count);
    if (item.quality) {
      const prev = globalStacksMap.get(item.name) ?? [0, 0, 0, 0, 0];
      globalStacksMap.set(item.name, item.quality.map((v, i) => (prev[i] ?? 0) + v));
    }
  }
  
  // Pre-compute ALL craftable counts upfront
  console.log(`[CACHE] Pre-computing all craftable counts`);
  globalCraftableCache.clear();
  for (const craftedName of recipeMap.keys()) {
    const cached = craftableCount(craftedName, globalInventoryMap);
    globalCraftableCache.set(craftedName, cached);
  }
  console.log(`[CACHE] Pre-computed ${globalCraftableCache.size} craftable counts`);
  
  const inventoryMap = globalInventoryMap;
  const stacksMap = globalStacksMap;

  const requiredFromParts = new Map<string, number>();
  const totalFromParts = new Map<string, number>();

  {
    // add trove to the requireds
    // Need 999 artifact troves in inventory + 999*length to open for all trove items
    // (opening a trove destroys it and gives 1 random item from the 28 possible)
    const length = CustomDataStore.getTroveItems().length;
    const minTroveCount: number = Math.min(...CustomDataStore.getTroveItems().map(itemName => inventoryMap.get(itemName) ?? 0));
    const troveRequired = TARGET * length;
    requiredFromParts.set("Artifact Trove", troveRequired);
    // Total is just what you've already opened (consumed)
    totalFromParts.set("Artifact Trove", minTroveCount*length);
  }

  for (const [craftedItemName, ingredients] of getPartsDataConsumersFirst()) {
    const craftedCount = inventoryMap.get(craftedItemName) ?? 0;
    const avgYield = yieldMap.get(craftedItemName) ?? 1;
    const required = requiredFromParts.get(craftedItemName) ?? 0;
    const targetAmount = TARGET + required;
    const totalCrafted = totalFromParts.get(craftedItemName) ?? 0;
    
    // How many of this crafted item do we have (inventory + what we've made/opened)
    const totalHave = Math.min(craftedCount + totalCrafted, targetAmount);
    
    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName, qty] = ingredientEntry as [string | null, number];
      if (isWildcard(ingredientId, ingredientName)) continue;
      const name = ingredientName!;
      
      // Calculate total ingredients required (for the full targetAmount)
      const requiredCount = Math.round((qty * targetAmount) / avgYield);
      // Calculate ingredients already used (for what we have)
      const totalCount = Math.round((qty * totalHave) / avgYield);
      requiredFromParts.set(name, (requiredFromParts.get(name) ?? 0) + requiredCount);
      totalFromParts.set(name, (totalFromParts.get(name) ?? 0) + totalCount);
    }
  }

  // Qi Seasoning: one per cooked dish when targeting highest quality
  if (quality === 'highest') {
    const seen = new Set<string>();
    for (const item of CustomDataStore.getItemsData()) {
      if (!getCookingItems().has(item.name) || seen.has(item.name)) continue;
      seen.add(item.name);
      requiredFromParts.set('Qi Seasoning', (requiredFromParts.get('Qi Seasoning') ?? 0) + TARGET);
      // Cap at TARGET per cooking item
      totalFromParts.set('Qi Seasoning', (totalFromParts.get('Qi Seasoning') ?? 0) + Math.min(inventoryMap.get(item.name) ?? 0, TARGET));
    }
  }

  const completionMap = new Map<string, boolean>();
  for (const item of CustomDataStore.getItemsData()) {
    const r = inventoryMap.get(item.name) ?? 0; // Use base name for inventory lookup
    const req = TARGET + (requiredFromParts.get(item.name) ?? 0);
    const tot = totalFromParts.get(item.name) ?? 0;
    // to be complete we need raw to be at least 999.
    completionMap.set(item.name, r + tot >= req && r >= TARGET);
  }

  // Helper to check if an item has wrong quality stacks
  const hasWrongQualityStacks = (itemName: string): boolean => {
    if (quality !== 'highest') return false;
    const stacks = stacksMap.get(itemName);
    if (!stacks) return false;
    
    // Only apply quality checks to items that actually have quality tiers
    const isCooking = getCookingItems().has(itemName);
    const isCrabpot = getCrabpotItems().has(itemName);
    
    // Check if this item type can have quality at all
    // Most items don't have quality tiers (like Hay, Stone, Wood, etc.)
    const totalItems = [0, 1, 2, 4].reduce((sum, tier) => sum + (stacks[tier] ?? 0), 0);
    const nonZeroTiers = [0, 1, 2, 4].filter(tier => (stacks[tier] ?? 0) > 0).length;
    
    // If item only has one tier with items, it doesn't have quality variations
    // (e.g., Hay is all in tier 0, no quality concept)
    if (nonZeroTiers <= 1 && !isCooking && !isCrabpot) return false;
    
    const correctTier = isCooking ? 2 : isCrabpot ? 1 : 4; // gold for cooking, silver for crabpot, iridium for others
    const correctQualityCount = stacks[correctTier] ?? 0;
    
    // Get requirements
    const req = TARGET + (requiredFromParts.get(itemName) ?? 0);
    const tot = totalFromParts.get(itemName) ?? 0;
    
    // Only show blue (wrong quality) if:
    // 1. At least one quality tier has 999+ items (a complete stack exists)
    // 2. BUT the correct quality tier doesn't have 999
    // Example: 1000 iridium eggs but need silver -> blue
    // Counter-example: 953 normal + 302 silver + 130 gold (no complete stack) -> white, not blue
    const hasCompleteStack = stacks.some(count => count >= TARGET);
    return hasCompleteStack && correctQualityCount < TARGET;
  };

  // Helper to check if an item has unfinished dependents
  const hasUnfinishedDependents = (itemName: string): boolean => {
    const dependents = reverseMap.get(itemName) ?? [];
    if (dependents.length === 0) return false;
    
    // Check if this item is complete
    const r = inventoryMap.get(itemName) ?? 0;
    const req = TARGET + (requiredFromParts.get(itemName) ?? 0);
    const tot = totalFromParts.get(itemName) ?? 0;
    const isComplete = r + tot >= req && r >= TARGET;
    
    if (!isComplete) return false;
    
    // Check if any dependent is not complete
    return dependents.some(depName => {
      const depComplete = completionMap.get(depName) ?? false;
      return !depComplete;
    });
  };

  // Helper to get count in the correct quality tier
  const getCorrectQualityCount = (itemName: string): number | undefined => {
    if (quality !== 'highest') return undefined;
    const stacks = stacksMap.get(itemName);
    if (!stacks) return undefined;
    
    const isCooking = getCookingItems().has(itemName);
    const isCrabpot = getCrabpotItems().has(itemName);
    if (!isCooking && !isCrabpot) return undefined;
    const correctTier = isCooking ? 2 : isCrabpot ? 1 : 4;
    
    return stacks[correctTier] ?? 0;
  };

  const source = CustomDataStore.getItemsData();
  const seen = new Set<string>();
  // ignore Qi fruit, even though we can have a count of it, it is too short.
  seen.add("Qi Fruit");
  allComputedRows = [];

  for (const item of source) {
    let itemKey = item.displayName || item.name;
    let lookupKey = itemKey;
    let isExtraVariant = false;
    
    // For items with displayName that are NOT variants (like "Bouquet: Wilted"), use base name for lookup
    if (item.displayName !== null && !VariantResolver.hasColorVariants(item.name) && item.name !== 'Strange Doll') {
      lookupKey = item.name;
    }
    
    // For base items with variants, check if base name exists in inventory
    if (item.displayName === null && (VariantResolver.hasColorVariants(item.name) || item.name === 'Strange Doll')) {
      if (inventoryMap.has(item.name)) {
        // Base item has inventory - show as (Cart) variant
        itemKey = `${item.name} (Cart)`;
        lookupKey = item.name;
      } else {
        // No inventory for base item - skip it
        continue;
      }
    }
    
    // Track by display name to allow multiple variants of same base item
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    
    let raw = inventoryMap.get(lookupKey) ?? 0;
    let required = TARGET + (requiredFromParts.get(item.name) ?? 0);
    let total = totalFromParts.get(item.name) ?? 0;
    
    // For color variant items and Cart variants, required is always 999 (no recipe requirements)
    if ((item.displayName !== null && VariantResolver.hasColorVariants(item.name)) || itemKey.endsWith(' (Cart)')) {
      required = TARGET;
      total = 0; // Cart and color variants don't show crafted totals
    }
    allComputedRows.push({ 
      name: itemKey, 
      required, 
      total, 
      raw, 
      rawStacks: stacksMap.get(lookupKey), // Use lookupKey to get actual stacks
      buyPrice: priceMap.get(item.name), 
      tooltip: computeTooltipData(item.name, raw , inventoryMap, completionMap, globalCraftableCache),
      hasWrongQuality: hasWrongQualityStacks(itemKey), // Use itemKey for variants
      hasUnfinishedDependents: hasUnfinishedDependents(item.name),
      correctQualityCount: getCorrectQualityCount(itemKey) // Use itemKey for variants
    });
  }
  
  // Add "Extra" variants for flowers used in recipes
  // These show excess items (total raw across all variants - 999 per variant) available for crafting
  const flowerBaseNames = new Set(
    source
      .filter(item => item.displayName === null && VariantResolver.hasColorVariants(item.name))
      .map(item => item.name)
  );
  
  for (const baseName of flowerBaseNames) {
    const recipeReq = requiredFromParts.get(baseName) ?? 0;
    if (recipeReq === 0) continue; // Skip if not used in recipes
    
    // Calculate total raw across all variants of this flower
    const variantRows = allComputedRows.filter(r => VariantResolver.getBaseName(r.name) === baseName);
    const totalRawAllVariants = variantRows.reduce((sum, r) => sum + r.raw, 0);
    const numVariants = variantRows.length;
    const excessRaw = Math.max(0, totalRawAllVariants - (TARGET * numVariants));
    
    if (excessRaw > 0 || recipeReq > 0) {
      allComputedRows.push({
        name: `${baseName} Extra`,
        required: recipeReq, // Only recipe requirements, no 999
        total: Math.min(totalFromParts.get(baseName) ?? 0, recipeReq), // Cap at recipe requirement
        raw: excessRaw, // Only the excess
        rawStacks: undefined,
        buyPrice: priceMap.get(baseName),
        tooltip: computeTooltipData(baseName, excessRaw, inventoryMap, completionMap, globalCraftableCache),
        hasWrongQuality: false,
        hasUnfinishedDependents: false,
        correctQualityCount: undefined
      });
    }
  }

  allComputedRows.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[CACHE] Computed ${allComputedRows.length} items`);
}

// Cooked outputs cap at gold quality naturally (Qi Seasoning provides iridium).
// Cooking-category ingredients like Oil, Vinegar, and Wheat Flour are not cooked dishes.
function getCookingItems(): Set<string> {
  const craftedNames = new Set(CustomDataStore.getPartsData().map(([craftedName]) => craftedName));
  return new Set<string>(
    CustomDataStore.getItemsData()
      .filter((item) => item.category === 'Cooking' && craftedNames.has(item.name))
      .map((item) => item.name)
  );
}

function getCrabpotItems(): Set<string> {
  return new Set<string>(
      ["Crab", "Crayfish", "Lobster", "Periwinkle", "Shrimp", "Snail"]
  )
}

(function buildMaps() {
  for (const [craftedName, ingredients] of CustomDataStore.getPartsData()) {
    const recipe = new Map<string, number>();
    for (const [id, entry] of Object.entries(ingredients)) {
      const [name, qty] = entry as [string | null, number];
      if (isWildcard(id, name)) continue;
      recipe.set(name!, qty);
      const rev = reverseMap.get(name!) ?? [];
      rev.push(craftedName);
      reverseMap.set(name!, rev);
    }
    if (recipe.size > 0) recipeMap.set(craftedName, recipe);
  }
})();

function craftableCount(
  craftedName: string,
  inventoryMap: Map<string, number>
): { count: number; limiting: string | null } {
  const recipe = recipeMap.get(craftedName);
  if (!recipe) return { count: 0, limiting: null };
  let min = Infinity;
  let limiting: string | null = null;
  for (const [ingredient, qty] of recipe) {
    const have = inventoryMap.get(ingredient) ?? 0;
    const can = Math.floor(have / qty);
    if (can < min) { min = can; limiting = ingredient; }
  }
  return { count: min === Infinity ? 0 : min, limiting };
}

function computeTooltipData(
  itemName: string,
  count: number,
  inventoryMap: Map<string, number>,
  completionMap: Map<string, boolean>,
  craftableCache: Map<string, { count: number; limiting: string | null }>
): ItemTooltipData {
  const note = (notesData as Record<string, string[]>)[itemName] ?? null;

  const ownRecipe = recipeMap.get(itemName);
  let recipe: IngredientInfo[] | null = null;
  let canCraft = 0;
  let limitingIngredient: string | null = null;

  if (ownRecipe) {
    let cached = craftableCache.get(itemName);
    if (!cached) {
      cached = craftableCount(itemName, inventoryMap);
      craftableCache.set(itemName, cached);
    }
    const { count, limiting } = cached;
    // Multiply by yield to show total output (e.g., 408 fish → 3060 bait at 7.5 avg yield)
    const avgYield = yieldMap.get(itemName) ?? 1;
    canCraft = Math.floor(count * avgYield);
    limitingIngredient = limiting;
    recipe = Array.from(ownRecipe.entries()).map(([name, qty]) => ({
      name,
      qty,
      available: inventoryMap.get(name) ?? 0,
      done: completionMap.get(name) ?? false,
    }));
  }

  if (Config.getQuality() === 'highest' && getCookingItems().has(itemName)) {
    if (recipe === null) recipe = [];
    recipe.push({
      name: 'Qi Seasoning',
      qty: 1,
      available: inventoryMap.get('Qi Seasoning') ?? 0,
      done: completionMap.get('Qi Seasoning') ?? false,
    });
  }

  const cookingItems = Config.getQuality() === 'highest' ? getCookingItems() : null;
  const usedBy: UsedByInfo[] = (reverseMap.get(itemName) ?? []).map(craftedName => {
    let cachedCrafted = craftableCache.get(craftedName);
    if (!cachedCrafted) {
      cachedCrafted = craftableCount(craftedName, inventoryMap);
      craftableCache.set(craftedName, cachedCrafted);
    }
    const { count } = cachedCrafted;
    // Multiply by yield to show total output
    const avgYield = yieldMap.get(craftedName) ?? 1;
    const totalOutput = Math.floor(count * avgYield);
    const alreadyHave = inventoryMap.get(craftedName) ?? 0;
    const done = completionMap.get(craftedName) ?? false;
    const depRecipe = recipeMap.get(craftedName);
    const recipe: IngredientInfo[] = depRecipe
      ? Array.from(depRecipe.entries()).map(([name, qty]) => ({
          name,
          qty,
          available: inventoryMap.get(name) ?? 0,
          done: completionMap.get(name) ?? false,
        }))
      : [];
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
  return { count, note, recipe, craftableCount: canCraft, limitingIngredient, done, usedBy, shops };
}

export function hasTooltipContent(t: ItemTooltipData): boolean {
  return !!t.note || !!t.recipe || t.usedBy.length > 0 || t.shops.length > 0;
}

function getQualityFilteredCount(stacks: number[] | undefined, quality: Quality, maxTierIndex = 4): number {
  if (!stacks) return 0;
  switch (quality) {
    case 'normal':  return stacks[0] ?? 0;
    case 'silver':  return stacks[1] ?? 0;
    case 'gold':    return stacks[2] ?? 0;
    case 'iridium': return stacks[4] ?? 0;
    case 'highest': {
      // For "highest" quality, return total across all tiers so user can see how many they have
      // The completion check uses rawStacks to verify correct quality tier
      return stacks.reduce((s, v) => s + v, 0);
    }
    default: return stacks.reduce((s, v) => s + v, 0);
  }
}

// Lightweight computation for historical/one-off data that doesn't use global cache
// Used by History dialog to compute past game states without polluting the main cache
export function computeCategoryItemsUncached(
  categoryName: string,
  compacted: Array<{ name: string; stack: number; quality?: number[] }>
): ItemRow[] {
  const quality = Config.getQuality();
  
  // Build local inventory map (doesn't touch global cache)
  const inventoryMap = new Map<string, number>();
  const stacksMap = new Map<string, number[]>();
  
  for (const item of compacted) {
    let maxTier = (quality === 'highest' && getCookingItems().has(item.name)) ? 2 : 4;
    maxTier = (quality === 'highest' && getCrabpotItems().has(item.name)) ? 1 : maxTier;
    const count = item.quality
      ? getQualityFilteredCount(item.quality, quality, maxTier)
      : item.stack;
    inventoryMap.set(item.name, (inventoryMap.get(item.name) ?? 0) + count);
    if (item.quality) {
      const prev = stacksMap.get(item.name) ?? [0, 0, 0, 0, 0];
      stacksMap.set(item.name, item.quality.map((v, i) => (prev[i] ?? 0) + v));
    }
  }
  
  const requiredFromParts = new Map<string, number>();
  const totalFromParts = new Map<string, number>();

  {
    // Need 999 artifact troves in inventory + 999*length to open for all trove items
    const length = CustomDataStore.getTroveItems().length;
    const minTroveCount: number = Math.min(...CustomDataStore.getTroveItems().map(itemName => inventoryMap.get(itemName) ?? 0));
    requiredFromParts.set("Artifact Trove", TARGET * length);
    totalFromParts.set("Artifact Trove", minTroveCount * length);
  }

  for (const [craftedItemName, ingredients] of getPartsDataConsumersFirst()) {
    const craftedCount = inventoryMap.get(craftedItemName) ?? 0;
    const avgYield = yieldMap.get(craftedItemName) ?? 1;
    const required = requiredFromParts.get(craftedItemName) ?? 0;
    const targetAmount = TARGET + required;
    const totalCrafted = totalFromParts.get(craftedItemName) ?? 0;
    
    // How many of this crafted item do we have (inventory + what we've made/opened)
    const totalHave = Math.min(craftedCount + totalCrafted, targetAmount);
    
    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName, qty] = ingredientEntry as [string | null, number];
      if (isWildcard(ingredientId, ingredientName)) continue;
      const name = ingredientName!;
      
      // Calculate total ingredients required (for the full targetAmount)
      const requiredCount = Math.round((qty * targetAmount) / avgYield);
      // Calculate ingredients already used (for what we have)
      const totalCount = Math.round((qty * totalHave) / avgYield);
      requiredFromParts.set(name, (requiredFromParts.get(name) ?? 0) + requiredCount);
      totalFromParts.set(name, (totalFromParts.get(name) ?? 0) + totalCount);
    }
  }

  if (quality === 'highest') {
    const seen = new Set<string>();
    for (const item of CustomDataStore.getItemsData()) {
      if (!getCookingItems().has(item.name) || seen.has(item.name)) continue;
      seen.add(item.name);
      requiredFromParts.set('Qi Seasoning', (requiredFromParts.get('Qi Seasoning') ?? 0) + TARGET);
      // Cap at TARGET per cooking item
      totalFromParts.set('Qi Seasoning', (totalFromParts.get('Qi Seasoning') ?? 0) + Math.min(inventoryMap.get(item.name) ?? 0, TARGET));
    }
  }

  const source = CustomDataStore.getItemsData();
  const entries = categoryName === 'All' ? source : source.filter((item) => item.category === categoryName);
  const seen = new Set<string>();
  seen.add("Qi Fruit");
  const rows: ItemRow[] = [];

  for (const item of entries) {
    let itemKey = item.displayName || item.name;
    let lookupKey = itemKey;
    
    // For base items with variants, check if base name exists in inventory
    if (item.displayName === null && (VariantResolver.hasColorVariants(item.name) || item.name === 'Strange Doll')) {
      if (inventoryMap.has(item.name)) {
        // Base item has inventory - show as (Cart) variant
        itemKey = `${item.name} (Cart)`;
        lookupKey = item.name;
      } else {
        // No inventory for base item - skip it
        continue;
      }
    }
    
    // Track by display name to allow multiple variants of same base item
    if (seen.has(itemKey)) continue;
    seen.add(itemKey);
    
    const raw = inventoryMap.get(lookupKey) ?? 0;
    const required = TARGET + (requiredFromParts.get(item.name) ?? 0);
    const total = totalFromParts.get(item.name) ?? 0;
    rows.push({ 
      name: itemKey, 
      required, 
      total, 
      raw, 
      rawStacks: stacksMap.get(lookupKey), // Use lookupKey to get actual stacks
      buyPrice: priceMap.get(item.name),
      tooltip: undefined as any // History doesn't need tooltips
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
  
  // Compute ALL items once when data or quality changes
  if (compacted !== lastCompactedRef || quality !== lastQuality) {
    // Set these FIRST so subsequent calls don't re-trigger
    lastCompactedRef = compacted;
    lastQuality = quality;
    
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
    // For variants like "Blue Jazz (Cart)" or "Blue Jazz (35,127,255)", extract base name
    const baseName = VariantResolver.getBaseName(row.name);
    return categoryItemIdentifiers.has(baseName) || categoryItemIdentifiers.has(row.name);
  });
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

  for (const invName of inventoryNames) {
    if (!knownItemNames.has(invName)) {
      console.info(`[inventory] "${invName}" is in the save file but not listed in items.json`);
    }
  }
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
  recipeMap,
  reverseMap,
  yieldMap,
  priceMap,
  shopEntriesMap
};
