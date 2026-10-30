import { ACHIEVEMENTS, ERAS, FOCUSES, GIVEN_NAMES, HOMES, ITEMS, ORIGINS, REALMS, RECIPES, REGIONS, ROUTES, SECTS, SECT_RANKS, SURNAMES, WORLD_PHASES } from './data.ts';
import { CHILD_EVENTS, EVENTS, EVENT_MAP } from './events.ts';
import { FAMILIES, advanceHistory, historyConditions, initializeHistory, nextHistoryEvent, getHistoryEvent, recordHistoryChoice, resonateRelics } from './history.ts';
import { advanceCultivation, cultivationFlow, cultivationInsight } from './cultivation.ts';
import { bindRelationshipEvent, getRelationshipEvent, growRelationships, nextRelationshipEvent, recordRelationshipChoice } from './relationships.ts';
import { gearTier } from './data.ts';
import { fateInfluence } from './fate.ts';
import { activateStoryPath, getStoryEvent, nextStoryEvent, recordStoryChoice, storyAnnualEffects, storyLegacy, storyTravelMultiplier } from './story.ts';
import { advancePreparation, completePreparation, learnSectSpecialty, preparationChance, preparationState, preparationTarget, progressionBenefits, selectPreparation } from './progression.ts';
import { mutateExpedition } from './expeditions.ts';
import { lifeIdentity } from './world.ts';
import { sectAnnualEffect, sectEntryReason, sectMissionEffect, sectPassive, sectStudyEffect } from './sects.ts';
import { directCandidate, npcResponses } from './director.ts';
import { LIFE_DIRECTIONS, arrangeLife, bindLifeEvent, getLifeEvent, nextLifeEvent, lifeAnnualEffects, lifeLegacyText, lifeTrainingMultiplier, npcLifeFactors } from './lifelines.ts';
import type { DirectorControl } from './director.ts';
import type { Action, ActionResult, BirthConfig, Choice, DirectedAction, DirectedPlan, DirectorDecision, Effect, EventDef, Game, LifeRecord, LogKind, NPC, Stat } from './types.ts';
export type { DirectedAction, DirectedPlan, DirectorCandidate, DirectorRequest, DirectorDecision } from './types.ts';

export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;
export function seedFromText(text: string): number {
  let seed = 2166136261;
  for (const char of text) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return seed || 1;
}
export function random(g: { rng: number }): number {
  g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0;
  return g.rng / 4294967296;
}
const pick = <T,>(g: { rng: number }, values: T[]): T => values[Math.floor(random(g) * values.length)];
const integer = (g: { rng: number }, low: number, high: number) => low + Math.floor(random(g) * (high - low + 1));
export const realmName = (g: Pick<Game, 'realm' | 'progress'>) => {
  const realm = REALMS[g.realm];
  if (g.realm === 0 || g.realm === 6) return realm.name;
  return realm.name + (g.progress >= realm.need ? '圆满' : g.progress / realm.need < 0.34 ? '初期' : g.progress / realm.need < 0.7 ? '中期' : '后期');
};
export const worldPhase = (g: Pick<Game, 'age'> & Partial<Pick<Game, 'history' | 'region'>>) => historyConditions(g);
export const currentRegion = (g: Pick<Game, 'region'>) => REGIONS.find(r => r.id === g.region)!;
export const currentEra = (g: Pick<Game, 'era'>) => ERAS.find(e => e.id === g.era)!;
export const itemPrice = (g: Game, id: string) => Math.ceil(ITEMS.find(i => i.id === id)!.price * currentEra(g).price * historyConditions(g).price);
export const homePrice = (g: Game, id: string) => Math.ceil(HOMES.find(h => h.id === id)!.cost * Math.pow(1.85, g.home[id] || 0));
export const travelPrice = (g: Game, id: string) => Math.ceil(REGIONS.find(region => region.id === id)!.cost * storyTravelMultiplier(g) * historyConditions(g, id).travel);
export const craftChance = (g: Game) => clamp(0.55 + g.stats.alchemy * 0.003 + (g.home.furnace || 0) * 0.08 + (g.route === 'alchemy' ? 0.08 : 0) + progressionBenefits(g).craftChance, 0.1, 0.98);
export function trainingFactors(g: Game) {
  return {
    base: 2.5 + g.aptitude / 12,
    realm: [1, 1.2, 1.6, 2.1, 2.8, 3.8, 0][g.realm],
    region: currentRegion(g).spirit, era: currentEra(g).spirit, phase: worldPhase(g).spirit,
    preparation: 1 + (g.home.array || 0) * 0.12 + (g.home.mat || 0) * 0.03 + (g.route === 'balanced' ? 0.1 : 0) + (sectPassive(g).cultivation ?? 0),
    mind: 0.55 + g.stats.mind * 0.0045, health: 0.4 + g.stats.health * 0.006,
    fate: fateInfluence(g).training,
    attainments: progressionBenefits(g).training,
    life: lifeTrainingMultiplier(g),
    fortune: cultivationFlow(g),
  };
}
export const trainingRate = (g: Game) => {
  const f = trainingFactors(g);
  return round(f.base * f.realm * f.region * f.era * f.phase * f.preparation * f.mind * f.health * f.fate * f.attainments * f.life * f.fortune);
};
export function breakthroughFactors(g: Game, usePill = false) {
  return [
    { label: '基础机会', value: 0.26 },
    { label: '根基积累', value: g.stats.foundation * 0.0025 },
    { label: '悟性见识', value: g.stats.insight * 0.00155 },
    { label: '当下道心', value: g.stats.mind * 0.00165 },
    { label: '先天资质', value: g.aptitude * 0.00085 },
    { label: '境界难度', value: -g.realm * 0.075 },
    { label: '凝灵丹准备', value: usePill ? 0.13 + progressionBenefits(g).pillChance : 0 },
    { label: '当前宗门师承', value: sectPassive(g).breakthrough ?? 0 },
    { label: '体魄未充盈', value: -Math.max(0, 75 - g.stats.health) * 0.0028 },
    { label: '一生道路的积累', value: fateInfluence(g).chance },
    { label: '本境持续准备', value: preparationChance(g) },
    { label: '顿悟与瓶颈', value: cultivationInsight(g) },
    { label: '此生所学本领', value: progressionBenefits(g).breakthrough },
    { label: '禁术后患', value: g.flags.includes('forbidden-art') ? -0.07 : 0 },
  ];
}
export const breakthroughChance = (g: Game, usePill = false) => clamp(breakthroughFactors(g, usePill).reduce((sum, factor) => sum + factor.value, 0), 0.07, 0.90);

