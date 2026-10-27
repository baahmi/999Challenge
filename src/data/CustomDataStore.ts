import rawItemsData from './items.json';
import defaultCategoriesData from './categories.json';
import rawTroveItems from './trove.json';
import rawPartsData from './parts.json';
import variantDefinitions from './itemVariants.json' assert { type: 'json' };
import flowerColorNames from './flowerColorNames.json';
import { VariantResolver } from './VariantResolver';

const STORAGE_KEY = 'stardew-custom-data';

// [category, name, displayName]
export type RawItemEntry = [category: string, name: string, displayName: string];
export type ItemEntry = {
  category: string,
  name: string,
  displayName: string | null
};

export type IngredientMap = Record<string, [string | null, number]>;
export type YieldSpec = number | [number, number];
export type PartsEntry = [string, IngredientMap, YieldSpec?];

export interface CustomData {
  categoryNames: string[];
  items: ItemEntry[];
}

// v2 persists deltas only: the (possibly customized) category list and per-item
// category overrides keyed by item identity. Item names/displayNames always come
// from the bundled data, so app updates never fight stale stored copies.
// Legacy entries (no v) are treated as tab order only, as before.
interface StoredCustomData {
  v?: 2;
  categoryNames?: string[];
  itemCategoryOverrides?: Record<string, string>;
}

function itemKey(item: { name: string; displayName: string | null }): string {
  return `${item.name}|${item.displayName ?? ''}`;
}

