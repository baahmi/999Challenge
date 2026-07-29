import { describe, expect, it } from 'bun:test';
import { getItemSprite } from '../ItemSprites';

describe('ItemSprites', () => {
  it('uses source item sprites for processed item display names', () => {
    expect(getItemSprite('Pickled Pumpkin')).toEqual(getItemSprite('Pumpkin'));
    expect(getItemSprite('Pumpkin Wine')).toEqual(getItemSprite('Pumpkin'));
    expect(getItemSprite('Anchovy Bait')).toEqual(getItemSprite('Anchovy'));
  });

  it('tints smoked fish with the game smoke color over the source fish sprite', () => {
    expect(getItemSprite('Smoked Anchovy')).toEqual({
      ...getItemSprite('Anchovy')!,
      baseTint: 'rgb(150, 120, 108)',
    });
    expect(getItemSprite('Pickled Pumpkin')?.baseTint).toBeUndefined();
  });

  it('resolves smoked fish whose names end in s without de-pluralizing', () => {
    expect(getItemSprite('Smoked Octopus')).toEqual({
      ...getItemSprite('Octopus')!,
      baseTint: 'rgb(150, 120, 108)',
    });
    expect(getItemSprite('Smoked Blue Discus')).toEqual({
      ...getItemSprite('Blue Discus')!,
      baseTint: 'rgb(150, 120, 108)',
    });
    expect(getItemSprite('Smoked Largemouth Bass')).toEqual({
      ...getItemSprite('Largemouth Bass')!,
      baseTint: 'rgb(150, 120, 108)',
    });
    // The plural sources for dried fruit keep working
    expect(getItemSprite('Dried Cherries')).toEqual(getItemSprite('Cherry'));
  });

  it('resolves flower color variants to the base sprite with a tinted overlay', () => {
    const base = getItemSprite('Summer Spangle')!;
    const fuchsia = getItemSprite('Summer Spangle (Fuchsia)')!;

    expect(fuchsia).toEqual({
      ...base,
      overlay: { x: base.x + 16, y: base.y, tint: 'rgb(255, 0, 238)' },
    });

    // RGB fallback names for save colors without a friendly name
    expect(getItemSprite('Tulip (255,80,0)')?.overlay?.tint).toBe('rgb(255, 80, 0)');
  });

  it('resolves Cart and Extra flower rows to the plain base sprite', () => {
    expect(getItemSprite('Blue Jazz (Cart)')).toEqual(getItemSprite('Blue Jazz'));
    expect(getItemSprite('Blue Jazz Extra')).toEqual(getItemSprite('Blue Jazz'));
  });

  it('falls back to the save item id for ambiguous names', () => {
    // "Chicken Statue" exists as artifact and statue, so it has no name mapping
    expect(getItemSprite('Chicken Statue')).toBeUndefined();
    expect(getItemSprite('Chicken Statue', '(O)113')).toBeDefined();
    expect(getItemSprite('Bait', '(O)685')).toBeDefined();
  });

  it('gives any-ingredient Extra rows a representative sprite', () => {
    expect(getItemSprite('Egg: Extra')).toEqual(getItemSprite('Egg: White'));
    expect(getItemSprite('Milk: Extra')).toEqual(getItemSprite('Milk'));
    expect(getItemSprite('Fish: Extra')).toEqual(getItemSprite('Sardine'));
  });

  it('keeps exact sprites for real bait items', () => {
    expect(getItemSprite('Magic Bait')).toEqual(getItemSprite('Magic Bait'));
    expect(getItemSprite('Magic Bait')).not.toEqual(getItemSprite('Magic'));
  });

  it('resolves sprites for seeded item-id variant display names', () => {
    expect(getItemSprite('Rotten Plant 1')).toBeDefined();
    expect(getItemSprite('Rotten Plant 2')).toBeDefined();
  });

  it('uses the real craftable sprite for Campfire', () => {
    expect(getItemSprite('Campfire')).toBeDefined();
  });
});
