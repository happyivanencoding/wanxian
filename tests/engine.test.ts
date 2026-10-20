import test from 'node:test';
import assert from 'node:assert/strict';
import { act, archiveLife, autoChoice, autoStep, biography, breakthroughChance, breakthroughFactors, craftChance, createGame, currentEra, currentRegion, getEvent, requiresPlayerChoice, trainingFactors, trainingRate, travelPrice, worldPhase, eventEligible, homePrice, itemPrice, simulateLife } from '../src/game/engine.ts';
import { EVENTS, EVENT_MAP } from '../src/game/events.ts';
import { fateInfluence } from '../src/game/fate.ts';
import { storyView } from '../src/game/story.ts';
import { ITEMS, REALMS, REGIONS } from '../src/game/data.ts';
import { attainedAbilities, companionTraits, preparationChance, preparationState, preparationTarget, preparationView, sectSpecialty } from '../src/game/progression.ts';
import { expeditionOffers, expeditionView } from '../src/game/expeditions.ts';
import { lifeIdentity, regionPractice, regionWorld, sectHome } from '../src/game/world.ts';
import { BACKUP_KEY, SAVE_KEY, loadProfile, newProfile, parseProfile, persistProfile, settleProfile, validGame } from '../src/game/storage.ts';
import type { BirthConfig, Game, PreparationMethod } from '../src/game/types.ts';
const config: BirthConfig = { name: '林听澜', gender: '随缘', origin: 'random', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: false, seed: 'test-1701' };
const prepared = () => {
  const g = createGame(config); g.age = 25; g.realm = 2; g.lifespan = 260; g.stones = 1000; g.actionsLeft = 3; g.pending = null;
  g.stats = { health: 90, mind: 70, foundation: 60, insight: 60, reputation: 50, combat: 60, alchemy: 70 }; return g;
};
const update = (g: Game, a: Parameters<typeof act>[1]) => { const r = act(g, a); assert.equal(r.error, undefined); return r.game; };
function until(g: Game, target: number) { for (let i = 0; i < 1000 && g.age < target && g.alive; i++) g = g.pending ? update(g, { type: 'choose', index: autoChoice(g, 'safe') }) : update(g, { type: 'advance' }); return g; }
function untilStory(g: Game, matches: (id: string) => boolean) {
  for (let step = 0; step < 500 && g.alive; step++) {
    if (g.pending && matches(g.pending)) return g;
    g = g.pending ? update(g, { type: 'choose', index: autoChoice(g, 'safe') }) : update(g, { type: 'advance' });
  }
  assert.fail(`The story did not arrive before age ${g.age}: ${g.ending ?? g.pending}`);
}
function storyOpening() {
  const g = prepared(); g.age = 21; g.focus = 'rest'; g.stones = 10000;
  return untilStory(g, id => id.startsWith('story-call-'));
}

