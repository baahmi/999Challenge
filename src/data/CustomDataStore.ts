import rawItemsData from './items.json';
import defaultCategoriesData from './categories.json';
import rawTroveItems from './trove.json';
import rawPartsData from './parts.json';
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

interface StoredCustomData {
  categoryNames?: string[];
}

type Listener = () => void;

class CustomDataManager {
  private static instance: CustomDataManager;
  private data: CustomData;
  private listeners: Set<Listener> = new Set();
  private partsData: PartsEntry[];
  private troveItems: string[];

  private constructor() {
    const defaults = this.buildDefaults();
    const cached = this.loadFromStorage();
    this.data = {
      categoryNames: cached?.categoryNames ?? defaults.categoryNames,
      items: defaults.items,
    };
    this.partsData = rawPartsData as PartsEntry[];
    this.troveItems = rawTroveItems as string[];
  }

  private saveToStorage(): void {
    const stored: StoredCustomData = {
      categoryNames: this.data.categoryNames,
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
    
    return {
      categoryNames: (defaultCategoriesData as { names: string[] }).names,
      items: defaultItemsData as ItemEntry[],
    };
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
        // This is a variant - add it
        newVariants.push({
          category: baseItem.category,
          name: baseName,
          displayName: displayName
        });
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
    this.data = {
      categoryNames: data.categoryNames,
      items: this.withExistingVariants(defaults.items),
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
