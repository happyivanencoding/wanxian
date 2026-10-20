import test from 'node:test';
import assert from 'node:assert/strict';
import { act, breakthroughFactors, createGame, trainingFactors } from '../src/game/engine.ts';
import { ITEMS, REGIONS } from '../src/game/data.ts';
import { EVENTS } from '../src/game/events.ts';
import { SECTS, hasSectArt, sectAnnualEffect, sectEntryReason, sectMissionEffect } from '../src/game/sects.ts';
import { progressionBenefits } from '../src/game/progression.ts';
import { expeditionView } from '../src/game/expeditions.ts';
import { regionWorld, sectHome } from '../src/game/world.ts';
import { validGame } from '../src/game/storage.ts';
import type { Action, Game } from '../src/game/types.ts';

function ready(): Game {
  const g = createGame({ name: '沈行远', gender: '随缘', origin: 'village', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: false, seed: 'twenty-sects' });
  Object.assign(g, { age: 26, realm: 2, lifespan: 260, stones: 1000, pending: null, actionsLeft: 3 });
  g.stats = { health: 70, mind: 60, foundation: 40, insight: 40, reputation: 40, combat: 30, alchemy: 30 };
  return g;
}
function step(g: Game, action: Action): Game {
  const result = act(g, action);
  assert.equal(result.error, undefined, JSON.stringify(action));
  assert.ok(validGame(result.game), `valid save after ${JSON.stringify(action)}`);
  return result.game;
}
function inRegion(g: Game, id: string): Game {
  g.region = id;
  if (!g.visited.includes(id)) g.visited.push(id);
  return g;
}
function renew(g: Game): Game { g.actionsLeft = 3; return g; }

test('[Sects] twenty original living schools share their regional, item and cultural source', () => {
  assert.equal(SECTS.length, 20);
  assert.equal(new Set(SECTS.map(s => s.id)).size, 20);
  assert.equal(new Set(SECTS.map(s => s.specialty.gear.id)).size, 20);
  for (const region of REGIONS) {
    const local = SECTS.filter(s => s.home === region.id);
    assert.equal(local.length, 4);
    assert.deepEqual(regionWorld(region.id).factions, local.map(s => `${s.name} · ${s.style}`));
  }
  for (const s of SECTS) {
    assert.equal(sectHome(s.id), s.home);
    assert.ok(s.culture.length > 15 && s.preferences.length >= 3);
    assert.ok(s.specialty.arts.length > 0);
    assert.equal(s.specialty.id, `sect-art-${s.id}`);
    const item = ITEMS.find(i => i.id === s.specialty.gear.id)!;
    assert.equal(item.market, false);
    assert.equal(item.kind, 'gear');
    assert.equal(item.name, s.specialty.gear.name);
  }
  assert.ok(!SECTS.some(s => ['断雪剑庭', '天衡算院'].includes(s.name)), 'historical ruins did not become living schools');
});

test('[Sects] every school enforces its local gate, realm, reputation and exact entry cost', () => {
  for (const s of SECTS) {
    let g = ready();
    g.region = s.home === 'qinglan' ? 'river' : 'qinglan';
    assert.ok(act(g, { type: 'join', id: s.id }).error, s.id);
    inRegion(g, s.home);
    g.realm = s.minRealm - 1;
    assert.ok(act(g, { type: 'join', id: s.id }).error, s.id);
    g.realm = 2;
    if (s.reputation > 0) {
      g.stats.reputation = s.reputation - 1;
      assert.ok(act(g, { type: 'join', id: s.id }).error, s.id);
    }
    g.stats.reputation = s.reputation;
    g.stones = s.entryCost - 1;
    const denied = act(g, { type: 'join', id: s.id });
    assert.ok(denied.error); assert.equal(denied.game, g);
    g.stones = s.entryCost;
    assert.equal(sectEntryReason(g, s.id), undefined);
    g = step(g, { type: 'join', id: s.id });
    assert.equal(g.stones, 0); assert.equal(g.sect, s.id); assert.equal(g.actionsLeft, 2);
  }
});

test('[Sects] distinct missions spend actual stats and pay the authored materials and income', () => {
  for (const s of SECTS) {
    let g = ready(); g.sect = s.id; g.sectRank = 1;
    const effect = sectMissionEffect(g), previous = structuredClone(g);
    g = step(g, { type: 'sect', job: 'mission' });
    assert.equal(g.stones - previous.stones, effect.stones, s.id);
    assert.equal(g.contribution, effect.contribution, s.id);
    for (const [stat, amount] of Object.entries(s.mission.stats)) assert.equal(g.stats[stat as keyof Game['stats']], previous.stats[stat as keyof Game['stats']] + amount, `${s.id}: ${stat}`);
    if (effect.item) assert.equal(g.inventory[effect.item] - (previous.inventory[effect.item] ?? 0), effect.amount);
    assert.ok(g.logs.at(-1)?.title.includes(s.mission.name));
  }
});

