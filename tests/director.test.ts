import { withLegacyPeers, handledWorldTurns } from './fixtures.ts';
import test from 'node:test';
import { LIFE_EVENTS } from '../src/game/lifelines.ts';
import assert from 'node:assert/strict';
import { act, autoStep, commitDirectedAction, createGame, getEvent, planDirectedAction } from '../src/game/engine.ts';
import { EVENTS } from '../src/game/events.ts';
import { expeditionView } from '../src/game/expeditions.ts';
import { newProfile, parseProfile, settleProfile, validGame } from '../src/game/storage.ts';
import type { DirectorDecision, DirectedAction, DirectorRequest, Game } from '../src/game/types.ts';

function person(): Game {
  const g = withLegacyPeers(createGame({ name: '沈见微', gender: '随缘', origin: 'wanderer', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: false, seed: 'director-1' }));
  g.age = 40; g.realm = 2; g.progress = 50; g.lifespan = 260; g.stones = 160; g.focus = 'adventure';
  g.stats = { health: 70, mind: 60, insight: 55, foundation: 55, alchemy: 30, combat: 40, reputation: 35 };
  g.seen['story-call-guardian'] = 20;
  for (const event of LIFE_EVENTS) g.seen[event.id] = 20;
  for (const npc of g.npcs) { npc.age = 40; npc.realm = 2; npc.lifespan = 260; npc.relation = 65; npc.progress = 0; }
  return handledWorldTurns(g);
}
const talk: DirectedAction = { type: 'npc', id: 'peer-1', interaction: 'talk' };
function decision(request: DirectorRequest, candidateId: string): DirectorDecision {
  return { kind: request.kind, age: request.age, ...(request.actorId ? { actorId: request.actorId } : {}), candidateId, source: 'startlux' };
}
function ordinaryOpportunity(): { g: Game; request: DirectorRequest } {
  for (let sample = 0; sample < 500; sample++) {
    const g = person(); g.rng = (sample * 65537) >>> 0;
    const { request } = planDirectedAction(g, { type: 'advance' });
    if (request?.kind === 'event') return { g, request };
  }
  assert.fail('Fixture must reach a real ordinary-event selection point');
}

test('director preview is pure and its local result equals ordinary actions and auto steps', () => {
  const g = person(), before = structuredClone(g);
  const preview = planDirectedAction(g, talk);
  assert.deepEqual(g, before);
  assert.deepEqual(preview.result, act(g, talk));
  assert.deepEqual(planDirectedAction(g, { type: 'auto', policy: 'safe' }).result, autoStep(g, 'safe'));
  assert.deepEqual(planDirectedAction(g, { type: 'advance' }).result, act(g, { type: 'advance' }));
  assert.deepEqual(commitDirectedAction(g, talk), preview.result);
  assert.ok(preview.request?.candidates.some(candidate => candidate.id === 'medicine'));
});

test('an eligible NPC response has a real bounded effect without replacing the player action', () => {
  const g = person(); const plan = planDirectedAction(g, talk);
  assert.ok(plan.request);
  const reply = decision(plan.request, 'medicine');
  const result = commitDirectedAction(g, talk, reply);
  assert.equal(result.error, undefined);
  assert.equal(result.game.inventory.herb, g.inventory.herb + 1);
  assert.equal(result.game.stats.alchemy, g.stats.alchemy + 1);
  assert.equal(result.game.npcs[1].relation, g.npcs[1].relation + 7);
  assert.equal(result.game.stats.mind, g.stats.mind + 3);
  assert.equal(result.game.stats.insight, g.stats.insight + 1);
  assert.equal(result.game.actionsLeft, g.actionsLeft - 1);
  assert.equal(result.game.stones, g.stones);
  assert.equal(result.game.directorRecords?.at(-1)?.source, 'startlux');
  assert.equal(result.game.directorRecords?.at(-1)?.candidateId, 'medicine');
  assert.ok(result.game.logs.at(-1)?.text.includes('灵草增加1'));
  assert.deepEqual(commitDirectedAction(g, talk, reply), result);
});

