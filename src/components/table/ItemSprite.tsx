import React from 'react';
import { getItemSprite } from '../../data/ItemSprites';

interface ItemSpriteProps {
  name: string;
}

function ItemSpriteInner({ name }: ItemSpriteProps) {
  const sprite = getItemSprite(name);
  if (!sprite) return <span className="item-sprite item-sprite-empty" aria-hidden="true" />;

  return (
    <span
      className="item-sprite"
      aria-hidden="true"
      style={{
        width: sprite.width * 2,
        height: sprite.height * 2,
        backgroundImage: `url(${sprite.src})`,
        backgroundPosition: `-${sprite.x * 2}px -${sprite.y * 2}px`,
        backgroundSize: `${sprite.sheetWidth * 2}px auto`,
      }}
    />
  );
}

export const ItemSprite = React.memo(ItemSpriteInner);
