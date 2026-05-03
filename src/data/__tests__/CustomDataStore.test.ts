import { describe, expect, it } from 'bun:test';

function installLocalStorageMock(initial: Record<string, string>) {
  let storage = { ...initial };
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
  return storage;
}

describe('CustomDataStore', () => {
  it('loads item display names from bundled data instead of stale localStorage items', async () => {
    installLocalStorageMock({
      'stardew-custom-data': JSON.stringify({
        categoryNames: ['Artisan Goods', 'Artisan Goods (Other)', 'Artisan Goods (Keg)'],
        items: [
          {
            category: 'Artisan Goods (Other)',
            name: 'Duck Mayonnaise',
            displayName: 'Mayanaise: Duck',
          },
        ],
      }),
    });

    const { CustomDataStore } = await import(`../CustomDataStore.ts?fresh-items-${Date.now()}`);

    expect(CustomDataStore.getCategoryNames()).not.toContain('Artisan Goods (Other)');
    expect(CustomDataStore.getCategoryNames()).not.toContain('Artisan Goods (Keg)');
    expect(CustomDataStore.getCategoryNames().slice(0, 2)).toEqual([
      'Artisan Goods',
      'Resources',
    ]);
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Duck Mayonnaise')?.displayName)
      .toBe('Mayonnaise: Duck');
  });

  it('persists only category names when custom data is saved', async () => {
    const storage = installLocalStorageMock({});
    const { CustomDataStore } = await import(`../CustomDataStore.ts?save-shape-${Date.now()}`);

    CustomDataStore.setData({
      categoryNames: ['Fish', 'Artisan Goods'],
      items: [
        {
          category: 'Old',
          name: 'Duck Mayonnaise',
          displayName: 'Mayanaise: Duck',
        },
      ],
    });

    const stored = JSON.parse(storage['stardew-custom-data'] ?? '{}');
    expect(stored.categoryNames.slice(0, 2)).toEqual(['Fish', 'Artisan Goods']);
    expect(stored.categoryNames).toContain('Resources');
    expect(stored.categoryNames).toContain('Artisan Goods (Dehydrator)');
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Duck Mayonnaise')?.displayName)
      .toBe('Mayonnaise: Duck');
  });

  it('treats stored category names as tab order only', async () => {
    installLocalStorageMock({
      'stardew-custom-data': JSON.stringify({
        categoryNames: ['Artisan Goods', 'Artisan Goods (Keg)', 'Fish'],
      }),
    });

    const { CustomDataStore } = await import(`../CustomDataStore.ts?tab-order-${Date.now()}`);

    expect(CustomDataStore.getCategoryNames().slice(0, 2)).toEqual(['Artisan Goods', 'Fish']);
    expect(CustomDataStore.getCategoryNames()).not.toContain('Artisan Goods (Keg)');
    expect(CustomDataStore.getCategoryNames()).toContain('Artisan Goods (Dehydrator)');
  });

  it('seeds known item-id variants into the default item list before any import', async () => {
    installLocalStorageMock({});

    const { CustomDataStore } = await import(`../CustomDataStore.ts?seeded-variants-${Date.now()}`);
    const rottenPlantItems = CustomDataStore.getItemsData()
      .filter(item => item.name === 'Rotten Plant')
      .map(item => item.displayName);

    expect(rottenPlantItems).toContain('Rotten Plant 1');
    expect(rottenPlantItems).toContain('Rotten Plant 2');
  });
});
