import rawItemsData from './items.json';
import defaultCategoriesData from './categories.json';
import rawTroveItems from './trove.json';
import rawPartsData from './parts.json';

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
    this.data = this.loadFromStorage() ?? this.buildDefaults();
    this.partsData = rawPartsData as PartsEntry[];
    this.troveItems = rawTroveItems as string[];
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
