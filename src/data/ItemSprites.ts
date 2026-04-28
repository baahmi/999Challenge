import itemSpriteData from './itemSprites.json' assert { type: 'json' };
import springObjectsSheet from '../assets/stardew/springobjects.png';
import objectsSheet from '../assets/stardew/Objects_2.png';
import craftablesSheet from '../assets/stardew/Craftables.png';
import mannequinsSheet from '../assets/stardew/Mannequins.png';

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
  const pickledMatch = itemName.match(/^Pickled (.+)$/);
  if (pickledMatch?.[1]) return pickledMatch[1];

  const smokedMatch = itemName.match(/^Smoked (.+)$/);
  if (smokedMatch?.[1]) return smokedMatch[1];

  const suffixMatch = itemName.match(/^(.+) (?:Wine|Jelly|Juice|Bait)$/);
  if (suffixMatch?.[1]) return suffixMatch[1];

  return undefined;
}

export function getItemSprite(itemName: string): ItemSprite | undefined {
  const fallbackItemId = itemName.match(/\[((?:\(O\)|\(BC\))[^\]]+)\]$/)?.[1];
  const directItemId = fallbackItemId ?? getItemIdByName(itemName);
  const sourceName = directItemId ? undefined : getProcessedSourceName(itemName);
  const itemId = directItemId ?? (sourceName ? getItemIdByName(sourceName) : undefined);
  return getSpriteByItemId(itemId);
}