test('identical seed and configuration reproduce an identical life', () => {
  assert.deepEqual(createGame(config), createGame(config));
  const a = simulateLife(config), b = simulateLife(config); assert.deepEqual(a, b); assert.equal(a.alive, false);
});
test('birth configurations change implemented conditions', () => {
  const village = createGame({ ...config, origin: 'village' }), merchant = createGame({ ...config, origin: 'merchant' });
  assert.ok(merchant.stones > village.stones); assert.ok(validGame(village)); assert.ok(validGame(merchant));
  assert.notDeepEqual(createGame({ ...config, seed: 'other' }).npcs, village.npcs);
});
test('multi-year advance stops exactly at a pending childhood event', () => {
  const g = update(createGame(config), { type: 'advance', years: 100 });
  assert.equal(g.age, 2); assert.equal(g.pending, 'child-pebble');
  assert.equal(act(g, { type: 'advance', years: 5 }).game, g);
  assert.equal(update(g, { type: 'choose', index: 0 }).pending, null);
});
test('fast start simulates rather than deletes childhood', () => {
  const g = createGame({ ...config, fastStart: true });
  assert.equal(g.age, 16); assert.equal(g.pending, 'departure');
  assert.ok(g.logs.some(l => l.title === '山门测灵')); assert.ok(g.stats.insight > 32);
});
test('event ids are unique; every event has at least one zero-cost fallback', () => {
  assert.equal(new Set(EVENTS.map(e => e.id)).size, EVENTS.length);
  assert.ok(EVENTS.length >= 60);
  for (const event of EVENTS) assert.ok(getEvent(prepared(), event.id)?.choices.some(c => !c.cost && !c.requiresStat), event.id);
});
test('event selection honors region, focus, flags, age and one-shot history', () => {
  const g = prepared(); const e = EVENT_MAP.cave;
  assert.equal(eventEligible(g, e), false); g.focus = 'adventure'; assert.equal(eventEligible(g, e), true);
  g.seen.cave = g.age; assert.equal(eventEligible(g, e), false);
  assert.equal(eventEligible(g, EVENT_MAP['snow-hermit']), false); g.region = 'north'; assert.equal(eventEligible(g, EVENT_MAP['snow-hermit']), true);
  assert.equal(eventEligible(g, EVENT_MAP['cave-return']), false); g.flags.push('cave-reported'); assert.equal(eventEligible(g, EVENT_MAP['cave-return']), true);
});
test('unaffordable or invalid actions are atomic and preserve source', () => {
  const g = prepared(); g.stones = 0; const before = JSON.stringify(g);
  const r = act(g, { type: 'buy', id: 'sword' }); assert.ok(r.error); assert.equal(r.game, g); assert.equal(JSON.stringify(g), before);
  g.pending = 'auction'; assert.ok(act(g, { type: 'choose', index: 0 }).error); assert.equal(g.pending, 'auction');
});
test('choices schedule genuine delayed consequences', () => {
  let g = prepared(); g.pending = 'merchant-rescue';
  g = update(g, { type: 'choose', index: 0 }); assert.equal(g.delayed.length, 1); assert.equal(g.delayed[0].at, 33);
  g.focus = 'rest'; g = until(g, 33); assert.ok(g.logs.some(l => l.title === '八年前的那场雨')); assert.ok(!g.delayed.some(d => d.title === '八年前的那场雨'));
});
test('breakthrough success changes realm, resets progress, extends life and spends resources', () => {
  let g = prepared(); g.progress = REALMS[g.realm].need; g.rng = 0;
  const cost = REALMS[g.realm].cost, oldLife = g.lifespan;
  g = update(g, { type: 'breakthrough' }); assert.equal(g.realm, 3); assert.equal(g.progress, 0); assert.equal(g.stones, 1000 - cost); assert.ok(g.lifespan > oldLife); assert.equal(g.actionsLeft, 2);
});
test('failed breakthrough has a real cooldown, injury and retained realm', () => {
  let g = prepared(); g.progress = REALMS[g.realm].need; g.rng = 1000; g.stats.foundation = 10; g.stats.insight = 10; g.stats.mind = 30;
  assert.ok(breakthroughChance(g) < .6);
  g = update(g, { type: 'breakthrough' }); assert.equal(g.realm, 2); assert.ok(g.cooldownUntil > g.age); assert.ok(g.stats.health < 90); assert.ok(g.progress < REALMS[2].need);
  g.progress = REALMS[2].need; assert.ok(act(g, { type: 'breakthrough' }).error);
});
test('three active actions per year; advance restores them', () => {
  let g = prepared(); for (let i = 0; i < 3; i++) g = update(g, { type: 'buy', id: 'herb' });
  assert.equal(g.actionsLeft, 0); assert.ok(act(g, { type: 'buy', id: 'herb' }).error);
  g = update(g, { type: 'advance' }); assert.equal(g.actionsLeft, 3);
});
test('inventory purchases, equipment switching and selling preserve real inventory', () => {
  let g = prepared(); const price = itemPrice(g, 'sword');
  g = update(g, { type: 'buy', id: 'sword' }); assert.equal(g.inventory.sword, 1); assert.equal(g.stones, 1000 - price);
  g = update(g, { type: 'use', id: 'sword' }); assert.equal(g.equipped, 'sword'); assert.ok(act(g, { type: 'sell', id: 'sword' }).error);
  g = update(g, { type: 'use', id: 'sword' }); assert.equal(g.equipped, null);
});
test('books cannot be farmed and longevity pills have a lifetime limit', () => {
  let g = prepared(); g.inventory.manual = 2;
  g = update(g, { type: 'use', id: 'manual' }); assert.equal(g.inventory.manual, 1); assert.ok(act(g, { type: 'use', id: 'manual' }).error);
  g = prepared(); g.inventory.longevity = 4;
  for (let i = 0; i < 3; i++) g = update(g, { type: 'use', id: 'longevity' });
  g.actionsLeft = 3; assert.equal(g.lifespan, 350); assert.ok(act(g, { type: 'use', id: 'longevity' }).error); assert.equal(g.inventory.longevity, 1);
});
test('home investments cost money and craft requires actual ingredients', () => {
  let g = prepared(); const cost = homePrice(g, 'furnace');
  assert.ok(act(g, { type: 'craft', id: 'heal' }).error);
  g = update(g, { type: 'home', id: 'furnace' }); assert.equal(g.home.furnace, 1); assert.equal(g.stones, 1000 - cost);
  g.rng = 0; const herbs = g.inventory.herb; g = update(g, { type: 'craft', id: 'heal' }); assert.equal(g.inventory.herb, herbs - 3); assert.equal(g.inventory.heal, 2);
});
test('region travel changes environment and cannot skip realm gates', () => {
  let g = prepared(); assert.ok(act(g, { type: 'travel', id: 'central' }).error);
  g = update(g, { type: 'travel', id: 'river' }); assert.equal(g.region, 'river'); assert.ok(g.visited.includes('river')); assert.equal(g.stones, 975);
});
test('story waystations reduce the charged travel price and remain usable when only the discounted fare is affordable', () => {
  const normal = prepared();
  const linked = structuredClone(normal); linked.flags.push('story-active-contract', 'fate-contract', 'story-waystations');
  const fare = travelPrice(linked, 'river');
  assert.equal(fare, Math.ceil(travelPrice(normal, 'river') * 0.7));
  assert.ok(fare < travelPrice(normal, 'river'));
  linked.stones = fare;
  const travelled = update(linked, { type: 'travel', id: 'river' });
  assert.equal(travelled.stones, 0); assert.equal(travelled.region, 'river');
  const changed = structuredClone(linked);
  changed.flags = changed.flags.filter(flag => flag !== 'story-active-contract'); changed.flags.push('story-active-guardian');
  assert.equal(travelPrice(changed, 'river'), travelPrice(normal, 'river'), 'An inactive former route must not keep its operating discount.');
});
test('sect membership, tasks and rank promotion spend the correct contributions', () => {
  let g = prepared(); g = update(g, { type: 'join', id: 'qinglan' }); assert.equal(g.sect, 'qinglan'); assert.equal(g.stones, 970);
  g = update(g, { type: 'sect', job: 'mission' }); assert.equal(g.contribution, 22); assert.equal(g.stats.health, 84);
  g.contribution = 70; g = update(g, { type: 'sect', job: 'promote' }); assert.equal(g.sectRank, 1); assert.equal(g.contribution, 10);
});
test('NPC interaction is bounded per year and companionship is exclusive', () => {
  let g = prepared(); g.npcs[0].relation = 80; g = update(g, { type: 'npc', id: g.npcs[0].id, interaction: 'bond' });
  assert.equal(g.npcs[0].role, 'companion'); assert.ok(act(g, { type: 'npc', id: g.npcs[0].id, interaction: 'talk' }).error);
  g.npcs[1].relation = 80; assert.ok(act(g, { type: 'npc', id: g.npcs[1].id, interaction: 'bond' }).error);
});
test('death stops simulation; retirement remains distinct from death; archives are deduplicated', () => {
  let g = prepared(); g.age = g.lifespan - 1; g.focus = 'rest'; g = update(g, { type: 'advance' }); assert.equal(g.alive, false); assert.equal(g.ending, '寿终坐化'); assert.equal(g.pending, null);
  assert.ok(act(g, { type: 'advance' }).error);
  const retired = update(prepared(), { type: 'retire' }); assert.equal(retired.ending, '归隐山林');
  let p = settleProfile(newProfile(), retired); p = settleProfile(p, retired); assert.equal(p.archives.length, 1); assert.equal(archiveLife(g).age, g.age);
});
test('save round-trip, validation and corruption fallback never replace a valid game with malformed data', () => {
  const p = settleProfile(newProfile(), prepared()); p.slots[0] = { name: '手动', savedAt: '2026-10-20', game: prepared() };
  assert.deepEqual(parseProfile(JSON.stringify(p)), p);
  for (const bad of [{ ...p, version: 2 }, { ...p, game: { ...p.game, stats: {} } }, { ...p, game: { ...p.game, pending: 'missing-event' } }, { ...p, slots: [] }]) assert.throws(() => parseProfile(JSON.stringify(bad)));
  const data = new Map<string, string>(); const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
  persistProfile(storage, p); persistProfile(storage, p); assert.ok(data.has(BACKUP_KEY)); data.set(SAVE_KEY, '{bad');
  const recovered = loadProfile(storage); assert.deepEqual(recovered.profile, p); assert.ok(recovered.warning); assert.equal(recovered.canSave, true);
  data.set(BACKUP_KEY, '{also-bad'); assert.equal(loadProfile(storage).canSave, false); assert.equal(data.get(SAVE_KEY), '{bad');
});
test('effort allocation changes progress, knowledge, money and recovery without outcome quotas', () => {
  const base = prepared(); base.progress = 0;
  const year = (focus: Game['focus']) => update(update(base, { type: 'focus', focus }), { type: 'advance' });
  const practice = year('cultivate'), study = year('study'), rest = year('rest'), work = year('work');
  assert.ok(practice.progress > study.progress && study.progress > rest.progress);
  assert.ok(study.stats.insight > practice.stats.insight);
  assert.ok(work.stones > practice.stones);
  assert.ok(rest.stats.health > practice.stats.health && rest.stats.mind > practice.stats.mind);
});
test('genuine preparation and a better environment improve opportunities', () => {
  const base = prepared(); const better = structuredClone(base);
  better.stats.foundation = 90; better.stats.insight = 90; better.stats.mind = 90;
  assert.ok(breakthroughChance(better) > breakthroughChance(base));
  assert.ok(breakthroughChance(base, true) > breakthroughChance(base));
  better.home.array = 3; better.home.mat = 3; better.region = 'desert';
  assert.ok(trainingRate(better) > trainingRate(base));
});
test('not seeking breakthroughs can end naturally while a purposeful life can succeed', () => {
  let quiet = createGame({ ...config, fastStart: true });
  if (quiet.pending) quiet = update(quiet, { type: 'choose', index: autoChoice(quiet, 'safe') });
  quiet = update(quiet, { type: 'focus', focus: 'rest' });
  quiet = until(quiet, 2000);
  assert.equal(quiet.alive, false); assert.equal(quiet.realm, 0);
  assert.equal(quiet.ending, '寿终正寝');
  const devoted = simulateLife({ ...config, fastStart: true });
  assert.equal(devoted.realm, 6); assert.equal(devoted.ending, '白日飞升');
});
test('2,000 seeded complete lives across origins, eras and routes have finite state and terminate', { timeout: 180000 }, () => {
  const endings: Record<string, number> = {}, realms: Record<string, number> = {}; let minAge = 10000, maxAge = 0;
  const ages: number[] = [], decisions: number[] = [], storyDecisions: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const g = simulateLife({ ...config, seed: `batch-${i}`, era: ['peace', 'chaos', 'renewal'][i % 3], route: ['balanced', 'sword', 'alchemy', 'body'][i % 4], mode: i % 3 ? 'seeker' : 'all', fastStart: true }, i % 5 === 0 ? 'bold' : 'safe');
    assert.equal(g.alive, false, `seed ${i} did not terminate`); assert.ok(validGame(g), `seed ${i} invalid state`);
    assert.ok(g.stones >= 0); assert.ok(g.npcs.every(n => Number.isFinite(n.progress))); assert.equal(g.pending, null);
    endings[g.ending!] = (endings[g.ending!] || 0) + 1; realms[REALMS[g.realm].name] = (realms[REALMS[g.realm].name] || 0) + 1;
    minAge = Math.min(minAge, g.age); maxAge = Math.max(maxAge, g.age);
    ages.push(g.age); decisions.push(g.choices);
    storyDecisions.push(Object.keys(g.seen).filter(id => id.startsWith('story-') && getEvent(g, id)?.kind === 'turning').length);
  }
  const distribution = (values: number[]) => {
    values.sort((a, b) => a - b);
    const middle = values.length / 2;
    return { min: values[0], median: (values[middle - 1] + values[middle]) / 2, max: values.at(-1) };
  };
  console.log('SIMULATION_REPORT', JSON.stringify({ count: 2000, endings, realms, minAge, maxAge, ages: distribution(ages), decisions: distribution(decisions), storyDecisions: distribution(storyDecisions), clock: { yearsPerLifeEstimate: 800, secondsPerYearAt1x: { 30: 2.25, 60: 4.5 } }, timingNote: 'Fast-start age begins at 16; the 30/60-minute settings estimate a life at 800 years, excluding player pauses and breakthrough ticks.' }));
});


