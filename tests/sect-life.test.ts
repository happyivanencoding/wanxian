import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createGame, getEvent } from '../src/game/engine.ts';
import { SECTS } from '../src/game/data.ts';
import { factionForRegion, worldYear } from '../src/game/history.ts';
import { getSectLifeEvent, nextSectLifeEvent, sectLifeSnapshot } from '../src/game/sect-life.ts';
import { validGame } from '../src/game/storage.ts';
import { handledWorldTurns } from './fixtures.ts';

function member(id: string) {
  const sect = SECTS.find(item => item.id === id)!;
  const g = createGame({
    name: '叶问心', gender: '女修', origin: 'village', era: 'peace', region: sect.home,
    route: 'balanced', mode: 'seeker', fastStart: false, seed: 'sect-life-' + id,
  });
  Object.assign(g, { age: 42, realm: Math.max(2, sect.minRealm), lifespan: 800, stones: 2500, totalStones: 2500, actionsLeft: 3, sect: id, contribution: 0, pending: null });
  Object.assign(g.stats, { health: 95, mind: 90, insight: 75, foundation: 75, combat: 60, reputation: 75 });
  g.flags.push('sect-joined:' + id + ':33');
  g.history!.lastYear = worldYear(g);
  handledWorldTurns(g);
  return g;
}

test('all twenty schools introduce a person and four authored chapters, not a common extra perk', () => {
  const introductions = new Set<string>();
  const problems = new Set<string>();
  for (const sect of SECTS) {
    let game = member(sect.id);
    assert.equal(nextSectLifeEvent(game), 'sect-life-' + sect.id + '-welcome');
    game = act(game, { type: 'advance' }).game;
    assert.equal(game.pending, 'sect-life-' + sect.id + '-welcome');
    assert.ok(game.npcs.some(person => person.id === 'sect-teacher-' + sect.id && person.role === 'mentor'));
    assert.ok(validGame(game));
    const intro = getEvent(game)!;
    introductions.add(intro.text);
    assert.ok(intro.text.length > 40);
    assert.ok(intro.choices.length >= 2);
    game = act(game, { type: 'choose', index: 0 }).game;
    assert.ok(game.contribution >= 8, sect.id);
    const future = getSectLifeEvent(game, 'sect-life-' + sect.id + '-errand')!;
    problems.add(future.text);
    assert.ok(future.choices.some(choice => (choice.effect.contribution ?? 0) > 0));
    assert.ok(sectLifeSnapshot(game)?.mentor);
  }
  assert.equal(introductions.size, 20);
  assert.equal(problems.size, 20);
});

test('sect missions and the internal disagreement affect contribution, mentors, and local standing', () => {
  const sect = SECTS.find(item => item.id === 'herb')!;
  let game = member('herb');
  game.seen['sect-life-herb-welcome'] = 37;
  game.pending = 'sect-life-herb-errand';
  const before = game.contribution;
  game = act(game, { type: 'choose', index: 0 }).game;
  assert.ok(game.contribution > before);
  assert.match(game.logs.at(-1)!.text, /宗门贡献/);
  game.pending = 'sect-life-herb-division';
  const strength = game.history!.strength[factionForRegion('river')];
  const choice = getEvent(game)!.choices.findIndex(option => option.effect.flag?.endsWith(':people'));
  game = act(game, { type: 'choose', index: choice }).game;
  assert.ok(game.history!.strength.tide > strength);
  assert.ok(game.flags.includes('sect-decision:herb:people'));
  assert.ok(validGame(game));
  assert.ok(sect.mission.contribution > 0);
});

test('a school teaches its own art and grants its artifact through a life event', () => {
  let game = member('qinglan');
  const sect = SECTS.find(item => item.id === 'qinglan')!;
  game.contribution = sect.specialty.cost + 14;
  game.pending = 'sect-life-qinglan-legacy';
  const before = game.contribution;
  assert.match(getEvent(game)!.choices[0].label, /师父/);
  game = act(game, { type: 'choose', index: 0 }).game;
  assert.ok(game.flags.includes(sect.specialty.id));
  assert.equal(game.contribution, before - sect.specialty.cost);
  assert.equal(game.inventory[sect.specialty.gear.id], 1);
  assert.ok(validGame(game));
});

test('the next technique becomes a story choice at its earned contribution threshold', () => {
  for (const sect of SECTS) {
    let game = member(sect.id);
    game.seen['sect-life-' + sect.id + '-welcome'] = 35;
    game.seen['sect-life-' + sect.id + '-errand'] = 38;
    game.contribution = sect.specialty.cost;
    const eventId = 'sect-life-' + sect.id + '-teaching';
    assert.equal(nextSectLifeEvent(game), eventId);
    game.pending = eventId;
    const before = game.contribution;
    game = act(game, { type: 'choose', index: 0 }).game;
    assert.ok(game.flags.includes(sect.specialty.id), sect.id);
    assert.equal(game.contribution, before - sect.specialty.cost);
    assert.equal(game.inventory[sect.specialty.gear.id], 1);
    assert.ok(validGame(game));
  }
});
test('staying in a school can advance a real role without opening the action drawer', () => {
  let game = member('qinglan');
  game.contribution = 60;
  for (const phase of ['welcome', 'errand', 'division', 'legacy']) game.seen['sect-life-qinglan-' + phase] = 30;
  game = act(game, { type: 'advance' }).game;
  assert.equal(game.sectRank, 1);
  assert.ok(game.logs.some(entry => entry.title === '门中升任'));
  assert.ok(validGame(game));
});
