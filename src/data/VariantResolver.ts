import variantDefinitions from './itemVariants.json' assert { type: 'json' };
import flowerColorNames from './flowerColorNames.json' assert { type: 'json' };

interface ColorRGBA {
  R: number;
  G: number;
  B: number;
  A: number;
}

interface VariantData {
  itemIdNames: Record<string, string>;
  ambiguousItemNames: Record<string, string[]>;
  colorVariantItems: string[];
  nameAliases: Record<string, string>;
}

const data = variantDefinitions as VariantData;
const FLOWER_COLOR_NAMES = flowerColorNames as Record<string, Record<string, string>>;
const COLOR_VARIANT_ITEMS = new Set(data.colorVariantItems);
const AMBIGUOUS_ITEM_NAMES = new Map(
  Object.entries(data.ambiguousItemNames ?? {}).map(([name, ids]) => [name, new Set(ids)])
);
const loggedAmbiguousFallbacks = new Set<string>();

const FLOWER_VARIANT_DISPLAY_NAMES = new Map<string, string>();
const ITEM_ID_VARIANT_BASE_NAMES = new Map<string, string>();

for (const [baseName, variants] of Object.entries(FLOWER_COLOR_NAMES)) {
  for (const displayName of Object.values(variants)) {
    FLOWER_VARIANT_DISPLAY_NAMES.set(displayName, baseName);
  }
}

function inferBaseName(displayName: string): string {
  if (displayName.startsWith('Egg: ') && displayName.endsWith(', Large')) {
    return 'Large Egg';
  }

  const parentheticalMatch = displayName.match(/^(.+?)\s*\([^)]+\)$/);
  if (parentheticalMatch?.[1]) {
    return parentheticalMatch[1];
  }

  const colonMatch = displayName.match(/^(.+?):/);
  if (colonMatch?.[1]) {
    return colonMatch[1];
  }

  const numberedMatch = displayName.match(/^(.+?)\s+\d+$/);
  if (numberedMatch?.[1]) {
    return numberedMatch[1];
  }

  return displayName;
}

for (const displayName of Object.values(data.itemIdNames)) {
  const baseName = inferBaseName(displayName);
  if (displayName !== baseName) {
    ITEM_ID_VARIANT_BASE_NAMES.set(displayName, baseName);
  }
}

function getColorKey(colorData: ColorRGBA): string {
  return `${colorData.R},${colorData.G},${colorData.B}`;
}

function getNamedFlowerVariant(itemName: string, colorData: ColorRGBA): string | undefined {
  return FLOWER_COLOR_NAMES[itemName]?.[getColorKey(colorData)];
}

function getItemIdName(itemName: string, itemId?: string): string | undefined {
  if (!itemId) return undefined;

  return data.itemIdNames[itemId] ?? data.itemIdNames[`(O)${itemId}`];
}

function getAmbiguousFallbackName(itemName: string, itemId?: string): string | undefined {
  if (!itemId) return undefined;

  const ambiguousIds = AMBIGUOUS_ITEM_NAMES.get(itemName);
  if (!ambiguousIds?.has(itemId)) return undefined;

  const displayName = `${itemName} [${itemId}]`;
  const logKey = `${itemName}|${itemId}`;
  if (!loggedAmbiguousFallbacks.has(logKey)) {
    loggedAmbiguousFallbacks.add(logKey);
    console.warn(`Missing item-id display mapping for duplicate save name: ${displayName}`);
  }

  return displayName;
}

function normalizeLegacyItemIdDisplayName(displayName: string): string | undefined {
  const legacyItemIdMatch = displayName.match(/^(.+?)\s+\[((?:\(O\)|\(BC\)|\(M\)).+)\]$/);
  if (!legacyItemIdMatch) return undefined;

  const [, itemName, itemId] = legacyItemIdMatch;
  const explicitItemIdName = data.itemIdNames[itemId];
  if (explicitItemIdName) {
    return explicitItemIdName;
  }

  const ambiguousIds = AMBIGUOUS_ITEM_NAMES.get(itemName);
  if (ambiguousIds?.has(itemId)) {
    return displayName;
  }

  return itemName;
}

/**
 * Resolves item variants from save file data.
 * Handles:
 * - Flower color variants (Blue Jazz, Tulip, etc.)
 * - Item id name variants like Strange Doll
 * - Name aliases (Wild Seeds (Sp) -> Spring Seeds)
 */
