import { Config } from "@/config/Config";

type Listener = () => void;

export interface AppDataState {
  xmlData: Record<string, any> | null;
  isLoading: boolean;
  error: string | null;
  daysPlayed: number | null;
  mysteryBoxesOpened: number | null;
  ticketPrizesClaimed: number | null;
  items: extractedItem[],
  compacted: Record<string, extractedItem>,
}

export type extractedItem = {
  name: string;
  itemId: number;
  category: number;
  stack: number;
  quality: number;
}

class AppDataManager {
  private static instance: AppDataManager;
  private state: AppDataState = {
    xmlData: null,
    isLoading: false,
    error: null,
    daysPlayed: null,
    mysteryBoxesOpened: null,
    ticketPrizesClaimed: null,
    items: [],
    compacted: {} as Record<string, extractedItem>,
  };
  private listeners: Set<Listener> = new Set();

  private constructor() {}

  static getInstance(): AppDataManager {
    if (!AppDataManager.instance) {
      AppDataManager.instance = new AppDataManager();
    }
    return AppDataManager.instance;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  getState(): AppDataState {
    return { ...this.state };
  }

  getXmlData(): Record<string, any> | null {
    return this.state.xmlData;
  }

  getQiGems(): number | null {
    if (!this.state.xmlData) return null;
    const qiGems = this.findValue(this.state.xmlData, 'qiGems');
    return qiGems ? parseInt(qiGems, 10) : null;
  }

  getDaysPlayed(): number | null {
    return this.state.daysPlayed;
  }

  private findValue(obj: Record<string, any>, key: string): string | null {
    if (obj[key]) {
      const value = obj[key];
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'object' && value._text) {
        return value._text;
      }
    }

    for (const k in obj) {
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        const result = this.findValue(obj[k], key);
        if (result !== null) return result;
      }
      if (Array.isArray(obj[k])) {
        for (const item of obj[k]) {
          if (typeof item === 'object') {
            const result = this.findValue(item, key);
            if (result !== null) return result;
          }
        }
      }
    }

    return null;
  }

  isLoading(): boolean {
    return this.state.isLoading;
  }

  getError(): string | null {
    return this.state.error;
  }

  async loadXmlFile(file: File): Promise<void> {
    this.state.isLoading = true;
    this.state.error = null;
    this.notifyListeners();

    try {
      this.clearData
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'application/xml');

      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML file');
      }

      this.processData(xmlDoc.documentElement);
      this.state.isLoading = false;
      this.notifyListeners();
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : 'Unknown error occurred';
      this.state.isLoading = false;
      this.notifyListeners();
      throw err;
    }
  }

  private processData(root: Element) {
    const items = root.querySelectorAll('SaveGame > player > stats > Values > item');
    for (const item of Array.from(items)) {
      let key = item.querySelector('key > string')?.textContent || '';
      let value = item.querySelector('value > *')?.textContent || '';
      if(key === 'daysPlayed') {
        this.state.daysPlayed = parseInt(value);
      } else if(key === 'MysteryBoxesOpened') {
        this.state.mysteryBoxesOpened = parseInt(value);
      } else if(key === 'ticketPrizesClaimed') {
        this.state.ticketPrizesClaimed = parseInt(value);
      }
    }
    this.extractItems(root, this.state.items);
    console.log(this.state.items);
    this.compactItems();
    console.log(this.state.compacted);
  }

  private compactItems() {
    const compacted: Record<string, { itemId: number; category: number; stacks: number[] }> = {};

    for (const item of this.state.items) {
      compacted[item.name] ??= {
        itemId: item.itemId,
        category: item.category,
        stacks: [0, 0, 0, 0, 0]
      };
      const entry = compacted[item.name]!;
      const quality = Math.min(item.quality, 4);
      entry.stacks[quality]! += item.stack;
    }

    this.state.compacted = Object.entries(compacted).map(([name, data]) => ({
      name,
      itemId: data.itemId,
      category: data.category,
      stack: data.stacks.reduce((sum, s) => sum + s, 0),
      quality: data.stacks
    })) as any;
  }


private getText(node: ParentNode, selector: string): string | undefined {
  return node.querySelector(selector)?.textContent?.trim() ?? undefined;
}

private getInt(node: ParentNode, selector: string): number {
  const t = this.getText(node, selector);
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

private extractItems(node: Element, out: extractedItem[]): void {
  const tag = node.tagName;

  if (tag === "Object" || tag === "Item") {
    const name = this.getText(node, "name");
    const category = this.getInt(node, "category");
    if (name && !Config.getIgnoredCategories().includes(category)) {
      const itemId = this.getInt(node, "itemId");
      let stack = this.getInt(node, "stack");
      if (stack === 0) stack = 1;

      const quality = this.getInt(node, "quality");

      out.push({ name, itemId, category, stack, quality });
    }
  }

  for (let i = 0; i < node.children.length; i++) {
    this.extractItems(node.children[i] as Element, out);
  }
}


  clearData(): void {
    this.state.xmlData = null;
    this.state.error = null;
    this.state.isLoading = false;
    this.state.items = [];
    this.state.daysPlayed = 0;
    this.state.mysteryBoxesOpened = 0;
    this.state.ticketPrizesClaimed = 0;
    this.notifyListeners();
  }
}

export const AppData = AppDataManager.getInstance();
