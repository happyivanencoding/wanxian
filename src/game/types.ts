export type Focus = 'cultivate' | 'adventure' | 'study' | 'work' | 'alchemy' | 'rest' | 'social';
export type Stat = 'health' | 'mind' | 'insight' | 'foundation' | 'reputation' | 'alchemy' | 'combat';
export type Stats = Record<Stat, number>;
export type LogKind = 'life' | 'cultivation' | 'encounter' | 'world' | 'relationship' | 'economy' | 'ending';
export interface Log { id: number; age: number; title: string; text: string; kind: LogKind; important: boolean; starred?: boolean }
export interface NPC { id: string; name: string; title: string; personality: string; realm: number; progress: number; aptitude: number; age: number; lifespan: number; alive: boolean; relation: number; role: 'friend' | 'rival' | 'companion' | 'mentor'; lastInteraction: number; story: string }
export interface Snapshot { age: number; realm: number; health: number; mind: number; stones: number; progress: number }
export interface Delayed { at: number; title: string; text: string; effect: Effect }
export interface Game {
  version: 1; id: string; seed: number; rng: number; name: string; gender: string; origin: string; era: string; root: string; aptitude: number; talent: string; route: string;
  age: number; realm: number; progress: number; lifespan: number; stones: number; stats: Stats; focus: Focus; region: string;
  sect: string | null; contribution: number; sectRank: number; home: Record<string, number>; inventory: Record<string, number>; equipped: string | null;
  flags: string[]; seen: Record<string, number>; pending: string | null; delayed: Delayed[]; npcs: NPC[]; logs: Log[]; snapshots: Snapshot[];
  actionsLeft: number; cooldownUntil: number; attempts: number; successes: number; totalStones: number; visited: string[]; choices: number;
  alive: boolean; ending: string | null; endingText: string; yearName: string; logSeq: number;
}
export interface Effect {
  stats?: Partial<Stats>; stones?: number; progress?: number; lifespan?: number; contribution?: number;
  item?: string; amount?: number; flag?: string; npcRelation?: number; rootBoost?: number;
}
export interface Choice { label: string; hint: string; effect: Effect; cost?: number; requiresStat?: [Stat, number]; chance?: number; failure?: Effect; successText?: string; failureText?: string; autoScore: number; delayed?: { after: number; title: string; text: string; effect: Effect } }
export interface EventDef { id: string; title: string; text: string; category: LogKind; minAge?: number; maxAge?: number; minRealm?: number; maxRealm?: number; focus?: Focus; region?: string; flag?: string; notFlag?: string; sect?: boolean; cooldown?: number; once?: boolean; weight?: number; choices: Choice[] }
export interface BirthConfig { name: string; gender: string; origin: string; era: string; route: string; mode: 'seeker' | 'all'; fastStart: boolean; seed: string }
export interface LifeRecord { id: string; name: string; age: number; realm: number; origin: string; route: string; ending: string; endingText: string; totalStones: number; choices: number; legacy: string; logs: Log[]; date: string }
export interface Profile { version: 1; game: Game | null; archives: LifeRecord[]; slots: ({ name: string; savedAt: string; game: Game } | null)[]; settings: { theme: 'light' | 'dark'; speed: number; durationMinutes: 30 | 60; policy: 'safe' | 'bold' | 'random'; reducedMotion: boolean }; achievements: string[] }
export type Action =
 | { type: 'advance'; years?: number }
 | { type: 'focus'; focus: Focus }
 | { type: 'choose'; index: number }
 | { type: 'breakthrough'; usePill?: boolean }
 | { type: 'buy'; id: string }
 | { type: 'sell'; id: string }
 | { type: 'use'; id: string }
 | { type: 'craft'; id: string }
 | { type: 'travel'; id: string }
 | { type: 'join'; id: string }
 | { type: 'sect'; job: 'mission' | 'study' | 'promote' | 'leave' }
 | { type: 'home'; id: string }
 | { type: 'npc'; id: string; interaction: 'talk' | 'gift' | 'duel' | 'bond' }
 | { type: 'star'; id: number }
 | { type: 'retire' };
export interface ActionResult { game: Game; message?: string; error?: string }
