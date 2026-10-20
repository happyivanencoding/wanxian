import { ITEMS } from '../game/data.ts';
import { PixelSprite } from './PixelArt.tsx';

/** Art follows the existing item catalogue; it never implies another equipment slot. */
export default function GameItemIcon({ id, size = 46, className = '' }: { id: string; size?: number; className?: string }) {
  const item = ITEMS.find(entry => entry.id === id);
  const name = id === 'herb' ? 'herb' : id === 'jade' ? 'jade' : item?.kind === 'pill' ? 'pill'
    : item?.kind === 'book' ? 'book' : /sword|blade|frost/.test(id) ? 'sword'
    : /robe|coat|cloak/.test(id) ? 'robe' : /gourd|satchel/.test(id) ? 'gourd'
    : /ledger|contract/.test(id) ? 'scroll' : /compass/.test(id) ? 'map'
    : /lamp|lantern/.test(id) ? 'home' : /seal|array|talisman/.test(id) ? 'array' : 'jade';
  return <PixelSprite name={name} size={size} className={className}/>;
}