test('explanation factors match the adjusted growth and breakthrough rules', () => {
  for (let i = 0; i < 120; i++) {
    const g = prepared();
    g.realm = i % 6; g.age = 16 + i; g.aptitude = 15 + i % 85;
    g.stats.health = i % 101; g.stats.mind = (i * 7) % 101;
    g.stats.foundation = (i * 11) % 101; g.stats.insight = (i * 3) % 101;
    g.home.array = i % 4; g.home.mat = (i + 1) % 4;
    g.sect = ['qinglan', 'herb', 'star', null][i % 4];
    const oldTraining = Math.round((2.5 + g.aptitude / 12) * [1, 1.2, 1.6, 2.1, 2.8, 3.8, 0][g.realm] * currentRegion(g).spirit * currentEra(g).spirit * worldPhase(g).spirit * (1 + g.home.array * .12 + g.home.mat * .03 + (g.route === 'balanced' ? .1 : 0) + (g.sect === 'qinglan' ? .12 : 0)) * (.55 + g.stats.mind * .0045) * (.4 + g.stats.health * .006) * 10 * 1) / 10;
    assert.equal(trainingRate(g), oldTraining);
    assert.ok(Object.values(trainingFactors(g)).every(Number.isFinite));
    for (const pill of [false, true]) {
      const oldChance = Math.min(.90, Math.max(.07, .26 + g.stats.foundation * .0025 + g.stats.insight * .00155 + g.stats.mind * .00165 + g.aptitude * .00085 - g.realm * .075 + (pill ? .13 : 0) + (g.sect === 'star' ? .06 : 0) - Math.max(0, 75 - g.stats.health) * .0028));
      assert.ok(Math.abs(breakthroughChance(g, pill) - oldChance) < 1e-12);
      assert.equal(breakthroughFactors(g, pill).find(factor => factor.label === '本境持续准备')?.value, 0);
      assert.equal(breakthroughFactors(g, pill).find(factor => factor.label === '此生所学本领')?.value, 0);
    }
  }
});

test('preparation can turn the same breakthrough roll into success without a failure quota', () => {
  const unprepared = prepared();
  unprepared.rng = 1000; unprepared.progress = REALMS[2].need;
  unprepared.stats.foundation = 10; unprepared.stats.insight = 10; unprepared.stats.mind = 30;
  const ready = structuredClone(unprepared);
  ready.stats.foundation = 100; ready.stats.insight = 100; ready.stats.mind = 100;
  assert.ok(breakthroughChance(ready) > breakthroughChance(unprepared));
  assert.equal(update(unprepared, { type: 'breakthrough' }).realm, 2);
  assert.equal(update(ready, { type: 'breakthrough' }).realm, 3);
  const pill = structuredClone(ready); pill.inventory.breakpill = 1;
  assert.ok(breakthroughChance(pill, true) >= breakthroughChance(pill));
});

test('effort and home improvements give actual growth benefits', () => {
  let g = prepared(); g.focus = 'study';
  const chance = breakthroughChance(g);
  g = update(g, { type: 'advance' });
  assert.ok(g.stats.foundation > 60); assert.ok(g.stats.insight > 60);
  assert.ok(breakthroughChance(g) > chance);
  g.pending = null;
  const rate = trainingRate(g);
  g = update(g, { type: 'home', id: 'array' });
  assert.ok(trainingRate(g) > rate);
  const injured = structuredClone(g); injured.stats.health = 30; injured.stats.mind = 30;
  injured.focus = 'rest'; const before = trainingRate(injured);
  const healed = update(injured, { type: 'advance' });
  assert.ok(healed.stats.health > injured.stats.health);
  assert.ok(trainingRate(healed) > before);
});


test('old v1 saves acquire a safe default game length; malformed duration is rejected', () => {
  const p = settleProfile(newProfile(), prepared());
  const old = structuredClone(p) as unknown as { settings: Record<string, unknown> };
  delete old.settings.durationMinutes;
  assert.equal(parseProfile(JSON.stringify(old)).settings.durationMinutes, 30);
  const bad = structuredClone(p);
  (bad.settings as { durationMinutes: number }).durationMinutes = 7;
  assert.throws(() => parseProfile(JSON.stringify(bad)));
});

test('neglected high attributes decline instead of remaining permanently capped', () => {
  const base = prepared(); base.focus = 'work';
  base.stats = { health: 96, mind: 96, foundation: 96, insight: 96, combat: 96, alchemy: 96, reputation: 96 };
  const after = update(base, { type: 'advance' });
  for (const key of ['health', 'mind', 'foundation', 'insight', 'alchemy', 'combat', 'reputation'] as const) {
    assert.ok(after.stats[key] < base.stats[key], `${key} should require maintenance`);
  }
  const resting = structuredClone(after); resting.pending = null; resting.focus = 'rest';
  const recovered = update(resting, { type: 'advance' });
  assert.ok(recovered.stats.health > after.stats.health);
  assert.ok(recovered.stats.mind > after.stats.mind);
});

test('late breakthrough benefits from preparation but no longer defaults near the old maximum', () => {
  const g = prepared(); g.realm = 5; g.stats.health = 85; g.stats.mind = 80;
  g.stats.foundation = 80; g.stats.insight = 80;
  assert.ok(breakthroughChance(g) < .65);
  const ready = structuredClone(g);
  ready.stats.foundation = 100; ready.stats.insight = 100; ready.stats.mind = 100;
  ready.sect = 'star';
  assert.ok(breakthroughChance(ready, true) > breakthroughChance(g) + .20);
  assert.ok(breakthroughChance(ready, true) <= .9);
});

