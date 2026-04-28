import { Config } from "@/config/Config";
import { JournalStore, type Journal, type ImportDiff } from './Journal';
import { VariantResolver, CustomDataStore } from '@/data/CustomDataStore';

const MANNEQUIN_ITEM_IDS = new Set([
  "MannequinMale",
  "MannequinFemale",
  "CursedMannequinMale",
  "CursedMannequinFemale",
]);

type Listener = () => void;

export type ImportStatus = {
  phase: 'reading' | 'sorting' | 'parsing' | 'importing';
  current: number;
  total: number;
  fileName: string;
  daysPlayed?: number;
};

export interface AppDataState {
  xmlData: Record<string, any> | null;
  isLoading: boolean;
  importStatus: ImportStatus | null;
  error: string | null;
  daysPlayed: number | null;
  qiGems: number | null;
  mysteryBoxesOpened: number | null;
  ticketPrizesClaimed: number | null;
  childrenTurnedToDoves: number | null;
  items: extractedItem[],
  compacted: Record<string, extractedItem>,
  lastDiff: ImportDiff | null,
  rawStats: Record<string, string>;
}

export type extractedItem = {
  name: string;
  itemId: string;
  category: number;
  stack: number;
  quality: number;
}

class AppDataManager {
  private static instance: AppDataManager;
  private state: AppDataState = {
    xmlData: null,
    isLoading: false,
    importStatus: null,
    error: null,
    daysPlayed: null,
    qiGems: null,
    mysteryBoxesOpened: null,
    ticketPrizesClaimed: null,
    childrenTurnedToDoves: null,
    items: [],
    compacted: {} as Record<string, extractedItem>,
    lastDiff: null,
    rawStats: {},
  };
  private listeners: Set<Listener> = new Set();
  private journal: Journal | null = null;

  private constructor() {
    this.loadFromJournal();
  }

  static getInstance(): AppDataManager {
    if (!AppDataManager.instance) {
      AppDataManager.instance = new AppDataManager();
    }
    return AppDataManager.instance;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  private async yieldToUi(): Promise<void> {
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  }

  getState(): AppDataState {
    return { ...this.state };
  }

  getXmlData(): Record<string, any> | null {
    return this.state.xmlData;
  }

  getQiGems(): number | null {
    return this.state.qiGems;
  }

  getDaysPlayed(): number | null {
    return this.state.daysPlayed;
  }

  getChildrenTurnedToDoves(): number | null {
    return this.state.childrenTurnedToDoves;
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
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'application/xml');

      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML file');
      }

