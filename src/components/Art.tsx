import type { ReactNode } from 'react';
import { PixelPortrait, PixelScene } from './PixelArt.tsx';

// Integer-coordinate silhouettes keep the small controls crisp alongside the art.
const paths: Record<string, string> = {
  mountain: 'M1 13h2V9h2V5h2V2h2v3h2v4h2v4h2v2H1Zm6-6v3H5v3h6v-3H9V7Z',
  compass: 'M5 1h6v2h3v3h1v5h-2v3h-3v1H5v-2H2v-3H1V5h2V2h2Zm1 2v1H4v2H3v4h1v2h2v1h4v-1h2v-2h1V6h-1V4h-2V3Zm4 2h2v2h-1v2H9v2H7v1H5v-2h1V8h2V6h2Z',
  sword: 'M11 1h4v4h-2v2h-2v2H9v2H7v2H5v2H2v-3h2v-2H2V8h2v2h2V8h2V6h2V4h1Z',
  book: 'M1 2h5v1h4V2h5v12h-5v1H6v-1H1Zm2 2v8h3v1h1V5H6V4Zm7 0v1H9v8h1v-1h3V4Z',
  people: 'M4 1h5v5H4ZM2 8h9v2h2v5H1v-5h1Zm9-6h3v4h-3Zm2 6h2v2h1v5h-2v-4h-1Z',
  leaf: 'M11 1h4v6h-2v3h-2v2H6v2H4v1H1v-2h2v-2H2V7h2V5h3V3h4ZM6 8v2h2V8h2V6H8v2Z',
  flask: 'M5 1h6v2h-1v3h1v2h1v2h2v5H2v-5h2V8h1V6h1V3H5Zm2 6v2H6v2H4v2h8v-2h-2V9H9V7Z',
  coins: 'M5 1h6v2h3v2h1v6h-2v3h-3v1H5v-2H2v-3H1V5h2V2h2Zm1 2v1H4v2H3v4h1v2h2v1h4v-1h2v-2h1V6h-1V4h-2V3Zm0 3h4v4H6Z',
  home: 'M7 1h2v2h2v2h2v2h2v2h-2v6H9v-5H7v5H3V9H1V7h2V5h2V3h2Zm-2 6v1h6V7H9V5H7v2Z',
  bag: 'M5 1h6v2h2v3h2v9H1V6h2V3h2Zm0 3v2h6V4Zm1 4v2h4V8Z',
  clock: 'M5 1h6v2h3v3h1v5h-2v3h-3v1H5v-2H2v-3H1V5h2V2h2Zm1 2v1H4v2H3v4h1v2h2v1h4v-1h2v-2h1V6h-1V4h-2V3Zm1 2h2v3h3v2H7Z',
  rebirth: 'M5 1h6v2h2v2h2v4H9V7h3V5h-2V3H6v1H4v2H2V3h3ZM1 7h6v2H4v2h2v2h4v-1h2v-2h2v3h-3v2H5v-2H3v-2H1Z',
  spark: 'M7 1h2v4h2v2h4v2h-4v2H9v4H7v-4H5V9H1V7h4V5h2Zm0 6v2h2V7Z',
  shield: 'M7 1h2v1h3v1h3v6h-2v3h-2v2H9v1H7v-1H5v-2H3V9H1V3h3V2h3Zm0 3H4v1H3v3h2v3h2v2h2v-2h2V8h2V5h-1V4H9V3H7Z',
  save: 'M1 1h11v2h2v2h1v10H1Zm3 2v4h7V3Zm0 7v3h8v-3Zm4-7h2v3H8Z',
  sun: 'M7 0h2v3H7ZM7 13h2v3H7ZM0 7h3v2H0ZM13 7h3v2h-3ZM2 2h2v2H2ZM12 2h2v2h-2ZM2 12h2v2H2ZM12 12h2v2h-2ZM6 4h4v1h1v1h1v4h-1v1h-1v1H6v-1H5v-1H4V6h1V5h1Z',
  moon: 'M6 1h4v2H7v3h1v2h2v1h3V8h2v4h-2v2h-3v1H6v-1H3v-2H1V6h1V3h4ZM4 5v2H3v4h2v2h5v-1h2v-1H8V9H6V7H5V5Z',
  arrow: 'M9 2h2v2h2v2h2v4h-2v2h-2v2H9v-3h2V9H1V7h10V5H9Z',
  play: 'M4 1h2v2h3v2h3v2h2v2h-2v2H9v2H6v2H4Z',
  pause: 'M3 2h3v12H3ZM10 2h3v12h-3Z',
  chevron: 'M5 1h2v2h2v2h2v2h2v2h-2v2H9v2H7v2H5v-3h2v-2h2V6H7V4H5Z',
  help: 'M4 1h7v2h2v5h-2v2H9v1H7V8h2V7h2V4h-1V3H5v1H4v2H2V3h2ZM7 13h2v2H7Z',
  close: 'M2 2h2v2h2v2h4V4h2V2h2v2h-2v2h-2v4h2v2h2v2h-2v-2h-2v-2H6v2H4v2H2v-2h2v-2h2V6H4V4H2Z',
  check: 'M13 3h2v3h-2v2h-2v2H9v2H7v2H5v-2H3v-2H1V7h2v2h2v2h2V9h2V7h2V5h2Z',
  download: 'M7 1h2v7h3v2h-2v2H6v-2H4V8h3ZM1 11h2v3h10v-3h2v5H1Z',
  upload: 'M7 1h2v2h2v2h2v2H9v6H7V7H3V5h2V3h2ZM1 11h2v3h10v-3h2v5H1Z',
  star: 'M7 1h2v3h2v2h4v2h-2v2h-2v2h1v3H9v-2H7v2H4v-3h1v-2H3V8H1V6h4V4h2Z',
  settings: 'M4 1h3v2h8v2H7v2H4V5H1V3h3ZM10 6h3v2h2v2h-2v2h-3v-2H1V8h9ZM4 11h3v2h8v2H7v1H4v-1H1v-2h3Z',
  eye: 'M5 3h6v2h2v2h2v2h-2v2h-2v2H5v-2H3V9H1V7h2V5h2Zm0 3v1H3v2h2v1h6V9h2V7h-2V6Zm2 1h2v2H7Z',
};

export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={`pixel-icon ${className}`} width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d={paths[name] || paths.mountain} fillRule="evenodd"/></svg>;
}

export function MountainScene({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  return <PixelScene className={`mountain-scene ${className}`} compact={compact}/>;
}

export function Seal({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <span className={`seal ${small ? 'small' : ''}`}>{children}</span>;
}

export function Portrait({ name, index, departed = false, gender }: { name: string; index?: number; departed?: boolean; gender?: string }) {
  return <PixelPortrait name={name} index={index} departed={departed} gender={gender}/>;
}