function log(g: Game, title: string, text: string, kind: LogKind = 'life', important = false) {
  g.logs.push({ id: ++g.logSeq, age: g.age, title, text, kind, important });
  if (g.logs.length > 1200) {
    const removable = g.logs.findIndex(entry => !entry.important && !entry.starred);
    if (removable >= 0) g.logs.splice(removable, 1);
  }
}
function gain(g: Game, effect: Effect = {}) {
  if (effect.stats) for (const [key, value] of Object.entries(effect.stats)) g.stats[key as Stat] = round(clamp(g.stats[key as Stat] + value));
  if (effect.stones) { g.stones = Math.max(0, Math.round(g.stones + effect.stones)); g.totalStones += Math.max(0, Math.round(effect.stones)); }
  if (effect.progress) g.progress = round(clamp(g.progress + effect.progress, 0, REALMS[g.realm].need));
  if (effect.lifespan) g.lifespan = Math.max(1, Math.round(g.lifespan + effect.lifespan));
  if (effect.contribution && g.sect) g.contribution = Math.max(0, g.contribution + effect.contribution);
  if (effect.item) {
    g.inventory[effect.item] = (g.inventory[effect.item] || 0) + (effect.amount ?? 1);
    const item = ITEMS.find(entry => entry.id === effect.item);
    if (item && g.realm >= item.minRealm && item.kind === 'book' && item.effect && !g.flags.includes(item.effect.flag ?? '')) {
      g.inventory[item.id]--;
      gain(g, item.effect);
      log(g, '读通一卷旧书', `${item.name}：${item.description}`, 'cultivation', true);
    } else if (item?.kind === 'gear' && g.realm >= item.minRealm && gearTier(item) > gearTier(ITEMS.find(entry => entry.id === g.equipped))) {
      g.equipped = item.id;
      log(g, '法宝随身', `你将${item.name}佩在身边。`, 'cultivation');
    }
  }
  if (effect.flag && !g.flags.includes(effect.flag)) g.flags.push(effect.flag);
  if (effect.storyPath) activateStoryPath(g, effect.storyPath);
  if (effect.rootBoost) g.aptitude = clamp(g.aptitude + effect.rootBoost, 15, 100);
  if (effect.npcRelation) {
    const friend = effect.npcId ? g.npcs.find(npc => npc.id === effect.npcId && npc.alive) : g.npcs.find(npc => npc.alive && !['rival', 'enemy'].includes(npc.role));
    if (friend) friend.relation = round(clamp(friend.relation + effect.npcRelation));
  }
}
function snapshot(g: Game) {
  const entry = { age: g.age, realm: g.realm, health: g.stats.health, mind: g.stats.mind, stones: g.stones, progress: g.progress };
  if (g.snapshots.at(-1)?.age === g.age) g.snapshots[g.snapshots.length - 1] = entry;
  else g.snapshots.push(entry);
}
function finish(g: Game, ending: string, text: string) {
  if (!g.alive) return;
  g.alive = false; g.pending = null; g.ending = ending; g.endingText = text;
  if (g.expeditions?.active) delete g.expeditions.active;
  log(g, ending, text, 'ending', true); snapshot(g);
}
function checkLife(g: Game) {
  if (g.stats.health <= 0) finish(g, '道途中陨落', '经年的伤势终于超过了肉身所能承受的限度。你把最后一口气留给这片走过的山河。');
  else if (g.age >= g.lifespan) finish(g, g.realm ? '寿终坐化' : '寿终正寝', g.realm ? '寿元将尽，你整理好行囊与旧书，在熟悉的晨光里散去一身修为。山中的风，仍像初来时一样。' : '这一生有平凡，也有求道的微光。你在熟悉的人间烟火中合上了最后一页。');
}

export function createGame(config: BirthConfig): Game {
  const seed = seedFromText(config.seed || '万仙之一');
  const cursor = { rng: seed };
  let origin = ORIGINS.find(o => o.id === config.origin);
  if (!origin) {
    let ticket = random(cursor) * ORIGINS.reduce((sum, o) => sum + o.weight, 0);
    origin = ORIGINS.find(o => { ticket -= o.weight; return ticket < 0; }) ?? ORIGINS[0];
  }
  const rootRoll = random(cursor);
  const noRoot = config.mode === 'all' && rootRoll < 0.28;
  const roots = ['五行杂灵根', '三系灵根', '双系灵根', '天灵根', '异变雷灵根'];
  const rootIndex = rootRoll < 0.35 ? 0 : rootRoll < 0.70 ? 1 : rootRoll < 0.9 ? 2 : rootRoll < 0.98 ? 3 : 4;
  const aptitude = clamp((noRoot ? 24 : [36, 49, 62, 82, 88][rootIndex]) + origin.aptitude + integer(cursor, -7, 10), 15, 99);
  const era = ERAS.find(e => e.id === config.era) ?? ERAS[0];
  let region = REGIONS.find(r => r.id === config.region) ?? REGIONS[0];
  if (config.region === 'random') {
    let ticket = random(cursor) * 100;
    const weights = [55, 25, 10, 7, 3];
    region = REGIONS.find((_, index) => (ticket -= weights[index]) < 0) ?? REGIONS[0];
  }
  const name = config.name.trim().slice(0, 12) || pick(cursor, SURNAMES) + pick(cursor, GIVEN_NAMES);
  const talent = pick(cursor, ['心如止水', '勤学不辍', '筋骨强健', '草木亲和', '剑心初生']);
  const g: Game = {
    version: 1, id: `${seed.toString(36)}-${name}`, seed, rng: cursor.rng, name, gender: config.gender || '随缘', origin: origin.id, era: era.id,
    root: noRoot ? '无灵根 · 以武入道' : roots[rootIndex], aptitude, talent, route: noRoot ? 'body' : (ROUTES.some(r => r.id === config.route) ? config.route : 'balanced'),
    age: 0, realm: 0, progress: 0, lifespan: 85 + integer(cursor, -6, 8), stones: origin.stones,
    stats: { health: 84, mind: 65, insight: 32 + origin.insight, foundation: 27 + origin.foundation, reputation: origin.id === 'clan' ? 12 : 3, alchemy: 0, combat: origin.id === 'wanderer' ? 18 : 6 },
    focus: 'cultivate', region: region.id, sect: null, contribution: 0, sectRank: 0, home: { mat: 1, array: 0, furnace: 0, library: 0, garden: 0 }, inventory: { herb: 3, heal: 1 }, equipped: null,
    flags: [], seen: {}, pending: null, delayed: [], npcs: [], logs: [], snapshots: [], actionsLeft: 3, cooldownUntil: 0, attempts: 0, successes: 0, totalStones: origin.stones,
    visited: [region.id], choices: 0, alive: true, ending: null, endingText: '', yearName: era.id === 'chaos' ? '赤烽历' : era.id === 'renewal' ? '灵初历' : '承平历', logSeq: 0,
  };
  g.rng = cursor.rng;
  if (config.guided) g.direction = 'seek';
  const talentEffects: Record<string, Effect> = { 心如止水: { stats: { mind: 10 } }, 勤学不辍: { stats: { insight: 9 } }, 筋骨强健: { stats: { health: 10, foundation: 4 } }, 草木亲和: { stats: { alchemy: 12 } }, 剑心初生: { stats: { combat: 12 } } };
  gain(g, talentEffects[talent]);
  initializeHistory(g, random);
  if (['clan', 'merchant'].includes(g.origin)) g.family = pick(g, FAMILIES[g.region]).name;
  log(g, `此生，始于${region.name}`, `${name}出身${origin.name}${g.family ? `，与${g.family}一族相连` : ''}，生于${region.name}。${origin.description}`, 'life', true);
  log(g, '命格初现', `${g.root}，先天资质 ${g.aptitude}。天赋「${g.talent}」。${noRoot ? '你将以体修之路寻找自己的仙缘。' : '出身决定起点，未必决定终点。'}`, 'life', true);
  snapshot(g);
  if (config.fastStart) {
    while (g.age < 16 && g.alive) {
      if (g.pending) resolveChoice(g, autoChoice(g, 'safe'));
      else advanceOne(g);
    }
  }
  return g;
}

