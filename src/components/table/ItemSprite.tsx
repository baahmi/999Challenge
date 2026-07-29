import React from 'react';
import { getItemSprite } from '../../data/ItemSprites';
import type { ItemSprite as ItemSpriteData } from '../../data/ItemSprites';

interface ItemSpriteProps {
  name: string;
  itemId?: string;
}

function sheetStyle(sprite: ItemSpriteData, x: number, y: number): React.CSSProperties {
  return {
    backgroundImage: `url(${sprite.src})`,
    backgroundPosition: `-${x * 2}px -${y * 2}px`,
    backgroundSize: `${sprite.sheetWidth * 2}px auto`,
  };
}

// Solid color clipped to the sprite's pixels; multiply blend tints the layers below,
// mirroring how the game tints sprites (texture color x tint color).
function tintStyle(sprite: ItemSpriteData, x: number, y: number, tint: string): React.CSSProperties {
  const maskImage = `url(${sprite.src})`;
  const maskPosition = `-${x * 2}px -${y * 2}px`;
  const maskSize = `${sprite.sheetWidth * 2}px auto`;
  return {
    backgroundColor: tint,
    maskImage,
    maskPosition,
    maskSize,
    maskRepeat: 'no-repeat',
    WebkitMaskImage: maskImage,
    WebkitMaskPosition: maskPosition,
    WebkitMaskSize: maskSize,
    WebkitMaskRepeat: 'no-repeat',
  };
}

function ItemSpriteInner({ name, itemId }: ItemSpriteProps) {
  const sprite = getItemSprite(name, itemId);
  if (!sprite) return <span className="item-sprite item-sprite-empty" aria-hidden="true" />;

  const size: React.CSSProperties = { width: sprite.width * 2, height: sprite.height * 2 };

  if (!sprite.overlay && !sprite.baseTint) {
    return (
      <span
        className="item-sprite"
        aria-hidden="true"
        style={{ ...size, ...sheetStyle(sprite, sprite.x, sprite.y) }}
      />
    );
  }

  return (
    <span className="item-sprite item-sprite-stack" aria-hidden="true" style={size}>
      <span className="item-sprite-layer" style={sheetStyle(sprite, sprite.x, sprite.y)} />
      {sprite.baseTint && (
        <span
          className="item-sprite-layer item-sprite-tint"
          style={tintStyle(sprite, sprite.x, sprite.y, sprite.baseTint)}
        />
      )}
      {sprite.overlay && (
        <>
          <span className="item-sprite-layer" style={sheetStyle(sprite, sprite.overlay.x, sprite.overlay.y)} />
          <span
            className="item-sprite-layer item-sprite-tint"
            style={tintStyle(sprite, sprite.overlay.x, sprite.overlay.y, sprite.overlay.tint)}
          />
        </>
      )}
    </span>
  );
}

export const ItemSprite = React.memo(ItemSpriteInner);
