import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TooltipPanel } from '../../components/table/ItemTable';
import { Config, type Quality } from '../../config/Config';
import { calculateNeededCount } from '../../types/Item';
import { CustomDataStore, type PartsEntry } from '../CustomDataStore';
import { computeCategoryItems, computeCategoryItemsUncached, computeFinishableItems, __test } from '../itemCalculations';
import bundledParts from '../parts.json';

describe('coal for processing recipes', () => {
    const store = CustomDataStore as any;
    let originalData: unknown;
    let originalParts: unknown;
    let originalTrove: unknown;
    let originalQuality: Quality;
    let originalExemptions: string[];
    let originalCoalConsumers: string[] | undefined;

    function fixture(entries: Array<[string, string]>, recipes: string[]) {
        store.data = {
            categoryNames: [...new Set(entries.map(([category]) => category))],
            items: entries.map(([category, name]) => ({ category, name, displayName: null })),
        };
        const parts = (bundledParts as PartsEntry[]).filter(([name]) => recipes.includes(name));
        store.partsData = parts;
        __test.reverseMap.set('Coal', parts.filter(([, ingredients]) => Object.values(ingredients)
            .some(([name]) => name === 'Coal')).map(([name]) => name));
    }

    beforeEach(() => {
        originalData = store.data;
        originalParts = store.partsData;
        originalTrove = store.troveItems;
        originalQuality = Config.getQuality();
        originalExemptions = Config.getQualityExemptions();
        originalCoalConsumers = __test.reverseMap.get('Coal');
        store.troveItems = [];
        Config.getInstance().setQuality('highest');
        Config.getInstance().setQualityExemptions([]);
    });

    afterEach(() => {
        store.data = originalData;
        store.partsData = originalParts;
        store.troveItems = originalTrove;
        if (originalCoalConsumers) __test.reverseMap.set('Coal', originalCoalConsumers);
        else __test.reverseMap.delete('Coal');
        Config.getInstance().setQuality(originalQuality);
        Config.getInstance().setQualityExemptions(originalExemptions);
    });

    for (const [label, compute] of [
        ['current', computeCategoryItems],
        ['historical', computeCategoryItemsUncached],
    ] as const) {
        it(`${label}: counts smoker and furnace fuel under every quality setting`, () => {
            fixture([
                ['Resources', 'Coal'], ['Resources', 'Iron Bar'], ['Resources', 'Refined Quartz'],
                ['Gifts/Rewards', 'Wilted Bouquet'], ['Smoked Fish', 'Smoked Carp'], ['Smoked Fish', 'Smoked Snail'],
            ], ['Iron Bar', 'Refined Quartz', 'Wilted Bouquet', 'Smoked Carp', 'Smoked Snail']);
            const inventory = [
                { name: 'Smoked Carp', stack: 100, quality: [0, 0, 0, 0, 100] },
                { name: 'Smoked Snail', stack: 50, quality: [0, 50, 0, 0, 0] },
                { name: 'Iron Bar', stack: 30, quality: [30, 0, 0, 0, 0] },
                { name: 'Refined Quartz', stack: 35, quality: [35, 0, 0, 0, 0] },
                { name: 'Wilted Bouquet', stack: 10, quality: [10, 0, 0, 0, 0] },
            ];
            for (const [quality, required, consumed] of [
                ['highest', 5166, 196], ['any', 5166, 196], ['all', 9162, 196],
                ['normal', 5166, 46], ['silver', 5166, 96], ['gold', 5166, 96], ['iridium', 5166, 196],
            ] as const) {
                Config.getInstance().setQuality(quality);
                const coal = compute('Resources', inventory).find(row => row.name === 'Coal')!;
                expect(coal.required).toBe(required);
                expect(coal.total).toBe(consumed);
                expect(coal.requiredStrict).toBe(0);
                expect(calculateNeededCount(coal)).toBe(required - consumed);
            }
        });

        it(`${label}: propagates smelting fuel through bars already used in crafted items`, () => {
            fixture([['Resources', 'Coal'], ['Resources', 'Iron Bar'], ['Machines', 'Bee House']], ['Iron Bar', 'Bee House']);
            const coal = compute('Resources', [
                { name: 'Bee House', stack: 500, quality: [500, 0, 0, 0, 0] },
            ]).find(row => row.name === 'Coal')!;
            expect(coal.required).toBe(10989);
            expect(coal.total).toBe(4500);
            expect(calculateNeededCount(coal)).toBe(6489);
        });
    }

    it('groups smoked fish in the coal tooltip and caps craftability by the shared fuel pool', () => {
        fixture([
            ['Resources', 'Coal'], ['Resources', 'Iron Bar'], ['Fish', 'Carp'], ['Fish', 'Snail'],
            ['Smoked Fish', 'Smoked Carp'], ['Smoked Fish', 'Smoked Snail'],
        ], ['Iron Bar', 'Smoked Carp', 'Smoked Snail']);
        const coal = computeCategoryItems('Resources', [
            { name: 'Coal', stack: 10, quality: [10, 0, 0, 0, 0] },
            { name: 'Carp', stack: 100, quality: [0, 0, 0, 0, 100] },
            { name: 'Snail', stack: 100, quality: [0, 100, 0, 0, 0] },
        ]).find(row => row.name === 'Coal')!;
        const smoking = coal.tooltip.usedBy.find(use => use.craftedName === 'Smoked Fish')!;
        expect(smoking).toBeDefined();
        expect(smoking.groupedRecipes).toBe(2);
        expect(smoking.craftableCount).toBe(10);
        expect(smoking.done).toBe(false);
        expect(smoking.recipe).toEqual([{ name: 'Coal', qty: 1, available: 10, done: false, neededForTarget: 1998 }]);
        expect(coal.tooltip.usedBy.map(use => use.craftedName)).toEqual(['Iron Bar', 'Smoked Fish']);
        const html = renderToStaticMarkup(createElement(TooltipPanel, { name: 'Coal', data: coal.tooltip }));
        expect(html).toContain('Smoked Fish (2 types)');
        expect(html).toContain('Iron Bar');
        expect(html).not.toContain('Smoked Carp');
        expect(html).not.toContain('Smoked Snail');
    });

    it('keeps the smoking group unfinished when all-quality stacks are missing', () => {
        Config.getInstance().setQuality('all');
        fixture([['Resources', 'Coal'], ['Smoked Fish', 'Smoked Carp'], ['Smoked Fish', 'Smoked Snail']], ['Smoked Carp', 'Smoked Snail']);
        const coal = computeCategoryItems('Resources', [
            { name: 'Smoked Carp', stack: 3996, quality: [3996, 0, 0, 0, 0] },
            { name: 'Smoked Snail', stack: 1998, quality: [1998, 0, 0, 0, 0] },
        ]).find(row => row.name === 'Coal')!;
        const smoking = coal.tooltip.usedBy.find(use => use.craftedName === 'Smoked Fish')!;
        expect(smoking.done).toBe(false);
        expect(smoking.recipe[0]?.neededForTarget).toBe(3996);
        expect(coal.total).toBe(1998);
    });

    it('marks the smoking group complete only after every fish target is complete', () => {
        fixture([['Resources', 'Coal'], ['Smoked Fish', 'Smoked Carp'], ['Smoked Fish', 'Smoked Snail']], ['Smoked Carp', 'Smoked Snail']);
        const coal = computeCategoryItems('Resources', [
            { name: 'Smoked Carp', stack: 999, quality: [0, 0, 0, 0, 999] },
            { name: 'Smoked Snail', stack: 999, quality: [0, 999, 0, 0, 0] },
        ]).find(row => row.name === 'Coal')!;
        const smoking = coal.tooltip.usedBy.find(use => use.craftedName === 'Smoked Fish')!;
        expect(smoking.done).toBe(true);
        expect(smoking.recipe[0]?.neededForTarget).toBe(0);
        expect(calculateNeededCount(coal)).toBe(999);
    });

    it('requires fuel to finish smoking and shares that fuel between all output qualities', () => {
        Config.getInstance().setQuality('all');
        fixture([['Resources', 'Coal'], ['Fish', 'Carp'], ['Smoked Fish', 'Smoked Carp']], ['Smoked Carp']);
        const fish = { name: 'Carp', stack: 7992, quality: [1998, 1998, 1998, 0, 1998] };
        const withoutFuel = computeFinishableItems([fish]).find(row => row.name === 'Smoked Carp')!;
        expect(withoutFuel.producible).toBe(0);
        expect(withoutFuel.limiting).toBe('Coal');
        const withFuel = computeFinishableItems([fish, { name: 'Coal', stack: 1998, quality: [1998, 0, 0, 0, 0] }])
            .find(row => row.name === 'Smoked Carp')!;
        expect(withFuel.producible).toBe(999);
        expect(withFuel.finishable).toBe(false);
    });
});
