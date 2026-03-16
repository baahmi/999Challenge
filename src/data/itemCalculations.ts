import itemsData from './items.json';
import partsData from './parts.json';
import notesData from './notes.json';

const TARGET = 999;

type IngredientMap = Record<string, [string | null, number]>;
type PartsEntry = [string, IngredientMap];

export interface IngredientInfo {
  name: string;
  qty: number;
  available: number;
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
  inventoryMap: Map<string, number>
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
        }))
      : [];
    return { craftedName, craftableCount: count, recipe };
  });

  return { note, recipe, craftableCount: canCraft, limitingIngredient, usedBy };
}

export function computeCategoryItems(
  categoryName: string,
  compacted: Array<{ name: string; stack: number }>
): ItemRow[] {
  const inventoryMap = new Map<string, number>();
  for (const item of compacted) {
    inventoryMap.set(item.name, (inventoryMap.get(item.name) ?? 0) + item.stack);
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

    rows.push({ name: itemName, required, total, raw, tooltip: computeTooltipData(itemName, inventoryMap) });
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
