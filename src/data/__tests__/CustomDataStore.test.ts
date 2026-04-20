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
        categoryNames: ['Custom Category'],
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

    expect(CustomDataStore.getCategoryNames()).toEqual(['Custom Category']);
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Duck Mayonnaise')?.displayName)
      .toBe('Mayonnaise: Duck');
  });

  it('persists only category names when custom data is saved', async () => {
    const storage = installLocalStorageMock({});
    const { CustomDataStore } = await import(`../CustomDataStore.ts?save-shape-${Date.now()}`);

    CustomDataStore.setData({
      categoryNames: ['A', 'B'],
      items: [
        {
          category: 'Old',
          name: 'Duck Mayonnaise',
          displayName: 'Mayanaise: Duck',
        },
      ],
    });

    expect(JSON.parse(storage['stardew-custom-data'] ?? '{}')).toEqual({
      categoryNames: ['A', 'B'],
    });
    expect(CustomDataStore.getItemsData().find(item => item.name === 'Duck Mayonnaise')?.displayName)
      .toBe('Mayonnaise: Duck');
  });
});
