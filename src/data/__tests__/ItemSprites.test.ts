import { describe, expect, it } from 'bun:test';
import { getItemSprite } from '../ItemSprites';

describe('ItemSprites', () => {
  it('uses source item sprites for processed item display names', () => {
    expect(getItemSprite('Pickled Pumpkin')).toEqual(getItemSprite('Pumpkin'));
    expect(getItemSprite('Pumpkin Wine')).toEqual(getItemSprite('Pumpkin'));
    expect(getItemSprite('Smoked Anchovy')).toEqual(getItemSprite('Anchovy'));
    expect(getItemSprite('Anchovy Bait')).toEqual(getItemSprite('Anchovy'));
  });

  it('keeps exact sprites for real bait items', () => {
    expect(getItemSprite('Magic Bait')).toEqual(getItemSprite('Magic Bait'));
    expect(getItemSprite('Magic Bait')).not.toEqual(getItemSprite('Magic'));
  });
});
