import { describe, expect, it } from 'bun:test';
import { JournalStore, type CompactedItem, type Journal } from './Journal';

function makeItem(name: string, count: number): CompactedItem {
  return {
    name,
    itemId: `(O)${name}`,
    category: 0,
    stack: count,
    quality: [count, 0, 0, 0, 0],
  };
}

describe('JournalStore', () => {
  it('restores legacy white Poppy names with their quality stacks intact', () => {
    const compacted = JournalStore.toCompactedItems({
      'Poppy (254,254,254)': { itemId: '(O)376', cat: -80, q: [10, 20, 30, 0, 40] },
    });

    expect(compacted).toEqual([{
      name: 'Poppy (White)',
      itemId: '(O)376',
      category: -80,
      stack: 100,
      quality: [10, 20, 30, 0, 40],
    }]);
  });

  it('reads all 100 legacy save snapshots without reimporting or rewriting the journal', () => {
    let journal: Journal | null = null;
    for (let day = 1; day <= 100; day++) {
      journal = JournalStore.upsertJournal(journal, day, 0, 0, 0, 0, [{
        name: 'Poppy (254,254,254)',
        itemId: '(O)376',
        category: -80,
        stack: day * 2,
        quality: [day, 0, 0, 0, day],
      }]);
    }
    const storedJournal = JSON.stringify(journal);
    const restored = JSON.parse(storedJournal) as Journal;

    for (let day = 1; day <= 100; day++) {
      const items = JournalStore.reconstructItemsAtDay(restored, day);
      expect(JournalStore.toCompactedItems(items)).toEqual([{
        name: 'Poppy (White)',
        itemId: '(O)376',
        category: -80,
        stack: day * 2,
        quality: [day, 0, 0, 0, day],
      }]);
    }
    expect(Object.keys(restored.days)).toHaveLength(100);
    expect(JSON.stringify(restored)).toBe(storedJournal);
  });

  it('reconstructs correct history when an earlier day is imported after a later day', () => {
    const day2672 = [
      makeItem('Mushroom Tree Seed', 20),
      makeItem('Stone', 50),
    ];
    const day2572 = [
      makeItem('Mushroom Tree Seed', 12),
      makeItem('Stone', 30),
    ];

    let journal = JournalStore.upsertJournal(
      null,
      2672,
      10,
      1,
      2,
      0,
      day2672,
    );

    journal = JournalStore.upsertJournal(
      journal,
      2572,
      5,
      0,
      1,
      0,
      day2572,
    );

    const reconstructed2572 = JournalStore.reconstructItemsAtDay(journal, 2572);
    const reconstructed2672 = JournalStore.reconstructItemsAtDay(journal, 2672);

    expect(journal.main.day).toBe(2672);
    expect(reconstructed2572['Mushroom Tree Seed']?.q[0]).toBe(12);
    expect(reconstructed2572['Stone']?.q[0]).toBe(30);
    expect(reconstructed2672['Mushroom Tree Seed']?.q[0]).toBe(20);
    expect(reconstructed2672['Stone']?.q[0]).toBe(50);
    expect(journal.days['2572']?.qiGems).toBe(5);
    expect(journal.days['2672']?.qiGems).toBe(10);
  });
});
