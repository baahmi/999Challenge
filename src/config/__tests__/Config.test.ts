import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Config, type Theme, type AppConfig } from '../Config';

describe('Config', () => {
  let config: Config;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Clear localStorage first
    localStorageMock = {};
    global.localStorage = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
      get length() {
        return Object.keys(localStorageMock).length;
      },
      key: (index: number) => {
        return Object.keys(localStorageMock)[index] || null;
      },
    };

    // Mock window for browser environment simulation
    (global as any).window = {};

    // Clear singleton instance
    (Config as any).instance = null;
    config = Config.getInstance();
  });

  afterEach(() => {
    // Clean up
    localStorageMock = {};
    (Config as any).instance = null;
    // Clear localStorage
    if (global.localStorage) {
      global.localStorage.clear();
    }
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Config.getInstance();
      const instance2 = Config.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Default Configuration', () => {
    it('should have dark theme as default', () => {
      const currentConfig = config.getConfig();
      expect(currentConfig.theme).toBe('dark');
    });

    it('should return a copy of config, not reference', () => {
      const config1 = config.getConfig();
      const config2 = config.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Theme Management', () => {
    it('should set theme to light', () => {
      config.setTheme('light');
      expect(config.getConfig().theme).toBe('light');
    });

    it('should set theme to dark', () => {
      config.setTheme('dark');
      expect(config.getConfig().theme).toBe('dark');
    });

    it('should not trigger save if theme is the same', () => {
      config.setTheme('dark');
      const initialStorage = { ...localStorageMock };
      config.setTheme('dark');
      expect(localStorageMock).toEqual(initialStorage);
    });

    it('should save to localStorage when theme changes', () => {
      config.setTheme('light');
      expect(localStorageMock['app-config']).toContain('"theme":"light"');
    });
  });

  describe('localStorage Integration', () => {
    it('should load config from localStorage on initialization', () => {
      localStorageMock['app-config'] = JSON.stringify({ theme: 'light' });
      (Config as any).instance = null;
      const newConfig = Config.getInstance();
      expect(newConfig.getConfig().theme).toBe('light');
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorageMock['app-config'] = 'invalid-json';
      (Config as any).instance = null;
      const newConfig = Config.getInstance();
      expect(newConfig.getConfig().theme).toBe('dark'); // Should fall back to default
    });

    it('should merge partial config from localStorage with defaults', () => {
      localStorageMock['app-config'] = JSON.stringify({ theme: 'light' });
      (Config as any).instance = null;
      const newConfig = Config.getInstance();
      expect(newConfig.getConfig().theme).toBe('light');
    });

    it('should handle missing localStorage gracefully', () => {
      // Mock window as undefined (server-side)
      const originalWindow = (global as any).window;
      delete (global as any).window;
      
      (Config as any).instance = null;
      const newConfig = Config.getInstance();
      expect(newConfig.getConfig().theme).toBe('dark'); // Should fall back to default
      
      // Restore window
      (global as any).window = originalWindow;
    });
  });

  describe('Update Config', () => {
    it('should update config with partial updates', () => {
      config.updateConfig({ theme: 'light' });
      expect(config.getConfig().theme).toBe('light');
    });

    it('should save to localStorage when config is updated', () => {
      config.updateConfig({ theme: 'light' });
      expect(localStorageMock['app-config']).toBe(JSON.stringify({ theme: 'light' }));
    });
  });

  describe('Subscription System', () => {
    it('should notify listeners when config changes', (done) => {
      const listener = (newConfig: AppConfig) => {
        expect(newConfig.theme).toBe('light');
        done();
      };
      
      config.subscribe(listener);
      config.setTheme('light');
    });

    it('should unsubscribe listener correctly', () => {
      let callCount = 0;
      const listener = () => callCount++;
      
      const unsubscribe = config.subscribe(listener);
      unsubscribe();
      
      config.setTheme('light');
      expect(callCount).toBe(1); // Only the initial call on subscription
    });

    it('should call listener immediately on subscription', () => {
      let callCount = 0;
      const listener = () => callCount++;
      
      config.subscribe(listener);
      expect(callCount).toBe(1);
    });

    it('should support multiple listeners', () => {
      let callCount1 = 0;
      let callCount2 = 0;
      
      config.subscribe(() => callCount1++);
      config.subscribe(() => callCount2++);
      
      config.setTheme('light');
      
      expect(callCount1).toBe(2); // Initial call + change notification
      expect(callCount2).toBe(2); // Initial call + change notification
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset config to default values', () => {
      config.setTheme('light');
      config.resetToDefaults();
      expect(config.getConfig().theme).toBe('dark');
    });

    it('should save defaults to localStorage after reset', () => {
      config.resetToDefaults();
      expect(localStorageMock['app-config']).toBe(JSON.stringify({ theme: 'dark' }));
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage setItem errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalSetItem = global.localStorage.setItem;
      global.localStorage.setItem = () => {
        throw new Error('Storage error');
      };
      
      expect(() => config.setTheme('light')).not.toThrow();
      
      // Restore original method
      global.localStorage.setItem = originalSetItem;
    });

    it('should handle localStorage getItem errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalGetItem = global.localStorage.getItem;
      global.localStorage.getItem = () => {
        throw new Error('Storage error');
      };
      
      (Config as any).instance = null;
      expect(() => Config.getInstance()).not.toThrow();
      
      // Restore original method
      global.localStorage.getItem = originalGetItem;
    });
  });
});
