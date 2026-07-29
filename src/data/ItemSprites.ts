import itemSpriteData from './itemSprites.json' assert { type: 'json' };
import { VariantResolver } from './VariantResolver';
import springObjectsSheet from '../assets/stardew/springobjects.png';
import objectsSheet from '../assets/stardew/Objects_2.png';
import craftablesSheet from '../assets/stardew/Craftables.png';
import mannequinsSheet from '../assets/stardew/Mannequins.png';
import {getListItemSecondaryActionClassesUtilityClass} from "@mui/material";

type SpriteSheet = 'springobjects' | 'objects2' | 'craftables' | 'mannequins';

interface SpriteDefinition {
  sheet: SpriteSheet;
  spriteIndex: number;
  width: number;
  height: number;
  columns?: number;
}

interface SpriteData {
  itemIds: Record<string, SpriteDefinition>;
  byName: Record<string, string>;
  byDisplayName: Record<string, string>;
}

export interface ItemSprite {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sheetWidth: number;
  // Flower color variants: the game draws spriteIndex + 1 tinted with the variant color
  overlay?: { x: number; y: number; tint: string };
  // Smoked fish: the game redraws the fish sprite with Color(80,30,10) * 0.6 on top,
  // which nets out to multiplying the sprite by this color
  baseTint?: string;
}

const SMOKED_FISH_TINT = 'rgb(150, 120, 108)';

// Synthetic any-ingredient rows get a representative item's sprite
const EXTRA_ROW_SOURCES: Record<string, string> = {
  'Egg: Extra': 'Egg: White',
  'Milk: Extra': 'Milk',
  'Fish: Extra': 'Sardine',
};

const data = itemSpriteData as SpriteData;
const spriteCache = new Map<string, ItemSprite | undefined>();

function getSheetSrc(sheet: SpriteSheet): string {
  if (sheet === 'mannequins') return mannequinsSheet;
  if (sheet === 'craftables') return craftablesSheet;
  if (sheet === 'objects2') return objectsSheet;
  return springObjectsSheet;
}

function getSpriteCoords(definition: SpriteDefinition, spriteIndex: number): { x: number; y: number } {
  const columns = definition.columns ?? (definition.sheet === 'springobjects' ? 24 : 8);
  return {
    x: (spriteIndex % columns) * definition.width,
    y: Math.floor(spriteIndex / columns) * definition.height,
  };
}

function getSpriteByItemId(itemId: string | undefined): ItemSprite | undefined {
  if (!itemId) return undefined;

  const definition = data.itemIds[itemId];
  if (!definition || !Number.isFinite(definition.spriteIndex)) return undefined;

  const columns = definition.columns ?? (definition.sheet === 'springobjects' ? 24 : 8);
  const { x, y } = getSpriteCoords(definition, definition.spriteIndex);
  const sheetWidth = columns * definition.width;

  return {
    src: getSheetSrc(definition.sheet),
    x,
    y,
    width: definition.width,
    height: definition.height,
    sheetWidth,
  };
}

// Flower color variants ("Summer Spangle (Fuchsia)", "Tulip (255,80,0)", "(Cart)", "Extra"):
// resolve the base flower sprite; for colored variants add the game's tinted overlay
// (spriteIndex + 1), matching ColoredObject.drawInMenu.
function getFlowerVariantSprite(itemName: string): ItemSprite | undefined {
  const baseName = VariantResolver.getBaseName(itemName);
  if (baseName === itemName || !VariantResolver.hasColorVariants(baseName)) return undefined;

  const itemId = getItemIdByName(baseName);
  const definition = itemId ? data.itemIds[itemId] : undefined;
  const baseSprite = getSpriteByItemId(itemId);
  if (!definition || !baseSprite) return undefined;

  const color = VariantResolver.getFlowerColor(itemName);
  if (!color) return baseSprite;

  return {
    ...baseSprite,
    overlay: {
      ...getSpriteCoords(definition, definition.spriteIndex + 1),
      tint: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
    },
  };
}

function getItemIdByName(itemName: string): string | undefined {
  return data.byDisplayName[itemName] ?? data.byName[itemName];
}

function getProcessedSourceName(itemName: string): string | undefined {
  const prefixedMatch = itemName.match(/^(?:Pickled|Smoked|Dried) (.+)$/);
  if (prefixedMatch?.[1]) {
    let result = prefixedMatch[1];
    // If the source name exists as-is, use it — de-pluralizing would break
    // names that just happen to end in "s" (Octopus, Blue Discus, Largemouth Bass)
    if (getItemIdByName(result)) return result;
    if (result !== "Cranberries") {
      if (result.endsWith("ies")) {
        result = result.substring(0, result.length - 3);
        result += 'y';
      } else if (result === "Peaches") {
        result = "Peach";
      } else if (result.endsWith("s")) {
        result = result.substring(0, result.length - 1);
      }
    }
    return result;
  }

  const agedRoeMatch = itemName.match(/^Aged (.+) Roe$/);
  if (agedRoeMatch?.[1]) return agedRoeMatch[1];

  if(itemName.startsWith("Honey")) return "Honey";

  const suffixMatch = itemName.match(/^(.+) (?:Wine|Jelly|Juice|Bait|Roe)$/);
  if (suffixMatch?.[1]) return suffixMatch[1];

  return undefined;
}

export function getItemSprite(itemName: string, saveItemId?: string): ItemSprite | undefined {
  const cacheKey = saveItemId ? `${itemName}|${saveItemId}` : itemName;
  if (spriteCache.has(cacheKey)) {
    return spriteCache.get(cacheKey);
  }

  const lookupName = EXTRA_ROW_SOURCES[itemName] ?? itemName;
  const fallbackItemId = lookupName.match(/\[((?:\(O\)|\(BC\))[^\]]+)\]$/)?.[1];
  const directItemId = fallbackItemId ?? getItemIdByName(lookupName);
  const sourceName = directItemId ? undefined : getProcessedSourceName(lookupName);
  const itemId = directItemId ?? (sourceName ? getItemIdByName(sourceName) : undefined);
  let result = getSpriteByItemId(itemId);

  if (!result && !directItemId) {
    result = getFlowerVariantSprite(lookupName);
  }

  // Ambiguous names (e.g. "Chicken Statue" artifact vs statue) have no name mapping,
  // but the save file's item id pinpoints the sprite
  if (!result && saveItemId) {
    result = getSpriteByItemId(saveItemId);
  }

  // Smoked fish resolved from their source fish sprite get the game's dark smoke tint
  if (result && !directItemId && sourceName && lookupName.startsWith('Smoked ')) {
    result = { ...result, baseTint: SMOKED_FISH_TINT };
  }

  spriteCache.set(cacheKey, result);
  return result;
}