test('online NPC decisions cannot select impossible, mismatched or stale reactions', () => {
  const g = person(), plan = planDirectedAction(g, talk);
  assert.ok(plan.request);
  const valid = decision(plan.request, 'medicine');
  for (const invalid of [
    { ...valid, candidateId: 'accounts' },
    { ...valid, candidateId: 'grant-immortality' },
    { ...valid, age: g.age - 1 },
    { ...valid, actorId: 'peer-0' },
    { ...valid, kind: 'event' as const },
  ]) assert.deepEqual(commitDirectedAction(g, talk, invalid), plan.result);
  const alreadyVisited = plan.result.game;
  const repeated = commitDirectedAction(alreadyVisited, talk, valid);
  assert.ok(repeated.error); assert.equal(repeated.game, alreadyVisited);
  const departed = structuredClone(g); departed.npcs[1].alive = false;
  assert.equal(commitDirectedAction(departed, talk, valid).game, departed);
});

test('gift costs, insufficient resources and fatal sparring remain authoritative', () => {
  const g = person(), gift = { type: 'npc', id: 'peer-1', interaction: 'gift' } as const;
  const plan = planDirectedAction(g, gift); assert.ok(plan.request);
  const result = commitDirectedAction(g, gift, decision(plan.request, 'medicine')).game;
  assert.equal(result.stones, g.stones - (12 + g.npcs[1].realm * 8));
  assert.equal(result.npcs[1].relation, g.npcs[1].relation + 13);
  assert.equal(result.actionsLeft, g.actionsLeft - 1);
  const poor = structuredClone(g); poor.stones = 0;
  const denied = planDirectedAction(poor, gift);
  assert.ok(denied.result.error); assert.equal(denied.request, undefined); assert.equal(denied.result.game, poor);
  const wounded = structuredClone(g); wounded.stats.health = 1;
  const duel = { type: 'npc', id: 'peer-1', interaction: 'duel' } as const;
  const fatal = planDirectedAction(wounded, duel);
  assert.equal(fatal.result.game.alive, false);
  assert.equal(fatal.result.game.stats.health, 0);
  assert.equal(fatal.result.game.ending, '道途中陨落');
  assert.equal(fatal.request, undefined);
  assert.equal(fatal.result.game.directorRecords, undefined);
  assert.deepEqual(commitDirectedAction(wounded, duel, { kind: 'npc', age: wounded.age, actorId: 'peer-1', candidateId: 'caution', source: 'startlux' }), fatal.result);
});

test('event directing selects only current legal opportunities and preserves player answers', () => {
  const { g, request } = ordinaryOpportunity();
  const action = { type: 'advance' } as const, fallback = planDirectedAction(g, action).result;
  const alternative = request.candidates.find(candidate => candidate.id !== fallback.game.pending)!;
  assert.ok(alternative);
  const result = commitDirectedAction(g, action, decision(request, alternative.id)).game;
  assert.equal(result.pending, alternative.id);
  assert.equal(result.seen[alternative.id], result.age);
  assert.equal(result.choices, g.choices);
  assert.equal(result.age, fallback.game.age);
  assert.equal(result.rng, fallback.game.rng);
  assert.equal(result.stones, fallback.game.stones);
  assert.equal(result.directorRecords?.at(-1)?.source, 'startlux');
  assert.ok(request.candidates.every(candidate => {
    const event = EVENTS.find(event => event.id === candidate.id)!;
    return event.kind === 'opportunity' && !event.id.startsWith('story-') && !event.id.startsWith('fate-');
  }));
  for (const override of [
    { ...decision(request, alternative.id), candidateId: 'fate-final' },
    { ...decision(request, alternative.id), candidateId: 'snow-hermit' },
    { ...decision(request, alternative.id), age: request.age + 1 },
    { ...decision(request, alternative.id), actorId: 'peer-0' },
  ]) assert.deepEqual(commitDirectedAction(g, action, override), fallback);
  const profile = parseProfile(JSON.stringify(settleProfile(newProfile(), result)));
  assert.deepEqual(profile.game, result);
  assert.equal(planDirectedAction(profile.game!, action).request, undefined);
  assert.equal(planDirectedAction(profile.game!, action).result.game, profile.game);
});

