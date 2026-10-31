import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Config } from '../../config/Config';
import type { Quality } from '../../config/Config';
import { calculateNeededCount, calculatePercentage } from '../../types/Item';
import { CustomDataStore } from '../CustomDataStore';
import { computeCategoryItems, computeCategoryItemsUncached } from '../itemCalculations';

describe('flower collection and crafting progress', () => {
    const store = CustomDataStore as any;
    let originalData: unknown;
    let originalParts: unknown;
    let originalTrove: unknown;
    let originalQuality: Quality;
    let originalExemptions: string[];

    beforeEach(() => {
        originalData = store.data;
        originalParts = store.partsData;
        originalTrove = store.troveItems;
        originalQuality = Config.getQuality();
        originalExemptions = Config.getQualityExemptions();
        Config.getInstance().setQuality('highest');
        Config.getInstance().setQualityExemptions([]);
        store.data = {
            categoryNames: ['Flowers', 'Consumables'],
            items: [
                { category: 'Flowers', name: 'Fairy Rose', displayName: null },
                { category: 'Flowers', name: 'Fairy Rose', displayName: 'Fairy Rose (Coral Pink)' },
                { category: 'Flowers', name: 'Fairy Rose', displayName: 'Fairy Rose (Violet)' },
                { category: 'Consumables', name: 'Fairy Dust', displayName: null },
            ],
        };
        store.partsData = [['Fairy Dust', { '595': ['Fairy Rose', 1] }, 1]];
        store.troveItems = [];
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
        it(`${label}: credits completed Fairy Dust only to Extra, not to flower colors or Cart`, () => {
            const rows = compute('Flowers', [
                { name: 'Fairy Rose', stack: 37, quality: [37, 0, 0, 0, 0] },
                { name: 'Fairy Rose (Coral Pink)', stack: 169, quality: [0, 102, 67, 0, 0] },
                { name: 'Fairy Dust', stack: 1701, quality: [1701, 0, 0, 0, 0] },
            ]);

            const cart = rows.find(row => row.name === 'Fairy Rose (Cart)')!;
            expect(cart.required).toBe(999);
            expect(cart.total).toBe(0);
            expect(cart.correctQualityCount).toBe(37);
            expect(calculatePercentage(cart)).toBeCloseTo(37 / 999 * 100);
            expect(calculateNeededCount(cart)).toBe(962);
            for (const name of ['Fairy Rose (Coral Pink)', 'Fairy Rose (Violet)']) {
                const flower = rows.find(row => row.name === name)!;
                expect(flower.required).toBe(999);
                expect(flower.total).toBe(0);
                expect(flower.correctQualityCount).toBe(0);
                expect(calculatePercentage(flower)).toBe(0);
                expect(calculateNeededCount(flower)).toBe(999);
            }
            const extra = rows.find(row => row.name === 'Fairy Rose Extra')!;
            expect(extra.required).toBe(999);
            expect(extra.total).toBe(999);
            expect(extra.raw).toBe(169);
            expect(calculatePercentage(extra)).toBe(100);
            expect(extra.excludeFromTotals).toBe(true);
        });

        it(`${label}: reserves the selected quality separately for each color and Cart`, () => {
            const rows = compute('Flowers', [
                { name: 'Fairy Rose', stack: 50, quality: [50, 0, 0, 0, 0] },
                { name: 'Fairy Rose (Coral Pink)', stack: 1300, quality: [100, 0, 0, 0, 1200] },
                { name: 'Fairy Rose (Violet)', stack: 150, quality: [50, 0, 0, 0, 100] },
            ]);

            expect(calculatePercentage(rows.find(row => row.name === 'Fairy Rose (Coral Pink)')!)).toBe(100);
            const violet = rows.find(row => row.name === 'Fairy Rose (Violet)')!;
            expect(calculateNeededCount(violet)).toBe(899);
            const cart = rows.find(row => row.name === 'Fairy Rose (Cart)')!;
            expect(cart.correctQualityCount).toBe(50);
            expect(calculateNeededCount(cart)).toBe(949);
            const extra = rows.find(row => row.name === 'Fairy Rose Extra')!;
            expect(extra.raw).toBe(351);
            expect(calculateNeededCount(extra)).toBe(648);
            expect(rows.reduce((sum, row) => sum + (row.excludeFromTotals ? 0 : row.raw), 0)).toBe(1500);
        });

        for (const quality of ['highest', 'any', 'normal', 'silver', 'gold', 'iridium', 'all'] as const) {
            it(`${label}: counts normal Cart flowers in ${quality} mode`, () => {
                Config.getInstance().setQuality(quality);
                const flowers = [
                    ['Blue Jazz', 37],
                    ['Tulip', 500],
                    ['Summer Spangle', 998],
                    ['Fairy Rose', 1200],
                    ['Poppy', 999],
                ] as const;
                store.data.items = flowers.map(([name]) => ({ category: 'Flowers', name, displayName: null }));
                const rows = compute('Flowers', flowers.map(([name, stack]) => ({
                    name, stack, quality: [stack, 0, 0, 0, 0],
                })));
                for (const [name, stack] of flowers) {
                    const cart = rows.find(row => row.name === `${name} (Cart)`)!;
                    expect(cart.raw).toBe(stack);
                    expect(cart.required).toBe(999);
                    expect(cart.total).toBe(0);
                    expect(cart.qualityTiers).toEqual([0]);
                    expect(cart.correctQualityCount).toBe(stack);
                    expect(cart.hasWrongQuality).toBe(false);
                    expect(calculatePercentage(cart)).toBeCloseTo(Math.min(100, stack / 999 * 100));
                    expect(calculateNeededCount(cart)).toBe(Math.max(0, 999 - stack));
                }
                expect(rows.find(row => row.name === 'Fairy Rose Extra')?.raw).toBe(201);
            });
        }

        it(`${label}: only offers Cart surplus to Fairy Dust recipes`, () => {
            const rows = compute('All', [
                { name: 'Fairy Rose', stack: 1200, quality: [1200, 0, 0, 0, 0] },
                { name: 'Fairy Rose (Coral Pink)', stack: 999, quality: [0, 0, 0, 0, 999] },
                { name: 'Diamond', stack: 201, quality: [201, 0, 0, 0, 0] },
            ]);
            expect(rows.find(row => row.name === 'Fairy Rose Extra')?.raw).toBe(201);
            if (label === 'current') {
                const dust = rows.find(row => row.name === 'Fairy Dust')!;
                expect(dust.tooltip.craftableCount).toBe(201);
                expect(dust.tooltip.recipe?.find(part => part.name === 'Fairy Rose')?.available).toBe(201);
            }
        });

        it(`${label}: keeps crafting progress separate when quality selection changes`, () => {
            const inventory = [
                { name: 'Fairy Rose (Coral Pink)', stack: 1510, quality: [1000, 200, 300, 0, 10] },
                { name: 'Fairy Dust', stack: 500, quality: [500, 0, 0, 0, 0] },
            ];
            for (const [quality, expectedNeeded, expectedExtra] of [
                ['highest', 989, 1500],
                ['any', 0, 511],
                ['all', 2487, 1],
                ['normal', 0, 511],
                ['silver', 799, 1310],
                ['gold', 699, 1210],
                ['iridium', 989, 1500],
            ] as const) {
                Config.getInstance().setQuality(quality);
                const rows = compute('Flowers', inventory);
                expect(calculateNeededCount(rows.find(row => row.name === 'Fairy Rose (Coral Pink)')!)).toBe(expectedNeeded);
                expect(rows.find(row => row.name === 'Fairy Rose Extra')?.raw).toBe(expectedExtra);
            }
        });

        it(`${label}: respects a Flowers quality exemption`, () => {
            Config.getInstance().setQualityExemptions(['Flowers']);
            const rows = compute('Flowers', [
                { name: 'Fairy Rose (Coral Pink)', stack: 1200, quality: [1200, 0, 0, 0, 0] },
            ]);
            const flower = rows.find(row => row.name === 'Fairy Rose (Coral Pink)')!;
            expect(calculatePercentage(flower)).toBe(100);
            expect(flower.correctQualityCount).toBeUndefined();
            expect(rows.find(row => row.name === 'Fairy Rose Extra')?.raw).toBe(201);
        });
    }
});
