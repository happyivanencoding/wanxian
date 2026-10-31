import test from 'node:test';
import assert from 'node:assert/strict';
import { withLegacyPeers } from './fixtures.ts';
import { act, choiceUnavailable, createGame, getEvent } from '../src/game/engine.ts';
import { EVENTS } from '../src/game/events.ts';
import { REGIONS, SECTS } from '../src/game/data.ts';
import { REGIONAL_EVENTS, getRegionalEvent } from '../src/game/regional.ts';
import { SECT_LIFE_EVENTS, getSectLifeEvent } from '../src/game/sect-life.ts';
import { LIFE_EVENTS, getLifeEvent } from '../src/game/lifelines.ts';
import { STORY_EVENTS, getStoryEvent } from '../src/game/story.ts';
import { HISTORY_EVENTS, getHistoryEvent } from '../src/game/history.ts';
import { VENTURE_EVENTS, getVentureEvent } from '../src/game/venture.ts';
import { getRelationshipEvent } from '../src/game/relationships.ts';
import { fateInfluence } from '../src/game/fate.ts';
import type { EventDef, Game } from '../src/game/types.ts';

const config = { name: '林听澜', gender: '随缘', origin: 'random', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker' as const, fastStart: false, seed: 'story-audit' };
const sample = () => {
  const g = withLegacyPeers(createGame(config));
  g.age = 420; g.realm = 5; g.lifespan = 2240; g.stones = 10000;
  g.actionsLeft = 3; g.pending = null; g.contribution = 10000;
  for (const npc of g.npcs) npc.relation = 85;
  for (const entry of LIFE_EVENTS) g.seen[entry.id] = g.age - 80;
  return g;
};
function verify(event: EventDef, id: string) {
  assert.ok(event.text.trim().length > 10, `${id}: missing scene`);
  assert.ok(event.choices.length, `${id}: missing choices`);
  assert.equal(new Set(event.choices.map(item => item.label)).size, event.choices.length, `${id}: duplicate labels`);
  for (const choice of event.choices) {
    assert.ok(choice.label.trim().length >= 3, `${id}: vague action`);
    assert.ok(choice.effect, `${id}: missing outcome`);
    assert.ok(!(choice.effect.stones && choice.effect.stones < 0 && !choice.cost), `${id}: unlisted immediate stone debit`);
    assert.ok(!choice.cost || choice.cost > 0, `${id}: invalid stone fee`);
    assert.ok(!choice.annualCost || choice.annualCost > 0, `${id}: invalid yearly fee`);
  }
}
test('all available story systems have concrete choices with declared immediate costs', () => {
  const g = sample();
  for (const event of EVENTS) {
    if ([...REGIONAL_EVENTS, ...SECT_LIFE_EVENTS, ...LIFE_EVENTS, ...STORY_EVENTS, ...HISTORY_EVENTS, ...VENTURE_EVENTS].some(item => item.id === event.id) || event.id.startsWith('meet-') || event.id === 'rival-pursuit') continue;
    verify(getEvent(g, event.id)!, event.id);
  }
  for (const event of REGIONAL_EVENTS) {
    const region = event.id.split('-')[1];
    g.region = region;
    const detail = getRegionalEvent(g, event.id);
    if (detail) verify(detail, event.id);
    if (event.id.endsWith('-arrival')) {
      assert.ok(detail && detail.choices.every(choice => !['帮忙查清这件事', '听取另一方的条件', '先把见闻记下'].includes(choice.label)));
    }
  }
  for (const event of SECT_LIFE_EVENTS) {
    const sect = SECTS.find(item => event.id.startsWith(`sect-life-${item.id}-`))!;
    g.sect = sect.id; g.region = sect.home;
    const detail = getSectLifeEvent(g, event.id);
    assert.ok(detail);
    verify(detail, event.id);
    assert.ok(detail.choices.every(item => !['照门里的规矩继续办', '过去帮忙，跟大家一同做'].includes(item.label)));
    if (event.id.endsWith('-teaching')) assert.match(detail.choices[0].hint, new RegExp(`消耗 ${sect.specialty.cost} 宗门贡献`));
  }
  g.sect = null;
  for (const event of LIFE_EVENTS) {
    const detail = getLifeEvent(g, event.id);
    if (detail) verify(detail, event.id);
  }
  for (const event of HISTORY_EVENTS) verify(getHistoryEvent(g, event.id)!, event.id);
  for (const event of STORY_EVENTS) {
    const detail = getStoryEvent(g, event.id);
    if (detail) verify(detail, event.id);
  }
  for (const event of VENTURE_EVENTS) {
    const realm = event.id.endsWith('-spring') ? 1 : event.id.endsWith('-rescue') ? 2 : 3;
    g.realm = realm; g.region = REGIONS.find(region => region.id === ({'venture-spring':'qinglan','venture-rescue':'river','venture-tomb':'north','venture-observatory':'central'} as Record<string,string>)[event.id])!.id;
    g.flags.push('cave-studied');
    const detail = getVentureEvent(g, event.id);
    assert.ok(detail, event.id);
    verify(detail, event.id);
    assert.ok(detail.choices[0].cost && detail.choices[0].cost > 0);
  }
  for (const id of ['meet-road','meet-healer','meet-heir','meet-sword','meet-stranger']) {
    g.flags.push(`meeting-actor:${id}:peer-0`);
    verify(getRelationshipEvent(g, id)!, id);
  }
});
test('a vastly weaker pursuer uses a messenger instead of forcing a fight', () => {
  const g = sample();
  g.realm = 5; g.stones = 1000; g.pending = 'rival-pursuit';
  const rival = g.npcs[0];
  rival.realm = 0; rival.role = 'enemy'; rival.hostility = 90;
  rival.grievance = '你当年取走了他的灵玉。';
  g.flags.push(`meeting-actor:rival-pursuit:${rival.id}`);
  const event = getEvent(g)!;
  assert.match(event.text, /没有拔剑/);
  assert.ok(event.choices.every(item => !/迎战|决生死/.test(item.label)));
  assert.equal(event.choices.length, 3);
  const fee = event.choices.find(choice => choice.cost)!;
  assert.ok(fee.cost! > 0 && fee.cost! < g.stones);
  const next = act(g, { type: 'choose', index: event.choices.indexOf(fee) });
  assert.equal(next.error, undefined);
  assert.equal(next.game.stones, g.stones - fee.cost!);
  assert.equal(next.game.npcs[0].hostility, 0);
  assert.equal(next.game.stats.health, g.stats.health);
});
test('region fees cannot silently subtract stones or hide an insufficient balance', () => {
  const g = sample();
  g.region = 'qinglan'; g.pending = 'region-qinglan-dispute'; g.stones = 11;
  const event = getEvent(g)!;
  const index = event.choices.findIndex(choice => choice.effect.flag === 'region-decision:qinglan:relocate');
  assert.equal(event.choices[index].cost, 12);
  assert.match(choiceUnavailable(g, event.choices[index])!, /需要 12 灵石，现有 11，还差 1/);
  assert.match(act(g, { type: 'choose', index }).error!, /需要 12 灵石/);
  g.stones = 12;
  const result = act(g, { type: 'choose', index });
  assert.equal(result.error, undefined);
  assert.equal(result.game.stones, 0);
});
test('entering a multi-step expedition charges only once', () => {
  const g = sample();
  g.region = 'qinglan'; g.realm = 1; g.pending = 'venture-spring'; g.stones = 1000;
  const event = getEvent(g)!;
  assert.equal(event.choices[0].cost, 18);
  const result = act(g, { type: 'choose', index: 0 });
  assert.equal(result.error, undefined);
  assert.equal(result.game.stones, 982);
  assert.equal(result.game.expeditions?.active?.id, 'spring');
});
test('long-term guardian choices disclose actual yearly costs', () => {
  const g = sample();
  assert.equal(getStoryEvent(g, 'story-call-guardian')!.choices[0].annualCost, 8);
  g.flags.push('story-active-guardian');
  const healing = getStoryEvent(g, 'story-guardian-healing')!;
  assert.deepEqual(healing.choices.map(choice => choice.annualCost), [7, 4]);
  g.flags.push('story-clinic');
  assert.equal(fateInfluence(g).upkeep, 7);
  assert.equal(getStoryEvent(g, 'story-guardian-exodus')!.choices[0].annualCost, 7);
  g.flags.push('story-watch');
  assert.equal(fateInfluence(g).upkeep, 7);
});
test('low-tier bandits stop targeting high-realm cultivators', () => {
  const bandits = EVENTS.find(event => event.id === 'bandits')!;
  assert.equal(bandits.maxRealm, 1);
});
test('joining a sect as a high-realm cultivator is an invitation to teach', () => {
  const g = sample();
  g.sect = null; g.region = 'qinglan'; g.realm = 5;
  g.pending = 'region-qinglan-apprentice';
  const event = getEvent(g)!;
  assert.match(event.text, /高阶修士/);
  const index = event.choices.findIndex(choice => choice.effect.flag?.endsWith(':join:qinglan'));
  assert.ok(index >= 0);
  const next = act(g, { type: 'choose', index });
  assert.equal(next.error, undefined);
  assert.equal(next.game.sect, 'qinglan');
  assert.equal(next.game.sectRank, 3);
  const welcome = getSectLifeEvent(next.game, 'sect-life-qinglan-welcome')!;
  assert.match(welcome.text, /高阶修士/);
});
test('a departed friend leaves a manuscript, not an impossible rescue request', () => {
  const g = sample();
  g.npcs[0].alive = false;
  g.flags.push('wounded-person:peer-0');
  g.pending = 'wounded-friend';
  const event = getEvent(g)!;
  assert.match(event.text, /已经离世/);
  assert.ok(event.choices.every(choice => !/守在身旁|请医/.test(choice.label)));
  assert.ok(event.choices.every(choice => !choice.delayed));
  const paid = event.choices.find(choice => choice.cost)!;
  assert.equal(paid.cost, 35);
  const next = act(g, { type: 'choose', index: event.choices.indexOf(paid) });
  assert.equal(next.error, undefined);
  assert.equal(next.game.delayed.length, g.delayed.length);
});