export function eventEligible(g: Game, e: EventDef): boolean {
  if (['wounded-friend', 'tea', 'letter', 'chess'].includes(e.id) && !g.npcs.some(npc => npc.alive && npc.role !== 'enemy')) return false;
  return g.alive && g.age >= (e.minAge ?? 0) && g.age <= (e.maxAge ?? 9999) && g.realm >= (e.minRealm ?? 0) && g.realm <= (e.maxRealm ?? 6)
    && (!e.focus || e.focus === g.focus) && (!e.region || e.region === g.region) && (!e.flag || g.flags.includes(e.flag)) && (!e.notFlag || !g.flags.includes(e.notFlag))
    && (!e.sect || Boolean(g.sect)) && !(e.once && g.seen[e.id] !== undefined) && (g.seen[e.id] === undefined || g.age - g.seen[e.id] >= (e.cooldown ?? 6));
}
export function getEvent(g: Game, id: string | null = g.pending): EventDef | undefined {
  if (!id) return;
  const relationship = getRelationshipEvent(g, id);
  if (relationship) return relationship;
  const historical = getHistoryEvent(g, id);
  if (historical) return historical;
  const life = getLifeEvent(g, id);
  if (life) return life;
  const story = getStoryEvent(g, id);
  if (story) return story;
  const original = EVENT_MAP[id];
  if (!original) return;
  if (id === 'wounded-friend') {
    const saved = g.flags.find(flag => flag.startsWith('wounded-person:'))?.slice('wounded-person:'.length);
    const person = saved ? g.npcs.find(npc => npc.id === saved) : g.npcs.find(npc => npc.alive && !['rival', 'enemy'].includes(npc.role)) ?? g.npcs.find(npc => npc.alive);
    if (person) return { ...original,
      text: person.alive ? `${person.name}重伤而归。门外放着一把断剑，屋内迟迟没有灯火。你认得那把剑。如今这段相识来到了需要回应的时候。` : `${person.name}${person.realm === 6 ? '已飞升离界' : '已经离世'}。旧日托存的病中手记辗转来到你手里，记着那段未能相见的日子。`,
      choices: original.choices.map((choice, index) => ({ ...choice,
        ...(!person.alive ? { label: ['替旧日的救治留下资助', '把旧医方整理给后来者', '收好手记，暂不重读'][index], hint: choice.hint.replace(/情谊 \+\d+ · ?/, '') } : {}),
        effect: { ...choice.effect, npcId: person.id },
        ...(choice.delayed ? { delayed: { ...choice.delayed, text: `${person.name}预先托存的一柄秋水剑辗转送到你手里。与此人相连的那段往事，留在剑鞘内的字迹中。`, effect: { ...choice.delayed.effect, npcId: person.id } } } : {}),
      })),
    };
  }
  return original;
}
export function requiresPlayerChoice(g: Game): boolean {
  return Boolean(g.expeditions?.active || (g.pending && getEvent(g)?.kind === 'turning'));
}
function openEvent(g: Game, id: string) {
  bindRelationshipEvent(g, id, { random, log, gain });
  bindLifeEvent(g, id);
  if (id === 'wounded-friend' && !g.flags.some(flag => flag.startsWith('wounded-person:'))) {
    const person = g.npcs.find(npc => npc.alive && !['rival', 'enemy'].includes(npc.role)) ?? g.npcs.find(npc => npc.alive);
    if (person) g.flags.push(`wounded-person:${person.id}`);
  }
  if (!getEvent(g, id)?.choices.length) return;
  g.pending = id; g.seen[id] = g.age;
  if (id.startsWith('history-')) resonateRelics(g, { random, log, gain });
}
function selectEvent(g: Game, director?: DirectorControl) {
  const forced = CHILD_EVENTS.get(g.age);
  if (forced && g.seen[forced] === undefined) { openEvent(g, forced); return; }
  const seenEntries = Object.entries(g.seen);
  const lastManual = Math.max(0, ...seenEntries.filter(([id]) => EVENT_MAP[id]?.kind !== 'routine').map(([, age]) => age));
  const lastRoutine = Math.max(0, ...seenEntries.filter(([id]) => EVENT_MAP[id]?.kind === 'routine').map(([, age]) => age));
  const relationship = nextRelationshipEvent(g, random(g));
  if (relationship === 'rival-pursuit') { openEvent(g, relationship); return; }
  const historical = nextHistoryEvent(g);
  if (historical && g.age - lastManual >= 6) { openEvent(g, historical); return; }
  if (relationship && g.age - lastManual >= (g.age < 16 ? 2 : 6)) { openEvent(g, relationship); return; }
  if (g.age < 16) return;
  const life = nextLifeEvent(g);
  if (life && g.age - lastManual >= 6) { openEvent(g, life); return; }
  const story = nextStoryEvent(g, random(g));
  if (story && (getStoryEvent(g, story)?.kind === 'routine' || g.age - lastManual >= 6)) {
    openEvent(g, story);
    if (getEvent(g)?.kind === 'routine') resolveChoice(g, 0, true);
    return;
  }
  // Previously seen opportunities do not return as recurring paperwork. Old IDs
  // remain resolvable for saved pending events, but new lives use the causal arcs.
  const opportunities = g.age - lastManual >= 12 ? EVENTS.filter(e => e.kind !== 'routine' && !e.id.startsWith('story-') && !e.id.startsWith('fate-') && g.seen[e.id] === undefined && (e.weight ?? 1) > 0 && eventEligible(g, e)) : [];
  const chooseWeighted = (events: EventDef[]) => {
    let ticket = random(g) * events.reduce((sum, e) => sum + (e.weight ?? 1), 0);
    return events.find(e => (ticket -= e.weight ?? 1) <= 0) ?? events.at(-1);
  };
  if (opportunities.length && random(g) < (g.focus === 'adventure' ? 0.2 : 0.14)) {
    const selected = chooseWeighted(opportunities);
    if (selected) {
      // Fixed milestones and major turning points retain their original schedule.
      // The model only selects which eligible ordinary opportunity appears, never its answer.
      const candidates = opportunities.filter(event => event.kind !== 'turning').map(event => {
        const current = getEvent(g, event.id) ?? event;
        return { id: event.id, label: current.title, description: current.text };
      });
      const id = selected.kind === 'turning' ? selected.id : directCandidate(g, 'event', candidates, selected.id, director);
      openEvent(g, id); return;
    }
  }
  if (g.age - lastRoutine < 8 || random(g) >= 0.2) return;
  const routines = EVENTS.filter(e => e.kind === 'routine' && (e.weight ?? 1) > 0 && eventEligible(g, e));
  const selected = routines.length ? chooseWeighted(routines) : undefined;
  if (selected) {
    openEvent(g, selected.id);
    const index = autoChoice(g, 'safe');
    if (choiceUnavailable(g, getEvent(g)!.choices[index])) { g.pending = null; return; }
    resolveChoice(g, index, true);
  }
}
export function choiceUnavailable(g: Game, choice: Choice): string | null {
  if ((choice.cost ?? 0) > g.stones) return `需要 ${choice.cost} 灵石`;
  if (choice.requiresStat && g.stats[choice.requiresStat[0]] < choice.requiresStat[1]) return `未达到 ${choice.requiresStat[1]} 点属性门槛`;
  return null;
}
function resolveChoice(g: Game, index: number, automatic = false): string | null {
  if (!g.pending) return '目前没有等待决定的事件';
  const event = getEvent(g);
  const choice = event?.choices[index];
  if (!choice) return '无效的选项';
  const unavailable = choiceUnavailable(g, choice);
  if (unavailable) return unavailable;
  if (choice.cost) g.stones -= choice.cost;
  const success = choice.chance === undefined || random(g) < choice.chance;
  gain(g, success ? choice.effect : choice.failure);
  if (success) {
    recordStoryChoice(g, event, choice);
    recordHistoryChoice(g, event, choice);
  }
  const fatalConflict = recordRelationshipChoice(g, event, choice, success, { random, log, gain });
  if (!automatic) g.choices++;
  log(g, event.title, `${event.cause ? event.cause + ' ' : ''}${automatic ? '岁月中自然发生：' : ''}${choice.label}。${success ? choice.successText || choice.hint : choice.failureText || '未能如愿，但这段经历仍留在你的生命里。'}`, event.category, !automatic || event.id.startsWith('story-'));
  if (success && choice.delayed) { const { after, ...later } = choice.delayed; g.delayed.push({ at: g.age + after, ...later }); }
  g.pending = null;
  if (fatalConflict) finish(g, '旧怨中陨落', fatalConflict);
  checkLife(g); snapshot(g);
  return null;
}
function growNPCs(g: Game) {
  growRelationships(g, { random, log, gain }, npcLifeFactors);
}
function tendBelongings(g: Game) {
  if (!g.direction || g.age < 16) return;
  const needs: [string, boolean][] = [['heal', g.stats.health < 50], ['calm', g.stats.mind < 40], ['longevity', g.lifespan - g.age <= 10 && g.flags.filter(flag => flag.startsWith('longevity-')).length < 3]];
  for (const [id, needed] of needs) {
    if (!needed || !(g.inventory[id] > 0)) continue;
    const item = ITEMS.find(entry => entry.id === id)!;
    g.inventory[id]--;
    gain(g, item.effect!);
    if (id === 'longevity') g.flags.push(`longevity-${g.flags.filter(flag => flag.startsWith('longevity-')).length + 1}`);
    log(g, '随身的药', `${item.name}：${item.description}`, 'cultivation');
  }
}
function advanceOne(g: Game, director?: DirectorControl) {
  if (!g.alive || g.pending || g.expeditions?.active) return;
  g.age++; g.actionsLeft = 3;
  advanceHistory(g, { random, log, gain });
  tendBelongings(g);
  arrangeLife(g);
  advanceCultivation(g, { random, log, gain });
  growNPCs(g);
  resonateRelics(g, { random, log, gain });
  const due = g.delayed.filter(d => d.at <= g.age);
  g.delayed = g.delayed.filter(d => d.at > g.age);
  for (const delayed of due) { gain(g, delayed.effect); log(g, delayed.title, delayed.text, 'encounter', true); }
  if (g.age < 6) {
    gain(g, { stats: { health: 1, insight: 0.8, foundation: 0.5 } });
    if (g.age === 1) log(g, '最初的脚步', '你跌跌撞撞地走过门槛，家中响起一阵笑声。');
  } else {
    const rate = trainingRate(g);
    const learned = progressionBenefits(g);
    const r = g.realm;
    if (g.age < 16) gain(g, { progress: rate * 0.22, stones: 1, stats: { insight: 0.6, foundation: 0.6, combat: 0.3 } });
    else {
      gain(g, { stones: 3 + r * 2 });
      switch (g.focus) {
        case 'cultivate': gain(g, { progress: rate, stats: { mind: -1.2, health: -0.4, foundation: 0.4 } }); break;
        case 'study': gain(g, { progress: rate * 0.42, stats: { insight: 1.5, foundation: 1.2, mind: -0.3 } }); break;
        case 'work': gain(g, { progress: rate * 0.2, stones: (14 + 16 * r) * worldPhase(g).income * (g.route === 'alchemy' ? 1.15 : 1) + learned.workIncome, stats: { health: -0.6 } }); break;
        case 'alchemy': gain(g, { progress: rate * 0.3, stones: 5 + 4 * r, item: 'herb', amount: 2 + Math.floor(r / 2) + (g.region === 'river' ? 1 : 0) + (worldPhase(g).name === '百草丰年' ? 1 : 0), stats: { alchemy: g.route === 'alchemy' ? 2.2 : 1.5 } }); break;
        case 'rest': gain(g, { progress: rate * 0.12, stats: { health: 10 + learned.restHealth, mind: 8 + g.home.mat * 2 + learned.restMind } }); break;
        case 'social': gain(g, { progress: rate * 0.35, stats: { mind: 6, reputation: 0.5 } }); for (const npc of g.npcs.filter(n => n.alive && n.role !== 'enemy')) npc.relation = round(clamp(npc.relation + 1.2)); break;
        case 'adventure': {
          gain(g, { progress: rate * 0.8 * learned.adventureTraining, stones: (8 + r * 8) * (g.region === 'desert' ? 1.6 : 1) * (g.route === 'sword' ? 1.25 : 1) * (g.era === 'chaos' ? 1.25 : 1) * learned.adventureIncome, stats: { combat: 1.8 } });
          if (random(g) < 0.45) gain(g, { item: 'herb', amount: integer(g, 1, 3) });
          if (random(g) < 0.16) gain(g, { item: 'jade', amount: 1 });
          const combat = g.stats.combat + learned.adventureCombat;
          const risk = currentRegion(g).risk * currentEra(g).risk * worldPhase(g).risk * (1 - Math.min(100, combat) / 180) * (g.equipped === 'talisman' ? 0.6 : 1);
          if (random(g) < risk) {
            const damage = Math.ceil(integer(g, 8, 23) * (g.route === 'body' ? 0.7 : 1) * learned.adventureDamage);
            gain(g, { stats: { health: -damage } }); log(g, '历练负伤', `山路不总是坦途。你带着${damage}点体魄损耗归来，最好先静养。`, 'encounter');
          }
          break;
        }
      }
      const fate = fateInfluence(g);
      const upkeep = 4 + 5 * r + Object.values(g.home).reduce((sum, level) => sum + level * 2, 0) + fate.upkeep + learned.upkeep;
      if (fate.income) gain(g, { stones: fate.income });
      const shortage = Math.max(0, upkeep - g.stones);
      g.stones = Math.max(0, g.stones - upkeep);
      if (shortage) {
        gain(g, { stats: { health: -Math.min(5, 2 + shortage / 25), mind: -Math.min(5, 1 + shortage / 20) } });
        if (g.age % 5 === 0 || !g.logs.some(entry => entry.title === '修行资用短缺')) log(g, '修行资用短缺', `今年日常供养需要${upkeep}灵石，仍缺${shortage}灵石；缺资年份持续损耗体魄与道心。`, 'economy');
      }
      if (g.sect) {
        gain(g, sectAnnualEffect(g));
      }
      if (g.home.garden) gain(g, { item: 'herb', amount: g.home.garden + (g.region === 'river' ? 1 : 0) + (worldPhase(g).name === '百草丰年' ? 1 : 0) });
      if (g.home.library) gain(g, { stats: { insight: g.home.library * (g.focus === 'study' ? 0.8 : 0.4) } });
      for (const effect of storyAnnualEffects(g)) gain(g, effect);
      for (const effect of lifeAnnualEffects(g)) gain(g, effect);
      // High stats need continued attention; different choices fund or strain a way of life.
      gain(g, { stats: {
        health: -0.65 - r * 0.10 - (g.age > g.lifespan * 0.8 ? 0.8 : 0) - fate.healthDrain + learned.yearHealth,
        mind: -0.6 - Math.max(0, g.stats.mind - 60) * 0.022 - fate.mindDrain,
        foundation: -Math.max(0, g.stats.foundation - 40) * 0.045 + fate.foundationGrowth,
        insight: -Math.max(0, g.stats.insight - 45) * 0.038,
        reputation: -Math.max(0, g.stats.reputation - 25) * 0.021 + fate.reputationGrowth + learned.yearReputation,
        alchemy: -Math.max(0, g.stats.alchemy - 35) * 0.04,
        combat: -Math.max(0, g.stats.combat - 35) * 0.034,
      } });
      advancePreparation(g, { gain, log });
    }
    if (g.age % 5 === 0) log(g, g.age < 16 ? '少年渐长' : '岁月小记', `${g.age < 16 ? '读书、练功，渐渐长大。' : `日常修行按安排继续，眼下以${FOCUSES.find(f => f.id === g.focus)!.name}为重心。`}如今修为${g.progress}，积蓄${g.stones}灵石，体魄${g.stats.health}，道心${g.stats.mind}。`, g.focus === 'work' || g.focus === 'alchemy' ? 'economy' : 'cultivation');
  }
  checkLife(g);
  if (g.alive) selectEvent(g, director);
  if (g.alive && !g.pending && g.direction && g.age >= 16 && g.actionsLeft > 0 && g.stats.health >= 65 && g.stats.mind >= 48 && (g.realm < 5 || g.flags.includes('life-gate-open')) && g.progress >= REALMS[g.realm].need && g.stones >= REALMS[g.realm].cost && g.age >= g.cooldownUntil) breakthrough(g, g.inventory.breakpill > 0);
  snapshot(g);
}
function breakthrough(g: Game, usePill: boolean): string | null {
  if (g.age < 16) return '十六岁后才可独立冲关';
  if (g.realm >= 6) return '此生已飞升';
  if (g.age < g.cooldownUntil) return `伤及经脉，需调息至 ${g.cooldownUntil} 岁`;
  if (g.progress < REALMS[g.realm].need) return '修为尚未圆满';
  if (g.stats.health < 25) return '体魄低于 25，先养伤再冲关';
  const cost = REALMS[g.realm].cost;
  if (g.stones < cost) return `冲关需要 ${cost} 灵石`;
  if (usePill && !(g.inventory.breakpill > 0)) return '行囊中没有凝灵丹';
  const chance = breakthroughChance(g, usePill);
  const learned = progressionBenefits(g);
  g.stones -= cost; if (usePill) g.inventory.breakpill--;
  g.attempts++; g.actionsLeft--;
  if (random(g) < chance) {
    completePreparation(g, { gain, log });
    g.realm++; g.progress = 0; g.successes++;
    g.lifespan = g.realm === 6 ? 9999 : Math.max(g.lifespan, REALMS[g.realm].life + integer(g, -6, 12));
    gain(g, { stats: { health: 12, mind: 7, foundation: -8, reputation: 8 } });
    if (g.realm === 6) finish(g, '白日飞升', '天门洞开，山川在脚下铺展。你回望人间，那里有你住过的草屋、喝过的茶，以及再也不会忘记的名字。');
    else log(g, '破境 · ' + REALMS[g.realm].name, `你越过了那道门槛。寿元上限延至${g.lifespan}岁，此刻冲关成功率为${Math.round(chance * 100)}%。`, 'cultivation', true);
  } else {
    const injury = Math.ceil(integer(g, 15, 27) * learned.failureDamage);
    g.progress = round(g.progress * learned.failureRetention); g.cooldownUntil = g.age + Math.max(1, 2 + g.realm - learned.cooldownReduction);
    gain(g, { stats: { health: -injury, mind: -10, foundation: 4 } });
    log(g, '冲关未成', `灵气散尽，体魄损耗${injury}。你保住了大半修为，并从失败中夯实根基；${g.cooldownUntil}岁后可再试。`, 'cultivation', true);
    checkLife(g);
  }
  snapshot(g); return null;
}
function perform(g: Game, action: Action, director?: DirectorControl): string | null {
  if (action.type === 'star') { const entry = g.logs.find(l => l.id === action.id); if (entry) entry.starred = !entry.starred; return null; }
  if (!g.alive) return '此生已结卷，请在轮回页开启新的人生';
  if (action.type === 'retire') { finish(g, '归隐山林', '你放下追逐境界的执念，将此生的求道篇章停在这里。余下的光阴，留给山林、故人，以及自己的生活。'); return null; }
  const expeditionAction = action.type === 'expedition-start' || action.type === 'expedition-choose' || action.type === 'expedition-retreat';
  if (g.expeditions?.active && !expeditionAction) return '你正在亲历一段机缘，请先作出选择或撤退';
  if (expeditionAction) {
    if (g.pending) return '请先处理眼前的抉择';
    const error = mutateExpedition(g, action, { random, gain, log, checkLife });
    if (!error) snapshot(g);
    return error ?? null;
  }
  if (action.type === 'prepare') {
    if (g.pending) return '请先处理眼前的抉择';
    return selectPreparation(g, action.method) ?? null;
  }
  if (action.type === 'focus') {
    if (!FOCUSES.some(f => f.id === action.focus)) return '未知的修行重心';
    if (g.age < 6) return '六岁后可选择修行重心';
    delete g.direction;
    g.focus = action.focus; return null;
  }
  if (action.type === 'direction') {
    if (g.pending) return '请先处理眼前的抉择';
    if (g.age < 6) return '六岁后可选择生活方向';
    if (action.direction === null) delete g.direction;
    else {
      if (!LIFE_DIRECTIONS.some(item => item.id === action.direction)) return '未知的生活方向';
      g.direction = action.direction;
      arrangeLife(g);
    }
    return null;
  }
  if (action.type === 'choose') return resolveChoice(g, action.index);
  if (g.pending) return '请先处理眼前的抉择';
  if (action.type === 'advance') {
    const years = clamp(Math.floor(action.years ?? 1), 1, 100);
    for (let year = 0; year < years && g.alive && !g.pending; year++) advanceOne(g, director);
    return null;
  }
  if (g.age < 16) return '十六岁后可独立外出、交易与经营洞府';
  if (g.actionsLeft <= 0) return '今年的三次主动行动已用完，请推进一年';
  if (action.type === 'breakthrough') return breakthrough(g, Boolean(action.usePill));
  if (action.type === 'buy' || action.type === 'sell' || action.type === 'use') {
    const item = ITEMS.find(i => i.id === action.id);
    if (!item) return '没有这件物品';
    if (item.kind === 'relic') return '此物暂且留在行囊中';
    if (action.type === 'buy') {
      if (item.market === false) return '坊市没有出售此物';
      if (g.realm < item.minRealm) return '境界不足，无法购得此物';
      const price = itemPrice(g, item.id);
      if (g.stones < price) return '灵石不足';
      g.stones -= price; gain(g, { item: item.id });
      log(g, '坊市购入', `以${price}灵石购入${item.name}。`, 'economy');
    } else {
      if (!(g.inventory[item.id] > 0)) return '行囊中没有这件物品';
      if (action.type === 'sell') {
        if (g.equipped === item.id && g.inventory[item.id] === 1) return '请先卸下正在使用的法宝';
        g.inventory[item.id]--; const price = Math.floor(itemPrice(g, item.id) * 0.5); gain(g, { stones: price });
        log(g, '坊市出售', `售出${item.name}，获得${price}灵石。`, 'economy');
      } else if (item.kind === 'gear') {
        g.equipped = g.equipped === item.id ? null : item.id;
        log(g, g.equipped ? '法宝随身' : '收起法宝', `${g.equipped ? '装备' : '卸下'}${item.name}。`, 'cultivation');
      } else {
        if (!item.effect) return item.id === 'breakpill' ? '凝灵丹只能在突破时使用' : '这是一份材料，请到丹房炼制';
        if (item.effect.flag && g.flags.includes(item.effect.flag)) return '这本功法已经领悟，重复阅读不再增加属性';
        if (item.id === 'longevity' && g.flags.filter(f => f.startsWith('longevity-')).length >= 3) return '此生已服用三枚延寿丹，再服无效';
        if (item.id === 'heal' && g.stats.health >= 100) return '体魄已满，无需服药';
        if (item.id === 'calm' && g.stats.mind >= 100) return '道心已满，无需服药';
        g.inventory[item.id]--;
        const recovery = progressionBenefits(g).pillPotency;
        const effect = item.id === 'heal' ? { ...item.effect, stats: { ...item.effect.stats, health: (item.effect.stats?.health ?? 0) + recovery } }
          : item.id === 'calm' ? { ...item.effect, stats: { ...item.effect.stats, mind: (item.effect.stats?.mind ?? 0) + recovery } } : item.effect;
        gain(g, effect);
        if (item.id === 'longevity') g.flags.push(`longevity-${g.flags.filter(f => f.startsWith('longevity-')).length + 1}`);
        log(g, item.kind === 'book' ? '研读功法' : '服用丹药', `${item.name}：${item.description}${recovery && ['heal', 'calm'].includes(item.id) ? `所学药理额外恢复${recovery}。` : ''}`, 'cultivation');
      }
    }
  } else if (action.type === 'craft') {
    const recipe = RECIPES.find(r => r.id === action.id);
    if (!recipe) return '没有这份丹方';
    if (!g.home.furnace) return '先在洞府建造青铜丹炉';
    if (g.stats.alchemy < recipe.level) return `丹术需达到 ${recipe.level}`;
    if (g.stones < recipe.fee) return '炉火费用不足';
    if (Object.entries(recipe.materials).some(([id, amount]) => (g.inventory[id] || 0) < amount)) return '炼丹材料不足';
    g.stones -= recipe.fee;
    for (const [id, amount] of Object.entries(recipe.materials)) g.inventory[id] -= amount;
    const success = random(g) < craftChance(g);
    gain(g, { stats: { alchemy: success ? 3 : 4 }, ...(success ? { item: recipe.id } : {}) });
    const returnedHerbs = !success ? progressionBenefits(g).failedCraftHerbs : 0;
    if (returnedHerbs) gain(g, { item: 'herb', amount: returnedHerbs });
    log(g, success ? '开炉成丹' : '丹火未候', success ? `一枚${recipe.name}落入玉瓶。` : `这一炉${recipe.name}未成。${returnedHerbs ? `凭所学回收${returnedHerbs}株灵草，其余材料与炉费已消耗。` : '材料已经消耗，'}你对火候多了一分理解。`, 'cultivation', true);
  } else if (action.type === 'travel') {
    const region = REGIONS.find(r => r.id === action.id);
    if (!region) return '未知的目的地';
    if (region.id === g.region) return '你已在此处';
    if (g.realm < region.minRealm) return `抵达此地需要${REALMS[region.minRealm].name}境`;
    const cost = travelPrice(g, region.id);
    if (g.stones < cost) return '路费不足';
    g.stones -= cost; g.region = region.id;
    if (!g.visited.includes(region.id)) g.visited.push(region.id);
    log(g, '远行 · ' + region.name, `支付${cost}灵石路费。${storyTravelMultiplier(g) < 1 ? '沿途驿站接应，路费减少。' : ''}${region.description}`, 'world', true);
  } else if (action.type === 'join') {
    const sect = SECTS.find(s => s.id === action.id);
    if (!sect) return '没有这个宗门';
    const reason = sectEntryReason(g, sect.id); if (reason) return reason;
    g.stones -= sect.entryCost; g.sect = sect.id; g.sectRank = 0; g.contribution = 0;
    log(g, '拜入山门', `你成为${sect.name}的外门弟子。${sect.bonus}。`, 'relationship', true);
  } else if (action.type === 'sect') {
    if (!g.sect) return '你尚未加入宗门';
    if (action.job === 'learn') {
      const error = learnSectSpecialty(g, { gain, log }); if (error) return error;
    } else if (action.job === 'mission') {
      const sect = SECTS.find(s => s.id === g.sect)!;
      gain(g, sectMissionEffect(g));
      log(g, '完成宗门委托 · ' + sect.mission.name, sect.mission.description, 'economy');
    } else if (action.job === 'study') {
      if (g.contribution < 20) return '需要20宗门贡献';
      g.contribution -= 20; gain(g, sectStudyEffect(g));
      log(g, '藏经阁参修', '用20贡献换来一次参修，根基与悟性均有所长进。', 'cultivation');
    } else if (action.job === 'promote') {
      if (g.sectRank >= 3) return '已是传功长老';
      const required = [60, 180, 450][g.sectRank]; const realm = [1, 2, 3][g.sectRank];
      if (g.realm < realm || g.contribution < required) return `晋升需要${REALMS[realm].name}境与${required}贡献`;
      g.contribution -= required; g.sectRank++;
      log(g, '宗门晋升', `凭修行与功绩，你晋为${SECT_RANKS[g.sectRank]}。年度月例随之增加。`, 'relationship', true);
    } else if (action.job === 'leave') {
      log(g, '告别山门', `离开${SECTS.find(s => s.id === g.sect)!.name}，余下贡献清零。从此再作山野散修。`, 'relationship', true);
      g.sect = null; g.sectRank = 0; g.contribution = 0;
    } else return '未知的宗门事务';
  } else if (action.type === 'home') {
    const home = HOMES.find(h => h.id === action.id);
    if (!home) return '未知的洞府设施';
    if ((g.home[home.id] || 0) >= home.max) return '设施已达最高等级';
    const cost = homePrice(g, home.id); if (g.stones < cost) return '灵石不足';
    g.stones -= cost; g.home[home.id] = (g.home[home.id] || 0) + 1;
    log(g, '洞府小成', `${home.name}升至${g.home[home.id]}级，消耗${cost}灵石。${home.description}`, 'economy', true);
  } else if (action.type === 'npc') {
    const npc = g.npcs.find(n => n.id === action.id);
    if (!npc || !npc.alive) return '这位同道已经不在人间';
    if (npc.role === 'enemy') return '旧怨未了，对方不肯相聚';
    if (npc.lastInteraction === g.age) return '今年已与这位同道相聚，来年再访';
    if (action.interaction === 'talk') {
      npc.relation = clamp(npc.relation + 7); gain(g, { stats: { mind: 3, insight: 1 } });
      log(g, '相坐论道', `与${npc.name}共饮一盏茶，情谊增加7。`, 'relationship');
    } else if (action.interaction === 'gift') {
      const price = 12 + npc.realm * 8; if (g.stones < price) return `赠礼需要${price}灵石`;
      g.stones -= price; npc.relation = clamp(npc.relation + 13);
      log(g, '一份薄礼', `为${npc.name}准备一份${price}灵石的礼物，情谊增加13。`, 'relationship');
    } else if (action.interaction === 'duel') {
      const damage = integer(g, 3, npc.realm > g.realm ? 18 : 9);
      gain(g, { stats: { health: -damage, combat: 4, foundation: 2 } }); npc.relation = clamp(npc.relation + 3);
      log(g, '切磋印证', `与${npc.name}切磋，战技增加4、根基增加2，体魄损耗${damage}。`, 'relationship');
    } else if (action.interaction === 'bond') {
      if (g.age < 18 || npc.age < 18) return '双方成年后才能结为道侣';
      if (npc.relation < 75) return '情谊达到75后才可缔结道侣';
      if (g.npcs.some(n => n.alive && n.role === 'companion')) return '已有一位仍在人间的道侣';
      npc.role = 'companion'; npc.relation = clamp(npc.relation + 10);
      gain(g, { stats: { mind: 12 } });
      log(g, '愿同看山河', `你与${npc.name}结为道侣。各自修行，也在岁月中彼此照应。每年道心恢复0.8。`, 'relationship', true);
    } else return '未知的互动';
    if (npc.role === 'acquaintance' && npc.relation >= 50) npc.role = 'friend';
    npc.lastInteraction = g.age;
    // A fatal sparring injury is settled before any response; no model reply can undo death.
    checkLife(g);
    if (action.interaction !== 'bond') {
      const responses = npcResponses(g, npc, action.interaction);
      if (responses.length) {
        const local = pick(g, responses);
        const id = directCandidate(g, 'npc', responses.map(({ id, label, description }) => ({ id, label, description })), local.id, director, npc, action.interaction);
        const response = responses.find(candidate => candidate.id === id)!;
        gain(g, response.effect);
        log(g, npc.name + '的回应', response.text, 'relationship');
      }
    }
  }
  g.actionsLeft--; checkLife(g); snapshot(g); return null;
}