function sanitizeCategoryNames(names: unknown): string[] {
  if (!Array.isArray(names)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    if (typeof name !== 'string') continue;
    const trimmed = name.trim();
    if (!trimmed || trimmed === 'asdf' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

interface VariantData {
  itemIdNames: Record<string, string>;
}

type Listener = () => void;

class CustomDataManager {
  private static instance: CustomDataManager;
  private data: CustomData;
  private listeners: Set<Listener> = new Set();
  private partsData: PartsEntry[];
  private troveItems: string[];
  private itemCategoryOverrides: Record<string, string> = {};

  private constructor() {
    const defaults = this.buildDefaults();
    const cached = this.loadFromStorage();
    if (cached?.v === 2) {
      const storedNames = sanitizeCategoryNames(cached.categoryNames);
      this.itemCategoryOverrides = this.sanitizeOverrides(cached.itemCategoryOverrides);
      this.data = {
        categoryNames: storedNames.length > 0 ? storedNames : defaults.categoryNames,
        items: this.applyOverrides(defaults.items),
      };
    } else {
      this.data = {
        categoryNames: this.applyStoredCategoryOrder(defaults.categoryNames, cached?.categoryNames),
        items: defaults.items,
      };
    }
    this.partsData = rawPartsData as PartsEntry[];
    this.troveItems = rawTroveItems as string[];
  }

  private sanitizeOverrides(overrides: unknown): Record<string, string> {
    if (typeof overrides !== 'object' || overrides === null) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'string' && value.trim()) result[key] = value.trim();
    }
    return result;
  }

  private applyOverrides(items: ItemEntry[]): ItemEntry[] {
    if (Object.keys(this.itemCategoryOverrides).length === 0) return items;
    return items.map(item => {
      const override = this.itemCategoryOverrides[itemKey(item)];
      return override && override !== item.category ? { ...item, category: override } : item;
    });
  }

  private saveToStorage(): void {
    const stored: StoredCustomData = {
      v: 2,
      categoryNames: this.data.categoryNames,
      itemCategoryOverrides: this.itemCategoryOverrides,
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
    } catch (e) {
      console.warn('Failed to save custom data:', e);
    }
  }

  static getInstance(): CustomDataManager {
    if (!CustomDataManager.instance) {
      CustomDataManager.instance = new CustomDataManager();
    }
    return CustomDataManager.instance;
  }

  private loadFromStorage(): StoredCustomData | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredCustomData;
      if (parsed.v === 2) {
        return parsed;
      }
      if (Array.isArray(parsed.categoryNames)) {
        return { categoryNames: parsed.categoryNames };
      }
    } catch {}
    return null;
  }

  private buildDefaults(): CustomData {
    // convert to real type
    const defaultItemsData: ItemEntry[] = (rawItemsData as RawItemEntry[]).map(([category, name, displayName]) => ({
      category,
      name,
      displayName
    }));

    const variantData = variantDefinitions as VariantData;
    const knownKeys = new Set(defaultItemsData.map(item => `${item.name}|${item.displayName ?? ''}`));
    const baseItemsByName = new Map<string, ItemEntry>();

    for (const item of defaultItemsData) {
      if (item.displayName === null && !baseItemsByName.has(item.name)) {
        baseItemsByName.set(item.name, item);
      }
    }

    const seededVariants: ItemEntry[] = [];
    const variantDisplayNames = [
      ...Object.values(variantData.itemIdNames),
      ...Object.values(flowerColorNames).flatMap(colors => Object.values(colors)),
    ];
    for (const displayName of variantDisplayNames) {
      const baseName = VariantResolver.getBaseName(displayName);
      if (displayName === baseName) continue;

      const baseItem = baseItemsByName.get(baseName);
      if (!baseItem) continue;

      const key = `${baseName}|${displayName}`;
      if (knownKeys.has(key)) continue;

      seededVariants.push({
        category: baseItem.category,
        name: baseName,
        displayName,
      });
      knownKeys.add(key);
    }
    
    return {
      categoryNames: (defaultCategoriesData as { names: string[] }).names,
      items: [...defaultItemsData, ...seededVariants] as ItemEntry[],
    };
  }

  private applyStoredCategoryOrder(defaultCategoryNames: string[], storedCategoryNames?: string[]): string[] {
    if (!storedCategoryNames?.length) {
      return defaultCategoryNames;
    }

    const defaultSet = new Set(defaultCategoryNames);
    const orderedKnownCategories = storedCategoryNames.filter((name, index) =>
      defaultSet.has(name) && storedCategoryNames.indexOf(name) === index
    );
    const missingDefaultCategories = defaultCategoryNames.filter(name => !orderedKnownCategories.includes(name));

    return [...orderedKnownCategories, ...missingDefaultCategories];
  }
  
  /**
   * Add variant items discovered from save file to the items list
   * Called after save file is parsed
   */
  addVariantsFromInventory(inventoryItems: Array<{name: string; category: number}> | Record<string, any>): void {
    // Track which variant display names we've already added
    const existingDisplayNames = new Set(
      this.data.items
        .filter(item => item.displayName !== null)
        .map(item => item.displayName)
    );
    const newVariants: ItemEntry[] = [];
    
    // Convert Record to array if needed
    const itemsArray = Array.isArray(inventoryItems) 
      ? inventoryItems 
      : Object.entries(inventoryItems).map(([name, data]) => ({ 
          name, 
          category: (data as any).cat ?? 0 
        }));
    
    for (const invItem of itemsArray) {
      const displayName = VariantResolver.normalizeDisplayName(invItem.name);
      
      // Get base name (e.g., "Blue Jazz")
      const baseName = VariantResolver.getBaseName(displayName);
      
      // Only process if this is actually a variant (displayName != baseName)
      if (displayName === baseName) continue;
      
      // Skip if we've already added this variant
      if (existingDisplayNames.has(displayName)) continue;
      
      // Find the base item in our items list
      const baseItem = this.data.items.find(item => item.name === baseName);
      
      if (baseItem) {
        // This is a variant - add it (honoring a stored category override)
        const variant = {
          category: baseItem.category,
          name: baseName,
          displayName: displayName
        };
        const override = this.itemCategoryOverrides[itemKey(variant)];
        if (override) variant.category = override;
        newVariants.push(variant);
        existingDisplayNames.add(displayName);
      }
    }
    
    if (newVariants.length > 0) {
      this.data.items = [...this.data.items, ...newVariants];
      this.notify();
    }
  }

  getDefaults(): CustomData {
    return this.buildDefaults();
  }

  isCustomized(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  getTroveItems(): string[] {
    return this.troveItems;
  }

  getPartsData(): PartsEntry[] {
    return this.partsData;
  }

  getCategoryNames(): string[] {
    return this.data.categoryNames;
  }

  getItemsData(): ItemEntry[] {
    return this.data.items;
  }

  setData(data: CustomData): void {
    const defaults = this.buildDefaults();

    // Persist only the category deltas: item identity stays bundled data's business
    const defaultCategoryByKey = new Map(defaults.items.map(item => [itemKey(item), item.category]));
    const defaultBaseCategory = new Map(
      defaults.items.filter(item => item.displayName === null).map(item => [item.name, item.category])
    );
    const overrides: Record<string, string> = {};
    for (const item of data.items) {
      const key = itemKey(item);
      const defaultCategory = defaultCategoryByKey.get(key) ?? defaultBaseCategory.get(item.name);
      if (defaultCategory !== undefined && item.category !== defaultCategory) {
        overrides[key] = item.category;
      }
    }
    this.itemCategoryOverrides = overrides;

    const categoryNames = sanitizeCategoryNames(data.categoryNames);
    // Runtime variants keep canonical identity; reset them to their base default
    // category so removed overrides actually revert, then apply the overrides.
    const rebuiltItems = this.withExistingVariants(defaults.items).map(item => {
      if (defaultCategoryByKey.has(itemKey(item))) return item;
      const baseCategory = defaultBaseCategory.get(item.name);
      return baseCategory !== undefined && baseCategory !== item.category
        ? { ...item, category: baseCategory }
        : item;
    });
    this.data = {
      categoryNames: categoryNames.length > 0 ? categoryNames : defaults.categoryNames,
      items: this.applyOverrides(rebuiltItems),
    };
    this.saveToStorage();
    this.notify();
  }

  resetToDefaults(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
    this.itemCategoryOverrides = {};
    this.data = this.buildDefaults();
    this.notify();
  }

  private withExistingVariants(defaultItems: ItemEntry[]): ItemEntry[] {
    const defaultKeys = new Set(defaultItems.map(item => `${item.name}|${item.displayName ?? ''}`));
    const variants = this.data.items.filter(item => {
      if (item.displayName === null) return false;
      return !defaultKeys.has(`${item.name}|${item.displayName}`);
    });
    return [...defaultItems, ...variants];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }
}

export const CustomDataStore = CustomDataManager.getInstance();
export { VariantResolver };
