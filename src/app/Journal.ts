import { VariantResolver } from '@/data/CustomDataStore';

const STORAGE_KEY = 'stardew-journal';

export type QualityStacks = [number, number, number, number, number];

export interface JournalItem {
  itemId: string;
  cat: number;
  q: QualityStacks;
}

export interface JournalDelta {
  itemId?: string;
  cat?: number;
  q: QualityStacks;
}

export interface DayEntry {
  qiGems: number;
  mysteryBoxesOpened: number;
  ticketPrizesClaimed: number;
  changes: Record<string, JournalDelta>;
  stats?: Record<string, string>;
}

export interface JournalMain {
  day: number;
  qiGems: number;
  mysteryBoxesOpened: number;
  ticketPrizesClaimed: number;
  childrenTurnedToDoves: number;
  items: Record<string, JournalItem>;
}

export interface Journal {
  v: 2;
  main: JournalMain;
  days: Record<string, DayEntry>;
}

export interface ImportDiff {
  previousDay: number | null;
  currentDay: number;
  previousQiGems: number | null;
  currentQiGems: number;
  changes: Record<string, JournalDelta>;
  currentItems: Record<string, JournalItem>;
}

export interface CompactedItem {
  name: string;
  itemId: string;
  category: number;
  stack: number;
  quality: number[];
}

function isJournal(obj: unknown): obj is Journal {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as Record<string, unknown>).v === 2 &&
    typeof (obj as Record<string, unknown>).main === 'object' &&
    typeof (obj as Record<string, unknown>).days === 'object'
  );
}

