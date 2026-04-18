import variantDefinitions from './itemVariants.json' assert { type: 'json' };

interface ColorRGBA {
  R: number;
  G: number;
  B: number;
  A: number;
}

interface VariantDefinition {
  baseItemId: string;
  variantType: 'color' | 'itemId';
  variants?: Array<{
    itemId?: string;
    displayName: string;
    color?: string;
    colorRGBA?: ColorRGBA;
    distinguisher?: string;
  }>;
}

interface VariantData {
  variantDefinitions: Record<string, VariantDefinition>;
  nameAliases: Record<string, string>;
}

const data = variantDefinitions as VariantData;

/**
 * Resolves item variants from save file data.
 * Handles:
 * - Flower color variants (Blue Jazz, Tulip, etc.)
 * - Strange Doll variants (Green vs Yellow)
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
    // Check name aliases first
    if (data.nameAliases[itemName]) {
      return data.nameAliases[itemName];
    }
    
    const variantDef = data.variantDefinitions[itemName];
    
    // Handle itemId-based variants (Strange Doll)
    if (variantDef && variantDef.variantType === 'itemId' && itemId && variantDef.variants) {
      const variant = variantDef.variants.find(v => v.itemId === itemId);
      if (variant) {
        return variant.displayName;
      }
    }
    
    // Handle color-based variants (flowers)
    // If item has color data AND is defined as having color variants, use RGB notation
    if (variantDef && variantDef.variantType === 'color' && colorData) {
      // Always use RGB notation for dynamic tracking
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
    return itemName in data.variantDefinitions;
  }
  
  /**
   * Check if an item has color variants (returns true for flowers with color data)
   */
  static hasColorVariants(itemName: string): boolean {
    const variantDef = data.variantDefinitions[itemName];
    return variantDef?.variantType === 'color';
  }
  
  /**
   * Get base item name from a variant display name
   * E.g., "Blue Jazz (35,127,255)" -> "Blue Jazz"
   * E.g., "Strange Doll (Green)" -> "Strange Doll"
   */
  static getBaseName(displayName: string): string {
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
    
    // Check if it's a Strange Doll variant
    for (const [baseName, variantDef] of Object.entries(data.variantDefinitions)) {
      if (variantDef.variantType === 'itemId' && variantDef.variants) {
        for (const variant of variantDef.variants) {
          if (variant.displayName === displayName) {
            return baseName;
          }
        }
      }
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
   * Get the raw variant data for initialization
   */
  static getVariantData() {
    return data;
  }
}