test('the same beginning and different life directions produce distinct consequences and biographies', () => {
  const fork = storyOpening();
  assert.ok(fork.age >= 22 && fork.age <= 34);
  assert.ok(requiresPlayerChoice(fork));
  const guardian = update(fork, { type: 'choose', index: 0 });
  const lone = update(fork, { type: 'choose', index: 1 });
  const trader = update(fork, { type: 'choose', index: 2 });
  assert.ok(guardian.flags.includes('fate-guardian') && lone.flags.includes('fate-lone') && trader.flags.includes('fate-contract'));
  assert.ok(fateInfluence(guardian).upkeep > 0 && fateInfluence(lone).healthDrain > 0);
  assert.ok(fateInfluence(trader).income > 0 && fateInfluence(trader).training < 1);
  const lives = [guardian, lone, trader].map((g, index) => {
    const path = ['guardian', 'lone', 'contract'][index];
    const middle = untilStory(g, id => id.startsWith(`story-${path}-`) && !id.endsWith('-legacy'));
    assert.ok(middle.age >= fork.age + 9, 'The commitment needs time to develop before its next decision.');
    assert.ok(getEvent(middle)?.cause, 'The player must see why the follow-up concerns this life.');
    const chosen = update(middle, { type: 'choose', index: 0 });
    assert.ok(storyView(chosen).chapters.length >= 2);
    assert.ok(storyView(chosen).person?.name);
    return { chosen, middle };
  });
  assert.equal(new Set(lives.map(l => l.middle.pending)).size, 3);
  assert.equal(new Set(lives.map(l => JSON.stringify(fateInfluence(l.chosen)))).size, 3);
  const records = lives.map(l => archiveLife(update(l.chosen, { type: 'retire' }), '2026-10-20'));
  assert.equal(new Set(records.map(r => r.legacy)).size, 3);
  for (let i = 0; i < records.length; i++) {
    assert.ok(records[i].logs.some(l => l.title === getEvent(lives[i].middle)?.title));
    assert.ok(biography(records[i]).includes(storyView(lives[i].chosen).person!.name));
  }
});

test('the same guardian direction branches with the character actual skills and surroundings', () => {
  const fork = storyOpening();
  const guardian = update(fork, { type: 'choose', index: 0 });
  const healer = structuredClone(guardian); healer.route = 'alchemy'; healer.focus = 'alchemy';
  const traveller = structuredClone(guardian); traveller.route = 'sword'; traveller.region = 'north'; traveller.origin = 'merchant';
  const healing = untilStory(healer, id => id.startsWith('story-guardian-'));
  const exodus = untilStory(traveller, id => id.startsWith('story-guardian-'));
  assert.equal(healing.pending, 'story-guardian-healing');
  assert.equal(exodus.pending, 'story-guardian-exodus');
  assert.notEqual(getEvent(healing)?.text, getEvent(exodus)?.text);
  assert.equal(storyView(healing).person?.id, storyView(exodus).person?.id, 'Changing circumstances must not silently replace the recurring person.');
  const stayed = update(exodus, { type: 'choose', index: 0 });
  const changed = update(exodus, { type: 'choose', index: 1 });
  assert.ok(changed.flags.includes('story-active-contract'));
  assert.ok(changed.flags.includes('fate-guardian'), 'The old promise remains part of this person history.');
  assert.notEqual(fateInfluence(stayed).income, fateInfluence(changed).income);
  assert.ok(storyView(changed).chapters.length >= 2);
  const followup = untilStory(changed, id => id.startsWith('story-contract-'));
  assert.ok(getEvent(followup)?.cause);
});

test('a story consequence unfolds automatically before its final decision, without replaying the same chapter', () => {
  const guardian = update(storyOpening(), { type: 'choose', index: 0 });
  const middle = untilStory(guardian, id => id.startsWith('story-guardian-'));
  let g = update(middle, { type: 'choose', index: 0 });
  const echo = 'story-guardian-echo';
  while (g.alive && g.age < middle.age + 22 && g.seen[echo] === undefined) {
    g = g.pending ? update(g, { type: 'choose', index: autoChoice(g, 'safe') }) : update(g, { type: 'advance' });
    assert.notEqual(g.pending, echo, 'The consequence should not ask the player to confirm a routine result.');
  }
  assert.ok(g.seen[echo] >= middle.age + 6);
  const echoTitle = getEvent(g, echo)!.title;
  assert.equal(g.logs.filter(l => l.title === echoTitle).length, 1);
  assert.ok(storyView(g).effects.length > 0);
  const finale = untilStory(g, id => id === 'story-guardian-legacy');
  assert.ok(finale.age >= middle.age + 22);
  const settled = update(finale, { type: 'choose', index: 0 });
  const later = until(settled, settled.age + 20);
  assert.equal(later.logs.filter(l => l.title === echoTitle).length, 1);
  assert.ok(archiveLife(update(later, { type: 'retire' })).logs.some(l => l.title === echoTitle));
});

test('a chosen clinic actually supplies later years and changes the bound person rather than an unrelated friend', () => {
  const guardian = update(storyOpening(), { type: 'choose', index: 0 });
  guardian.route = 'alchemy';
  const middle = untilStory(guardian, id => id === 'story-guardian-healing');
  const personId = storyView(middle).person!.id;
  const person = middle.npcs.find(n => n.id === personId)!;
  person.alive = true; person.relation = 40;
  const chosen = update(middle, { type: 'choose', index: 0 });
  assert.equal(chosen.npcs.find(n => n.id === personId)!.relation, 48);
  for (const npc of middle.npcs.filter(n => n.id !== personId)) assert.deepEqual(chosen.npcs.find(n => n.id === npc.id), npc);
  chosen.age = Math.ceil((chosen.age + 1) / 3) * 3 - 1;
  chosen.stats.health = 60; chosen.focus = 'study';
  const withoutClinic = structuredClone(chosen);
  withoutClinic.flags = withoutClinic.flags.filter(flag => flag !== 'story-clinic');
  const supplied = update(chosen, { type: 'advance' });
  const baseline = update(withoutClinic, { type: 'advance' });
  assert.ok(Math.abs(supplied.stats.health - baseline.stats.health - 0.9) < 1e-9);
  assert.equal(supplied.stones, baseline.stones - 3);
  assert.equal(supplied.inventory.herb, baseline.inventory.herb + 1);
});

test('automatic play stops unchanged at major decisions, then continues after the player chooses', () => {
  const fork = storyOpening(); const before = structuredClone(fork);
  for (const policy of ['safe', 'bold', 'random'] as const) {
    const waiting = autoStep(fork, policy);
    assert.equal(waiting.error, undefined);
    assert.deepEqual(waiting.game, before, `${policy} must not select or consume randomness while waiting`);
  }
  assert.deepEqual(fork, before, 'The source game is never mutated by automatic play.');
  const selected = update(fork, { type: 'choose', index: 0 });
  assert.equal(selected.pending, null);
  assert.ok(!requiresPlayerChoice(selected));
  const continued = autoStep(selected, 'safe').game;
  assert.ok(continued.age > selected.age || continued.attempts > selected.attempts);
});

test('automation also preserves vows, forbidden arts and relationship commitments for the player', () => {
  for (const id of ['departure', 'vow', 'forbidden', 'disciple', 'sect-war', 'forbidden-echo']) {
    const g = prepared(); g.pending = id; g.seen[id] = g.age;
    assert.ok(requiresPlayerChoice(g), id);
    assert.deepEqual(autoStep(g, 'bold').game, g, `${id} must not become an invisible permanent commitment`);
  }
});

test('ordinary experiences are automatic and adult manual encounters respect breathing space', () => {
  let routines = 0, opportunities = 0;
  for (let seed = 0; seed < 8; seed++) {
    let g = createGame({ ...config, seed: `story-pacing-${seed}`, fastStart: true });
    g = update(g, { type: 'choose', index: 0 });
    g.realm = 2; g.lifespan = 260; g.stones = 10000; g.focus = 'rest';
    let lastManual = g.age;
    for (let year = 0; year < 120 && g.alive; year++) {
      const before = new Set(Object.keys(g.seen));
      g = update(g, { type: 'advance' });
      for (const id of Object.keys(g.seen).filter(id => !before.has(id))) {
        const event = getEvent(g, id)!;
        if (event.kind === 'routine') { routines++; assert.notEqual(g.pending, id); }
      }
      if (g.pending) {
        const event = getEvent(g)!;
        assert.notEqual(event.kind, 'routine');
        if (event.id !== 'vow') assert.ok(g.age - lastManual >= 6, `Adult decisions were too close: ${event.id} at ${g.age}, previous at ${lastManual}`);
        if (event.kind !== 'turning') {
          opportunities++;
          assert.ok(g.age - lastManual >= 12, `An ordinary opportunity interrupted too soon: ${event.id}`);
        }
        lastManual = g.age;
        g = update(g, { type: 'choose', index: autoChoice(g, 'safe') });
      }
    }
  }
  assert.ok(routines > 0, 'There should still be quiet life events between important choices.');
  assert.ok(opportunities > 0, 'Reducing interruptions must not remove all optional opportunities.');
});