test('[Sects] each school teaches once; leaving, selling and rejoining cannot duplicate its gear', () => {
  for (const s of SECTS) {
    let g = inRegion(ready(), s.home);
    g = step(g, { type: 'join', id: s.id }); g.contribution = s.specialty.cost;
    g = step(g, { type: 'sect', job: 'learn' });
    assert.equal(g.contribution, 0); assert.equal(g.inventory[s.specialty.gear.id], 1);
    assert.ok(g.flags.includes(s.specialty.id));
    for (const art of s.specialty.arts) assert.ok(hasSectArt(g, art));
    const learned = progressionBenefits(g);
    g = step(g, { type: 'use', id: s.specialty.gear.id });
    assert.equal(g.equipped, s.specialty.gear.id);
    assert.notDeepEqual(progressionBenefits(g), learned, `${s.id} gear has an effective modifier`);
    g = step(renew(g), { type: 'use', id: s.specialty.gear.id });
    g = step(g, { type: 'sell', id: s.specialty.gear.id });
    assert.equal(g.inventory[s.specialty.gear.id], 0);
    assert.ok(act(renew(g), { type: 'buy', id: s.specialty.gear.id }).error);
    g = step(g, { type: 'sect', job: 'leave' });
    assert.ok(g.flags.includes(s.specialty.id));
    g = step(g, { type: 'join', id: s.id }); g.contribution = 999;
    const repeated = act(renew(g), { type: 'sect', job: 'learn' });
    assert.ok(repeated.error); assert.equal(repeated.game, g);
    assert.equal(g.inventory[s.specialty.gear.id], 0); assert.equal(g.contribution, 999);
  }
});

test('[Sects] original three schools keep their annual, preparation, specialty and gear values', () => {
  const g = ready();
  g.sect = 'qinglan';
  assert.deepEqual(sectAnnualEffect(g), { stones: 16, contribution: 1, stats: { combat: 1 } });
  assert.equal(trainingFactors(g).preparation, 1 + g.home.mat * .03 + .1 + .12);
  g.sect = 'herb';
  assert.deepEqual(sectAnnualEffect(g), { stones: 16, contribution: 1, item: 'herb', amount: 1, stats: { alchemy: 1 } });
  g.flags = ['sect-art-herb']; g.equipped = 'sect-satchel';
  assert.equal(progressionBenefits(g).pillPotency, 12);
  assert.equal(progressionBenefits(g).craftChance, .12);
  g.sect = 'star'; g.flags = ['sect-art-star']; g.equipped = 'sect-seal';
  assert.deepEqual(sectAnnualEffect(g), { stones: 16, contribution: 1, stats: { insight: 1 } });
  assert.equal(breakthroughFactors(g).find(f => f.label === '当前宗门师承')!.value, .06);
  assert.ok(Math.abs(progressionBenefits(g).breakthrough - .075) < 1e-12);
  assert.deepEqual(SECTS.filter(s => ['qinglan', 'herb', 'star'].includes(s.id)).map(s => [s.id, s.entryCost, s.specialty.cost]), [['qinglan', 30, 100], ['herb', 30, 80], ['star', 30, 140]]);
});

test('[Sects] multiple permanent school arts retain solutions but only the strongest shared numerical benefit', () => {
  const g = ready(); g.flags = SECTS.map(s => s.specialty.id);
  const b = progressionBenefits(g);
  assert.equal(b.adventureDamage, .75);
  assert.equal(b.adventureIncome, 1.14);
  assert.equal(b.adventureTraining, 1.25);
  assert.equal(b.workIncome, 8);
  assert.equal(b.pillPotency, 7);
  assert.equal(b.restMind, 6);
  assert.equal(b.restHealth, 6);
  assert.equal(b.breakthrough, .04);
  assert.equal(b.training, 1.07);
  assert.equal(b.upkeep, 2, 'a learned heterodox cost is not discarded when changing schools');
  for (const art of ['sword', 'medicine', 'formation', 'ledger', 'pathfinder', 'body'] as const) assert.ok(hasSectArt(g, art));
  g.flags.push('exp-spring-vein', 'exp-tomb-ward');
  assert.equal(progressionBenefits(g).training, 1.07 * 1.08, 'earned expedition rewards remain distinct from school stacking');
});

test('[Sects] school yearly income and constrained heterodox practice affect a real year', () => {
  const baseline = ready(); baseline.focus = 'work'; baseline.age = 16;
  baseline.seen = Object.fromEntries(EVENTS.map(event => [event.id, 17]));
  const ordinary = step(structuredClone(baseline), { type: 'advance' });
  const merchant = structuredClone(baseline); merchant.sect = 'cloudledger';
  const traded = step(merchant, { type: 'advance' });
  assert.equal(traded.stones - ordinary.stones, 26, '20 annual allowance plus 6 active work income');
  const heterodox = structuredClone(baseline); heterodox.sect = 'ashveil';
  const changed = step(heterodox, { type: 'advance' });
  assert.equal(changed.stones - ordinary.stones, 11, '14 allowance minus 3 upkeep');
  assert.equal(changed.stats.health - ordinary.stats.health, 1);
  assert.ok(changed.stats.reputation < ordinary.stats.reputation);
  const herb = structuredClone(baseline); herb.sect = 'herb';
  assert.equal(step(herb, { type: 'advance' }).inventory.herb - ordinary.inventory.herb, 1);
});

