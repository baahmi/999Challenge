import { describe, expect, it } from 'bun:test';
import { VariantResolver } from '../VariantResolver';

describe('VariantResolver flower colors', () => {
  it('uses item id names before base names or aliases', () => {
    expect(VariantResolver.resolveDisplayName('Strange Doll', '(O)126')).toBe('Strange Doll (Green)');
    expect(VariantResolver.resolveDisplayName('Strange Doll', '(O)127')).toBe('Strange Doll (Pink)');
    expect(VariantResolver.resolveDisplayName('Strange Doll', '126')).toBe('Strange Doll (Green)');
    expect(VariantResolver.resolveDisplayName('Rarecrow', '(BC)126')).toBe('Rarecrow: 3');
    expect(VariantResolver.resolveDisplayName('Large Egg', '(O)174')).toBe('Egg: White, Large');
    expect(VariantResolver.getBaseName('Strange Doll (Green)')).toBe('Strange Doll');
    expect(VariantResolver.getBaseName('Egg: White, Large')).toBe('Large Egg');
    expect(VariantResolver.hasItemIdVariants('Strange Doll')).toBe(true);
  });

  it('uses readable names for known flower colors from the save file', () => {
    expect(
      VariantResolver.resolveDisplayName('Blue Jazz', '597', { R: 109, G: 131, B: 255, A: 255 })
    ).toBe('Blue Jazz (Periwinkle)');

    expect(
      VariantResolver.resolveDisplayName('Fairy Rose', '595', { R: 255, G: 127, B: 144, A: 255 })
    ).toBe('Fairy Rose (Coral Pink)');

    expect(
      VariantResolver.resolveDisplayName('Poppy', '376', { R: 255, G: 170, B: 0, A: 255 })
    ).toBe('Poppy (Orange)');
  });

  it('falls back to RGB names for unmapped flower colors', () => {
    expect(
      VariantResolver.resolveDisplayName('Blue Jazz', '597', { R: 1, G: 2, B: 3, A: 255 })
    ).toBe('Blue Jazz (1,2,3)');
  });

  it('extracts the base name from readable flower variants', () => {
    expect(VariantResolver.getBaseName('Summer Spangle (Fuchsia)')).toBe('Summer Spangle');
    expect(VariantResolver.getBaseName('Tulip (Rose Pink)')).toBe('Tulip');
    expect(VariantResolver.getBaseName('Blue Jazz (35,127,255)')).toBe('Blue Jazz');
    expect(VariantResolver.getBaseName('Blue Jazz (Cart)')).toBe('Blue Jazz');
  });

  it('normalizes legacy RGB flower names to readable names', () => {
    expect(VariantResolver.normalizeDisplayName('Blue Jazz (109,131,255)')).toBe('Blue Jazz (Periwinkle)');
    expect(VariantResolver.normalizeDisplayName('Poppy (255,170,0)')).toBe('Poppy (Orange)');
    expect(VariantResolver.normalizeDisplayName('Blue Jazz (1,2,3)')).toBe('Blue Jazz (1,2,3)');
  });
});