test('major choices, bonding, retirement and expedition choices are never delegated', () => {
  const g = person(); g.pending = 'vow';
  const stopped = planDirectedAction(g, { type: 'auto', policy: 'bold' });
  assert.equal(stopped.request, undefined); assert.deepEqual(stopped.result.game, g);
  const chosen = planDirectedAction(g, { type: 'choose', index: 0 });
  assert.equal(chosen.request, undefined); assert.equal(chosen.result.game.pending, null);
  assert.equal(chosen.result.game.choices, g.choices + 1);
  const together = person(); together.npcs[1].relation = 80;
  const bond = planDirectedAction(together, { type: 'npc', id: 'peer-1', interaction: 'bond' });
  assert.equal(bond.request, undefined); assert.equal(bond.result.game.npcs[1].role, 'companion');
  assert.equal(bond.result.game.directorRecords, undefined);
  assert.equal(planDirectedAction(person(), { type: 'retire' }).request, undefined);
  const start = planDirectedAction(person(), { type: 'expedition-start', id: 'spring' });
  assert.equal(start.result.error, undefined); assert.equal(start.request, undefined);
  const current = expeditionView(start.result.game).active!;
  const choice = current.choices.find(choice => !choice.disabled)!;
  const stage = planDirectedAction(start.result.game, { type: 'expedition-choose', id: choice.id });
  assert.equal(stage.result.error, undefined); assert.equal(stage.request, undefined);
  const paused = planDirectedAction(start.result.game, { type: 'auto', policy: 'bold' });
  assert.equal(paused.request, undefined); assert.deepEqual(paused.result.game, start.result.game);
  const child = createGame({ name: '童年', gender: '随缘', origin: 'village', era: 'peace', route: 'balanced', mode: 'seeker', fastStart: false, seed: 'child-director' });
  const milestone = planDirectedAction(child, { type: 'advance', years: 10 });
  assert.equal(milestone.request, undefined); assert.equal(getEvent(milestone.result.game)?.id, 'child-pebble');
});

test('director context contains bounded observed fiction and omits future reward schedules', () => {
  const g = person();
  g.delayed.push({ at: 90, title: 'SECRET_FUTURE_REWARD', text: 'SECRET_FUTURE_REWARD', effect: { stones: 300 } });
  g.flags.push('companion-bond:peer-1');
  const { request } = planDirectedAction(g, talk); assert.ok(request);
  const encoded = JSON.stringify(request);
  assert.ok(!encoded.includes('SECRET_FUTURE_REWARD'));
  assert.ok(!encoded.includes('"delayed"')); assert.ok(!encoded.includes('"snapshots"'));
  assert.ok(!encoded.includes('"inventory"')); assert.ok(!encoded.includes('"archives"'));
  assert.ok(encoded.includes('sharedExperience'));
  assert.ok(request.candidates.every(candidate => Object.keys(candidate).sort().join(',') === 'description,id,label'));
  assert.ok((request.context.livedExperience as unknown[]).length <= 6);
});

test('decision records survive saving, are bounded and reject invalid additions; old settings still load', () => {
  const g = person();
  g.directorRecords = Array.from({ length: 64 }, (_, age) => ({ kind: 'npc' as const, age: Math.min(g.age, age), actorId: 'peer-1', candidateId: 'reserved', source: 'local' as const }));
  const plan = planDirectedAction(g, talk); assert.ok(plan.request);
  const next = commitDirectedAction(g, talk, decision(plan.request, 'medicine')).game;
  assert.equal(next.directorRecords?.length, 64); assert.ok(validGame(next));
  const profile = settleProfile(newProfile(), next);
  assert.deepEqual(parseProfile(JSON.stringify(profile)), profile);
  const old = newProfile(); delete old.settings.directorEnabled;
  assert.equal(parseProfile(JSON.stringify(old)).settings.directorEnabled, true);
  old.settings.directorEnabled = false;
  assert.equal(parseProfile(JSON.stringify(old)).settings.directorEnabled, false);
  for (const record of [
    { kind: 'npc', age: 40, actorId: 'peer-1', candidateId: 'make-up-an-effect', source: 'startlux' },
    { kind: 'npc', age: 41, actorId: 'peer-1', candidateId: 'reserved', source: 'local' },
    { kind: 'npc', age: 40, actorId: 'missing', candidateId: 'reserved', source: 'startlux' },
    { kind: 'event', age: 40, candidateId: 'fate-final', source: 'startlux' },
    { kind: 'event', age: 40, candidateId: '__proto__', source: 'startlux' },
    { kind: 'npc', age: 40, actorId: 'peer-1', candidateId: 'reserved', source: 'local', prompt: 'must not be persisted' },
  ]) assert.equal(validGame({ ...next, directorRecords: [record] }), false);
  assert.equal(validGame({ ...next, directorRecords: Array(65).fill(next.directorRecords![0]) }), false);
  assert.throws(() => parseProfile(JSON.stringify({ ...profile, settings: { ...profile.settings, directorEnabled: 'yes' } })));
});