test('[Sects] learned pathfinding opens independent spring and observatory routes without invented companions', () => {
  for (const expedition of ['spring', 'observatory']) {
    let g = ready(); g.flags.push('sect-art-emberescort');
    if (expedition === 'observatory') { inRegion(g, 'central'); g.realm = 3; g.lifespan = 560; g.flags.push('exp-spring-clear'); }
    for (const npc of g.npcs) npc.relation = 0;
    g = step(g, { type: 'expedition-start', id: expedition });
    assert.ok(expeditionView(g).active!.choices.some(c => c.id === 'pathcraft' && !c.disabled));
    g = step(g, { type: 'expedition-choose', id: 'pathcraft' });
    assert.equal(g.expeditions!.active!.companionId, undefined);
    assert.equal(g.expeditions!.active!.marks[0], 'pathcraft');
    const persisted = JSON.parse(JSON.stringify(g)); assert.ok(validGame(persisted));
    const forged = structuredClone(g); forged.expeditions!.active!.companionId = 'peer-2'; assert.equal(validGame(forged), false);
    const relations = g.npcs.map(n => n.relation);
    g = step(persisted, { type: 'expedition-choose', id: expedition === 'spring' ? 'channel' : 'balanced' });
    g = step(g, { type: 'expedition-choose', id: expedition === 'spring' ? 'clear' : 'chart' });
    assert.deepEqual(g.npcs.map(n => n.relation), relations);
    assert.ok(!g.flags.includes('companion-bond:peer-2'));
  }
});

test('[Sects] independent contract study unlocks rescue passage and does not summon the ledger NPC', () => {
  let g = inRegion(ready(), 'river'); g.flags.push('sect-art-cloudledger');
  g.npcs[1].relation = 50; g.npcs[0].alive = false;
  g = step(g, { type: 'expedition-start', id: 'rescue' });
  g = step(g, { type: 'expedition-choose', id: 'ledger-study' });
  assert.equal(g.expeditions!.active!.companionId, undefined); assert.ok(validGame(g));
  const persisted = JSON.parse(JSON.stringify(g));
  g = step(persisted, { type: 'expedition-choose', id: 'passage' });
  g = step(g, { type: 'expedition-choose', id: 'cache' });
  assert.ok(g.flags.includes('exp-rescue-cache'));
  assert.ok(!g.flags.includes('companion-bond:peer-0'));
});

test('[Sects] prior companion marks still require their companion and resume independently of school arts', () => {
  for (const [id, choice, peer] of [['spring', 'guide', 'peer-2'], ['rescue', 'ledger', 'peer-0']] as const) {
    let g = inRegion(ready(), id === 'spring' ? 'qinglan' : 'river');
    for (const npc of g.npcs) npc.relation = 70;
    g = step(g, { type: 'expedition-start', id });
    assert.ok(!expeditionView(g).active!.choices.some(c => ['pathcraft', 'ledger-study'].includes(c.id)));
    g = step(g, { type: 'expedition-choose', id: choice });
    assert.equal(g.expeditions!.active!.companionId, peer);
    const persisted = JSON.parse(JSON.stringify(g)); assert.ok(validGame(persisted));
    const invalid = structuredClone(g); delete invalid.expeditions!.active!.companionId; assert.equal(validGame(invalid), false);
    g = step(persisted, { type: 'expedition-choose', id: id === 'spring' ? 'channel' : 'passage' });
    assert.equal(g.expeditions!.active!.companionId, peer);
  }
});

test('[Sects] medicine, sword, formation and body traditions unlock actual distinct expedition solutions', () => {
  let medicine = ready(); medicine.flags.push('sect-art-redriver'); medicine.stats.alchemy = 0;
  medicine = step(medicine, { type: 'expedition-start', id: 'spring' });
  assert.equal(expeditionView(medicine).active!.choices.find(c => c.id === 'medicine')!.disabled, undefined);
  let sword = inRegion(ready(), 'north'); sword.flags.push('sect-art-frostsword'); sword.stats.combat = 0;
  sword = step(sword, { type: 'expedition-start', id: 'tomb' });
  sword = step(sword, { type: 'expedition-choose', id: 'sword' });
  assert.equal(sword.expeditions!.active!.marks[0], 'sword');
  let formation = ready(); formation.flags.push('sect-art-stillpine');
  formation = step(formation, { type: 'expedition-start', id: 'spring' });
  formation = step(formation, { type: 'expedition-choose', id: 'map' });
  formation = step(formation, { type: 'expedition-choose', id: 'read' });
  assert.equal(formation.expeditions!.active!.marks[1], 'settled');
  let body = inRegion(ready(), 'river'); body.flags.push('sect-art-northforge'); body.npcs[1].relation = 60;
  body = step(body, { type: 'expedition-start', id: 'rescue' });
  body = step(body, { type: 'expedition-choose', id: 'haste' });
  const health = body.stats.health;
  body = step(body, { type: 'expedition-choose', id: 'force' });
  assert.equal(health - body.stats.health, 8);
});
