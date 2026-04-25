import { describe, it, expect, beforeEach } from 'bun:test';
import {CustomDataStore, type PartsEntry} from '../CustomDataStore';
import {  computeCategoryItems,  __test } from '../itemCalculations';
import { calculateNeededCount, calculatePercentage } from '../../types/Item';

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
        expect(calculateNeededCount(dish)).toBe(999);
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

    it('shows wildcard ingredients in the crafted item recipe tooltip', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Animal Products', 'Cooking']
        CustomDataStore.data.items = [
            { category: 'Animal Products', name: 'Egg', displayName: null },
            { category: 'Cooking', name: 'Chocolate Cake', displayName: null },
            { category: 'Cooking', name: 'Wheat Flour', displayName: null },
            { category: 'Cooking', name: 'Sugar', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Chocolate Cake", {
                "246": ["Wheat Flour", 1],
                "245": ["Sugar", 1],
                "-5": [null, 1],
            }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Cooking', [
            { name: 'Egg', stack: 1500, category: 'Animal Products', quality: [0,0,0,0,1500] },
            { name: 'Wheat Flour', stack: 200, category: 'Cooking', quality: [200,0,0,0,0] },
            { name: 'Sugar', stack: 200, category: 'Cooking', quality: [200,0,0,0,0] },
        ]);
        const cake = rows.find(row => row.name === 'Chocolate Cake')!;

        expect(cake.tooltip.recipe).toContainEqual({
            name: 'Egg: Extra',
            qty: 1,
            available: 501,
            done: true,
        });
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

    it('does not count wrong-quality flower variants toward highest quality progress', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Flowers']
        CustomDataStore.data.items = [
            { category: 'Flowers', name: 'Summer Spangle', displayName: null },
            { category: 'Flowers', name: 'Summer Spangle', displayName: 'Summer Spangle (Fuchsia)' },
        ];
        CustomDataStore.partsData = [] as PartsEntry[]

        const rows = computeCategoryItems('Flowers', [
            { name: 'Summer Spangle (Fuchsia)', stack: 8, category: 'Flowers', quality: [0,1,4,3,0] },
        ]);
        const flower = rows.find(item => item.name === 'Summer Spangle (Fuchsia)')!;

        expect(flower.correctQualityCount).toBe(0);
        expect(calculatePercentage(flower)).toBe(0);
        expect(calculateNeededCount(flower)).toBe(999);
    });

    it('requires iridium forage quality in highest mode', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Forage']
        CustomDataStore.data.items = [
            { category: 'Forage', name: 'Daffodil', displayName: null },
        ];
        CustomDataStore.partsData = [] as PartsEntry[]

        const rows = computeCategoryItems('Forage', [
            { name: 'Daffodil', stack: 1183, category: 'Forage', quality: [342,0,0,0,841] },
        ]);
        const daffodil = rows.find(item => item.name === 'Daffodil')!;

        expect(daffodil.correctQualityCount).toBe(841);
        expect(daffodil.hasWrongQuality).toBe(false);
        expect(calculatePercentage(daffodil)).toBeCloseTo((841 / 999) * 100, 5);
        expect(calculateNeededCount(daffodil)).toBe(158);
    });

    it('does not require quality for forage items that cannot have it', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Forage']
        CustomDataStore.data.items = [
            { category: 'Forage', name: 'Cave Carrot', displayName: null },
            { category: 'Forage', name: 'Ginger', displayName: null },
        ];
        CustomDataStore.partsData = [] as PartsEntry[]

        const rows = computeCategoryItems('Forage', [
            { name: 'Cave Carrot', stack: 500, category: 'Forage', quality: [500,0,0,0,0] },
            { name: 'Ginger', stack: 700, category: 'Forage', quality: [700,0,0,0,0] },
        ]);

        const caveCarrot = rows.find(item => item.name === 'Cave Carrot')!;
        expect(caveCarrot.correctQualityCount).toBeUndefined();
        expect(calculatePercentage(caveCarrot)).toBeCloseTo((500 / 999) * 100, 5);

        const ginger = rows.find(item => item.name === 'Ginger')!;
        expect(ginger.correctQualityCount).toBeUndefined();
        expect(calculatePercentage(ginger)).toBeCloseTo((700 / 999) * 100, 5);
    });

    it('requires iridium fruit quality in highest mode', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Fruits', 'Jelly', 'Wine', 'Dried Fruit']
        CustomDataStore.data.items = [
            { category: 'Fruits', name: 'Cherry', displayName: null },
            { category: 'Jelly', name: 'Cherry Jelly', displayName: null },
            { category: 'Wine', name: 'Cherry Wine', displayName: null },
            { category: 'Dried Fruit', name: 'Dried Cherries', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Cherry Jelly", { "638": ["Cherry", 1] }, 1],
            ["Cherry Wine", { "638": ["Cherry", 1] }, 1],
            ["Dried Cherries", { "638": ["Cherry", 5] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Fruits', [
            { name: 'Cherry', stack: 1506, category: 'Fruits', quality: [0,0,507,0,999] },
            { name: 'Cherry Jelly', stack: 1002, category: 'Jelly', quality: [1002,0,0,0,0] },
            { name: 'Cherry Wine', stack: 999, category: 'Wine', quality: [0,0,0,0,999] },
            { name: 'Dried Cherries', stack: 1020, category: 'Dried Fruit', quality: [1020,0,0,0,0] },
        ]);
        const cherry = rows.find(item => item.name === 'Cherry')!;

        expect(cherry.required).toBe(7992);
        expect(cherry.correctQualityCount).toBe(999);
        expect(calculatePercentage(cherry)).toBe(100);
        expect(calculateNeededCount(cherry)).toBe(0);
    });

    it('counts normal-quality ageable artisan goods toward ingredient consumption', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Fruits', 'Jelly', 'Wine', 'Dried Fruit']
        CustomDataStore.data.items = [
            { category: 'Fruits', name: 'Cherry', displayName: null },
            { category: 'Jelly', name: 'Cherry Jelly', displayName: null },
            { category: 'Wine', name: 'Cherry Wine', displayName: null },
            { category: 'Dried Fruit', name: 'Dried Cherries', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Cherry Jelly", { "638": ["Cherry", 1] }, 1],
            ["Cherry Wine", { "638": ["Cherry", 1] }, 1],
            ["Dried Cherries", { "638": ["Cherry", 5] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Fruits', [
            { name: 'Cherry', stack: 1506, category: 'Fruits', quality: [0,0,507,0,999] },
            { name: 'Cherry Jelly', stack: 1002, category: 'Jelly', quality: [1002,0,0,0,0] },
            { name: 'Cherry Wine', stack: 999, category: 'Wine', quality: [999,0,0,0,0] },
            { name: 'Dried Cherries', stack: 1020, category: 'Dried Fruit', quality: [1020,0,0,0,0] },
        ]);
        const cherry = rows.find(item => item.name === 'Cherry')!;
        const wine = computeCategoryItems('Wine', [
            { name: 'Cherry', stack: 1506, category: 'Fruits', quality: [0,0,507,0,999] },
            { name: 'Cherry Jelly', stack: 1002, category: 'Jelly', quality: [1002,0,0,0,0] },
            { name: 'Cherry Wine', stack: 999, category: 'Wine', quality: [999,0,0,0,0] },
            { name: 'Dried Cherries', stack: 1020, category: 'Dried Fruit', quality: [1020,0,0,0,0] },
        ]).find(item => item.name === 'Cherry Wine')!;

        expect(cherry.total).toBe(6993);
        expect(calculatePercentage(cherry)).toBe(100);
        expect(calculateNeededCount(cherry)).toBe(0);
        expect(wine.correctQualityCount).toBe(0);
        expect(calculatePercentage(wine)).toBe(0);
        expect(wine.hasWrongQuality).toBe(true);
    });

    it('marks wine with a complete non-iridium stack as wrong quality in highest mode', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Wine']
        CustomDataStore.data.items = [
            { category: 'Wine', name: 'Ancient Fruit Wine', displayName: null },
        ];
        CustomDataStore.partsData = [] as PartsEntry[]

        const rows = computeCategoryItems('Wine', [
            { name: 'Ancient Fruit Wine', stack: 999, category: 'Wine', quality: [999,0,0,0,0] },
        ]);
        const wine = rows.find(item => item.name === 'Ancient Fruit Wine')!;

        expect(wine.correctQualityCount).toBe(0);
        expect(wine.hasWrongQuality).toBe(true);
        expect(calculatePercentage(wine)).toBe(0);
        expect(calculateNeededCount(wine)).toBe(999);
    });

    it('requires iridium input fish in smoked fish recipe tooltips', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Fish', 'Smoked Fish']
        CustomDataStore.data.items = [
            { category: 'Fish', name: 'Mussel', displayName: null },
            { category: 'Smoked Fish', name: 'Smoked Mussel', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Smoked Mussel", { "719": ["Mussel", 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('All', [
            { name: 'Mussel', stack: 7000, category: 'Fish', quality: [7000,0,0,0,0] },
            { name: 'Smoked Mussel', stack: 999, category: 'Smoked Fish', quality: [999,0,0,0,0] },
        ]);
        const smoked = rows.find(item => item.name === 'Smoked Mussel')!;
        const musselIngredient = smoked.tooltip.recipe?.find(ing => ing.name === 'Mussel');
        const mussel = rows.find(item => item.name === 'Mussel')!;
        const usedInSmoked = mussel.tooltip.usedBy.find(dep => dep.craftedName === 'Smoked Mussel')!;

        expect(mussel.correctQualityCount).toBe(0);
        expect(calculateNeededCount(mussel)).toBe(1998);
        expect(smoked.correctQualityCount).toBe(0);
        expect(smoked.hasWrongQuality).toBe(true);
        expect(musselIngredient).toEqual({ name: 'Mussel', qty: 1, available: 0, done: false });
        expect(usedInSmoked.recipe.find(ing => ing.name === 'Mussel')).toEqual({ name: 'Mussel', qty: 1, available: 0, done: false });
        expect(usedInSmoked.craftableCount).toBe(0);
    });

    it('uses silver as the highest quality for smoked crabpot-only fish', () => {
        CustomDataStore.troveItems = ['Missing Artifact']
        CustomDataStore.data.categoryNames = ['Fish', 'Smoked Fish']
        CustomDataStore.data.items = [
            { category: 'Fish', name: 'Snail', displayName: null },
            { category: 'Smoked Fish', name: 'Smoked Snail', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Smoked Snail", { "721": ["Snail", 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('All', [
            { name: 'Snail', stack: 999, category: 'Fish', quality: [0,999,0,0,0] },
            { name: 'Smoked Snail', stack: 999, category: 'Smoked Fish', quality: [0,999,0,0,0] },
        ]);
        const smoked = rows.find(item => item.name === 'Smoked Snail')!;
        const snailIngredient = smoked.tooltip.recipe?.find(ing => ing.name === 'Snail');

        expect(smoked.correctQualityCount).toBe(999);
        expect(smoked.hasWrongQuality).toBe(false);
        expect(calculatePercentage(smoked)).toBe(100);
        expect(snailIngredient).toEqual({ name: 'Snail', qty: 1, available: 999, done: true });
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
