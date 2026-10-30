import test from 'node:test';
import assert from 'node:assert/strict';
import { act, autoChoice, breakthroughChance, createGame, getEvent, random, simulateLife, trainingRate } from '../src/game/engine.ts';
import { EVENTS } from '../src/game/events.ts';
import { HISTORY_CHAPTERS, advanceHistory, historyView, initializeHistory, recordHistoryChoice, resonateRelics, worldYear } from '../src/game/history.ts';
import { bindRelationshipEvent, confrontationChance, growRelationships, meetPerson, nextRelationshipEvent } from '../src/game/relationships.ts';
import { npcLifeFactors } from '../src/game/lifelines.ts';
import { activateStoryPath, getStoryEvent } from '../src/game/story.ts';
import { sectAnnualEffect, sectEntryReason } from '../src/game/sects.ts';
import { newProfile, parseProfile, settleProfile, validGame } from '../src/game/storage.ts';
import { withLegacyPeers } from './fixtures.ts';
import type { Action, BirthConfig, Effect, Game, LogKind } from '../src/game/types.ts';

const config: BirthConfig = { name: '沈听澜', gender: '随缘', origin: 'random', era: 'peace', region: 'qinglan', route: 'balanced', mode: 'seeker', fastStart: false, seed: 'world-history-test' };
const birth = (seed = config.seed) => createGame({ ...config, seed });
function adult(seed = config.seed) {
  const g = birth(seed); Object.assign(g, { age: 26, realm: 2, lifespan: 260, stones: 2000, progress: 50 });
  Object.assign(g.stats, { health: 85, mind: 75, combat: 60, insight: 65, foundation: 65 });
  return g;
}
const step = (g: Game, action: Action) => { const result = act(g, action); assert.equal(result.error, undefined); return result.game; };
const hooks = {
  random,
  log(g: Game, title: string, text: string, kind: LogKind, important = false) { g.logs.push({ id: ++g.logSeq, age: g.age, title, text, kind, important }); },
  gain(g: Game, effect: Effect) { g.stones += effect.stones ?? 0; g.progress += effect.progress ?? 0; for (const [key, value] of Object.entries(effect.stats ?? {})) g.stats[key as keyof Game['stats']] = Math.min(100, g.stats[key as keyof Game['stats']] + value!); },
};
function meeting(g: Game, id = 'meet-heir') {
  bindRelationshipEvent(g, id, hooks); g.pending = id; g.seen[id] = g.age;
  return g;
}
function enemy() {
  let g = meeting(adult()); const choices = getEvent(g)!.choices;
  g = step(g, { type: 'choose', index: choices.findIndex(c => c.effect.flag?.endsWith(':take')) });
  const npc = g.npcs[0]; npc.pursuitAt = g.age; npc.realm = 4; npc.lifespan = 1120; npc.gear = { name: '离火宝轮', tier: 4 };
  g.realm = 1; g.stats.health = 25;
  bindRelationshipEvent(g, 'rival-pursuit', hooks); g.pending = 'rival-pursuit'; g.seen[g.pending] = g.age;
  return g;
}

test('a newborn knows nobody; first acquaintance is produced by a real encounter and survives reload', () => {
  let g = birth(); assert.deepEqual(g.npcs, []); assert.ok(validGame(g));
  for (let i = 0; i < 70 && g.npcs.length === 0; i++) g = g.pending ? step(g, { type: 'choose', index: autoChoice(g, 'safe') }) : step(g, { type: 'advance' });
  assert.ok(g.npcs.length > 0); assert.ok(g.pending?.startsWith('meet-'));
  const npc = g.npcs[0]; assert.equal(npc.role, 'acquaintance'); assert.equal(npc.metAt, g.age);
  const loaded = parseProfile(JSON.stringify(settleProfile(newProfile(), g))).game!;
  assert.deepEqual(loaded.npcs, g.npcs); assert.deepEqual(getEvent(loaded), getEvent(g));
  const friend = step(loaded, { type: 'choose', index: 0 });
  assert.equal(friend.npcs[0].role, 'friend'); assert.equal(friend.npcs.length, 1);
});

