export type Theme = 'light' | 'dark';

export interface AppConfig {
  theme: Theme;
}

export class Config {
  private static readonly STORAGE_KEY = 'app-config';
  private static readonly DEFAULT_CONFIG: AppConfig = {
    // theme: 'dark'
    theme: 'light'
  };

  private static instance: Config;
  private config: AppConfig;
  private listeners: Set<(config: AppConfig) => void> = new Set();

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public static getTheme(): Theme {
    const theme = this.getInstance().getConfig().theme;
    console.log(theme);
    return theme;
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
    if (this.config.theme !== theme) {
      this.config.theme = theme;
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
