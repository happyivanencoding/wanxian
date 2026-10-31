import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createGame, getEvent } from '../src/game/engine.ts';
import { nextRegionalEvent } from '../src/game/regional.ts';
import { getVentureEvent, nextVentureEvent } from '../src/game/venture.ts';
import { HISTORY_CHAPTERS, worldYear } from '../src/game/history.ts';
import { validGame } from '../src/game/storage.ts';
import type { Game } from '../src/game/types.ts';

const ids=['qinglan','river','north','desert','central'];
function born(region:string):Game {
  const g=createGame({name:'',gender:'随缘',origin:'random',era:'peace',region,route:'balanced',mode:'seeker',fastStart:false,seed:'region-test-'+region});
  Object.assign(g,{age:28,realm:1,progress:0,lifespan:260,stones:3000,totalStones:3000,pending:null,actionsLeft:3});
  Object.assign(g.stats,{health:95,mind:92,insight:80,foundation:85,reputation:70});
  g.history!.lastYear=worldYear(g);
  g.seen.departure=16;g.seen.vow=18;
  for(const chapter of HISTORY_CHAPTERS) g.seen['history-'+chapter.id]=20;
  return g;
}
function nextYear(g:Game):Game{
  const result=act(g,{type:'advance'});
  assert.equal(result.error,undefined);
  return result.game;
}
function settle(g:Game,index=0):Game {
  assert.ok(g.pending,'Expected a pending story');
  const outcome=act(g,{type:'choose',index});
  assert.equal(outcome.error,undefined);
  assert.ok(validGame(outcome.game));
  return outcome.game;
}
function toAge(g:Game,age:number):Game {
  g.age=age;g.history!.lastYear=worldYear(g);g.pending=null;return g;
}
for (const region of ids) test('Each continent has a named household, distinct scenes and meaningful local consequences: '+region,()=>{
  let g=nextYear(born(region));
  assert.equal(g.pending,'region-'+region+'-arrival');
  assert.ok(getEvent(g)?.text.includes(g.region==='river'?'药':region==='north'?'剑':region==='desert'?'流':region==='central'?'名':'泉'));
  assert.equal(g.npcs.length,1);
  const person=g.npcs[0];assert.equal(person.id,'region-person-'+region);
  assert.ok(person.family);assert.ok(person.desire);
  g=settle(g,0);
  const first=g.seen['region-'+region+'-arrival'];
  g=nextYear(toAge(g,first+6));
  assert.equal(g.pending,'region-'+region+'-dispute');
  const before={...g.history!.strength};
  g=settle(g,0);
  assert.ok(g.flags.includes('region-decision:'+region+':'+(region==='river'?'open':region==='north'?'guard':region==='central'?'names':'protect')));
  assert.ok(g.logs.some(l=>l.title==='地方局势'));
  assert.ok(Object.values(g.history!.strength).some((score,i)=>score!==Object.values(before)[i]));
});
test('Escorted travel changes the entire local story without charging normal fare or erasing past ties',()=>{
  let g=born('qinglan');g.seen['region-qinglan-arrival']=20;g.seen['region-qinglan-dispute']=28;
  g.seen['region-qinglan-apprentice']=29;g.age=40;g.history!.lastYear=worldYear(g);
  g=nextYear(g);assert.equal(g.pending,'region-qinglan-journey');
  const stones=g.stones;
  g=settle(g,0);assert.equal(g.region,'river');assert.equal(g.stones,stones);
  assert.ok(g.visited.includes('qinglan')&&g.visited.includes('river'));
  g=nextYear(g);assert.equal(g.pending,'region-river-arrival');
  assert.ok(g.logs.some(l=>l.title==='山河转折'));
});
test('A story encounter can enroll the player through a sponsor rather than a separate sect menu',()=>{
  let g=born('north');g.realm=1;g.seen['region-north-arrival']=20;g.seen['region-north-dispute']=30;
  g=nextYear(toAge(g,38));assert.equal(g.pending,'region-north-apprentice');
  const options=getEvent(g)!.choices; assert.ok(options.some(c=>c.effect.flag?.includes(':join:')));
  const stones=g.stones;
  g=settle(g,0);assert.ok(g.sect);assert.equal(g.stones,stones);
  assert.ok(g.logs.some(l=>l.title==='有了师承'));
});
test('The spring expedition arrives as a life decision and enters a three-stage scene only after acceptance',()=>{
  let g=born('qinglan');g.age=34;g.history!.lastYear=worldYear(g);
  for(const beat of ['arrival','dispute','apprentice','journey','echo']) g.seen['region-qinglan-'+beat]=20;
  assert.equal(nextRegionalEvent(g),undefined);
  assert.equal(nextVentureEvent(g,0),'venture-spring');
  g.pending='venture-spring';assert.ok(validGame(g));
  assert.match(getVentureEvent(g,'venture-spring')!.text,/泉|雾/);
  const prior=g.stones;
  g=settle(g,0);assert.equal(g.expeditions?.active?.stage,0);
  assert.equal(g.actionsLeft,2);assert.ok(g.stones<prior);
  assert.ok(g.logs.some(l=>l.text.includes('本次变化：灵石')));
});
test('Choice outcomes reveal actual numbers only after the decision is recorded',()=>{
  let g=born('river');g=nextYear(g);
  const option=getEvent(g)!.choices[0];
  assert.ok(option.effect.stats?.insight);
  g=settle(g,0);
  assert.ok(g.logs.some(l=>l.title.includes('闻氏')&&l.text.includes('本次变化：')));
});