      this.processData(xmlDoc.documentElement);
      this.state.isLoading = false;
      this.state.importStatus = null;
      this.notifyListeners();
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : 'Unknown error occurred';
      this.state.isLoading = false;
      this.state.importStatus = null;
      this.notifyListeners();
      throw err;
    }
  }

  async loadXmlFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    this.state.isLoading = true;
    this.state.importStatus = {
      phase: 'reading',
      current: 0,
      total: files.length,
      fileName: '',
    };
    this.state.error = null;
    this.notifyListeners();

    try {
      const saves: Array<{ file: File; index: number; text: string; daysPlayed: number }> = [];

      for (const [index, file] of files.entries()) {
        this.state.importStatus = {
          phase: 'reading',
          current: index + 1,
          total: files.length,
          fileName: file.name,
        };
        this.notifyListeners();
        await this.yieldToUi();

        const text = await file.text();

        saves.push({
          file,
          index,
          text,
          daysPlayed: this.getDaysPlayedFromText(text),
        });
      }

      this.state.importStatus = {
        phase: 'sorting',
        current: saves.length,
        total: saves.length,
        fileName: 'Sorting by save day',
      };
      this.notifyListeners();
      await this.yieldToUi();

      saves.sort((a, b) => (a.daysPlayed - b.daysPlayed) || a.file.name.localeCompare(b.file.name) || (a.index - b.index));

      const parser = new DOMParser();

      for (const [index, save] of saves.entries()) {
        this.state.importStatus = {
          phase: 'parsing',
          current: index + 1,
          total: saves.length,
          fileName: save.file.name,
          daysPlayed: save.daysPlayed,
        };
        this.notifyListeners();
        await this.yieldToUi();

        const xmlDoc = parser.parseFromString(save.text, 'application/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          throw new Error(`Invalid XML file: ${save.file.name}`);
        }

        this.state.importStatus = {
          phase: 'importing',
          current: index + 1,
          total: saves.length,
          fileName: save.file.name,
          daysPlayed: save.daysPlayed,
        };
        this.notifyListeners();
        await this.yieldToUi();

        this.processData(xmlDoc.documentElement);
        save.text = '';
      }

      this.state.isLoading = false;
      this.state.importStatus = null;
      this.notifyListeners();
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : 'Unknown error occurred';
      this.state.isLoading = false;
      this.state.importStatus = null;
      this.notifyListeners();
      throw err;
    }
  }

  private getDaysPlayedFromText(text: string): number {
    const itemMatch = text.match(/<item><key><string>daysPlayed<\/string><\/key><value><[^>]+>(\d+)<\/[^>]+><\/value><\/item>/);
    if (itemMatch?.[1]) return Number(itemMatch[1]);

    const statsMatch = text.match(/<daysPlayed>(\d+)<\/daysPlayed>/);
    if (statsMatch?.[1]) return Number(statsMatch[1]);

    return 0;
  }

  private processData(root: Element) {
    this.state.items = [];
    this.state.rawStats = {};
    const items = root.querySelectorAll('SaveGame > player > stats > Values > item');
    for (const item of Array.from(items)) {
      const key = item.querySelector('key > string')?.textContent || '';
      const value = item.querySelector('value > *')?.textContent || '';
      if (!key) continue;
      this.state.rawStats[key] = value;
      if(key === 'daysPlayed') {
        this.state.daysPlayed = parseInt(value);
      } else if(key === 'MysteryBoxesOpened') {
        this.state.mysteryBoxesOpened = parseInt(value);
      } else if(key === 'ticketPrizesClaimed') {
        this.state.ticketPrizesClaimed = parseInt(value);
      } else if(key === 'childrenTurnedToDoves') {
        this.state.childrenTurnedToDoves = parseInt(value);
      }
    }
    const qiGemsEl = root.querySelector('SaveGame > player > qiGems') ??
      root.getElementsByTagName('qiGems')[0];
    if (qiGemsEl) {
      this.state.qiGems = parseInt(qiGemsEl.textContent || '0', 10);
    }
    this.extractItems(root, this.state.items);
    
    // Add discovered variants to CustomDataStore items list
    CustomDataStore.addVariantsFromInventory(this.state.items);
    
    this.compactItems();
    this.saveToJournal();
  }

  private loadFromJournal(): void {
    this.journal = JournalStore.load();
    if (!this.journal) return;
    const { main, days } = this.journal;
    this.state.daysPlayed = main.day;
    this.state.qiGems = main.qiGems;
    this.state.mysteryBoxesOpened = main.mysteryBoxesOpened;
    this.state.ticketPrizesClaimed = main.ticketPrizesClaimed;
    this.state.childrenTurnedToDoves = main.childrenTurnedToDoves ?? null;
    
    // Add variants from stored journal data
    CustomDataStore.addVariantsFromInventory(main.items as any);
    
    this.state.compacted = JournalStore.toCompactedItems(main.items, Config.getIgnoredCategories()) as unknown as Record<string, extractedItem>;

    const sortedDays = Object.keys(days).map(Number).sort((a, b) => a - b);
    const latestDay = sortedDays[sortedDays.length - 1];
    if (latestDay !== undefined) {
      const dayEntry = days[latestDay]!;
      const prevDayNum = sortedDays[sortedDays.length - 2];
      const prevDay = prevDayNum ?? null;
      const prevQiGems = prevDay !== null ? (days[prevDay]?.qiGems ?? null) : null;
      this.state.lastDiff = {
        previousDay: prevDay,
        currentDay: latestDay,
        previousQiGems: prevQiGems,
        currentQiGems: dayEntry.qiGems,
        changes: dayEntry.changes,
        currentItems: main.items,
      };
    }
  }

  private saveToJournal(): void {
    const prevMain = this.journal?.main ?? null;
    const compacted = this.state.compacted as unknown as Array<{ name: string; itemId: string; category: number; stack: number; quality: number[] }>;
    const currentDay = this.state.daysPlayed ?? 0;
    const currentQiGems = this.state.qiGems ?? 0;
    this.journal = JournalStore.upsertJournal(
      this.journal,
      currentDay,
      currentQiGems,
      this.state.mysteryBoxesOpened ?? 0,
      this.state.ticketPrizesClaimed ?? 0,
      this.state.childrenTurnedToDoves ?? 0,
      compacted,
      Object.keys(this.state.rawStats).length > 0 ? this.state.rawStats : undefined,
    );
    JournalStore.save(this.journal);
    this.state.lastDiff = {
      previousDay: prevMain?.day ?? null,
      currentDay,
      previousQiGems: prevMain?.qiGems ?? null,
      currentQiGems,
      changes: this.journal.days[currentDay]?.changes ?? {},
      currentItems: this.journal.main.items,
    };
  }

  downloadJournal(): void {
    if (this.journal) JournalStore.download(this.journal);
  }

  clearJournal(): void {
    this.journal = null;
    JournalStore.clear();
    this.state.compacted = {} as Record<string, extractedItem>;
    this.state.daysPlayed = null;
    this.state.qiGems = null;
    this.state.mysteryBoxesOpened = null;
    this.state.ticketPrizesClaimed = null;
    this.state.childrenTurnedToDoves = null;
    this.state.lastDiff = null;
    this.notifyListeners();
  }

  getLastDiff(): ImportDiff | null {
    return this.state.lastDiff;
  }

  getJournal(): Journal | null {
    return this.journal;
  }

  getStats(): Record<string, string> {
    return this.state.rawStats;
  }

  hasJournal(): boolean {
    return this.journal !== null;
  }

  getJournalDayCount(): number {
    return this.journal ? Object.keys(this.journal.days).length : 0;
  }

  loadJournalFromData(data: unknown): boolean {
    const journal = JournalStore.importFrom(data);
    if (!journal) return false;
    this.journal = journal;
    JournalStore.save(journal);
    const { main } = journal;
    this.state.daysPlayed = main.day;
    this.state.qiGems = main.qiGems;
    this.state.mysteryBoxesOpened = main.mysteryBoxesOpened;
    this.state.ticketPrizesClaimed = main.ticketPrizesClaimed;
    this.state.compacted = JournalStore.toCompactedItems(main.items, Config.getIgnoredCategories()) as unknown as Record<string, extractedItem>;
    this.notifyListeners();
    return true;
  }

  private compactItems() {
    const compacted: Record<string, { itemId: string; category: number; stacks: number[] }> = {};

    for (const item of this.state.items) {
      // Keep variants as separate items (e.g., "Blue Jazz (35,127,255)" stays separate)
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

private getBool(node: ParentNode, selector: string): boolean {
  return this.getText(node, selector) === "true";
}

private getItemId(node: ParentNode, itemIdText: string | undefined): string {
  if (!itemIdText) return '';
  if (itemIdText.startsWith("(")) return itemIdText;
  if (MANNEQUIN_ITEM_IDS.has(itemIdText)) return `(M)${itemIdText}`;
  if (!Number.isFinite(Number(itemIdText))) return itemIdText;

  if (this.getBool(node, "bigCraftable")) return `(BC)${itemIdText}`;

  const element = node instanceof Element ? node : undefined;
  const type = element?.getAttribute("xsi:type");
  if (element?.tagName === "Object" || type === "Object" || type === "ColoredObject") {
    return `(O)${itemIdText}`;
  }

  return itemIdText;
}

private extractItems(node: Element, out: extractedItem[]): void {
  const tag = node.tagName;

  if (tag === "Object" || tag === "Item") {
    const name = this.getText(node, "name");
    const category = this.getInt(node, "category");
    if (name && !Config.getIgnoredCategories().includes(category)) {
      const itemIdText = this.getText(node, "itemId");
      const itemId = this.getItemId(node, itemIdText);
      let stack = this.getInt(node, "stack");
      if (stack === 0) stack = 1;

      const quality = this.getInt(node, "quality");
      
      // Extract color data for variant resolution (flowers)
      const colorNode = node.querySelector("color");
      let colorData: { R: number; G: number; B: number; A: number } | undefined;
      if (colorNode) {
        const r = this.getInt(colorNode, "R");
        const g = this.getInt(colorNode, "G");
        const b = this.getInt(colorNode, "B");
        const a = this.getInt(colorNode, "A");
        if (r || g || b || a) {
          colorData = { R: r, G: g, B: b, A: a };
        }
      }
      
      // Resolve variant display name
      const displayName = VariantResolver.resolveDisplayName(
        name,
        itemId,
        colorData
      );

      out.push({ name: displayName, itemId, category, stack, quality });
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
    this.state.importStatus = null;
    this.state.items = [];
    this.state.daysPlayed = 0;
    this.state.qiGems = 0;
    this.state.mysteryBoxesOpened = 0;
    this.state.ticketPrizesClaimed = 0;
    this.notifyListeners();
  }
}

export const AppData = AppDataManager.getInstance();