test('meeting choices can leave an acquaintance, make a benefactor or create a named enemy', () => {
  const start = meeting(adult(), 'meet-healer');
  assert.equal(step(start, { type: 'choose', index: 1 }).npcs[0].role, 'acquaintance');
  const aid = getEvent(start)!.choices.findIndex(c => c.effect.flag?.endsWith(':aid'));
  assert.equal(step(start, { type: 'choose', index: aid }).npcs[0].role, 'benefactor');
  const hostile = enemy(); assert.equal(hostile.npcs[0].role, 'enemy');
  assert.ok(hostile.npcs[0].grievance?.includes(hostile.npcs[0].name));
  assert.ok(act(hostile, { type: 'npc', id: hostile.npcs[0].id, interaction: 'gift' }).error);
});

test('realm and equipment both change the actual confrontation chance', () => {
  const g = enemy(), npc = g.npcs[0]; npc.realm = g.realm; npc.gear!.tier = 0;
  const equal = confrontationChance(g, npc);
  npc.gear!.tier = 4; const armed = confrontationChance(g, npc);
  npc.realm += 2; const superior = confrontationChance(g, npc);
  assert.ok(superior < armed && armed < equal);
  g.inventory.talisman = 1; g.equipped = 'talisman'; assert.ok(confrontationChance(g, npc) > superior);
});

test('a stronger pursuer can kill the player; the warning, ending and archived killer agree', () => {
  const source = enemy(); assert.match(getEvent(source)!.choices[0].hint, /会陨落/);
  let fatal: Game | undefined;
  for (let i = 1; i < 100; i++) {
    const g = step({ ...source, rng: i * 65537 }, { type: 'choose', index: 0 });
    if (!g.alive) { fatal = g; break; }
  }
  assert.ok(fatal); assert.equal(fatal.ending, '旧怨中陨落'); assert.equal(fatal.pending, null);
  assert.ok(fatal.endingText.includes(source.npcs[0].name)); assert.ok(validGame(fatal));
  const profile = settleProfile(newProfile(), fatal); assert.equal(profile.archives.length, 1);
  assert.ok(profile.archives[0].endingText.includes(source.npcs[0].name));
});

test('settling a grievance ends pursuit without fabricating a friendship', () => {
  const g = enemy(), index = getEvent(g)!.choices.findIndex(c => c.effect.flag?.endsWith(':settle'));
  const price = getEvent(g)!.choices[index].cost!;
  const settled = step(g, { type: 'choose', index });
  assert.equal(settled.stones, g.stones - price); assert.equal(settled.npcs[0].role, 'rival');
  assert.equal(settled.npcs[0].hostility, 0); assert.notEqual(nextRelationshipEvent(settled, 1), 'rival-pursuit');
});

test('shelter requires an actual capable ally nearby or an open local sect', () => {
  const g = enemy(); g.sect = 'qinglan'; g.contribution = 40;
  assert.ok(getEvent(g)!.choices.some(c => c.effect.flag?.endsWith(':shelter')));
  g.region = 'river'; assert.ok(!getEvent(g)!.choices.some(c => c.effect.flag?.endsWith(':shelter')));
  const ally = meetPerson(g, 'elder', hooks); ally.role = 'friend'; ally.relation = 80; ally.realm = 4;
  assert.ok(getEvent(g)!.choices.some(c => c.effect.npcId === ally.id));
  ally.region = 'north'; assert.ok(!getEvent(g)!.choices.some(c => c.effect.npcId === ally.id));
});

test('NPC advancement has independent pace and a real bottleneck, not player-level scaling', () => {
  const g = adult(), slow = meetPerson(g, 'wanderer', hooks), fast = meetPerson(g, 'prodigy', hooks);
  for (const npc of g.npcs) { npc.realm = 1; npc.age = 30; npc.lifespan = 1000; npc.progress = 0; npc.career!.resources = 10000; npc.career!.opportunityAt = 10000; npc.career!.breakthroughAt = 0; }
  slow.career!.pace = .3; slow.career!.ceiling = 1; fast.career!.pace = 2.25; fast.career!.ceiling = 5;
  const other = structuredClone(g); other.realm = 5;
  const stableHooks = { ...hooks, random: () => .12 };
  for (let year = 0; year < 45; year++) { g.age++; other.age++; growRelationships(g, stableHooks, npcLifeFactors); growRelationships(other, stableHooks, npcLifeFactors); }
  assert.deepEqual(g.npcs, other.npcs); assert.equal(slow.realm, 1); assert.ok(fast.realm > slow.realm);
  slow.career!.opportunityAt = slow.age;
  growRelationships(g, { ...hooks, random: () => .05 }, npcLifeFactors);
  assert.ok(slow.career!.ceiling > 1, 'a later opportunity can open a formerly blocked road');
});