export class JournalStore {
  static load(): Journal | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      return isJournal(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  static save(journal: Journal): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
    } catch (e) {
      console.warn('Failed to save journal:', e);
    }
  }

  static download(journal: Journal): void {
    const blob = new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stardew-journal-day${journal.main.day}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static importFrom(data: unknown): Journal | null {
    return isJournal(data) ? data : null;
  }

  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  static toJournalItems(compacted: CompactedItem[]): Record<string, JournalItem> {
    const result: Record<string, JournalItem> = {};
    for (const item of compacted) {
      const raw = item.quality ?? [];
      const q: QualityStacks = [
        raw[0] ?? 0,
        raw[1] ?? 0,
        raw[2] ?? 0,
        raw[3] ?? 0,
        raw[4] ?? 0,
      ];
      result[item.name] = { itemId: item.itemId, cat: item.category, q };
    }
    return result;
  }

  static toCompactedItems(items: Record<string, JournalItem>, ignoredCategories: number[] = []): CompactedItem[] {
    return Object.entries(items)
      .filter(([, item]) => !ignoredCategories.includes(item.cat))
      .map(([name, item]) => ({
        name: VariantResolver.normalizeDisplayName(name),
        itemId: item.itemId,
        category: item.cat,
        stack: item.q.reduce((s, v) => s + v, 0),
        quality: [...item.q],
      }));
  }

  static computeDelta(
    previous: Record<string, JournalItem>,
    current: Record<string, JournalItem>,
  ): Record<string, JournalDelta> {
    const delta: Record<string, JournalDelta> = {};

    for (const [name, item] of Object.entries(current)) {
      const prev = previous[name];
      if (!prev) {
        delta[name] = { itemId: item.itemId, cat: item.cat, q: [...item.q] as QualityStacks };
      } else {
        const dq = item.q.map((v, i) => v - (prev.q[i] ?? 0)) as QualityStacks;
        if (dq.some(v => v !== 0)) {
          delta[name] = { q: dq };
        }
      }
    }

    for (const [name, item] of Object.entries(previous)) {
      if (!current[name]) {
        delta[name] = { q: item.q.map(v => -v) as QualityStacks };
      }
    }

    return delta;
  }

  static reconstructItemsAtDay(
    journal: Journal,
    targetDay: number,
  ): Record<string, JournalItem> {
    const sortedDays = Object.keys(journal.days).map(Number).sort((a, b) => b - a);
    const items: Record<string, JournalItem> = {};
    for (const [name, item] of Object.entries(journal.main.items)) {
      items[name] = { ...item, q: [...item.q] as QualityStacks };
    }
    for (const day of sortedDays) {
      if (day <= targetDay) break;
      const changes = journal.days[String(day)]?.changes ?? {};
      for (const [name, delta] of Object.entries(changes)) {
        const cur = items[name];
        const prevQ = (delta.q as number[]).map((dv, i) => (cur?.q[i] ?? 0) - dv) as QualityStacks;
        const total = prevQ.reduce((s, v) => s + v, 0);
        if (total <= 0) {
          delete items[name];
        } else {
          items[name] = {
            itemId: cur?.itemId ?? delta.itemId ?? '',
            cat: cur?.cat ?? delta.cat ?? 0,
            q: prevQ,
          };
        }
      }
    }
    return items;
  }

  static getDiffBetween(
    journal: Journal,
    fromDay: number,
    toDay: number,
  ): ImportDiff {
    const toItems = JournalStore.reconstructItemsAtDay(journal, toDay);
    const fromItems = fromDay === 0 ? {} : JournalStore.reconstructItemsAtDay(journal, fromDay);
    const changes = JournalStore.computeDelta(fromItems as Record<string, JournalItem>, toItems);
    const fromEntry = fromDay > 0 ? journal.days[String(fromDay)] : undefined;
    const toEntry = journal.days[String(toDay)];
    return {
      previousDay: fromDay === 0 ? null : fromDay,
      currentDay: toDay,
      previousQiGems: fromEntry?.qiGems ?? null,
      currentQiGems: toEntry?.qiGems ?? journal.main.qiGems,
      changes,
      currentItems: toItems,
    };
  }

  static upsertJournal(
    existing: Journal | null,
    day: number,
    qiGems: number,
    mysteryBoxesOpened: number,
    ticketPrizesClaimed: number,
    childrenTurnedToDoves: number,
    compacted: CompactedItem[],
    stats?: Record<string, string>,
  ): Journal {
    const currentItems = JournalStore.toJournalItems(compacted);
    const snapshotsByDay = new Map<number, Record<string, JournalItem>>();
    const dayEntries: Record<string, DayEntry> = { ...(existing?.days ?? {}) };

    if (existing) {
      for (const existingDay of Object.keys(existing.days).map(Number)) {
        snapshotsByDay.set(existingDay, JournalStore.reconstructItemsAtDay(existing, existingDay));
      }
    }

    snapshotsByDay.set(day, currentItems);
    dayEntries[String(day)] = { qiGems, mysteryBoxesOpened, ticketPrizesClaimed, changes: {}, stats };

    const sortedDays = [...snapshotsByDay.keys()].sort((a, b) => a - b);
    const rebuiltDays: Record<string, DayEntry> = {};

    let previousItems: Record<string, JournalItem> = {};
    for (const currentDay of sortedDays) {
      const snapshot = snapshotsByDay.get(currentDay) ?? {};
      const existingEntry = dayEntries[String(currentDay)];
      rebuiltDays[String(currentDay)] = {
        qiGems: existingEntry?.qiGems ?? 0,
        mysteryBoxesOpened: existingEntry?.mysteryBoxesOpened ?? 0,
        ticketPrizesClaimed: existingEntry?.ticketPrizesClaimed ?? 0,
        changes: JournalStore.computeDelta(previousItems, snapshot),
        stats: existingEntry?.stats,
      };
      previousItems = snapshot;
    }

    const latestDay = sortedDays[sortedDays.length - 1] ?? day;
    const latestItems = snapshotsByDay.get(latestDay) ?? currentItems;
    const latestEntry = rebuiltDays[String(latestDay)];
    const latestChildrenTurnedToDoves =
      latestDay === day
        ? childrenTurnedToDoves
        : (existing?.main.childrenTurnedToDoves ?? childrenTurnedToDoves);

    return {
      v: 2,
      main: {
        day: latestDay,
        qiGems: latestEntry?.qiGems ?? qiGems,
        mysteryBoxesOpened: latestEntry?.mysteryBoxesOpened ?? mysteryBoxesOpened,
        ticketPrizesClaimed: latestEntry?.ticketPrizesClaimed ?? ticketPrizesClaimed,
        childrenTurnedToDoves: latestChildrenTurnedToDoves,
        items: latestItems,
      },
      days: rebuiltDays,
    };
  }
}
