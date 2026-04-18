import { CustomDataStore } from './CustomDataStore';
import notesData from './notes.json';
import pricesData from './prices.json';
import { Config } from '../config/Config';
import type { Quality } from '../config/Config';
import type { YieldSpec } from "./CustomDataStore";

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
}

function isWildcard(id: string, name: string | null): boolean {
  if (name === null) return true;
  const numId = Number(id);
  return Number.isFinite(numId) && numId < 0;
}

// Static maps built once from partsData (never changes at runtime)
const recipeMap = new Map<string, Map<string, number>>(); // craftedName -> ingredient -> qty
const reverseMap = new Map<string, string[]>();           // ingredient -> [craftedNames]

// Cooking items cap at gold quality naturally (Qi Seasoning provides iridium)
function getCookingItems(): Set<string> {
  return new Set<string>(
    CustomDataStore.getItemsData().filter((item) => item.category === 'Cooking').map((item) => item.name)
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
  if(craftedName === 'Void Salmon Bait') {
    console.log(craftedName, inventoryMap);
    debugger;
  }
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
  completionMap: Map<string, boolean>
): ItemTooltipData {
  const note = (notesData as Record<string, string[]>)[itemName] ?? null;

  const ownRecipe = recipeMap.get(itemName);
  let recipe: IngredientInfo[] | null = null;
  let canCraft = 0;
  let limitingIngredient: string | null = null;

  if (ownRecipe) {
    const { count, limiting } = craftableCount(itemName, inventoryMap);
    canCraft = count;
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
    const { count } = craftableCount(craftedName, inventoryMap);
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
    return { craftedName, craftableCount: count, alreadyHave, done, recipe };
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
      for (const i of [4, 2, 1, 0]) {
        if (i > maxTierIndex) continue;
        const v = stacks[i] ?? 0;
        if (v > 0) return v;
      }
      return 0;
    }
    default: return stacks.reduce((s, v) => s + v, 0);
  }
}

export function computeCategoryItems(
  categoryName: string,
  compacted: Array<{ name: string; stack: number; quality?: number[] }>
): ItemRow[] {
  // console.log(categoryName, compacted);
  const quality = Config.getQuality();
  const inventoryMap = new Map<string, number>();
  const stacksMap = new Map<string, number[]>();
  for (const item of compacted) {
    let  maxTier = (quality === 'highest' && getCookingItems().has(item.name)) ? 2 : 4;
    maxTier = (quality === 'highest' && getCrabpotItems().has(item.name)) ? 1 : maxTier;
    // this is making a different count for higest quality
    const count = item.quality
      ? getQualityFilteredCount(item.quality, quality, maxTier)
      : item.stack;
    // const count = item.stack;
    inventoryMap.set(item.name, (inventoryMap.get(item.name) ?? 0) + count);
    if (item.quality) {
      const prev = stacksMap.get(item.name) ?? [0, 0, 0, 0, 0];
      stacksMap.set(item.name, item.quality.map((v, i) => (prev[i] ?? 0) + v));
    }
  }

  const requiredFromParts = new Map<string, number>();
  const totalFromParts = new Map<string, number>();

  {
    // add trove to the requireds
    const length = CustomDataStore.getTroveItems().length;
    const minTroveCount: number = Math.min(...CustomDataStore.getTroveItems().map(itemName => inventoryMap.get(itemName) ?? 0));
    requiredFromParts.set("Artifact Trove", TARGET*length);
    totalFromParts.set("Artifact Trove", minTroveCount*length);
  }

  for (const [craftedItemName, ingredients] of CustomDataStore.getPartsData()) {

    const craftedCount = inventoryMap.get(craftedItemName) ?? 0;
    const avgYield = yieldMap.get(craftedItemName) ?? 1;
    const required = requiredFromParts.get(craftedItemName);
    const craftsNeeded = Math.ceil((required ?? TARGET )/ avgYield);
    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName, qty] = ingredientEntry as [string | null, number];
      if (isWildcard(ingredientId, ingredientName)) continue;
      const name = ingredientName!;
      const requiredCount = Math.round((qty * (TARGET+(required ?? 0))) / avgYield);
      const totalCount = Math.round(craftedCount / avgYield);
      requiredFromParts.set(name, (requiredFromParts.get(name) ?? 0) + requiredCount);
      totalFromParts.set(name, (totalFromParts.get(name) ?? 0) + totalCount);
    }
  }

  // Qi Seasoning: one per cooked dish when targeting highest quality
  if (quality === 'highest') {
    const seen = new Set<string>();
    for (const item of CustomDataStore.getItemsData()) {
      if (item.category !== 'Cooking' || seen.has(item.name)) continue;
      seen.add(item.name);
      requiredFromParts.set('Qi Seasoning', (requiredFromParts.get('Qi Seasoning') ?? 0) + TARGET);
      totalFromParts.set('Qi Seasoning', (totalFromParts.get('Qi Seasoning') ?? 0) + (inventoryMap.get(item.name) ?? 0));
    }
  }

  const completionMap = new Map<string, boolean>();
  for (const item of CustomDataStore.getItemsData()) {
    const r = inventoryMap.get(item.name) ?? 0;
    const req = TARGET + (requiredFromParts.get(item.name) ?? 0);
    const tot = totalFromParts.get(item.name) ?? 0;
    // to be complete we need raw to be at least 999.
    completionMap.set(item.name, r + tot >= req && r >= TARGET);
  }

  const source = CustomDataStore.getItemsData();
  const entries = categoryName === 'All' ? source : source.filter((item) => item.category === categoryName);

  const seen = new Set<string>();
  // ignore Qi fruit, even though we can have a count of it, it is too short.
  seen.add("Qi Fruit");
  const rows: ItemRow[] = [];

  for (const item of entries) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    const raw = inventoryMap.get(item.name) ?? 0;
    const required = TARGET + (requiredFromParts.get(item.name) ?? 0);
    const total = totalFromParts.get(item.name) ?? 0;
    rows.push({ name: item.displayName || item.name, required, total, raw, rawStacks: stacksMap.get(item.name), buyPrice: priceMap.get(item.name), tooltip: computeTooltipData(item.name, raw , inventoryMap, completionMap) });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function logDataIssues(
  compacted: Array<{ name: string; stack: number }>
): void {
  const itemsList = CustomDataStore.getItemsData();
  const partsList = CustomDataStore.getPartsData();

  const knownItemNames = new Set(itemsList.map((item) => item.name));
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