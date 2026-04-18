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

type Listener = () => void;

class CustomDataManager {
  private static instance: CustomDataManager;
  private data: CustomData;
  private listeners: Set<Listener> = new Set();
  private partsData: PartsEntry[];
  private troveItems: string[];

  private constructor() {
    const cached = this.loadFromStorage();
    // Validate cached data - if missing critical items, rebuild from defaults
    const isValid = cached ? this.validateData(cached) : false;
    if (cached && isValid) {
      this.data = cached;
    } else {
      this.data = this.buildDefaults();
      this.saveToStorage();
    }
    this.partsData = rawPartsData as PartsEntry[];
    this.troveItems = rawTroveItems as string[];
  }
  
  private validateData(data: CustomData): boolean {
    // Check for critical items that should always exist
    const criticalItems = ['Wilted Bouquet', 'Void Ghost Pendant'];
    const itemNames = new Set(data.items.map(item => item.name));
    return criticalItems.every(name => itemNames.has(name));
  }
  
  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
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

  private loadFromStorage(): CustomData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CustomData>;
      if (Array.isArray(parsed.categoryNames) && Array.isArray(parsed.items)) {
        return parsed as CustomData;
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
      const displayName = invItem.name; // Already resolved by VariantResolver (e.g., "Blue Jazz (35,127,255)")
      
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
    this.data = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save custom data:', e);
    }
    this.notify();
  }

  resetToDefaults(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.data = this.buildDefaults();
    this.notify();
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