export class VariantResolver {
  /**
   * Get the display name for an item, accounting for variants
   * @param itemName Base item name from save file
   * @param itemId Item ID (for itemId-based variants like Strange Doll)
   * @param colorData Color data from save file (for color-based variants)
   */
  static resolveDisplayName(
    itemName: string,
    itemId?: string,
    colorData?: ColorRGBA
  ): string {
    const itemIdName = getItemIdName(itemName, itemId);
    if (itemIdName) {
      return itemIdName;
    }

    const fallbackName = getAmbiguousFallbackName(itemName, itemId);
    if (fallbackName) {
      return fallbackName;
    }

    // Check name aliases after item id mappings, because item id is the save file's
    // most specific identity for non-color variants.
    if (data.nameAliases[itemName]) {
      return data.nameAliases[itemName];
    }
    
    // Handle color-based variants (flowers)
    // Use friendly names for known save colors and fall back to RGB for unseen colors.
    if (COLOR_VARIANT_ITEMS.has(itemName) && colorData) {
      const namedVariant = getNamedFlowerVariant(itemName, colorData);
      if (namedVariant) {
        return namedVariant;
      }
      return `${itemName} (${colorData.R},${colorData.G},${colorData.B})`;
    }
    
    return itemName;
  }
  
  /**
   * Get a unique key for an item including its variant
   * Used for tracking distinct items in inventory
   */
  static getVariantKey(
    itemName: string,
    itemId?: string,
    colorData?: ColorRGBA
  ): string {
    const displayName = this.resolveDisplayName(itemName, itemId, colorData);
    return displayName;
  }
  
  /**
   * Check if an item has variants defined
   */
  static hasVariants(itemName: string): boolean {
    return this.hasColorVariants(itemName) || this.hasItemIdVariants(itemName);
  }
  
  /**
   * Check if an item has color variants (returns true for flowers with color data)
   */
  static hasColorVariants(itemName: string): boolean {
    return COLOR_VARIANT_ITEMS.has(itemName);
  }

  static hasItemIdVariants(itemName: string): boolean {
    return [...ITEM_ID_VARIANT_BASE_NAMES.values()].includes(itemName) || AMBIGUOUS_ITEM_NAMES.has(itemName);
  }
  
  /**
   * Get base item name from a variant display name
   * E.g., "Blue Jazz (Bright Blue)" -> "Blue Jazz"
   * E.g., "Blue Jazz (35,127,255)" -> "Blue Jazz"
   * E.g., "Strange Doll (Green)" -> "Strange Doll"
   */
  static getBaseName(displayName: string): string {
    const mappedFlowerBaseName = FLOWER_VARIANT_DISPLAY_NAMES.get(displayName);
    if (mappedFlowerBaseName) {
      return mappedFlowerBaseName;
    }

    // Check for RGB notation pattern: "Name (R,G,B)"
    const rgbMatch = displayName.match(/^(.+?)\s*\(\d+,\d+,\d+\)$/);
    if (rgbMatch && rgbMatch[1]) {
      return rgbMatch[1];
    }
    
    // Check for (Cart) suffix: "Name (Cart)"
    const cartMatch = displayName.match(/^(.+?)\s*\(Cart\)$/);
    if (cartMatch && cartMatch[1]) {
      return cartMatch[1];
    }
    
    // Check for Extra suffix: "Name Extra"
    const extraMatch = displayName.match(/^(.+?)\s+Extra$/);
    if (extraMatch && extraMatch[1]) {
      return extraMatch[1];
    }

    const ambiguousIdMatch = displayName.match(/^(.+?)\s+\[\((?:O|BC)\).+\]$/);
    if (ambiguousIdMatch && ambiguousIdMatch[1]) {
      return ambiguousIdMatch[1];
    }
    
    const itemIdVariantBaseName = ITEM_ID_VARIANT_BASE_NAMES.get(displayName);
    if (itemIdVariantBaseName) {
      return itemIdVariantBaseName;
    }
    
    // Check aliases
    for (const [alias, canonical] of Object.entries(data.nameAliases)) {
      if (displayName === canonical) {
        return alias;
      }
    }
    
    return displayName;
  }
  
  /**
   * Apply name aliases to normalize item names
   */
  static applyAlias(name: string): string {
    return data.nameAliases[name] || name;
  }

  /**
   * Normalize legacy stored variant names to the current display naming.
   * E.g., "Blue Jazz (109,131,255)" -> "Blue Jazz (Periwinkle)"
   */
  static normalizeDisplayName(displayName: string): string {
    const normalizedLegacyItemIdName = normalizeLegacyItemIdDisplayName(displayName);
    if (normalizedLegacyItemIdName) {
      return normalizedLegacyItemIdName;
    }

    const rgbMatch = displayName.match(/^(.+?)\s*\((\d+),(\d+),(\d+)\)$/);
    if (!rgbMatch) {
      return displayName;
    }

    const [, itemName, r, g, b] = rgbMatch;
    const namedVariant = getNamedFlowerVariant(itemName, {
      R: Number(r),
      G: Number(g),
      B: Number(b),
      A: 255
    });

    return namedVariant ?? displayName;
  }
  
  /**
   * Get the raw variant data for initialization
   */
  static getVariantData() {
    return data;
  }
}
