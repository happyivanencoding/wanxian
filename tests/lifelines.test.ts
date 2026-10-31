import { withLegacyPeers } from './fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, autoStep, createGame, getEvent, planDirectedAction, trainingRate } from '../src/game/engine.ts';
import { EVENT_MAP } from '../src/game/events.ts';
import { REALMS } from '../src/game/data.ts';
import { LIFE_EVENTS, arrangeLife, bindLifeEvent, getLifeEvent, lifeAnnualEffects, lifeMemory, lifeTrainingMultiplier, nextLifeEvent, npcLifeFactors } from '../src/game/lifelines.ts';
import { preparationTarget } from '../src/game/progression.ts';
import { newProfile, parseProfile, settleProfile, validGame } from '../src/game/storage.ts';
import type { Game } from '../src/game/types.ts';

const config = { name: '林听澜', gender: '女修', origin: 'merchant', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker' as const, fastStart: false, seed: 'life-design' };
function adult(): Game {
  const g = withLegacyPeers(createGame(config));
  g.age = 40; g.realm = 2; g.lifespan = 260; g.progress = 100; g.stones = 300;
  g.stats = { health: 85, mind: 80, insight: 60, foundation: 60, alchemy: 20, combat: 40, reputation: 35 };
  for (const npc of g.npcs) { npc.age = 40; npc.realm = 2; npc.lifespan = 260; npc.relation = 60; }
  return g;
}
function pending(g: Game, id: string) {
  bindLifeEvent(g, id); g.pending = id; g.seen[id] = g.age; return g;
}
function choose(g: Game, id: string, index: number) {
  const result = act(pending(g, id), { type: 'choose', index });
  assert.equal(result.error, undefined); return result.game;
}
function clearStories(g: Game) {
  for (const event of LIFE_EVENTS) g.seen[event.id] = 20;
  g.seen['story-call-guardian'] = 20;
}

test('lifeline events are registered manual turns and have stable save-compatible IDs', () => {
  const g = adult();
  for (const event of LIFE_EVENTS) {
    assert.equal(EVENT_MAP[event.id].kind, 'turning');
    assert.equal(EVENT_MAP[event.id].weight, 0);
    const view = getLifeEvent(g, event.id)!;
    assert.ok(view.text.length > 20);
    assert.ok(view.choices.length >= 2);
    const before = structuredClone(g);
    assert.deepEqual(getLifeEvent(g, event.id), view);
    assert.deepEqual(g, before);
  }
});

test('new guided births opt into daily care; existing saves keep manual focus', () => {
  const old = createGame(config), guided = createGame({ ...config, guided: true });
  assert.equal(old.direction, undefined); assert.equal(guided.direction, 'seek');
  const imported = parseProfile(JSON.stringify(settleProfile(newProfile(), old))).game!;
  assert.equal(imported.direction, undefined); assert.deepEqual(imported, old);
  guided.age = 16;
  const manual = act(guided, { type: 'focus', focus: 'study' }).game;
  assert.equal(manual.direction, undefined); assert.equal(manual.focus, 'study');
  const resumed = act(manual, { type: 'direction', direction: 'belong' }).game;
  assert.equal(resumed.direction, 'belong'); assert.ok(validGame(resumed));
});

test('daily care handles actual health and funding before following the chosen direction', () => {
  const g = adult(); g.direction = 'roam'; g.stats.health = 30;
  arrangeLife(g); assert.equal(g.focus, 'rest');
  g.stats.health = 80; g.stones = 0;
  arrangeLife(g); assert.equal(g.focus, 'work');
  g.stones = 300; g.age = 40;
  arrangeLife(g); assert.equal(g.focus, 'adventure');
  g.direction = 'belong'; arrangeLife(g); assert.equal(g.focus, 'social');
  g.direction = 'peace'; arrangeLife(g); assert.equal(g.focus, 'study');
});

test('completed preparation no longer locks guided play into the preparation focus', () => {
  const g = adult(); g.direction = 'seek';
  const target = preparationTarget(g.realm, 'temper');
  g.preparation = { realm: g.realm, selected: 'temper', progress: { temper: target - 1, meditate: 0, medicine: 0 } };
  arrangeLife(g); assert.equal(g.focus, 'adventure');
  g.preparation.progress.temper = target;
  arrangeLife(g); assert.equal(g.focus, 'cultivate');
});

test('donating the shared pill helps its named recipient without predetermining their fate', () => {
  const g = adult(), donated = choose(structuredClone(g), 'life-pill', 1), kept = choose(structuredClone(g), 'life-pill', 0);
  assert.equal(kept.progress, g.progress + 40); assert.equal(donated.progress, g.progress);
  assert.equal(donated.npcs[1].relation, g.npcs[1].relation + 12);
  assert.equal(donated.npcs[0].relation, g.npcs[0].relation);
  assert.deepEqual(npcLifeFactors(donated, donated.npcs[1]), { training: 1.08, risk: 0.8 });
  assert.deepEqual(npcLifeFactors(donated, donated.npcs[0]), { training: 1, risk: 1 });
  assert.equal(donated.delayed.length, 0, 'Helping is not a scheduled monetary repayment.');
  assert.equal(donated.npcs[1].alive, true);
});

test('trying a second batch has seeded success and real failure costs', () => {
  const successes: Game[] = [], failures: Game[] = [];
  for (let seed = 0; seed < 5000 && (!successes.length || !failures.length); seed += 200) {
    const g = adult(); g.rng = seed;
    const next = choose(g, 'life-pill', 2);
    assert.equal(next.stones, 300 - (18 + 2 * 10));
    if (next.flags.includes('life-dose-shared')) successes.push(next);
    if (next.flags.includes('life-dose-failed')) failures.push(next);
  }
  assert.ok(successes.length && failures.length);
  assert.equal(failures[0].progress, 100);
  assert.equal(successes[0].progress, 118);
  const poor = adult(); poor.stones = 0; pending(poor, 'life-pill');
  const before = structuredClone(poor), denied = act(poor, { type: 'choose', index: 2 });
  assert.ok(denied.error); assert.equal(denied.game, poor); assert.deepEqual(poor, before);
});

test('later medicine and road scenes remember the same named person after death or ascension', () => {
  let g = choose(adult(), 'life-pill', 1); g.age = 75;
  for (const realm of [2, 6]) {
    g.npcs[1].alive = false; g.npcs[1].realm = realm;
    const followup = getLifeEvent(g, 'life-pill-return')!;
    assert.ok(followup.text.includes(g.npcs[1].name));
    assert.match(followup.text, realm === 6 ? /飞升离界/ : /已经离世/);
    assert.match(followup.text, /你留下的那枚/);
    const before = g.npcs[1].relation;
    g = choose(g, 'life-pill-return', 0);
    assert.equal(g.npcs[1].alive, false); assert.equal(g.npcs[1].relation, before);
  }
});

test('a broken promise affects that relationship and changes the available reconciliation', () => {
  let g = choose(adult(), 'life-rival', 0); g.age = 80;
  assert.equal(getLifeEvent(g, 'life-sword-answer')!.choices.length, 3);
  const before = g.npcs[3].relation;
  g = choose(g, 'life-sword-answer', 2);
  assert.equal(g.npcs[3].relation, before - 25);
  assert.ok(g.flags.includes('life-sword-published'));
  assert.ok(lifeMemory(g, g.npcs[3])?.text.includes('不再像从前'));
  const distant = choose(adult(), 'life-rival', 1);
  const alternative = getLifeEvent(distant, 'life-sword-answer')!;
  assert.equal(alternative.choices.length, 2);
  assert.match(alternative.text, /自己新写的剑谱/);
  assert.ok(!alternative.choices.some(item => item.label.includes('保存的旧谱')));
});

test('long-term duties affect income and training, and can be ended at renewal', () => {
  const g = adult(), before = trainingRate(g);
  const signed = choose(structuredClone(g), 'life-house', 0);
  assert.equal(lifeTrainingMultiplier(signed), 0.92);
  assert.ok(trainingRate(signed) < before);
  assert.deepEqual(lifeAnnualEffects(signed), [{ stones: 4 }]);
  const released = choose(signed, 'life-house-return', 1);
  assert.ok(released.flags.includes('life-house-contract'));
  assert.ok(released.flags.includes('life-house-released'));
  assert.equal(lifeTrainingMultiplier(released), 1);
  assert.deepEqual(lifeAnnualEffects(released), []);
});

test('writing a private life record produces readers rather than an invented line of disciples', () => {
  const g = adult(); clearStories(g); g.age = 300;
  g.flags.push('life-legacy-book'); g.seen['life-revision'] = 200;
  delete g.seen['life-division']; delete g.seen['life-book-reader'];
  assert.equal(nextLifeEvent(g), 'life-book-reader');
  g.flags = g.flags.filter(flag => flag !== 'life-legacy-book'); g.flags.push('life-legacy-open');
  assert.equal(nextLifeEvent(g), 'life-division');
});

test('new pending choices and memories survive save import without consuming random state', () => {
  const g = adult(); pending(g, 'life-visit');
  const profile = settleProfile(newProfile(), g), text = getEvent(g)?.text;
  const restored = parseProfile(JSON.stringify(profile)).game!;
  assert.deepEqual(restored, g); assert.equal(getEvent(restored)?.text, text);
  const chosen = act(restored, { type: 'choose', index: 0 }).game;
  assert.equal(chosen.choices, g.choices + 1); assert.ok(validGame(chosen));
  assert.equal(chosen.rng, g.rng);
  const invalid = structuredClone(chosen) as unknown as Record<string, unknown>;
  invalid.direction = 'infinite-life'; assert.equal(validGame(invalid), false);
});

test('autoplay and online directing never answer a lifeline decision', () => {
  const g = adult(); g.direction = 'seek'; pending(g, 'life-pill');
  assert.deepEqual(autoStep(g, 'bold').game, g);
  assert.deepEqual(planDirectedAction(g, { type: 'auto', policy: 'safe' }).result.game, g);
  assert.equal(planDirectedAction(g, { type: 'auto', policy: 'safe' }).request, undefined);
  const blocked = act(g, { type: 'direction', direction: 'peace' });
  assert.ok(blocked.error); assert.equal(blocked.game, g);
});

test('the final ascension waits for a personal decision, and staying does not destroy the opportunity', () => {
  const g = adult(); g.direction = 'seek'; g.realm = 5; g.lifespan = 2240; g.age = 300; g.progress = REALMS[5].need; g.stones = 10000;
  clearStories(g); delete g.seen['life-heaven'];
  const atGate = act(g, { type: 'advance' }).game;
  assert.equal(atGate.pending, 'life-heaven'); assert.equal(atGate.realm, 5);
  assert.deepEqual(autoStep(atGate, 'safe').game, atGate);
  const staying = act(atGate, { type: 'choose', index: 1 }).game;
  const anotherYear = act(staying, { type: 'advance' }).game;
  assert.equal(anotherYear.realm, 5); assert.equal(anotherYear.attempts, g.attempts);
  anotherYear.pending = null;
  const manual = act(anotherYear, { type: 'breakthrough' });
  assert.equal(manual.error, undefined); assert.equal(manual.game.attempts, anotherYear.attempts + 1);
});

test('guided lives remain deterministic, finite and saveable across all four directions', () => {
  for (const direction of ['seek', 'roam', 'belong', 'peace'] as const) {
    let g = createGame({ ...config, fastStart: true, guided: true, seed: `guided-${direction}` });
    const start = structuredClone(g);
    function run(source: Game) {
      let current = source;
      current.direction = direction;
      for (let n = 0; n < 12000 && current.alive; n++) {
        if (current.expeditions?.active) current = act(current, { type: 'expedition-retreat' }).game;
        else if (current.pending) {
          const event = getEvent(current)!;
          const index = event.choices.findIndex(item => (item.cost ?? 0) <= current.stones && (!item.requiresStat || current.stats[item.requiresStat[0]] >= item.requiresStat[1]));
          current = act(current, { type: 'choose', index }).game;
        } else current = autoStep(current, 'safe').game;
      }
      return current;
    }
    g = run(g);
    assert.equal(g.alive, false, direction);
    assert.ok(validGame(g), direction);
    assert.deepEqual(run(start), g, direction);
    assert.ok(g.choices > 10, direction);
    assert.ok(Object.keys(g.seen).some(id => id.startsWith('life-')), direction);
    assert.ok(!g.logs.some(entry => /undefined|NaN/.test(entry.text)), direction);
  }
});
