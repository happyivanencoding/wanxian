import type { CSSProperties } from 'react';
import './PixelArt.css';

export type PixelSpriteName = 'sword' | 'robe' | 'jade' | 'gourd' | 'herb' | 'pill' | 'book' | 'stones' | 'home' | 'sect' | 'furnace' | 'scroll' | 'map' | 'letter' | 'coins' | 'array';

const spriteNames: PixelSpriteName[] = [
  'sword', 'robe', 'jade', 'gourd',
  'herb', 'pill', 'book', 'stones',
  'home', 'sect', 'furnace', 'scroll',
  'map', 'letter', 'coins', 'array',
];

const spriteAliases: Record<string, PixelSpriteName> = {
  mountain: 'sect', compass: 'map', flask: 'furnace', leaf: 'herb', bag: 'coins',
  shield: 'robe', spark: 'array', people: 'letter', clock: 'scroll',
  heal: 'pill', calm: 'pill', foundation: 'pill', breakpill: 'pill', longevity: 'pill',
  talisman: 'jade', library: 'book', garden: 'herb', mat: 'gourd',
};

/** A decorative icon from the local, sixteen-cell pixel inventory atlas. */
export function PixelSprite({ name, className = '', size = 40 }: { name: PixelSpriteName | string; className?: string; size?: number }) {
  const selected = spriteAliases[name] || name;
  const index = Math.max(0, spriteNames.indexOf(selected as PixelSpriteName));
  const style: CSSProperties = {
    width: size, height: size,
    backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%`,
  };
  return <span className={`pixel-sprite pixel-sprite-${selected} ${className}`} style={style} aria-hidden="true"/>;
}

/** Shared landscape art. Its height follows the caller's container. */
export function PixelScene({ className = '', region = 'qinglan', compact = false }: { className?: string; region?: string; compact?: boolean }) {
  return <div className={`pixel-scene pixel-scene-${region} ${compact ? 'pixel-scene-compact' : ''} ${className}`} aria-hidden="true"><img src={`${import.meta.env.BASE_URL}art/pixel-scene.png`} alt="" draggable={false}/></div>;
}

/** Eight portraits share a fixed four-column, two-row local atlas. */
export function PixelPortrait({ name = '', index, gender, departed = false, className = '' }: { name?: string; index?: number; gender?: string; departed?: boolean; className?: string }) {
  const identity = index ?? Array.from(name).reduce((total, letter) => total + letter.charCodeAt(0), 0);
  // New lives start young; reserve the elderly portrait for an explicitly chosen actor.
  const selected = index !== undefined ? identity % 8 : gender === '女修' ? 4 + identity % 3 : gender === '男修' ? identity % 4 : identity % 7;
  const style: CSSProperties = { backgroundPosition: `${(selected % 4) * 100 / 3}% ${Math.floor(selected / 4) * 100}%` };
  return <div className={`portrait pixel-portrait ${departed ? 'departed' : ''} ${className}`} aria-hidden="true"><div className="pixel-portrait-face" style={style}/></div>;
}
