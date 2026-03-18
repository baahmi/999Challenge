import defaultItemsData from './items.json';
import defaultCategoriesData from './categories.json';

const STORAGE_KEY = 'stardew-custom-data';

export type ItemEntry = [string, string]; // [category, name]

export interface CustomData {
  categoryNames: string[];
  items: ItemEntry[];
}

type Listener = () => void;

class CustomDataManager {
  private static instance: CustomDataManager;
  private data: CustomData;
  private listeners: Set<Listener> = new Set();

  private constructor() {
    this.data = this.loadFromStorage() ?? this.buildDefaults();
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
