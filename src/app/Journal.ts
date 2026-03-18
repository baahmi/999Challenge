const STORAGE_KEY = 'stardew-journal';

export type QualityStacks = [number, number, number, number, number];

export interface JournalItem {
  id: number;
  cat: number;
  q: QualityStacks;
}

export interface JournalDelta {
  id?: number;
  cat?: number;
  q: QualityStacks;
}

export interface DayEntry {
  qiGems: number;
  mysteryBoxesOpened: number;
  ticketPrizesClaimed: number;
  changes: Record<string, JournalDelta>;
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
  v: 1;
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
  itemId: number;
  category: number;
  stack: number;
  quality: number[];
}

function isJournal(obj: unknown): obj is Journal {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as Record<string, unknown>).v === 1 &&
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
      result[item.name] = { id: item.itemId, cat: item.category, q };
    }
    return result;
  }

  static toCompactedItems(items: Record<string, JournalItem>): CompactedItem[] {
    return Object.entries(items).map(([name, item]) => ({
      name,
      itemId: item.id,
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
        delta[name] = { id: item.id, cat: item.cat, q: [...item.q] as QualityStacks };
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

  static upsertJournal(
    existing: Journal | null,
    day: number,
    qiGems: number,
    mysteryBoxesOpened: number,
    ticketPrizesClaimed: number,
    childrenTurnedToDoves: number,
    compacted: CompactedItem[],
  ): Journal {
    const currentItems = JournalStore.toJournalItems(compacted);
    const prevItems = existing?.main.items ?? {};
    const changes = JournalStore.computeDelta(prevItems, currentItems);

    return {
      v: 1,
      main: { day, qiGems, mysteryBoxesOpened, ticketPrizesClaimed, childrenTurnedToDoves, items: currentItems },
      days: {
        ...(existing?.days ?? {}),
        [day]: { qiGems, mysteryBoxesOpened, ticketPrizesClaimed, changes },
      },
    };
  }
}
