import categoriesData from '../data/categories.json' assert { type: 'json' };
import { CustomDataStore } from '../data/CustomDataStore';

export type Theme = 'light' | 'dark';
export type TabsPosition = 'top' | 'bottom' | 'both';
export type Quality = 'highest' | 'any' | 'normal' | 'silver' | 'gold'| 'iridium' | 'all';

export interface UIConfig {
  tabsPosition: TabsPosition;
  selectedTab: string;
  theme: Theme;
}

export interface CategoriesConfig {
  names: string[];
  ignored: number[];
}

export interface AppConfig {
  ui: UIConfig;
  quality: Quality;
}

export class Config {
  private static readonly STORAGE_KEY = 'app-config';
  private static readonly DEFAULT_CONFIG: AppConfig = {
    ui: {
      theme: 'light',
      tabsPosition: 'both',
      selectedTab: 'Resources'
    },
    quality: 'highest'
  };

  private static instance: Config;
  private config: AppConfig;
  private categories: CategoriesConfig | null = null;
  private listeners: Set<(config: AppConfig) => void> = new Set();

  private constructor() {
    this.config = this.loadConfig();
    this.categories = this.loadCategoriesSync();
  }

  private loadCategoriesSync(): CategoriesConfig | null {
    try {
      return categoriesData as CategoriesConfig;
    } catch (error) {
      console.warn('Failed to load categories:', error);
      return null;
    }
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public static getTheme(): Theme {
    return this.getInstance().getConfig().ui.theme;
  }

  public static getTabsPosition(): TabsPosition {
    return this.getInstance().getConfig().ui.tabsPosition;
  }

  public static getSelectedTab(): string {
    return this.getInstance().getConfig().ui.selectedTab;
  }

  public static setSelectedTab(tab: string): void {
    this.getInstance().setSelectedTab(tab);
  }

  public static getQuality(): Quality {
    return this.getInstance().getConfig().quality;
  }

  public static getCategoryNames(): string[] {
    return CustomDataStore.getCategoryNames();
  }

  public static getIgnoredCategories(): number[] {
    const categories = this.getInstance().categories;
    return categories?.ignored ?? [];
  }

  private loadConfig(): AppConfig {
    try {
      // Check if we're in a browser-like environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(Config.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<AppConfig>;
          return { ...Config.DEFAULT_CONFIG, ...parsed };
        }
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
    }
    // Always return a fresh copy of DEFAULT_CONFIG
    return { ...Config.DEFAULT_CONFIG };
  }

  private saveConfig(): void {
    try {
      // Check if we're in a browser-like environment
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(this.config));
      }
      this.notifyListeners();
    } catch (error) {
      console.warn('Failed to save config to localStorage:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config));
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public setTheme(theme: Theme): void {
    if (this.config.ui.theme !== theme) {
      this.config.ui.theme = theme;
      this.saveConfig();
    }
  }

  public setTabsPosition(position: TabsPosition): void {
    if (this.config.ui.tabsPosition !== position) {
      this.config.ui.tabsPosition = position;
      this.saveConfig();
    }
  }

  public setSelectedTab(tab: string): void {
    if (this.config.ui.selectedTab !== tab) {
      this.config.ui.selectedTab = tab;
      this.saveConfig();
    }
  }

  public setQuality(quality: Quality): void {
    if (this.config.quality !== quality) {
      this.config.quality = quality;
      this.saveConfig();
    }
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  public subscribe(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener);
    listener(this.config);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetToDefaults(): void {
    this.config = { ...Config.DEFAULT_CONFIG };
    this.saveConfig();
  }
}
