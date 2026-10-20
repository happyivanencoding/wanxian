import { useId, type ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  mountain: <><path d="m3 19 6-13 5 9 3-6 4 10H3Z"/><path d="m7 10 2 2 2-2M13 13l2 2"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/></>,
  sword: <><path d="m5 19 3-3M7 14l3 3M9 15 18 3l3 0 0 3-12 9ZM4 20l1 1"/></>,
  book: <><path d="M12 5C8 2 5 3 3 4v15c3-2 6-1 9 1 3-2 6-3 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/></>,
  leaf: <><path d="M20 3c1 10-3 16-10 15-8-1-7-9-2-11 3-2 6 0 12-4Z"/><path d="M4 21 16 9"/></>,
  flask: <><path d="M9 3h6M10 3v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3M7 15h10"/><path d="M10 18h1"/></>,
  coins: <><path d="m12 3 8 5v8l-8 5-8-5V8l8-5Z"/><path d="m12 7 4 5-4 5-4-5 4-5Z"/></>,
  home: <><path d="m2 11 10-8 10 8M5 10v11h14V10M9 21v-7h6v7"/></>,
  bag: <><path d="M5 7h14l2 14H3L5 7ZM8 7V6a4 4 0 0 1 8 0v1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
  rebirth: <><path d="M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5m-4 5a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/></>,
  spark: <><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  save: <><path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-7h10v7"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  play: <path d="m8 4 12 8-12 8V4Z"/>,
  pause: <><path d="M8 4v16M16 4v16"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 1-1 2-1 2m0 3h.01"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  check: <path d="m4 12 5 5L20 6"/>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/></>,
  star: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="7" cy="18" r="2"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
};
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.mountain}</svg>;
}