test('identical player actions reproduce the same branching story and concrete recurring person', () => {
  const play = () => {
    let g = update(storyOpening(), { type: 'choose', index: 0 });
    g = untilStory(g, id => id.startsWith('story-guardian-'));
    g = update(g, { type: 'choose', index: 0 });
    g = untilStory(g, id => id.endsWith('-legacy'));
    return update(g, { type: 'choose', index: 1 });
  };
  const a = play(), b = play();
  assert.deepEqual(a, b);
  assert.deepEqual(storyView(a), storyView(b));
  const beforeRendering = structuredClone(a);
  for (let render = 0; render < 5; render++) { storyView(a); getEvent(a, 'story-guardian-healing'); }
  assert.deepEqual(a, beforeRendering, 'Rendering the story repeatedly must not consume RNG or rewrite the history.');
});

test('recurring people stay identifiable after death or ascension without returning as living visitors', () => {
  let g = update(storyOpening(), { type: 'choose', index: 0 });
  g = untilStory(g, id => id.startsWith('story-guardian-'));
  const person = storyView(g).person!;
  assert.ok(person.id && person.name);
  const living = structuredClone(g); const livingPerson = living.npcs.find(n => n.id === person.id)!;
  livingPerson.alive = true; livingPerson.realm = 2;
  const liveText = getEvent(living)!.text;
  const deceased = structuredClone(living); const deadPerson = deceased.npcs.find(n => n.id === person.id)!;
  deadPerson.alive = false; deadPerson.story = '此前已寿终坐化。';
  const deadText = getEvent(deceased)!.text;
  assert.ok(deadText.includes(person.name));
  assert.notEqual(deadText, liveText);
  assert.match(deadText, /遗|旧信|旧札|故去|离世|已逝|身后|寿终|不在人世|不在世|故人/);
  const ascended = structuredClone(deceased); const ascendedPerson = ascended.npcs.find(n => n.id === person.id)!;
  ascendedPerson.realm = 6; ascendedPerson.story = '此前白日飞升，已离开此方世界。';
  const ascendedText = getEvent(ascended)!.text;
  assert.ok(ascendedText.includes(person.name));
  assert.notEqual(ascendedText, deadText);
  assert.match(ascendedText, /飞升|天门|天外|上界|离开此方/);
  assert.equal(storyView(deceased).person?.id, person.id);
  assert.equal(storyView(ascended).person?.id, person.id);
  assert.equal(storyView(deceased).person?.alive, false);
  assert.equal(storyView(ascended).person?.alive, false);
  assert.ok(validGame(deceased) && validGame(ascended));
});

test('malformed saved story effects are rejected before replacing valid current progress', () => {
  const valid = settleProfile(newProfile(), update(storyOpening(), { type: 'choose', index: 0 }));
  const before = JSON.stringify(valid);
  for (const effect of [{ storyPath: 'missing-path' }, { npcId: 7 }, { npcId: 'missing-person', npcRelation: 4 }]) {
    const malformed = JSON.parse(before);
    malformed.game.delayed.push({ at: malformed.game.age + 5, title: '旧信', text: '一段尚未兑现的承诺。', effect });
    assert.throws(() => parseProfile(JSON.stringify(malformed)));
    assert.equal(JSON.stringify(valid), before);
  }
  const roundTrip = parseProfile(before);
  assert.deepEqual(roundTrip, valid);
});

test('old v1 pending fate events remain importable and their original choices retain their effects', () => {
  for (const [id, prior, expected] of [
    ['fate-first', '', 'fate-guardian'],
    ['fate-mid-guardian', 'fate-guardian', 'fate-city-defended'],
    ['fate-mid-lone', 'fate-lone', 'fate-shared'],
    ['fate-mid-contract', 'fate-contract', 'fate-honest'],
    ['fate-final', 'fate-guardian', 'fate-legacy'],
  ]) {
    const old = prepared(); old.age = id === 'fate-first' ? 28 : id === 'fate-final' ? 140 : 60;
    old.pending = id; old.seen[id] = old.age; if (prior) old.flags.push(prior);
    const profile = settleProfile(newProfile(), old);
    const imported = parseProfile(JSON.stringify(profile)).game!;
    assert.equal(imported.pending, id);
    assert.ok(requiresPlayerChoice(imported));
    const selected = update(imported, { type: 'choose', index: 0 });
    assert.ok(selected.flags.includes(expected), id);
    assert.equal(selected.pending, null);
    assert.ok(validGame(selected));
  }
});

test('retirement resolves a pending decision without losing the completed life', () => {
  const g = createGame({ ...config, fastStart: true });
  assert.equal(g.pending, 'departure');
  const retired = update(g, { type: 'retire' });
  assert.equal(retired.age, g.age); assert.equal(retired.pending, null);
  assert.equal(retired.ending, '归隐山林');
  assert.equal(retired.alive, false); assert.equal(g.alive, true);
  const profile = settleProfile(newProfile(), retired);
  assert.equal(profile.archives.length, 1);
  assert.equal(parseProfile(JSON.stringify(profile)).archives[0].ending, '归隐山林');
});

const preparationFocus = { temper: 'adventure', meditate: 'study', medicine: 'alchemy' } as const;
function preparedForMethod(method: PreparationMethod, realm = 0) {
  let g = prepared(); g.realm = realm; g.age = 20; g.stones = 10000; g.home.furnace = 1; g.inventory.herb = 100;
  g = update(g, { type: 'prepare', method });
  g = update(g, { type: 'focus', focus: preparationFocus[method] });
  for (let step = 0; step < 60 && preparationState(g).progress[method] < preparationTarget(realm, method); step++) {
    g = g.pending ? update(g, { type: 'choose', index: autoChoice(g, 'safe') }) : update(g, { type: 'advance' });
  }
  assert.equal(preparationState(g).progress[method], preparationTarget(realm, method));
  if (g.pending) g = update(g, { type: 'choose', index: autoChoice(g, 'safe') });
  return g;
}
function expeditionReady(id: string) {
  const g = prepared();
  g.region = ({ spring: 'qinglan', rescue: 'river', tomb: 'north', observatory: 'central' } as Record<string, string>)[id];
  if (!g.visited.includes(g.region)) g.visited.push(g.region);
  g.realm = id === 'observatory' ? 3 : 2; g.stones = 2000; g.progress = 100; g.inventory.herb = 20;
  g.npcs.forEach(n => { n.alive = true; n.realm = 1; n.relation = 70; });
  if (id === 'observatory') g.flags.push('cave-studied');
  return g;
}
function expeditionThrough(g: Game, id: string, choices: string[]) {
  g = update(g, { type: 'expedition-start', id });
  for (const choice of choices) g = update(g, { type: 'expedition-choose', id: choice });
  return g;
}

test('[Progression] preparation consumes real annual resources only under the matching focus', () => {
  for (const method of ['temper', 'meditate', 'medicine'] as const) {
    const base = prepared(); base.home.furnace = 1; base.inventory.herb = 20; base.focus = preparationFocus[method];
    const selected = update(base, { type: 'prepare', method });
    assert.equal(selected.actionsLeft, base.actionsLeft, 'Setting a long-term plan is not another yearly chore.');
    const normal = update(base, { type: 'advance' });
    const invested = update(selected, { type: 'advance' });
    assert.equal(preparationState(invested).progress[method], 1);
    assert.equal(normal.stones - invested.stones, { temper: 4, meditate: 3, medicine: 7 }[method]);
    if (method === 'medicine') assert.equal(normal.inventory.herb - invested.inventory.herb, 2);
    if (method === 'temper') assert.equal(Math.round((normal.stats.health - invested.stats.health) * 10), 20);
    const resting = update(selected, { type: 'focus', focus: 'rest' });
    const paused = update(resting, { type: 'advance' });
    const restingBaseline = update({ ...base, focus: 'rest' }, { type: 'advance' });
    assert.equal(preparationState(paused).progress[method], 0);
    assert.equal(paused.stones, restingBaseline.stones);
  }
  const noFurnace = prepared();
  assert.ok(act(noFurnace, { type: 'prepare', method: 'medicine' }).error);
  const poor = prepared(); poor.stones = 0; poor.focus = 'study';
  Object.keys(poor.home).forEach(id => { poor.home[id] = 3; });
  const paused = update(update(poor, { type: 'prepare', method: 'meditate' }), { type: 'advance' });
  assert.equal(preparationState(paused).progress.meditate, 0);
  assert.ok(paused.stones >= 0);
});

