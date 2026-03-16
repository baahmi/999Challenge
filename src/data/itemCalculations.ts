import itemsData from './items.json';
import partsData from './parts.json';
import notesData from './notes.json';
import { Config } from '../config/Config';
import type { Quality } from '../config/Config';

const TARGET = 999;

type IngredientMap = Record<string, [string | null, number]>;
type PartsEntry = [string, IngredientMap];

export interface IngredientInfo {
  name: string;
  qty: number;
  available: number;
  done: boolean;
}

export interface UsedByInfo {
  craftedName: string;
  craftableCount: number;
  recipe: IngredientInfo[];
}

export interface ItemTooltipData {
  note: string | null;
  recipe: IngredientInfo[] | null;
  craftableCount: number;
  limitingIngredient: string | null;
  usedBy: UsedByInfo[];
}

export interface ItemRow {
  name: string;
  required: number;
  total: number;
  raw: number;
  rawStacks?: number[]; // [normal, silver, gold, unused, iridium]
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
const cookingItems = new Set<string>(
  (itemsData as [string, string][]).filter(([cat]) => cat === 'Cooking').map(([, name]) => name)
);

(function buildMaps() {
  for (const [craftedName, ingredients] of partsData as PartsEntry[]) {
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
  inventoryMap: Map<string, number>,
  completionMap: Map<string, boolean>
): ItemTooltipData {
  const note = (notesData as Record<string, string>)[itemName] ?? null;

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

  const usedBy: UsedByInfo[] = (reverseMap.get(itemName) ?? []).map(craftedName => {
    const { count } = craftableCount(craftedName, inventoryMap);
    const depRecipe = recipeMap.get(craftedName);
    const recipe: IngredientInfo[] = depRecipe
      ? Array.from(depRecipe.entries()).map(([name, qty]) => ({
          name,
          qty,
          available: inventoryMap.get(name) ?? 0,
          done: completionMap.get(name) ?? false,
        }))
      : [];
    return { craftedName, craftableCount: count, recipe };
  });

  return { note, recipe, craftableCount: canCraft, limitingIngredient, usedBy };
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
  const quality = Config.getQuality();
  const inventoryMap = new Map<string, number>();
  const stacksMap = new Map<string, number[]>();
  for (const item of compacted) {
    // Cooking items naturally cap at gold; only iridium via Qi Seasoning
    const maxTier = (quality === 'highest' && cookingItems.has(item.name)) ? 2 : 4;
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

  for (const [craftedItemName, ingredients] of partsData as PartsEntry[]) {
    const craftedCount = inventoryMap.get(craftedItemName) ?? 0;
    for (const [ingredientId, ingredientEntry] of Object.entries(ingredients)) {
      const [ingredientName, qty] = ingredientEntry as [string | null, number];
      if (isWildcard(ingredientId, ingredientName)) continue;
      const name = ingredientName!;
      requiredFromParts.set(name, (requiredFromParts.get(name) ?? 0) + qty * TARGET);
      totalFromParts.set(name, (totalFromParts.get(name) ?? 0) + craftedCount * qty);
    }
  }

  // Qi Seasoning: one per cooked dish when targeting iridium quality
  if (quality === 'highest' || quality === 'iridium') {
    const seen = new Set<string>();
    for (const [cat, itemName] of itemsData as [string, string][]) {
      if (cat !== 'Cooking' || seen.has(itemName)) continue;
      seen.add(itemName);
      requiredFromParts.set('Qi Seasoning', (requiredFromParts.get('Qi Seasoning') ?? 0) + TARGET);
      totalFromParts.set('Qi Seasoning', (totalFromParts.get('Qi Seasoning') ?? 0) + (inventoryMap.get(itemName) ?? 0));
    }
  }

  const completionMap = new Map<string, boolean>();
  for (const [, itemName] of itemsData as [string, string][]) {
    const r = inventoryMap.get(itemName) ?? 0;
    const req = TARGET + (requiredFromParts.get(itemName) ?? 0);
    const tot = totalFromParts.get(itemName) ?? 0;
    completionMap.set(itemName, r + tot >= req);
  }

  const source = itemsData as [string, string][];
  const entries = categoryName === 'All' ? source : source.filter(([cat]) => cat === categoryName);

  const seen = new Set<string>();
  const rows: ItemRow[] = [];

  for (const [, itemName] of entries) {
    if (seen.has(itemName)) continue;
    seen.add(itemName);

    const raw = inventoryMap.get(itemName) ?? 0;
    const required = TARGET + (requiredFromParts.get(itemName) ?? 0);
    const total = totalFromParts.get(itemName) ?? 0;

    rows.push({ name: itemName, required, total, raw, rawStacks: stacksMap.get(itemName), tooltip: computeTooltipData(itemName, inventoryMap, completionMap) });
  }

  return rows;
}

export function logDataIssues(
  compacted: Array<{ name: string; stack: number }>
): void {
  const itemsList = itemsData as [string, string][];
  const partsList = partsData as PartsEntry[];

  const knownItemNames = new Set(itemsList.map(([, name]) => name));
  const inventoryNames = new Set(compacted.map(i => i.name));

  for (const [cat, name] of itemsList) {
    if (cat === 'asdf') {
      console.warn(`[items.json] Item "${name}" has placeholder category "asdf" — assign a real category`);
    }
  }

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