export function act(source: Game, action: Action): ActionResult {
  const game = structuredClone(source);
  const error = perform(game, action);
  return error ? { game: source, error } : { game };
}
export function autoChoice(g: Game, policy: 'safe' | 'bold' | 'random'): number {
  const event = getEvent(g);
  if (!event) return 0;
  const available = event.choices.map((choice, index) => ({ choice, index })).filter(({ choice }) => !choiceUnavailable(g, choice));
  if (!available.length) return 0;
  if (policy === 'random') return available[Math.floor((g.rng / 4294967296) * available.length)].index;
  const score = (choice: Choice) => choice.autoScore + (policy === 'bold' ? (choice.effect.progress ?? 0) / 10 + (choice.chance ? 5 : 0) : 0) - (g.stats.health < 45 && (choice.effect.stats?.health ?? 0) < 0 ? 20 : 0) + (g.stats.mind < 40 ? (choice.effect.stats?.mind ?? 0) / 2 : 0);
  return available.sort((a, b) => score(b.choice) - score(a.choice))[0].index;
}
function autoMutate(g: Game, policy: 'safe' | 'bold' | 'random', director?: DirectorControl) {
  if (!g.alive || g.expeditions?.active) return;
  if (g.pending) { if (!requiresPlayerChoice(g)) resolveChoice(g, autoChoice(g, policy)); return; }
  if (g.direction) { advanceOne(g, director); return; }
  if (g.age < 16) { advanceOne(g, director); return; }
  const preparation = preparationState(g);
  const preparing = preparation.selected && preparation.progress[preparation.selected] < preparationTarget(g.realm, preparation.selected);
  if (g.stats.health < (policy === 'bold' ? 40 : 60) || g.stats.mind < 42) g.focus = 'rest';
  else if (preparing) {
    if (g.stones < 12 + g.realm * 8) g.focus = 'work';
    else g.focus = ({ temper: 'adventure', meditate: 'study', medicine: 'alchemy' } as const)[preparation.selected!];
  }
  else if (g.progress >= REALMS[g.realm].need && g.age >= g.cooldownUntil && g.stones >= REALMS[g.realm].cost && g.actionsLeft > 0) { breakthrough(g, g.inventory.breakpill > 0); return; }
  else if (g.progress / REALMS[g.realm].need > 0.55 && g.stones < REALMS[g.realm].cost * 1.2) g.focus = 'work';
  else if (g.progress / REALMS[g.realm].need > 0.75 && g.stats.foundation < 50) g.focus = 'study';
  else if (g.flags.includes('legacy-eclipse') && ['rest', 'work', 'study', 'cultivate'].includes(g.focus)) g.focus = 'adventure';
  else if (['rest', 'work', 'study'].includes(g.focus)) g.focus = 'cultivate';
  advanceOne(g, director);
}
export function autoStep(source: Game, policy: 'safe' | 'bold' | 'random'): ActionResult {
  const game = structuredClone(source); autoMutate(game, policy); return { game };
}
function runDirectedAction(source: Game, action: DirectedAction, director: DirectorControl): ActionResult {
  const game = structuredClone(source);
  if (action.type === 'auto') { autoMutate(game, action.policy, director); return { game }; }
  const error = perform(game, action, director);
  return error ? { game: source, error } : { game };
}
/** Preview keeps the source untouched. Its result is the complete seeded offline fallback. */
export function planDirectedAction(source: Game, action: DirectedAction): DirectedPlan {
  const director: DirectorControl = {};
  const result = runDirectedAction(source, action, director);
  return { result, ...(!result.error && director.request ? { request: director.request } : {}) };
}
/** Replay an explicit choice against fresh engine conditions; invalid or stale replies fall back. */
export function commitDirectedAction(source: Game, action: DirectedAction, decision?: DirectorDecision): ActionResult {
  return runDirectedAction(source, action, { decision });
}
export function simulateLife(config: BirthConfig, policy: 'safe' | 'bold' | 'random' = 'safe'): Game {
  const game = createGame(config);
  for (let step = 0; step < 15000 && game.alive; step++) {
    // Test/research helper explicitly supplies choices; player-facing autoStep never does.
    if (requiresPlayerChoice(game)) resolveChoice(game, autoChoice(game, policy));
    else autoMutate(game, policy);
  }
  return game;
}
export function earnedAchievements(g: Game): string[] {
  const rules: Record<string, boolean> = { first: g.realm >= 1, foundation: g.realm >= 2, gold: g.realm >= 3, soul: g.realm >= 4, ascend: g.realm >= 6, friend: g.npcs.some(n => n.role === 'companion'), wealth: g.totalStones >= 3000, traveller: g.visited.length === REGIONS.length, master: g.sectRank === 3, life: !g.alive };
  return ACHIEVEMENTS.filter(a => rules[a.id]).map(a => a.id);
}
export function lifeLegacy(g: Game) {
  const fate = g.flags.includes('fate-city-defended') ? '边境山城的灯火因你的坚守得以延续。'
    : g.flags.includes('fate-city-abandoned') ? '那一夜失守的边城，是你求道途中最难遗忘的选择。'
    : g.flags.includes('fate-shared') ? '孤峰的石门曾为后辈打开，后来者将你的心法带往山海。'
    : g.flags.includes('fate-secluded') ? '你独守绝壁的古老传承，连山风都记得当年那扇关闭的石门。'
    : g.flags.includes('fate-honest') ? '你曾揭开灵石商会的旧账，为矿工与家眷留下公道。'
    : g.flags.includes('fate-magnate') ? '你曾以一本账簿改写商路与灵矿的命运。'
    : g.flags.includes('fate-guardian') ? '你曾与山城百姓立下守望之约。'
    : g.flags.includes('fate-lone') ? '你曾独入孤峰，求一条不同的路。'
    : g.flags.includes('fate-contract') ? '你曾与商盟共掌一段山河商路。' : '';
  const personal = g.flags.includes('open-teaching') || g.flags.includes('took-disciple') ? '留下薪火与弟子，后来者记得你的名字。'
    : g.flags.includes('saved-town') || g.flags.includes('home-school') ? '曾为一方百姓撑起一片安稳的天空。'
    : g.npcs.some(n => n.role === 'companion') ? '山河走过，有人与你共看过长夜。'
    : g.stats.alchemy >= 70 ? '药香未散，你的手艺仍在坊间流传。'
    : g.realm >= 4 ? '你的传说，留在那些仰望仙途的人口中。'
    : '未必人人知晓，但这一生的每一步都曾真实走过。';
  const identity = lifeIdentity(g);
  return [identity.description, lifeLegacyText(g), storyLegacy(g) || fate, personal].filter(Boolean).join(' ');
}
export function archiveLife(g: Game, date = new Date().toISOString()): LifeRecord {
  return { id: g.id, name: g.name, age: g.age, realm: g.realm, origin: g.origin, route: g.route, ending: g.ending ?? '未结卷', endingText: g.endingText, totalStones: g.totalStones, choices: g.choices, legacy: lifeLegacy(g), logs: g.logs.filter(l => l.important || l.starred).slice(-500), date };
}
export function biography(record: LifeRecord): string {
  return `万仙之一 · ${record.name}生平\n\n出身：${ORIGINS.find(o => o.id === record.origin)?.name ?? record.origin}\n结卷年龄：${record.age}岁\n最高境界：${REALMS[record.realm].name}\n结局：${record.ending}\n\n${record.endingText}\n${record.legacy}\n\n—— 生平大事 ——\n\n${record.logs.map(l => `${l.age}岁 · ${l.title}\n${l.text}`).join('\n\n')}`;
}