test('[Progression] switching or cancelling keeps invested progress, while partial preparation adds only partial chance', () => {
  let g = prepared(); g.focus = 'study';
  g = update(g, { type: 'prepare', method: 'meditate' });
  g = update(g, { type: 'advance' });
  if (g.pending) g = update(g, { type: 'choose', index: 0 });
  assert.equal(preparationState(g).progress.meditate, 1);
  assert.ok(Math.abs(preparationChance(g) - 0.12 / preparationTarget(g.realm, 'meditate')) < 1e-12);
  const before = preparationState(g).progress.meditate;
  g = update(g, { type: 'prepare', method: 'temper' });
  assert.equal(preparationState(g).progress.meditate, before);
  assert.equal(preparationChance(g), 0);
  g = update(g, { type: 'prepare', method: null });
  assert.equal(preparationState(g).progress.meditate, before);
  g = update(g, { type: 'prepare', method: 'meditate' });
  const ordinary = structuredClone(g); delete ordinary.preparation;
  assert.ok(breakthroughChance(g) > breakthroughChance(ordinary));
  g.progress = REALMS[g.realm].need; g.rng = 0;
  const success = update(g, { type: 'breakthrough' });
  assert.ok(!success.flags.some(flag => flag.startsWith('attainment-')), 'A partial plan must not award its completed ability.');
  assert.equal(success.preparation, undefined);
  ordinary.progress = REALMS[ordinary.realm].need; ordinary.rng = 0;
  assert.equal(update(ordinary, { type: 'breakthrough' }).realm, ordinary.realm + 1, 'Ordinary breakthrough remains available.');
});

test('[Progression] completed preparation survives failure and success permanently grants the selected attainment', () => {
  for (const method of ['temper', 'meditate', 'medicine'] as const) {
    const g = preparedForMethod(method); g.progress = REALMS[g.realm].need; g.rng = 1000;
    g.stats.foundation = 0; g.stats.insight = 0; g.stats.mind = 0;
    const failed = update(g, { type: 'breakthrough' });
    assert.equal(failed.realm, g.realm);
    assert.deepEqual(failed.preparation, g.preparation);
    assert.ok(!failed.flags.includes(`attainment-0-${method}`));
    const successSource = structuredClone(g); successSource.rng = 0;
    const success = update(successSource, { type: 'breakthrough' });
    assert.equal(success.realm, 1);
    assert.ok(success.flags.includes(`attainment-0-${method}`));
    assert.equal(success.preparation, undefined);
    assert.ok(attainedAbilities(success).some(ability => ability.id === `attainment-0-${method}`));
    if (method === 'meditate') assert.equal(success.aptitude, Math.min(100, g.aptitude + 3));
    const later = structuredClone(success); later.progress = REALMS[1].need; later.rng = 0; later.actionsLeft = 3;
    const advanced = update(later, { type: 'breakthrough' });
    assert.ok(advanced.flags.includes(`attainment-0-${method}`));
    assert.equal(advanced.flags.filter(flag => flag === `attainment-0-${method}`).length, 1);
  }
});

test('[Progression] attained abilities change actual recovery, pills, failed crafting and failed breakthrough', () => {
  const resting = prepared(); resting.focus = 'rest'; resting.stats.health = 25; resting.stats.mind = 25;
  const learned = structuredClone(resting); learned.flags.push('attainment-0-temper', 'attainment-3-medicine');
  const plainYear = update(resting, { type: 'advance' }), learnedYear = update(learned, { type: 'advance' });
  assert.equal(learnedYear.stats.health - plainYear.stats.health, 5);
  assert.equal(learnedYear.stats.mind - plainYear.stats.mind, 2);
  const patient = prepared(); patient.stats.health = 10; patient.inventory.heal = 1;
  const medic = structuredClone(patient); medic.flags.push('attainment-1-medicine', 'sect-art-herb');
  medic.inventory['sect-satchel'] = 1; medic.equipped = 'sect-satchel';
  assert.equal(update(medic, { type: 'use', id: 'heal' }).stats.health - update(patient, { type: 'use', id: 'heal' }).stats.health, 18);
  const craft = prepared(); craft.home.furnace = 1; craft.stats.alchemy = 0; craft.inventory.herb = 10; craft.rng = 1700;
  const recycle = structuredClone(craft); recycle.flags.push('attainment-2-medicine');
  const wasted = update(craft, { type: 'craft', id: 'heal' }), recycled = update(recycle, { type: 'craft', id: 'heal' });
  assert.equal(recycled.inventory.heal, wasted.inventory.heal);
  assert.equal(recycled.inventory.herb, wasted.inventory.herb + 1);
  assert.equal(recycled.stones, wasted.stones);
  const attempt = prepared(); attempt.progress = REALMS[attempt.realm].need; attempt.rng = 1000;
  attempt.stats.foundation = 0; attempt.stats.insight = 0; attempt.stats.mind = 0;
  const normal = update(attempt, { type: 'breakthrough' });
  for (const [flag, expectedRetention] of [['attainment-3-meditate', 0.78], ['exp-observatory-anchor', 0.82]] as const) {
    const skilled = structuredClone(attempt); skilled.flags.push(flag);
    const result = update(skilled, { type: 'breakthrough' });
    assert.equal(result.realm, attempt.realm);
    assert.equal(result.progress, Math.round(attempt.progress * expectedRetention * 10) / 10);
  }
  const protectedBody = structuredClone(attempt); protectedBody.flags.push('attainment-1-temper', 'attainment-3-temper');
  const protectedFailure = update(protectedBody, { type: 'breakthrough' });
  assert.equal(attempt.stats.health - protectedFailure.stats.health, Math.ceil((attempt.stats.health - normal.stats.health) * 0.85));
  assert.equal(protectedFailure.cooldownUntil, normal.cooldownUntil - 1);
});

test('[Progression] local sect study grants one real gear item and its effects survive leaving the sect', () => {
  for (const [sect, gear] of [['qinglan', 'sect-sword'], ['herb', 'sect-satchel'], ['star', 'sect-seal']]) {
    let g = prepared(); g.stats.reputation = 100; g.realm = 3;
    g.region = sectHome(sect) === 'qinglan' ? 'river' : 'qinglan';
    assert.ok(act(g, { type: 'join', id: sect }).error, `${sect} cannot be joined from another continent.`);
    g.region = sectHome(sect); g = update(g, { type: 'join', id: sect }); g.contribution = 200;
    const cost = sectSpecialty(g)!.cost;
    g = update(g, { type: 'sect', job: 'learn' });
    assert.equal(g.contribution, 200 - cost); assert.equal(g.inventory[gear], 1);
    assert.ok(g.flags.includes(`sect-art-${sect}`));
    g.actionsLeft = 3;
    assert.ok(act(g, { type: 'sect', job: 'learn' }).error);
    assert.ok(act(g, { type: 'buy', id: gear }).error);
    assert.equal(ITEMS.find(item => item.id === gear)?.market, false);
    const empty = structuredClone(g); empty.flags = empty.flags.filter(flag => flag !== `sect-art-${sect}`);
    if (sect === 'herb') assert.ok(craftChance(g) > craftChance(empty));
    if (sect === 'star') assert.ok(breakthroughChance(g) > breakthroughChance(empty));
    g = update(g, { type: 'use', id: gear }); assert.equal(g.equipped, gear);
    g = update(g, { type: 'sect', job: 'leave' });
    assert.ok(g.flags.includes(`sect-art-${sect}`)); assert.equal(g.inventory[gear], 1);
    assert.ok(validGame(g));
  }
});

