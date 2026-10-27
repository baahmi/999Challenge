import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Config } from '../../config/Config';
import type { Quality } from '../../config/Config';
import { ItemTable } from '../../components/table/ItemTable';
import { calculateNeededCount, calculatePercentage } from '../../types/Item';
import { CustomDataStore } from '../CustomDataStore';
import { computeCategoryItems, computeCategoryItemsUncached } from '../itemCalculations';

const fruitSaplings = [
    'Apple Sapling', 'Apricot Sapling', 'Banana Sapling', 'Cherry Sapling',
    'Mango Sapling', 'Orange Sapling', 'Peach Sapling', 'Pomegranate Sapling',
];

describe('sapling quality and collection progress', () => {
    const store = CustomDataStore as any;
    let originalData: unknown;
    let originalParts: unknown;
    let originalTrove: unknown;
    let originalQuality: Quality;

    beforeEach(() => {
        originalData = store.data;
        originalParts = store.partsData;
        originalTrove = store.troveItems;
        originalQuality = Config.getQuality();
        Config.getInstance().setQuality('highest');
        store.data = {
            categoryNames: ['Seeds'],
            items: [...fruitSaplings, 'Tea Sapling', 'Parsnip Seeds'].map(name => ({
                category: 'Seeds', name, displayName: null,
            })),
        };
        store.partsData = [];
        store.troveItems = [];
    });

    afterEach(() => {
        store.data = originalData;
        store.partsData = originalParts;
        store.troveItems = originalTrove;
        Config.getInstance().setQuality(originalQuality);
    });

    for (const [label, compute] of [
        ['current', computeCategoryItems],
        ['historical', computeCategoryItemsUncached],
    ] as const) {
        it(`${label}: counts only iridium fruit saplings in highest mode`, () => {
            const rows = compute('Seeds', fruitSaplings.map(name => ({
                name, stack: 1103, quality: [999, 0, 0, 0, 104],
            })));

            for (const name of fruitSaplings) {
                const row = rows.find(item => item.name === name)!;
                expect(row.raw).toBe(1103);
                expect(row.correctQualityCount).toBe(104);
                expect(calculatePercentage(row)).toBeCloseTo(104 / 999 * 100);
                expect(calculateNeededCount(row)).toBe(895);
            }
        });

        it(`${label}: completes iridium saplings without changing tea or ordinary seeds`, () => {
            const rows = compute('Seeds', [
                { name: 'Banana Sapling', stack: 999, quality: [0, 0, 0, 0, 999] },
                { name: 'Tea Sapling', stack: 999, quality: [999, 0, 0, 0, 0] },
                { name: 'Parsnip Seeds', stack: 999, quality: [999, 0, 0, 0, 0] },
            ]);

            for (const name of ['Banana Sapling', 'Tea Sapling', 'Parsnip Seeds']) {
                const row = rows.find(item => item.name === name)!;
                expect(calculatePercentage(row)).toBe(100);
                expect(calculateNeededCount(row)).toBe(0);
            }
        });
    }

    it('respects explicit quality choices when switching away from highest', () => {
        const inventory = [
            { name: 'Banana Sapling', stack: 1103, quality: [999, 0, 0, 0, 104] },
            { name: 'Tea Sapling', stack: 999, quality: [999, 0, 0, 0, 0] },
        ];
        for (const [quality, expectedNeeded] of [
            ['highest', 895], ['any', 0], ['normal', 0], ['silver', 999], ['gold', 999], ['iridium', 895],
        ] as const) {
            Config.getInstance().setQuality(quality);
            for (const compute of [computeCategoryItems, computeCategoryItemsUncached]) {
                const rows = compute('Seeds', inventory);
                const row = rows.find(item => item.name === 'Banana Sapling')!;
                expect(row.raw).toBe(1103);
                expect(calculateNeededCount(row)).toBe(expectedNeeded);
                expect(calculateNeededCount(rows.find(item => item.name === 'Tea Sapling')!)).toBe(0);
            }
        }
    });

    it('uses the matching tier for normal, silver, gold, and iridium selections', () => {
        const inventory = [{ name: 'Mango Sapling', stack: 100, quality: [10, 20, 30, 0, 40] }];
        for (const [quality, expectedCount] of [
            ['normal', 10], ['silver', 20], ['gold', 30], ['iridium', 40], ['highest', 40],
        ] as const) {
            Config.getInstance().setQuality(quality);
            for (const compute of [computeCategoryItems, computeCategoryItemsUncached]) {
                const row = compute('Seeds', inventory).find(item => item.name === 'Mango Sapling')!;
                expect(row.correctQualityCount).toBe(expectedCount);
                expect(calculateNeededCount(row)).toBe(999 - expectedCount);
                expect(row.namePercentage).toBeCloseTo(40 / 999 * 100);
            }
        }
    });

    it('shows collected saplings in the name fill while the quality target stays unfinished', () => {
        const rows = computeCategoryItems('Seeds', [
            { name: 'Banana Sapling', stack: 1103, quality: [999, 0, 0, 0, 104] },
        ]).filter(row => row.name === 'Banana Sapling');
        const html = renderToStaticMarkup(createElement(ItemTable, { items: rows }));
        const start = html.indexOf('data-item-name="Banana Sapling"');
        const rowHtml = html.slice(start, html.indexOf('</tr>', start));

        expect(start).toBeGreaterThanOrEqual(0);
        expect(rowHtml).toContain('10%');
        expect(rowHtml).toContain('☐');
        expect(rowHtml).not.toContain('☑');
        expect(rowHtml).toContain('linear-gradient(90deg, rgba(102, 187, 106, 0.28) 0%, rgba(102, 187, 106, 0.28) 100%');
        expect(rowHtml).not.toContain('background-color:#c8e6c9');
    });
});
