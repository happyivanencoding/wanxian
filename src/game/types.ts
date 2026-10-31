export type Focus = 'cultivate' | 'adventure' | 'study' | 'work' | 'alchemy' | 'rest' | 'social';
export type Stat = 'health' | 'mind' | 'insight' | 'foundation' | 'reputation' | 'alchemy' | 'combat';
export type Stats = Record<Stat, number>;
export type LogKind = 'life' | 'cultivation' | 'encounter' | 'world' | 'relationship' | 'economy' | 'ending';
export interface Log { id: number; age: number; title: string; text: string; kind: LogKind; important: boolean; starred?: boolean }
export interface NPC {
  id: string; name: string; title: string; personality: string; realm: number; progress: number; aptitude: number; age: number; lifespan: number; alive: boolean; relation: number;
  role: 'acquaintance' | 'friend' | 'benefactor' | 'enemy' | 'rival' | 'companion' | 'mentor';
  lastInteraction: number; story: string;
  metAt?: number; meeting?: string; region?: string; family?: string; desire?: string;
  gear?: { name: string; tier: number };
  career?: { pace: number; ceiling: number; resources: number; breakthroughAt: number; opportunityAt: number };
  hostility?: number; pursuitAt?: number; grievance?: string;
}
export type WorldFaction = 'sword' | 'tide' | 'star' | 'ember' | 'jade';
export interface WorldHistory {
  birthYear: number; lastYear: number; rng: number;
  strength: Record<WorldFaction, number>;
  choices: Record<string, { side: WorldFaction | 'open' | 'self' | 'watch'; weight: number }>;
  outcomes: Record<string, WorldFaction | 'open'>;
}
export interface CultivationFortune { flow: number; until: number; nextAt: number; insight: number; impasseUntil: number }
export interface Snapshot { age: number; realm: number; health: number; mind: number; stones: number; progress: number }
export interface Delayed { at: number; title: string; text: string; effect: Effect }
export type PreparationMethod = 'temper' | 'meditate' | 'medicine';
export interface Preparation { realm: number; selected: PreparationMethod | null; progress: Record<PreparationMethod, number> }
export interface ExpeditionState {
  active?: { id: string; stage: number; marks: string[]; companionId?: string; startedAge: number };
  completed: { id: string; outcome: string; title: string; text: string; age: number }[];
}
export interface DirectorCandidate { id: string; label: string; description: string }
export interface DirectorRequest {
  kind: 'event' | 'npc'; age: number; actorId?: string;
  context: Record<string, unknown>; candidates: DirectorCandidate[];
}
export interface DirectorDecision {
  kind: 'event' | 'npc'; age: number; actorId?: string; candidateId: string; source: 'startlux';
}
export interface DirectorRecord {
  kind: 'event' | 'npc'; age: number; actorId?: string; candidateId: string; source: 'startlux' | 'local';
}
export interface Game {
  direction?: 'seek' | 'roam' | 'belong' | 'peace';
  version: 2; id: string; seed: number; rng: number; name: string; gender: string; origin: string; era: string; root: string; aptitude: number; talent: string; route: string;
  age: number; realm: number; progress: number; lifespan: number; stones: number; stats: Stats; focus: Focus; region: string;
  sect: string | null; contribution: number; sectRank: number; home: Record<string, number>; inventory: Record<string, number>; equipped: string | null;
  flags: string[]; seen: Record<string, number>; pending: string | null; delayed: Delayed[]; npcs: NPC[]; logs: Log[]; snapshots: Snapshot[];
  actionsLeft: number; cooldownUntil: number; attempts: number; successes: number; totalStones: number; visited: string[]; choices: number;
  alive: boolean; ending: string | null; endingText: string; yearName: string; logSeq: number;
  preparation?: Preparation; expeditions?: ExpeditionState; directorRecords?: DirectorRecord[];
  history?: WorldHistory; fortune?: CultivationFortune; family?: string;
}
export interface Effect {
  stats?: Partial<Stats>; stones?: number; progress?: number; lifespan?: number; contribution?: number;
  item?: string; amount?: number; flag?: string; npcRelation?: number; rootBoost?: number;
  npcId?: string; storyPath?: 'guardian' | 'lone' | 'contract';
}
export interface Choice { label: string; hint: string; effect: Effect; cost?: number; annualCost?: number; requiresStat?: [Stat, number]; chance?: number; failure?: Effect; successText?: string; failureText?: string; autoScore: number; delayed?: { after: number; title: string; text: string; effect: Effect } }
export interface EventDef { id: string; title: string; text: string; category: LogKind; kind?: 'routine' | 'opportunity' | 'turning'; cause?: string; minAge?: number; maxAge?: number; minRealm?: number; maxRealm?: number; focus?: Focus; region?: string; flag?: string; notFlag?: string; sect?: boolean; cooldown?: number; once?: boolean; weight?: number; choices: Choice[] }
export interface BirthConfig { name: string; gender: string; origin: string; era: string; route: string; region?: string; mode: 'seeker' | 'all'; fastStart: boolean; seed: string; guided?: boolean }
export interface LifeRecord { id: string; name: string; age: number; realm: number; origin: string; route: string; ending: string; endingText: string; totalStones: number; choices: number; legacy: string; logs: Log[]; date: string }
export interface Profile { version: 2; game: Game | null; archives: LifeRecord[]; slots: ({ name: string; savedAt: string; game: Game } | null)[]; settings: { theme: 'light' | 'dark'; speed: number; durationMinutes: 30 | 60; policy: 'safe' | 'bold' | 'random'; reducedMotion: boolean; directorEnabled?: boolean }; achievements: string[] }
export type Action =
 | { type: 'direction'; direction: 'seek' | 'roam' | 'belong' | 'peace' | null }
 | { type: 'advance'; years?: number }
 | { type: 'focus'; focus: Focus }
 | { type: 'choose'; index: number }
 | { type: 'breakthrough'; usePill?: boolean }
 | { type: 'prepare'; method: string | null }
 | { type: 'expedition-start'; id: string }
 | { type: 'expedition-choose'; id: string }
 | { type: 'expedition-retreat' }
 | { type: 'buy'; id: string }
 | { type: 'sell'; id: string }
 | { type: 'use'; id: string }
 | { type: 'craft'; id: string }
 | { type: 'travel'; id: string }
 | { type: 'join'; id: string }
 | { type: 'sect'; job: 'mission' | 'study' | 'promote' | 'leave' | 'learn' }
 | { type: 'home'; id: string }
 | { type: 'npc'; id: string; interaction: 'talk' | 'gift' | 'duel' | 'bond' }
 | { type: 'star'; id: number }
 | { type: 'retire' };
export interface ActionResult { game: Game; message?: string; error?: string }
export type DirectedAction = Action | { type: 'auto'; policy: 'safe' | 'bold' | 'random' };
export interface DirectedPlan { result: ActionResult; request?: DirectorRequest }