test('the player has temporary slow periods and discoveries with real training and breakthrough effects', () => {
  const baseline = adult();
  const stalled = structuredClone(baseline), inspired = structuredClone(baseline);
  stalled.fortune = { flow: .5, until: 45, nextAt: 50, insight: 0, impasseUntil: 45 };
  inspired.fortune = { flow: 2, until: 45, nextAt: 50, insight: .16, impasseUntil: 0 };
  assert.ok(trainingRate(stalled) < trainingRate(baseline)); assert.ok(trainingRate(inspired) > trainingRate(baseline));
  assert.ok(breakthroughChance(stalled) < breakthroughChance(inspired));
  assert.ok(step(stalled, { type: 'advance' }).progress < step(inspired, { type: 'advance' }).progress);
});

test('world history uses its own calendar and random stream and proceeds without player participation', () => {
  const a = adult(), b = structuredClone(a);
  a.age = b.age = 31; a.history!.lastYear = b.history!.lastYear = 2331; a.rng = 77; b.rng = 8912; b.realm = 4;
  const first = step(a, { type: 'advance' }), second = step(b, { type: 'advance' });
  assert.equal(worldYear(first), 2332); assert.deepEqual(first.history, second.history);
  assert.ok(first.history!.outcomes[HISTORY_CHAPTERS[0].id]); assert.ok(first.logs.some(log => log.title.includes(HISTORY_CHAPTERS[0].title)));
  const late = createGame({ ...config, era: 'chaos' });
  assert.equal(worldYear(late), 2362); assert.ok(Object.keys(late.history!.outcomes).length >= 2);
});

test('the same world seed has counterfactual outcomes influenced by a supported faction, not guaranteed wins', () => {
  const chapter = HISTORY_CHAPTERS[0]; let wins = 0, neutralWins = 0, changes = 0;
  for (let seed = 0; seed < 80; seed++) {
    const g = adult(`history-impact-${seed}`); g.realm = 4; g.age = 31; g.history!.lastYear = 2331;
    const neutral = structuredClone(g); g.pending = `history-${chapter.id}`;
    const index = getEvent(g)!.choices.findIndex(c => c.effect.flag === `history-choice:${chapter.id}:${chapter.sides[0]}`);
    const committed = step(g, { type: 'choose', index });
    const result = step(committed, { type: 'advance' }), control = step(neutral, { type: 'advance' });
    wins += Number(result.history!.outcomes[chapter.id] === chapter.sides[0]);
    neutralWins += Number(control.history!.outcomes[chapter.id] === chapter.sides[0]);
    changes += Number(result.history!.outcomes[chapter.id] !== control.history!.outcomes[chapter.id]);
  }
  assert.ok(wins > neutralWins && changes > 0); assert.ok(wins < 80);
});

test('a ruined faction actually stops the sect allowance and recruitment', () => {
  const g = adult(); g.sect = 'qinglan'; g.history!.strength.sword = 10;
  assert.equal(sectAnnualEffect(g).stones ?? 0, 0);
  const outsider = { ...g, sect: null }; assert.match(sectEntryReason(outsider, 'qinglan')!, /闭守/);
  const thriving = structuredClone(g); thriving.history!.strength.sword = 90;
  assert.ok((sectAnnualEffect(thriving).stones ?? 0) > 0);
  assert.ok(step(thriving, { type: 'advance' }).stones > step(g, { type: 'advance' }).stones);
});

test('an unknown relic cannot be sold or clicked for reward, but resonates in its later chapter only once', () => {
  let g = adult(); g.inventory['relic-jade'] = 1;
  assert.ok(act(g, { type: 'use', id: 'relic-jade' }).error); assert.ok(act(g, { type: 'sell', id: 'relic-jade' }).error);
  g.age = 39; g.region = 'river'; g.history!.lastYear = 2339;
  g = step(g, { type: 'advance' });
  assert.ok(g.flags.includes('relic-known:relic-jade')); assert.equal(g.inventory['relic-jade'], 1);
  assert.equal(g.logs.filter(log => log.title === '旧物有了来历').length, 1);
  const before = structuredClone(g); resonateRelics(g, hooks); assert.deepEqual(g, before);
  const choices = getEvent(g)!; assert.equal(choices.id, 'history-seven-bridges');
  g = step(g, { type: 'choose', index: 0 });
  assert.ok(g.flags.includes('relic-used:relic-jade:seven-bridges'));
  assert.ok(g.history!.choices['seven-bridges'].weight > 8 + g.realm * 5);
});

