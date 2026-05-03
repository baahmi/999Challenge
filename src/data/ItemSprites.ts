import itemSpriteData from './itemSprites.json' assert { type: 'json' };
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
}

const data = itemSpriteData as SpriteData;
const spriteCache = new Map<string, ItemSprite | undefined>();

function getSheetSrc(sheet: SpriteSheet): string {
  if (sheet === 'mannequins') return mannequinsSheet;
  if (sheet === 'craftables') return craftablesSheet;
  if (sheet === 'objects2') return objectsSheet;
  return springObjectsSheet;
}

function getSpriteByItemId(itemId: string | undefined): ItemSprite | undefined {
  if (!itemId) return undefined;

  const definition = data.itemIds[itemId];
  if (!definition || !Number.isFinite(definition.spriteIndex)) return undefined;

  const columns = definition.columns ?? (definition.sheet === 'springobjects' ? 24 : 8);
  const x = (definition.spriteIndex % columns) * definition.width;
  const y = Math.floor(definition.spriteIndex / columns) * definition.height;
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

function getItemIdByName(itemName: string): string | undefined {
  return data.byDisplayName[itemName] ?? data.byName[itemName];
}

function getProcessedSourceName(itemName: string): string | undefined {
  const prefixedMatch = itemName.match(/^(?:Pickled|Smoked|Dried) (.+)$/);
  if (prefixedMatch?.[1]) {
    let result = prefixedMatch[1];
    if (result.endsWith("ies")) {
      result = result.substring(0, result.length - 3);
      result+='y';
    } else if(result === "Peaches") {
      result = "Peach";
    } else if(result.endsWith("s")) {
      result = result.substring(0, result.length - 1);
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

export function getItemSprite(itemName: string): ItemSprite | undefined {
  if (spriteCache.has(itemName)) {
    return spriteCache.get(itemName);
  }

  const fallbackItemId = itemName.match(/\[((?:\(O\)|\(BC\))[^\]]+)\]$/)?.[1];
  const directItemId = fallbackItemId ?? getItemIdByName(itemName);
  const sourceName = directItemId ? undefined : getProcessedSourceName(itemName);
  const itemId = directItemId ?? (sourceName ? getItemIdByName(sourceName) : undefined);
  const result = getSpriteByItemId(itemId);
  spriteCache.set(itemName, result);
  return result;
}
