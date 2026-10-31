import { planDirectedAction } from '../src/game/engine.ts';
import type { Game } from '../src/game/types.ts';
import { HISTORY_EVENTS } from '../src/game/history.ts';
import { REGIONAL_EVENTS } from '../src/game/regional.ts';
import { VENTURE_EVENTS } from '../src/game/venture.ts';

/** A pre-rework adult save: these four people were already part of its history. */
export function withLegacyPeers(g: Game): Game {
  g.npcs = ['沈长风', '苏青禾', '陆远山', '顾霁'].map((name, i) => ({
    id: `peer-${i}`, name, title: ['世家后人', '药师之子', '山野少年', '剑阁遗孤'][i],
    personality: ['锐意进取', '温厚沉稳', '随性洒脱', '清冷执着'][i],
    realm: 0, progress: 0, aptitude: 50 + i * 5, age: 28, lifespan: 85,
    alive: true, relation: i === 3 ? 25 : 42, role: i === 3 ? 'rival' : 'friend',
    lastInteraction: -1, story: '与你相识已久。',
  }));
  if (g.history) g.history.strength = { sword: 60, tide: 60, star: 60, ember: 60, jade: 60 };
  return g;
}

/** Isolate an ordinary-event boundary from already handled, higher-priority turns. */
export function handledWorldTurns(g: Game) {
  for (const event of [...HISTORY_EVENTS, ...REGIONAL_EVENTS, ...VENTURE_EVENTS]) g.seen[event.id] = 20;
  for (const npc of g.npcs) npc.metAt = g.age;
  return g;
}

export function ordinaryYear(g: Game): Game {
  handledWorldTurns(g);
  for (let sample = 1; sample < 512; sample++) {
    g.rng = (sample * 65537) >>> 0;
    const plan = planDirectedAction(g, { type: 'advance' });
    if (plan.request?.kind === 'event' && plan.result.game.pending === 'auction') return g;
  }
  throw new Error('No legal ordinary-event fixture found');
}