test('historical rewards require presence and future chapters are absent from the live world view', () => {
  const g = adult(); g.age = 26; g.region = 'river';
  const event = getEvent(g, `history-${HISTORY_CHAPTERS[0].id}`)!;
  assert.ok(!event.choices.some(choice => choice.effect.item));
  assert.ok(!JSON.stringify(historyView(g)).includes('天门重光'));
  assert.ok(event.choices.some(choice => !choice.cost && !choice.requiresStat));
});

test('books are learned and a stronger new artifact is equipped as part of receiving it', () => {
  let g = adult(); g = step(g, { type: 'buy', id: 'manual' });
  assert.ok(g.flags.includes('read-manual')); assert.equal(g.inventory.manual, 0);
  g = step(g, { type: 'buy', id: 'sword' }); assert.equal(g.equipped, 'sword');
  g = step(g, { type: 'use', id: 'sword' }); assert.equal(g.equipped, null);
});

test('guided daily care uses owned medicine without spending another action point', () => {
  const g = adult(); g.direction = 'seek'; g.stats.health = 20; g.inventory.heal = 1;
  const next = step(g, { type: 'advance' });
  assert.equal(next.inventory.heal, 0); assert.equal(next.actionsLeft, 3); assert.ok(next.stats.health > g.stats.health);
});

test('legacy v1 relationships survive loading unchanged and malformed new fields are rejected', () => {
  const legacy = withLegacyPeers(adult()); delete legacy.history; delete legacy.fortune;
  const restored = parseProfile(JSON.stringify(settleProfile(newProfile(), legacy))).game!;
  assert.deepEqual(restored.npcs, legacy.npcs); assert.equal(restored.history, undefined);
  const g = enemy(); assert.ok(validGame(g));
  for (const mutate of [
    (x: Game) => { x.npcs.push(structuredClone(x.npcs[0])); },
    (x: Game) => { x.npcs[0].gear!.tier = 100; },
    (x: Game) => { x.history!.strength.sword = -1; },
    (x: Game) => { x.history!.outcomes['unknown-chapter'] = 'sword'; },
    (x: Game) => { x.flags = x.flags.filter(flag => !flag.startsWith('meeting-actor:')); },
    (x: Game) => { x.fortune = { flow: -1, until: 10, nextAt: 20, insight: 0, impasseUntil: 0 }; },
  ]) { const corrupt = structuredClone(g); mutate(corrupt); assert.equal(validGame(corrupt), false); }
});

test('changing a lived story path keeps its actual companion instead of inventing an unmet one', () => {
  const g = adult(); const healer = meetPerson(g, 'healer', hooks, 'peer-1');
  activateStoryPath(g, 'guardian'); activateStoryPath(g, 'contract');
  assert.ok(g.flags.includes(`story-person:contract:${healer.id}`));
  const event = getStoryEvent(g, 'story-contract-supply'); assert.ok(event?.choices.length); assert.ok(event.text.includes(healer.name));
  const formerBlock = simulateLife({ ...config, name: '林听澜', seed: 'batch-285', route: 'sword', mode: 'all', fastStart: true }, 'bold');
  assert.equal(formerBlock.alive, false); assert.ok(validGame(formerBlock));
});

test('dynamic meeting and pursuit records always expose a reachable decision', () => {
  for (const id of ['meet-road', 'meet-healer', 'meet-heir', 'meet-sword', 'meet-stranger']) {
    const g = meeting(adult(), id), event = getEvent(g)!;
    assert.ok(event.choices.some(c => !c.cost && !c.requiresStat)); assert.ok(validGame(g));
    const rng = g.rng; assert.deepEqual(getEvent(g), event); assert.equal(g.rng, rng);
  }
  assert.ok(getEvent(enemy())!.choices.some(c => !c.cost && !c.requiresStat));
});
