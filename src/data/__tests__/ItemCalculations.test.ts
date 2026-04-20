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
            { category: 'Cooking', name: 'Fried Egg', displayName: null },
        ];
        CustomDataStore.partsData = [
            ["Fried Egg", { "-5": [null, 1] }, 1],
        ] as PartsEntry[]

        const rows = computeCategoryItems('Cooking', [
            { name: 'Fried Egg', stack: 500, category: 'Cooking', quality: [500,0,0,0,0] },
        ]);
        const dish = rows.find(row => row.name === 'Fried Egg')!;

        expect(dish.hasWrongQuality).toBe(false);
        expect(dish.correctQualityCount).toBe(0);
        expect(calculatePercentage(dish)).toBe(0);
    });

    it('does not require cooking ingredient items to use cooking quality', () => {
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
        expect(dish.correctQualityCount).toBe(0);
        expect(calculatePercentage(dish)).toBe(0);
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
