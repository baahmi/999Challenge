import { describe, it, expect, beforeEach } from 'bun:test';
import {CustomDataStore, type PartsEntry} from '../CustomDataStore';
import {  computeCategoryItems,  __test } from '../itemCalculations';
import { calculatePercentage } from '../../types/Item';

describe('computeCategoryItems', () => {
    it('propagates required counts through dependencies even when parts data is unordered', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Test']
        CustomDataStore.data.items = [
            { category: 'Test', name: 'Parent', displayName: null },
            { category: 'Test', name: 'Middle', displayName: null },
            { category: 'Test', name: 'Raw', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Middle", { "1": ["Raw", 1] }, 1],
            ["Parent", { "2": ["Middle", 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Test', []);

        expect(rows.find(row => row.name === 'Parent')?.required).toBe(999);
        expect(rows.find(row => row.name === 'Middle')?.required).toBe(1998);
        expect(rows.find(row => row.name === 'Raw')?.required).toBe(2997);
    });

    it('caps ingredient totals from surplus crafted items at the required challenge amount', () => {
        const compacted = [
            { name: 'Crafted', stack: 10000, category: 'Test', quality: [10000,0,0,0,0] },
        ];
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Test']
        CustomDataStore.data.items = [
            { category: 'Test', name: 'Crafted', displayName: null },
            { category: 'Test', name: 'Raw', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Crafted", { "1": ["Raw", 99] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Test', compacted);

        expect(rows.find(row => row.name === 'Crafted')?.raw).toBe(10000);
        expect(rows.find(row => row.name === 'Raw')?.total).toBe(98901);
    });

    it('uses the correct quality tier for cooking percentage before wrong-quality highlighting starts', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Cooking']
        CustomDataStore.data.items = [
            { category: 'Cooking', name: 'Salad', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Salad", { "20": ["Leek", 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Cooking', [
            { name: 'Salad', stack: 500, category: 'Cooking', quality: [500,0,0,0,0] },
        ]);
        const dish = rows.find(row => row.name === 'Salad')!;

        expect(dish.hasWrongQuality).toBe(false);
        expect(dish.correctQualityCount).toBe(0);
        expect(calculatePercentage(dish)).toBe(0);
    });

    it('does not require cooking ingredient or intermediate cooking items to use cooking quality', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Cooking']
        CustomDataStore.data.items = [
            { category: 'Cooking', name: 'Oil', displayName: null },
            { category: 'Cooking', name: 'Fried Egg', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Fried Egg", { "1": ["Oil", 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Cooking', [
            { name: 'Oil', stack: 500, category: 'Cooking', quality: [500,0,0,0,0] },
            { name: 'Fried Egg', stack: 500, category: 'Cooking', quality: [500,0,0,0,0] },
        ]);
        const oil = rows.find(row => row.name === 'Oil')!;
        const dish = rows.find(row => row.name === 'Fried Egg')!;

        expect(oil.correctQualityCount).toBeUndefined();
        expect(calculatePercentage(oil)).toBeGreaterThan(0);
        expect(dish.correctQualityCount).toBeUndefined();
        expect(calculatePercentage(dish)).toBeGreaterThan(0);
    });

    it('only counts correct-quality cooked dishes as having consumed their ingredients', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Cooking']
        CustomDataStore.data.items = [
            { category: 'Cooking', name: 'Tortilla', displayName: null },
            { category: 'Cooking', name: 'Lucky Lunch', displayName: null },
            { category: 'Cooking', name: 'Fish Taco', displayName: null },
            { category: 'Resources', name: 'Qi Seasoning', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Lucky Lunch", { "229": ["Tortilla", 1] }, 1],
            ["Fish Taco", { "229": ["Tortilla", 1] }, 1],
            ["Tortilla", { "270": ["Corn", 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('All', [
            { name: 'Tortilla', stack: 1, category: 'Cooking', quality: [1,0,0,0,0] },
            { name: 'Lucky Lunch', stack: 100, category: 'Cooking', quality: [90,0,10,0,0] },
            { name: 'Fish Taco', stack: 100, category: 'Cooking', quality: [80,0,20,0,0] },
        ]);

        expect(rows.find(row => row.name === 'Tortilla')?.correctQualityCount).toBeUndefined();
        expect(rows.find(row => row.name === 'Tortilla')?.total).toBe(30);
        expect(rows.find(row => row.name === 'Qi Seasoning')?.total).toBe(30);
    });

    it('routes wildcard egg requirements to Egg: Extra using only completed egg surplus', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Animal Products', 'Cooking']
        CustomDataStore.data.items = [
            { category: 'Animal Products', name: 'Egg', displayName: null },
            { category: 'Animal Products', name: 'Duck Egg', displayName: null },
            { category: 'Cooking', name: 'Fried Egg', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Fried Egg", { "-5": [null, 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Animal Products', [
            { name: 'Egg', stack: 1200, category: 'Animal Products', quality: [0,0,0,0,1200] },
            { name: 'Duck Egg', stack: 900, category: 'Animal Products', quality: [0,0,0,0,900] },
        ]);
        const extra = rows.find(row => row.name === 'Egg: Extra')!;

        expect(extra.required).toBe(999);
        expect(extra.raw).toBe(201);
        expect(extra.hasUnfinishedDependents).toBe(false);
        expect(extra.excludeFromTotals).toBe(true);
        expect(extra.tooltip.usedBy.map(dep => dep.craftedName)).toContain('Fried Egg');
        expect(extra.tooltip.usedBy.find(dep => dep.craftedName === 'Fried Egg')?.recipe).toEqual([
            { name: 'Egg: Extra', qty: 1, available: 201, done: true },
        ]);
    });

    it('does not count normal animal products toward highest quality progress', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Animal Products']
        CustomDataStore.data.items = [
            { category: 'Animal Products', name: 'Milk', displayName: null },
            { category: 'Animal Products', name: 'Goat Milk', displayName: null },
            { category: 'Animal Products', name: 'Egg', displayName: null },
        ];
        CustomDataStore.partsData = [] as PartsEntry[]

        const rows = computeCategoryItems('Animal Products', [
            { name: 'Milk', stack: 220, category: 'Animal Products', quality: [220,0,0,0,0] },
            { name: 'Goat Milk', stack: 180, category: 'Animal Products', quality: [180,0,0,0,0] },
            { name: 'Egg', stack: 1200, category: 'Animal Products', quality: [1200,0,0,0,0] },
        ]);

        for (const name of ['Milk', 'Goat Milk', 'Egg']) {
            const row = rows.find(item => item.name === name)!;
            expect(row.correctQualityCount).toBe(0);
            expect(calculatePercentage(row)).toBe(0);
        }
    });

    it('uses any-quality egg surplus for Egg: Extra after the egg row is complete', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Animal Products', 'Cooking']
        CustomDataStore.data.items = [
            { category: 'Animal Products', name: 'Egg', displayName: null },
            { category: 'Cooking', name: 'Fried Egg', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Fried Egg", { "-5": [null, 1] }, 1],
        ] as PartsEntry[]

        const normalRows = computeCategoryItems('Animal Products', [
            { name: 'Egg', stack: 2500, category: 'Animal Products', quality: [2500,0,0,0,0] },
        ]);
        expect(normalRows.find(row => row.name === 'Egg: Extra')?.raw).toBe(0);

        const iridiumRows = computeCategoryItems('Animal Products', [
            { name: 'Egg', stack: 2500, category: 'Animal Products', quality: [0,0,0,0,2500] },
        ]);
        expect(iridiumRows.find(row => row.name === 'Egg: Extra')?.raw).toBe(1501);

        const mixedRows = computeCategoryItems('Animal Products', [
            { name: 'Egg', stack: 1099, category: 'Animal Products', quality: [100,0,0,0,999] },
        ]);
        expect(mixedRows.find(row => row.name === 'Egg: Extra')?.raw).toBe(100);
    });

    it('marks completed wildcard extra rows yellow while their recipes are not crafted', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Animal Products', 'Cooking']
        CustomDataStore.data.items = [
            { category: 'Animal Products', name: 'Egg', displayName: null },
            { category: 'Cooking', name: 'Fried Egg', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Fried Egg", { "-5": [null, 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Animal Products', [
            { name: 'Egg', stack: 2500, category: 'Animal Products', quality: [0,0,0,0,2500] },
        ]);
        const extra = rows.find(row => row.name === 'Egg: Extra')!;

        expect(extra.raw + extra.total).toBeGreaterThanOrEqual(extra.required);
        expect(extra.total).toBeLessThan(extra.required);
        expect(extra.hasUnfinishedDependents).toBe(true);
    });

    it('returns rows sorted alphabetically', () => {
        const compacted = [
            { name: 'Void Salmon', stack: 999, category: 'Fish', quality: [0,0,0,0,999] },
            { name: 'Smoked Void Salmon', category: 'Smoked Fish', stack: 999, quality: [0,0,0,0,999] },
            { name: 'Void Salmon Bait', category: 'Bait', stack: 160, quality: [160,0,0,0,0] },
            { name: 'Omni Geode', category: "Geodes", stack: 3792, quality: [3792,0,0,0,0] },
            { name: 'Artifact Trove', category: "Geodes", stack: 1025, quality: [1025,0,0,0,0] },
            { name: 'Chipped Amphora', category: "Artifacts", stack: 815, quality: [815,0,0,0,0] },
        ];
        CustomDataStore.troveItems = ['Chipped Amphora']
        CustomDataStore.data.categoryNames = ['Geodes', 'Fish', 'Smoked Fish', 'Bait', 'Artifacts']
        CustomDataStore.data.items = compacted.map( (item) =>
            ({category: item.category, name: item.name, displayName: null})
        );
        CustomDataStore.partsData = [
            ["Void Salmon Bait",  {"795": ["Void Salmon",1] },[5,10]],
            ["Smoked Void Salmon",{"795": ["Void Salmon",1] },1],
            ["Artifact Trove",    {"749": ["Omni Geode", 5] },1]
        ] as PartsEntry[]

        const artifactRows = computeCategoryItems('Artifacts', compacted);
        const geodeRows = computeCategoryItems('Geodes', compacted);
        const fishRows = computeCategoryItems('Fish', compacted);
        const smokedFishRows = computeCategoryItems('Smoked Fish', compacted);
        const baitRows = computeCategoryItems('Bait', compacted);

        console.log(fishRows);
        // console.log(baitRows);
        // console.log(smokedFishRows);

        // expect(rows.length).toBeGreaterThan(0);
        // const names = rows.map(r => r.name);
        // const sorted = [...names].sort();
        // expect(names).toEqual(sorted);
    });
});