export function MountainScene({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  return <svg className={`mountain-scene ${className}`} viewBox={compact ? '100 130 850 430' : '0 0 1000 690'} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}sky`} x2="0" y2="1"><stop stopColor="#e6e5d8"/><stop offset="1" stopColor="#f3f0e5"/></linearGradient>
      <linearGradient id={`${id}far`} x2="0.6" y2="1"><stop stopColor="#a3b8ac"/><stop offset="1" stopColor="#d9dfd0"/></linearGradient>
      <linearGradient id={`${id}mid`} x1="0" x2="0.8" y2="1"><stop stopColor="#5c8b7e"/><stop offset="1" stopColor="#b2c7b8"/></linearGradient>
      <linearGradient id={`${id}near`} x2="0.8" y2="1"><stop stopColor="#2a574f"/><stop offset="1" stopColor="#668d76"/></linearGradient>
      <linearGradient id={`${id}mist`} x2="0" y2="1"><stop stopColor="#f3f0e5" stopOpacity="0"/><stop offset="1" stopColor="#f3f0e5"/></linearGradient>
    </defs>
    <rect width="1000" height="690" fill={`url(#${id}sky)`}/>
    <circle cx="748" cy="133" r="53" fill="#c4a46c" opacity=".46"/>
    <circle cx="748" cy="133" r="70" fill="none" stroke="#c4a46c" opacity=".15"/>
    <path d="M0 365 73 325 117 340 191 242 222 259 305 119 347 209 394 184 463 307 518 244 569 270 642 174 706 251 762 216 841 302 884 258 1000 335V690H0Z" fill={`url(#${id}far)`}/>
    <path d="m305 119-25 104 36-23 31 9-42-90m337 55-19 79 29-25 54 23Z" fill="#e4e8dd" opacity=".65"/>
    <path d="M0 428 72 402 142 290 172 314 236 236 267 277 321 254 393 386 425 360 472 400 534 327 571 346 653 275 691 328 731 305 810 397 874 345 935 382 1000 346V690H0Z" fill={`url(#${id}mid)`}/>
    <g fill="none" stroke="#e6e8db" strokeWidth="2" opacity=".36"><path d="m236 236-30 114-42 40m157-136 17 112 51 69m264-160-17 93-54 34m149-97 16 107 64 39"/><path d="m245 279 32 70-3 59m411-77-23 67 40 36"/></g>
    <path d="M0 456c120-30 173 31 280 3s180-30 280 1 210-24 440-10v80H0Z" fill="#e5e9dd" opacity=".78"/>
    <path d="M0 500 86 449 139 467 209 397 258 417 298 365 344 427 389 425 465 528 518 522 615 436 662 461 718 402 764 446 798 427 881 515 940 493 1000 530V690H0Z" fill={`url(#${id}near)`}/>
    <path d="m298 365-20 95-52 56m440-55-26 62-67 31m175-108 7 68 66 42" stroke="#c8d2af" strokeWidth="2" fill="none" opacity=".28"/>
    <path d="M120 690c250-71 193-77 389-121s149-67 84-85c-43-12-31-25 36-48-12 26-13 35 26 42 132 27 42 75-115 119-78 22-90 39-108 93" fill="#dce3d3" opacity=".88"/>
    <path d="M450 675c40-33 164-57 183-75M513 561c30-18 76-27 99-36" fill="none" stroke="#f6f2e5" strokeWidth="3" opacity=".65"/>
    <g transform="translate(289 377)"><path d="M-48 20h95v9h-95Z" fill="#314f46"/><path d="M-30 0h60v21h-60Z" fill="#d5c5a0"/><path d="M-51 2c24-5 31-15 51-24C18-10 30-2 51 2Z" fill="#1f443e"/><path d="M-15-20h30v-15h-30Z" fill="#d5c5a0"/><path d="M-30-35c16-2 22-9 30-15 10 9 20 12 30 15Z" fill="#2c5148"/><path d="M-5 21V4h10v17M-22 6v10M22 6v10" stroke="#5b6150" strokeWidth="3"/><path d="M-56 30H56M-65 35H65" stroke="#8a9677" strokeWidth="4"/></g>
    <g fill="#234e45"><path d="m95 510-4-47-24-14 19 3-8-19 18 22 17-7-15 14 2 48Zm31-11-1-34 17-16-10 21 16-4-18 13 1 20Z"/><ellipse cx="78" cy="446" rx="31" ry="9"/><ellipse cx="109" cy="435" rx="33" ry="10"/><ellipse cx="141" cy="453" rx="23" ry="8"/></g>
    <g fill="none" stroke="#547567" strokeWidth="2" opacity=".75"><path d="m551 182 10 3 10-6m14 12 7 1 8-6m-52 24 8 2 9-5"/></g>
    <path d="M0 594c170-34 258 50 402 12s232-12 329 17 180 2 269-8v75H0Z" fill={`url(#${id}mist)`}/>
    <path d="M10 324c150 17 186-26 289-15M658 355c125-17 178 2 297-20M61 553c150-30 189-10 270-19" stroke="#f2f1e7" strokeWidth="11" strokeLinecap="round" opacity=".45" fill="none"/>
  </svg>;
}
export function Seal({ children, small = false }: { children: ReactNode; small?: boolean }) { return <span className={`seal ${small ? 'small' : ''}`}>{children}</span>; }
export function Portrait({ name, index = 0, departed = false }: { name: string; index?: number; departed?: boolean }) {
  return <div className={`portrait tone-${index % 4} ${departed ? 'departed' : ''}`} aria-hidden="true"><svg viewBox="0 0 160 150"><circle cx="80" cy="58" r="27" fill="currentColor" opacity=".19"/><path d="M39 140c3-35 14-52 41-53 27 0 41 22 43 53" fill="currentColor" opacity=".4"/><path d="M66 82 80 116 95 82l15 21-30 37-29-37Z" fill="currentColor" opacity=".25"/><path d="M55 53c-2-27 42-39 50-4-9-12-24-15-31-15-1 10-9 16-19 19Z" fill="currentColor" opacity=".6"/><path d="M74 21q-6-16 9-15 16 3 4 18" fill="currentColor" opacity=".6"/></svg><span>{name.slice(0, 1)}</span></div>;
}
