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

  it('persists category deltas but keeps item identity from bundled data', async () => {
    const storage = installLocalStorageMock({});
    const { CustomDataStore } = await import(`../CustomDataStore.ts?save-shape-${Date.now()}`);

    const edited = CustomDataStore.getItemsData().map(item =>
      item.name === 'Stone' && item.displayName === null
        ? { ...item, category: 'My Stuff' }
        : item
    );
    CustomDataStore.setData({
      categoryNames: [...CustomDataStore.getCategoryNames(), 'My Stuff'],
      items: edited,
    });

    const stored = JSON.parse(storage['stardew-custom-data'] ?? '{}');
    expect(stored.v).toBe(2);
    expect(stored.categoryNames).toContain('My Stuff');
    expect(stored.itemCategoryOverrides).toEqual({ 'Stone|': 'My Stuff' });
    // no item names/displayNames in storage: bundled data stays canonical
    expect(stored.items).toBeUndefined();
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Stone' && item.displayName === null)?.category)
      .toBe('My Stuff');
    expect(CustomDataStore.getCategoryNames()).toContain('My Stuff');
  });

  it('reapplies persisted category customizations on a fresh load', async () => {
    installLocalStorageMock({
      'stardew-custom-data': JSON.stringify({
        v: 2,
        categoryNames: ['Resources', 'My Stuff'],
        itemCategoryOverrides: { 'Stone|': 'My Stuff' },
      }),
    });

    const { CustomDataStore } = await import(`../CustomDataStore.ts?v2-roundtrip-${Date.now()}`);

    expect(CustomDataStore.getCategoryNames()).toEqual(['Resources', 'My Stuff']);
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Stone' && item.displayName === null)?.category)
      .toBe('My Stuff');
    // untouched items keep their bundled category
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Wood' && item.displayName === null)?.category)
      .toBe('Resources');
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

  it('keeps known flower colors visible without owning them and avoids duplicates on import', async () => {
    installLocalStorageMock({});
    const { CustomDataStore } = await import(`../CustomDataStore.ts?seeded-flowers-${Date.now()}`);
    const poppyColors = () => CustomDataStore.getItemsData()
      .filter(item => item.name === 'Poppy' && item.displayName !== null)
      .map(item => item.displayName)
      .sort();

    expect(poppyColors()).toEqual(['Poppy (Orange)', 'Poppy (Scarlet)', 'Poppy (White)']);
    CustomDataStore.addVariantsFromInventory([{ name: 'Poppy (Orange)', category: -80 }]);
    expect(poppyColors()).toContain('Poppy (White)');

    CustomDataStore.addVariantsFromInventory([
      { name: 'Poppy (254,254,254)', category: -80 },
      { name: 'Poppy (White)', category: -80 },
      { name: 'Poppy (1,2,3)', category: -80 },
    ]);
    expect(poppyColors().filter(name => name === 'Poppy (White)')).toHaveLength(1);
    expect(poppyColors()).not.toContain('Poppy (254,254,254)');
    expect(poppyColors()).toContain('Poppy (1,2,3)');

    CustomDataStore.resetToDefaults();
    expect(poppyColors()).toEqual(['Poppy (Orange)', 'Poppy (Scarlet)', 'Poppy (White)']);
  });

  it('applies saved category customizations to unowned flower colors', async () => {
    installLocalStorageMock({
      'stardew-custom-data': JSON.stringify({
        v: 2,
        categoryNames: ['Flowers', 'My Flowers'],
        itemCategoryOverrides: { 'Poppy|Poppy (White)': 'My Flowers' },
      }),
    });
    const { CustomDataStore } = await import(`../CustomDataStore.ts?flower-category-${Date.now()}`);

    expect(CustomDataStore.getItemsData().find(item => item.displayName === 'Poppy (White)'))
      .toEqual({ category: 'My Flowers', name: 'Poppy', displayName: 'Poppy (White)' });
  });
});
