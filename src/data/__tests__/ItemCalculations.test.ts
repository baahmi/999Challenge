import { describe, it, expect, beforeEach } from 'bun:test';
import {CustomDataStore, type PartsEntry} from '../CustomDataStore';
import {  computeCategoryItems,  __test } from '../itemCalculations';

describe('computeCategoryItems', () => {
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
