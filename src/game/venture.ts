import { expeditionOffers, mutateExpedition } from './expeditions.ts';
import type { Choice, Effect, EventDef, Game, LogKind } from './types.ts';

type Hooks = {
  random: (cursor: { rng: number }) => number;
  gain: (g: Game, effect: Effect) => void;
  log: (g: Game, title: string, text: string, kind?: LogKind, important?: boolean) => void;
  checkLife: (g: Game) => void;
};
const names = ['spring','rescue','tomb','observatory'];
export const VENTURE_EVENTS: EventDef[] = names.map(id => ({
  id:'venture-'+id,title:'不期而至的机缘',text:'',category:'encounter',kind:'turning',
  once:true,weight:0,choices:[],
}));
export function nextVentureEvent(g:Game,roll:number):string|undefined {
  if(!g.alive||g.age<22||g.expeditions?.active)return;
  const localBeenHere=g.seen['region-'+g.region+'-arrival'];
  if(localBeenHere===undefined||g.age-localBeenHere<4)return;
  const offers=expeditionOffers(g).filter(o=>o.region===g.region&&o.available&&g.seen['venture-'+o.id]===undefined);
  const offer=offers[0];
  if(offer&&roll<(g.focus==='adventure'?0.34:0.22))return 'venture-'+offer.id;
}
export function getVentureEvent(g:Game,id:string):EventDef|undefined {
  const base=VENTURE_EVENTS.find(e=>e.id===id);
  if(!base)return;
  const offer=expeditionOffers(g).find(o=>id==='venture-'+o.id);
  if(!offer)return;
  const choices:Choice[]=[
    {label:'备好行装，亲自探查',hint:offer.risk,cost:offer.cost,autoScore:4,effect:{flag:'venture-enter:'+offer.id},successText:'你带上行装，决定亲自探查这处地方。'},
    {label:'记住这个消息，继续眼前的生活',hint:'',autoScore:6,effect:{flag:'venture-pass:'+offer.id},successText:'你没有踏进险地。那段传闻和这次错过，都属于你的经历。'},
  ];
  return {...base,title:offer.title,text:offer.description+'入口尚未探明，备齐行装才能进去；遇险也可能空手而归。',choices};
}
export function recordVentureChoice(g:Game,event:EventDef,choice:Choice,hooks:Hooks){
  if(!event.id.startsWith('venture-')||!choice.effect.flag?.startsWith('venture-enter:'))return;
  const id=choice.effect.flag.split(':')[1];
  const error=mutateExpedition(g,{type:'expedition-start',id},hooks);
  if(error)hooks.log(g,'错过的机缘',error+'。你暂且回到了日常生活。','encounter');
}