test('[Progression] protective training and sect arts reduce real adventure injuries at the same random roll', () => {
  const g = prepared(); g.focus = 'adventure'; g.region = 'desert'; g.stats.combat = 0;
  g.npcs.forEach(n => { n.alive = false; });
  let hurt: Game | undefined, roll = 0;
  for (let rng = 0; rng < 2000; rng++) {
    const result = update({ ...g, rng }, { type: 'advance' });
    if (result.logs.some(log => log.title === '历练负伤')) { hurt = result; roll = rng; break; }
  }
  assert.ok(hurt, 'The fixture must actually encounter an adventure injury.');
  const protectedBody = structuredClone(g); protectedBody.rng = roll; protectedBody.flags.push('attainment-2-temper', 'sect-art-qinglan');
  const safe = update(protectedBody, { type: 'advance' });
  assert.ok(safe.logs.some(log => log.title === '历练负伤'));
  assert.ok(safe.stats.health > hurt.stats.health);
});

test('[Expedition] all four adventures finish three connected stages using one entry action and preserve their results', () => {
  const routes = [
    { id: 'spring', choices: ['map', 'channel', 'clear'], outcome: 'clear', flag: 'exp-spring-clear' },
    { id: 'rescue', choices: ['haste', 'force', 'healer'], outcome: 'healer', flag: 'exp-rescue-healer' },
    { id: 'tomb', choices: ['glyph', 'ward', 'ward'], outcome: 'ward', flag: 'exp-tomb-ward' },
    { id: 'observatory', choices: ['notes', 'lens', 'chart'], outcome: 'chart', flag: 'exp-observatory-chart' },
  ];
  for (const route of routes) {
    let g = expeditionReady(route.id); g.actionsLeft = 1;
    const offer = expeditionOffers(g).find(offer => offer.id === route.id)!;
    const age = g.age, stones = g.stones;
    g = update(g, { type: 'expedition-start', id: route.id });
    assert.equal(g.stones, stones - offer.cost); assert.equal(g.actionsLeft, 0);
    for (const [stage, choice] of route.choices.entries()) {
      assert.equal(expeditionView(g).active?.stage, stage); assert.ok(validGame(g));
      g = update(g, { type: 'expedition-choose', id: choice });
      assert.equal(g.actionsLeft, 0); assert.equal(g.age, age);
    }
    assert.equal(g.expeditions?.active, undefined);
    assert.equal(g.expeditions?.completed[0].outcome, route.outcome);
    assert.ok(g.flags.includes(route.flag)); assert.ok(validGame(g));
    assert.ok(archiveLife(update(g, { type: 'retire' })).logs.some(log => log.title.includes(g.expeditions!.completed[0].title)));
    const source = JSON.stringify(g);
    assert.ok(act(g, { type: 'expedition-start', id: route.id }).error);
    assert.equal(JSON.stringify(g), source, 'A completed adventure must not grant its permanent rewards again.');
  }
});

test('[Expedition] early approaches change later paths, and all four companions have distinct usable expertise', () => {
  const base = expeditionReady('spring');
  assert.equal(new Set(companionTraits(base).map(trait => trait.traitId)).size, 4);
  for (const [id, choice, companion] of [['spring', 'healer', 'peer-1'], ['spring', 'guide', 'peer-2'], ['rescue', 'ledger', 'peer-0'], ['tomb', 'guard', 'peer-3']]) {
    let g = expeditionThrough(expeditionReady(id), id, [choice]);
    assert.equal(g.expeditions?.active?.companionId, companion);
    assert.ok(expeditionView(g).active?.text.includes(g.npcs.find(n => n.id === companion)!.name));
    const dead = expeditionReady(id); dead.npcs.find(n => n.id === companion)!.alive = false;
    g = update(dead, { type: 'expedition-start', id });
    assert.ok(expeditionView(g).active!.choices.find(option => option.id === choice)?.disabled);
    assert.ok(act(g, { type: 'expedition-choose', id: choice }).error);
  }
  const planned = expeditionThrough(expeditionReady('rescue'), 'rescue', ['ledger']);
  const rushed = expeditionThrough(expeditionReady('rescue'), 'rescue', ['haste']);
  assert.equal(expeditionView(planned).active!.choices.find(c => c.id === 'passage')?.disabled, undefined);
  assert.ok(expeditionView(rushed).active!.choices.find(c => c.id === 'passage')?.disabled);
  const kept = update(update(planned, { type: 'expedition-choose', id: 'passage' }), { type: 'expedition-choose', id: 'cache' });
  assert.ok(kept.flags.includes('exp-rescue-cache'));
  assert.ok(kept.flags.includes('companion-bond:peer-0') && kept.flags.includes('companion-bond:peer-1'));
  const lens = expeditionThrough(expeditionReady('observatory'), 'observatory', ['notes', 'lens']);
  const anchor = expeditionThrough(expeditionReady('observatory'), 'observatory', ['notes', 'anchor']);
  assert.ok(expeditionView(lens).active!.choices.find(c => c.id === 'anchor')?.disabled);
  assert.ok(expeditionView(anchor).active!.choices.find(c => c.id === 'chart')?.disabled);
  assert.equal(expeditionView(anchor).active!.choices.find(c => c.id === 'eclipse')?.disabled, undefined);
});

test('[Expedition] active adventures freeze automation and unrelated actions, save mid-stage and can retire or retreat safely', () => {
  const active = expeditionThrough(expeditionReady('spring'), 'spring', ['map']);
  const before = JSON.stringify(active);
  for (const action of [{ type: 'advance' }, { type: 'focus', focus: 'rest' }, { type: 'prepare', method: 'temper' }, { type: 'buy', id: 'heal' }, { type: 'travel', id: 'river' }, { type: 'breakthrough' }] as const) {
    const blocked = act(active, action); assert.ok(blocked.error, action.type); assert.equal(blocked.game, active);
  }
  assert.deepEqual(autoStep(active, 'bold').game, active);
  assert.equal(JSON.stringify(active), before);
  const loaded = parseProfile(JSON.stringify(settleProfile(newProfile(), active))).game!;
  assert.deepEqual(loaded, active);
  const resumed = update(update(loaded, { type: 'expedition-choose', id: 'channel' }), { type: 'expedition-choose', id: 'clear' });
  const direct = update(update(active, { type: 'expedition-choose', id: 'channel' }), { type: 'expedition-choose', id: 'clear' });
  assert.deepEqual(resumed, direct);
  const retired = update(active, { type: 'retire' });
  assert.equal(retired.expeditions?.active, undefined); assert.ok(validGame(retired));
  assert.equal(settleProfile(newProfile(), retired).archives.length, 1);
  for (const stage of [0, 1, 2]) {
    let g = update(expeditionReady('spring'), { type: 'expedition-start', id: 'spring' });
    if (stage >= 1) g = update(g, { type: 'expedition-choose', id: 'map' });
    if (stage >= 2) g = update(g, { type: 'expedition-choose', id: 'channel' });
    const health = g.stats.health;
    const escaped = update(g, { type: 'expedition-retreat' });
    assert.equal(escaped.stats.health, health); assert.equal(escaped.expeditions?.active, undefined);
    assert.equal(escaped.expeditions?.completed[0].outcome, 'withdrawn');
    assert.ok(!escaped.flags.includes('exp-spring-clear'));
    assert.ok(act(escaped, { type: 'expedition-start', id: 'spring' }).error);
  }
});

