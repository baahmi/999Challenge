import { describe, it, expect, beforeEach } from 'bun:test';
import {
    computeCategoryItems,
    hasTooltipContent,
    logDataIssues,
    __test
} from '../itemCalculations';

// Short aliases for readability
const {
    craftableCount,
    computeTooltipData,
    isWildcard,
    getCookingItems,
    getCrabpotItems,
    avgYieldOf,
    recipeMap,
    reverseMap,
    yieldMap,
    priceMap,
    shopEntriesMap
} = __test;

// ---------------------------------------------
// Helpers: build simple inventory + completion maps
// ---------------------------------------------
function inv(items: Record<string, number>) {
    return new Map(Object.entries(items));
}

function completion(items: Record<string, boolean>) {
    return new Map(Object.entries(items));
}

// ------------------------------------------------
// Internal function tests
// ------------------------------------------------
describe('internal helpers', () => {
    it('isWildcard correctly detects negative IDs and null names', () => {
        expect(isWildcard('5', 'Stone')).toBe(false);
        expect(isWildcard('-2', 'Stone')).toBe(true);
        expect(isWildcard('10', null)).toBe(true);
    });

    it('avgYieldOf handles numbers and ranges', () => {
        expect(avgYieldOf(undefined)).toBe(1);
        expect(avgYieldOf(3)).toBe(3);
        expect(avgYieldOf([2, 6])).toBe(4);
    });

    it('craftableCount works for simple recipes', () => {
        // Use a real recipe from recipeMap if available
        const sample = [...recipeMap.entries()][0];
        expect(sample).toBeDefined();

        const [craftedName, recipe] = sample!;
        const ingredientName = [...recipe.keys()][0];
        const ingredientQty = recipe.get(ingredientName)!;

        const inventory = inv({ [ingredientName]: ingredientQty * 3 });
        const { count, limiting } = craftableCount(craftedName, inventory);

        expect(count).toBe(3);
        expect(limiting).toBe(ingredientName);
    });

    it('computeTooltipData includes recipe and usedBy', () => {
        const sample = [...recipeMap.keys()][0];
        const inventory = inv({});
        const done = completion({});

        const tooltip = computeTooltipData(sample, inventory, done);

        expect(tooltip).toBeDefined();
        expect(Array.isArray(tooltip.usedBy)).toBe(true);
        expect('craftableCount' in tooltip).toBe(true);
    });
});

// ------------------------------------------------
// Public API tests
// ------------------------------------------------
describe('hasTooltipContent', () => {
    it('returns true when tooltip has note or recipe or usedBy or shops', () => {
        const t1 = {
            note: ['a'],
            recipe: null,
            craftableCount: 0,
            limitingIngredient: null,
            done: false,
            usedBy: [],
            shops: []
        };
        expect(hasTooltipContent(t1)).toBe(true);

        const t2 = {
            note: null,
            recipe: null,
            craftableCount: 0,
            limitingIngredient: null,
            done: false,
            usedBy: [],
            shops: []
        };
        expect(hasTooltipContent(t2)).toBe(false);
    });
});

// ------------------------------------------------
// computeCategoryItems tests
// ------------------------------------------------
describe('computeCategoryItems', () => {
    it('returns rows sorted alphabetically', () => {
        const compacted = [
            { name: 'ItemB', stack: 2 },
            { name: 'ItemA', stack: 5 }
        ];

        const rows = computeCategoryItems('All', compacted);

        expect(rows.length).toBeGreaterThan(0);
        const names = rows.map(r => r.name);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
    });

    it('includes tooltip data for each row', () => {
        const rows = computeCategoryItems('All', [{ name: 'Fiber', stack: 10 }]);
        expect(rows[0].tooltip).toBeDefined();
        expect(typeof rows[0].tooltip).toBe('object');
    });
});

// ------------------------------------------------
// logDataIssues tests
// ------------------------------------------------
describe('logDataIssues', () => {
    it('does not crash and logs info for unknown items', () => {
        const spy = spyOn(console, 'info');
        logDataIssues([{ name: 'TotallyUnknownItem123', stack: 3 }]);
        expect(spy).toHaveBeenCalled();
    });
});