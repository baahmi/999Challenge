import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Config, type Quality } from '../../config/Config';
import { calculateNeededCount, calculatePercentage } from '../../types/Item';
import { CustomDataStore, type PartsEntry } from '../CustomDataStore';
import { computeCategoryItems, computeCategoryItemsUncached, computeFinishableItems } from '../itemCalculations';

describe('quality mode collection stacks', () => {
    const store = CustomDataStore as any;
    let originalData: unknown;
    let originalParts: unknown;
    let originalTrove: unknown;
    let originalQuality: Quality;
    let originalExemptions: string[];

    function items(entries: Array<[string, string]>, parts: PartsEntry[] = []) {
        store.data = {
            categoryNames: [...new Set(entries.map(([category]) => category))],
            items: entries.map(([category, name]) => ({ category, name, displayName: null })),
        };
        store.partsData = parts;
    }

    beforeEach(() => {
        originalData = store.data;
        originalParts = store.partsData;
        originalTrove = store.troveItems;
        originalQuality = Config.getQuality();
        originalExemptions = Config.getQualityExemptions();
        store.troveItems = [];
        Config.getInstance().setQuality('all');
        Config.getInstance().setQualityExemptions([]);
    });

    afterEach(() => {
        store.data = originalData;
        store.partsData = originalParts;
        store.troveItems = originalTrove;
        Config.getInstance().setQuality(originalQuality);
        Config.getInstance().setQualityExemptions(originalExemptions);
    });

    for (const [label, compute] of [
        ['current', computeCategoryItems],
        ['historical', computeCategoryItemsUncached],
    ] as const) {
        it(`${label}: any accepts a different single quality for each item`, () => {
            Config.getInstance().setQuality('any');
            items([['Animal Products', 'Golden Egg'], ['Seeds', 'Peach Sapling'], ['Flowers', 'Crocus']]);
            const rows = compute('All', [
                { name: 'Golden Egg', stack: 999, quality: [0, 0, 999, 0, 0] },
                { name: 'Peach Sapling', stack: 999, quality: [999, 0, 0, 0, 0] },
                { name: 'Crocus', stack: 999, quality: [0, 0, 0, 0, 999] },
            ]);
            for (const row of rows) {
                expect(row.required).toBe(999);
                expect(calculateNeededCount(row)).toBe(0);
            }
        });

        it(`${label}: any does not combine mixed qualities into a collection stack`, () => {
            Config.getInstance().setQuality('any');
            items([['Seeds', 'Peach Sapling']]);
            const row = compute('Seeds', [
                { name: 'Peach Sapling', stack: 999, quality: [400, 300, 299, 0, 0] },
            ])[0]!;
            expect(row.raw).toBe(999);
            expect(calculateNeededCount(row)).toBe(599);
            expect(calculatePercentage(row)).toBeCloseTo(400 / 999 * 100);
            expect(row.namePercentage).toBeCloseTo(400 / 999 * 100);
        });

        it(`${label}: all requires 999 at every tier and caps surplus separately`, () => {
            items([['Seeds', 'Banana Sapling']]);
            for (const [stacks, needed] of [
                [[3996, 0, 0, 0, 0], 2997],
                [[999, 999, 999, 0, 998], 1],
                [[999, 999, 999, 0, 999], 0],
            ] as const) {
                const row = compute('Seeds', [{ name: 'Banana Sapling', stack: stacks.reduce<number>((sum, n) => sum + n, 0), quality: [...stacks] }])[0]!;
                expect(row.required).toBe(3996);
                expect(calculateNeededCount(row)).toBe(needed);
            }
        });

        it(`${label}: all uses only obtainable quality tiers`, () => {
            items([
                ['Seeds', 'Tea Sapling'], ['Cooking', 'Salad'], ['Fish', 'Snail'],
                ['Wine', 'Wine'], ['Artisan Goods', 'Mayonnaise'], ['Seeds', 'Coffee Bean'],
                ['Vegetables', 'Cauliflower'], ['Forage', 'Coral'], ['Aged Roe', 'Caviar'], ['Vegetables', 'Tea Leaves'],
            ], [['Salad', { '20': ['Leek', 1] }, 1]]);
            const rows = compute('All', []);
            for (const [name, required] of [
                ['Tea Sapling', 999], ['Salad', 1998], ['Snail', 1998], ['Wine', 3996],
                ['Mayonnaise', 3996], ['Coffee Bean', 3996], ['Cauliflower', 3996], ['Coral', 3996], ['Caviar', 999], ['Tea Leaves', 999],
            ] as const) {
                expect(rows.find(row => row.name === name)?.required).toBe(required);
            }
        });

        it(`${label}: recipe counts grow with all output tiers and allow aging lower-quality wine`, () => {
            items([['Fruits', 'Cherry'], ['Wine', 'Cherry Wine']], [['Cherry Wine', { '638': ['Cherry', 1] }, 1]]);
            for (const [wineStacks, neededCherries] of [
                [[3996, 0, 0, 0, 0], 0],
                [[0, 0, 0, 0, 3996], 2997],
            ] as const) {
                const rows = compute('All', [
                    { name: 'Cherry', stack: 3996, quality: [999, 999, 999, 0, 999] },
                    { name: 'Cherry Wine', stack: 3996, quality: [...wineStacks] },
                ]);
                const cherry = rows.find(row => row.name === 'Cherry')!;
                expect(cherry.required).toBe(7992);
                expect(calculateNeededCount(cherry)).toBe(neededCherries);
                expect(calculatePercentage(rows.find(row => row.name === 'Cherry Wine')!)).toBe(25);
            }
        });

        it(`${label}: mixed-quality recipe ingredients can cover extras but not the base stack`, () => {
            Config.getInstance().setQuality('any');
            items([['Fruits', 'Cherry'], ['Wine', 'Cherry Wine']], [['Cherry Wine', { '638': ['Cherry', 1] }, 1]]);
            for (const [stacks, needed] of [
                [[1000, 998, 0, 0, 0], 0],
                [[700, 700, 598, 0, 0], 299],
            ] as const) {
                const cherry = compute('Fruits', [{ name: 'Cherry', stack: 1998, quality: [...stacks] }])[0]!;
                expect(cherry.required).toBe(1998);
                expect(calculateNeededCount(cherry)).toBe(needed);
            }
        });

        it(`${label}: smoked fish requirements and consumption keep their input quality`, () => {
            items([['Fish', 'Carp'], ['Smoked Fish', 'Smoked Carp']], [['Smoked Carp', { '142': ['Carp', 1] }, 1]]);
            const rows = compute('All', [
                { name: 'Carp', stack: 999, quality: [999, 0, 0, 0, 0] },
                { name: 'Smoked Carp', stack: 3996, quality: [3996, 0, 0, 0, 0] },
            ]);
            const carp = rows.find(row => row.name === 'Carp')!;
            expect(carp.required).toBe(7992);
            expect(carp.qualityTargets).toEqual([1998, 1998, 1998, 0, 1998]);
            expect(carp.qualityConsumed).toEqual([999, 0, 0, 0, 0]);
            expect(calculateNeededCount(carp)).toBe(5994);
        });

        it(`${label}: all counts only gold cooking toward Qi Seasoning consumption`, () => {
            items([['Cooking', 'Salad'], ['Forage', 'Leek'], ['Resources', 'Qi Seasoning']], [['Salad', { '20': ['Leek', 1] }, 1]]);
            const rows = compute('All', [
                { name: 'Salad', stack: 1998, quality: [1998, 0, 0, 0, 0] },
                { name: 'Qi Seasoning', stack: 999, quality: [999, 0, 0, 0, 0] },
            ]);
            const seasoning = rows.find(row => row.name === 'Qi Seasoning')!;
            expect(seasoning.required).toBe(1998);
            expect(seasoning.total).toBe(0);
            expect(calculateNeededCount(seasoning)).toBe(999);
            expect(rows.find(row => row.name === 'Leek')?.total).toBe(999);
        });

        it(`${label}: wildcard recipes keep all egg collection stacks reserved`, () => {
            items([['Animal Products', 'Egg'], ['Cooking', 'Fried Egg']], [['Fried Egg', { '-5': [null, 1] }, 1]]);
            const rows = compute('All', [
                { name: 'Egg', stack: 4196, quality: [1199, 999, 999, 0, 999] },
            ]);
            const extra = rows.find(row => row.name === 'Egg: Extra')!;
            expect(extra.required).toBe(1998);
            expect(extra.raw).toBe(200);
            expect(extra.total).toBe(0);
        });

        it(`${label}: egg display variants contribute surplus once each, including Golden Egg`, () => {
            items([['Animal Products', 'Egg'], ['Animal Products', 'Golden Egg'], ['Cooking', 'Fried Egg']],
                [['Fried Egg', { '-5': [null, 1] }, 1]]);
            store.data.items.push(
                { category: 'Animal Products', name: 'Egg', displayName: 'Egg: White' },
                { category: 'Animal Products', name: 'Egg', displayName: 'Egg: Brown' },
            );
            store.data.items.find((item: { name: string }) => item.name === 'Golden Egg').displayName = 'Egg: Golden';
            const rows = compute('All', [
                { name: 'Egg: White', stack: 4196, quality: [1199, 999, 999, 0, 999] },
                { name: 'Egg: Brown', stack: 4296, quality: [1299, 999, 999, 0, 999] },
                { name: 'Golden Egg', stack: 4396, quality: [1399, 999, 999, 0, 999] },
            ]);
            expect(rows.find(row => row.name === 'Egg: Extra')?.raw).toBe(900);
        });

        it(`${label}: quality exemptions still require a stack at one single quality`, () => {
            Config.getInstance().setQuality('highest');
            Config.getInstance().setQualityExemptions(['Wine']);
            items([['Wine', 'Wine']]);
            const row = compute('Wine', [{ name: 'Wine', stack: 999, quality: [500, 499, 0, 0, 0] }])[0]!;
            expect(calculateNeededCount(row)).toBe(499);
        });

        it(`${label}: moving Wine to a custom tab preserves its available quality tiers`, () => {
            items([['My Drinks', 'Wine']]);
            const row = compute('My Drinks', [{ name: 'Wine', stack: 3996, quality: [999, 999, 999, 0, 999] }])[0]!;
            expect(row.required).toBe(3996);
            expect(calculateNeededCount(row)).toBe(0);
        });

        it(`${label}: unavailable selected tiers use the highest obtainable tier below them`, () => {
            Config.getInstance().setQuality('iridium');
            items([['Seeds', 'Tea Sapling'], ['Cooking', 'Salad'], ['Fish', 'Snail']], [['Salad', { '20': ['Leek', 1] }, 1]]);
            const rows = compute('All', [
                { name: 'Tea Sapling', stack: 999, quality: [999, 0, 0, 0, 0] },
                { name: 'Salad', stack: 999, quality: [0, 0, 999, 0, 0] },
                { name: 'Snail', stack: 999, quality: [0, 999, 0, 0, 0] },
            ]);
            for (const name of ['Tea Sapling', 'Salad', 'Snail']) {
                expect(calculateNeededCount(rows.find(row => row.name === name)!)).toBe(0);
            }
        });
    }

    it('does not mark all smoked fish tiers finishable from surplus of only one input quality', () => {
        items([['Fish', 'Carp'], ['Smoked Fish', 'Smoked Carp']], [['Smoked Carp', { '142': ['Carp', 1] }, 1]]);
        const smoked = computeFinishableItems([
            { name: 'Carp', stack: 8000, quality: [8000, 0, 0, 0, 0] },
        ]).find(row => row.name === 'Smoked Carp')!;
        expect(smoked.finishable).toBe(false);
        expect(smoked.producible).toBe(999);
    });

    it('can finish an uncollected any-quality smoked stack from iridium input surplus', () => {
        Config.getInstance().setQuality('any');
        items([['Fish', 'Carp'], ['Smoked Fish', 'Smoked Carp']], [['Smoked Carp', { '142': ['Carp', 1] }, 1]]);
        const smoked = computeFinishableItems([
            { name: 'Carp', stack: 1998, quality: [0, 0, 0, 0, 1998] },
        ]).find(row => row.name === 'Smoked Carp')!;
        expect(smoked.finishable).toBe(true);
        expect(smoked.producible).toBe(999);
    });
});