test('[Expedition] risky endings use seeded outcomes and disclose current losses without revealing future reward numbers', () => {
  const source = expeditionThrough(expeditionReady('spring'), 'spring', ['map', 'channel']);
  const description = expeditionView(source).active!.choices.map(choice => choice.hint).join(' ');
  assert.match(description, /40%|30.*体魄/);
  assert.doesNotMatch(description, /资质.*\+|修炼.*8%|道心.*\+3/);
  const successful = update({ ...source, rng: 0 }, { type: 'expedition-choose', id: 'vein' });
  const failed = update({ ...source, rng: 1700 }, { type: 'expedition-choose', id: 'vein' });
  assert.equal(successful.expeditions?.completed[0].outcome, 'vein');
  assert.equal(failed.expeditions?.completed[0].outcome, 'scarred');
  assert.equal(failed.stats.health, source.stats.health - 30);
  assert.equal(failed.progress, Math.round(source.progress * 0.6 * 10) / 10);
  assert.ok(successful.aptitude > failed.aptitude);
  assert.deepEqual(update({ ...source, rng: 1700 }, { type: 'expedition-choose', id: 'vein' }), failed);
  const doomed = expeditionThrough(expeditionReady('observatory'), 'observatory', ['notes', 'lens']);
  doomed.stats.health = 40; doomed.rng = 1700;
  const fallen = update(doomed, { type: 'expedition-choose', id: 'confluence' });
  assert.equal(fallen.alive, false); assert.equal(fallen.expeditions?.active, undefined);
  assert.match(fallen.expeditions!.completed[0].title, /陨落/);
  assert.match(fallen.expeditions!.completed[0].text, /未能撑过伤势/);
  assert.ok(validGame(fallen));
});

test('[Expedition] permanent discoveries alter later gameplay and the heterodox ending preserves its real tradeoffs', () => {
  const source = expeditionReady('observatory');
  const transformed = expeditionThrough(source, 'observatory', ['notes', 'anchor', 'eclipse']);
  assert.ok(transformed.flags.includes('legacy-eclipse'));
  assert.ok(!transformed.flags.includes('exp-observatory-chart') && !transformed.flags.includes('exp-observatory-anchor'));
  assert.equal(transformed.aptitude, Math.min(100, source.aptitude + 5));
  assert.match(lifeIdentity(transformed).title, /异道/);
  const ordinary = structuredClone(transformed); ordinary.flags = ordinary.flags.filter(flag => flag !== 'legacy-eclipse');
  for (const g of [transformed, ordinary]) { g.focus = 'adventure'; g.progress = 0; g.stats.health = 60; }
  const changedYear = update(transformed, { type: 'advance' }), ordinaryYear = update(ordinary, { type: 'advance' });
  assert.ok(changedYear.progress > ordinaryYear.progress);
  assert.equal(changedYear.stones, ordinaryYear.stones - 5);
  assert.ok(changedYear.stats.health > ordinaryYear.stats.health);
  assert.ok(changedYear.stats.reputation < ordinaryYear.stats.reputation);
  const learned = expeditionThrough(expeditionReady('spring'), 'spring', ['map', 'channel', 'clear']);
  learned.focus = 'rest'; learned.stats.mind = 20;
  const untouched = structuredClone(learned); untouched.flags = untouched.flags.filter(flag => flag !== 'exp-spring-clear');
  assert.equal(update(learned, { type: 'advance' }).stats.mind - update(untouched, { type: 'advance' }).stats.mind, 3);
});

test('[Expedition] optional progress fields preserve old v1 saves and reject corrupt activity or preparation atomically', () => {
  const old = settleProfile(newProfile(), prepared());
  assert.equal(old.game!.preparation, undefined); assert.equal(old.game!.expeditions, undefined);
  assert.deepEqual(parseProfile(JSON.stringify(old)), old);
  const active = expeditionThrough(expeditionReady('spring'), 'spring', ['guide']);
  const valid = settleProfile(newProfile(), active), raw = JSON.stringify(valid);
  const mutations: ((g: Game) => void)[] = [
    g => { g.expeditions!.active!.stage = 3; },
    g => { g.expeditions!.active!.marks = ['unknown']; },
    g => { g.expeditions!.active!.companionId = 'peer-0'; },
    g => { g.expeditions!.active!.startedAge--; },
    g => { g.npcs.find(n => n.id === 'peer-2')!.alive = false; },
    g => { g.expeditions!.completed.push({ id: 'spring', outcome: 'invented', title: '假结果', text: '无效', age: g.age }); },
    g => { g.preparation = { realm: g.realm + 1, selected: 'temper', progress: { temper: 0, meditate: 0, medicine: 0 } }; },
    g => { g.preparation = { realm: g.realm, selected: 'invalid' as PreparationMethod, progress: { temper: 0, meditate: 0, medicine: 0 } }; },
    g => { g.preparation = { realm: g.realm, selected: 'temper', progress: { temper: -1, meditate: 0, medicine: 0 } }; },
    g => { g.preparation = { realm: g.realm, selected: 'temper', progress: { temper: preparationTarget(g.realm, 'temper') + 1, meditate: 0, medicine: 0 } }; },
  ];
  for (const mutate of mutations) {
    const malformed = structuredClone(valid); mutate(malformed.game!);
    assert.throws(() => parseProfile(JSON.stringify(malformed)));
    assert.equal(JSON.stringify(valid), raw);
  }
});

test('[World] five birthplaces and seeded random birth preserve their identity and local preparation advantages', () => {
  for (const region of REGIONS) {
    const g = createGame({ ...config, region: region.id });
    assert.equal(g.region, region.id); assert.equal(g.visited[0], region.id);
    assert.ok(g.logs[0].text.includes(region.name));
    assert.ok(lifeIdentity(g).facets.includes(`生于${regionWorld(region.id).continent}`));
    assert.ok(validGame(g));
  }
  const randomBirth = createGame({ ...config, region: 'random', seed: 'world-birth' });
  assert.deepEqual(randomBirth, createGame({ ...config, region: 'random', seed: 'world-birth' }));
  const generated = new Set(Array.from({ length: 100 }, (_, n) => createGame({ ...config, region: 'random', seed: `world-${n}` }).region));
  assert.ok(generated.size > 1, 'Seeded random birth must not silently force every life into the same region.');
  for (const [region, method] of [['north', 'temper'], ['river', 'medicine'], ['central', 'meditate']] as const) {
    const g = prepared(); g.region = region; g.home.furnace = 1; g.inventory.herb = 20; g.focus = preparationFocus[method];
    const advanced = update(update(g, { type: 'prepare', method }), { type: 'advance' });
    assert.equal(preparationState(advanced).progress[method], 1.3);
    assert.equal(preparationView(advanced).methods.find(m => m.id === method)?.rate, regionPractice(region, method));
  }
});

test('[Progression] eclipse automation restores body and funds before returning to adventure', () => {
  const learned = expeditionThrough(expeditionReady('observatory'), 'observatory', ['notes', 'anchor', 'eclipse']);
  learned.focus = 'adventure'; learned.stats.health = 55; learned.stats.mind = 80;
  let resting = autoStep(learned, 'safe').game;
  assert.equal(resting.focus, 'rest');
  assert.ok(resting.stats.health >= 60, 'The fixture must actually recover above the safe policy threshold.');
  if (resting.pending) resting = update(resting, { type: 'choose', index: autoChoice(resting, 'safe') });
  assert.equal(autoStep(resting, 'safe').game.focus, 'adventure', 'An inherited adventure practice must resume after recovery.');
  const poor = structuredClone(learned);
  poor.stats.health = 90; poor.progress = REALMS[poor.realm].need; poor.stones = 0;
  const earning = autoStep(poor, 'safe').game;
  assert.equal(earning.focus, 'work', 'Funding an imminent breakthrough still takes priority.');
  assert.ok(earning.stones > poor.stones);
  for (const focus of ['rest', 'work', 'study', 'cultivate'] as const) {
    const ready = structuredClone(learned); ready.stats.health = 90; ready.stones = 2000; ready.focus = focus;
    const ordinary = structuredClone(ready); ordinary.flags = ordinary.flags.filter(flag => flag !== 'legacy-eclipse');
    assert.equal(autoStep(ready, 'safe').game.focus, 'adventure', `${focus} must yield to the learned practice once urgent needs are met.`);
    assert.equal(autoStep(ordinary, 'safe').game.focus, 'cultivate', 'Ordinary characters retain the existing cultivation fallback.');
  }
});
