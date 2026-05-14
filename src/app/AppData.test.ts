import { describe, expect, it } from 'bun:test';
import { JournalStore, type CompactedItem } from './Journal';

function installLocalStorageMock() {
  let storage: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      storage = {};
    },
    key: (index: number) => Object.keys(storage)[index] ?? null,
    get length() {
      return Object.keys(storage).length;
    },
  } as Storage;
}

function makeItem(name: string, itemId: string, category: number, count: number): CompactedItem {
  return {
    name,
    itemId,
    category,
    stack: count,
    quality: [count, 0, 0, 0, 0],
  };
}

describe('AppData', () => {
  it('keeps visible state on the latest journal day after importing an older save', async () => {
    installLocalStorageMock();

    const { AppData } = await import(`./AppData.ts?older-import-${Date.now()}`);

    const latestJournal = JournalStore.upsertJournal(
      null,
      2672,
      55,
      3,
      4,
      1,
      [makeItem('Stone', '(O)390', 0, 50)],
    );

    (AppData as any).journal = latestJournal;
    (AppData as any).state.compacted = [makeItem('Stone', '(O)390', 0, 20)];
    (AppData as any).state.daysPlayed = 2572;
    (AppData as any).state.qiGems = 12;
    (AppData as any).state.mysteryBoxesOpened = 1;
    (AppData as any).state.ticketPrizesClaimed = 2;
    (AppData as any).state.childrenTurnedToDoves = 0;
    (AppData as any).state.rawStats = { daysPlayed: '2572' };

    (AppData as any).saveToJournal();

    expect(AppData.getDaysPlayed()).toBe(2672);
    expect(AppData.getQiGems()).toBe(55);
    expect((AppData as any).state.mysteryBoxesOpened).toBe(3);
    expect((AppData as any).state.ticketPrizesClaimed).toBe(4);
    expect((AppData as any).state.compacted[0]?.stack).toBe(50);
  });

  it('does not import furniture items from save files', async () => {
    installLocalStorageMock();

    const { AppData } = await import(`./AppData.ts?skip-furniture-${Date.now()}`);
    const makeNode = (
      tagName: string,
      xsiType: string | null,
      fields: Record<string, string>,
      children: any[] = [],
    ) => ({
      tagName,
      children,
      getAttribute: (name: string) => (name === 'xsi:type' ? xsiType : null),
      querySelector: (selector: string) => {
        const value = fields[selector];
        return value === undefined ? null : { textContent: value };
      },
    });

    const root = makeNode('Root', null, {}, [
      makeNode('Item', 'Furniture', {
        name: 'Wood Chair',
        category: '-24',
        itemId: '1308',
        quality: '0',
        stack: '1',
      }),
      makeNode('Item', 'Object', {
        name: 'Mushroom Tree Seed',
        category: '-74',
        itemId: '(O)891',
        quality: '0',
        stack: '3',
      }),
    ]);

    const out: any[] = [];
    (AppData as any).extractItems(root, out);

    const names = out.map((item: { name: string }) => item.name);
    expect(names).not.toContain('Wood Chair');
    expect(names).toContain('Mushroom Tree Seed');
  });
});
