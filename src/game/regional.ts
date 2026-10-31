import { REGIONS, SECTS } from './data.ts';
import { FACTIONS, factionForRegion, regionalStanding } from './history.ts';
import { meetPerson } from './relationships.ts';
import type { Choice, Effect, EventDef, Game, LogKind } from './types.ts';

type RegionId = 'qinglan' | 'river' | 'north' | 'desert' | 'central';
type Beat = 'arrival' | 'dispute' | 'apprentice' | 'journey' | 'echo';
type Hooks = {
  random: (cursor: { rng: number }) => number;
  log: (g: Game, title: string, text: string, kind: LogKind, important?: boolean) => void;
  gain: (g: Game, effect: Effect) => void;
};
type Locale = {
  family: string; name: string; title: string; kind: string; desire: string;
  origin: string; arrival: string; dispute: string; echo: string; invitation: string;
  destinations: [RegionId,RegionId];
};
const locales: Record<RegionId, Locale> = {
  qinglan: {
    family: '虞氏', name: '虞听溪', title: '雾隐泉守后人', kind: 'healer', desire: '查清泉眼石化的根源',
    origin: '虞氏与陆氏为雾隐泉的旧水契争执了三代。泉水渐冷，山脚的人仍依赖这口泉。',
    arrival: '山雨后，虞听溪把旧水契摊在你面前。陆家想修引水渠，剑宗则要封泉。谁也没有问过泉边住着的人。',
    dispute: '石化沿着水渠蔓延。剑宗封山，陆家提出迁村，虞氏坚持查清泉底古印。你先前做过的事已被他们记住。',
    echo: '雾隐泉的新守人寄来一册水账。人们仍在泉边生活，账上也记着你当年的决定。',
    invitation: '云泽的药船愿查泉毒；北溟的顾氏则请人辨认泉底剑纹。两队都肯承担同行的船马。',
    destinations: ['river','north'],
  },
  river: {
    family: '闻氏', name: '闻照水', title: '七桥行医人', kind: 'healer', desire: '让船上的穷人用得起药',
    origin: '七桥沈氏管船位，闻氏保存旧药方。药价涨了，双方都有难以让步的理由。',
    arrival: '闻照水的药船停了三天。船上的病人等药，沈家要求先交押金；另有一箱药必须浸在冷水里。',
    dispute: '沉钟岛送来一份残方。闻氏想公开，沈氏想独占海路配药权。渡潮盟请你见证谁能守住约定。',
    echo: '七桥药价又变了。有人沿用你的药方，有人改出新药；原稿上仍写着闻氏的名字。',
    invitation: '玉京的苏氏邀你携药方入城辩论；赤霞迁徙营地缺药，船队愿将你送去而不收客路钱。',
    destinations: ['central','desert'],
  },
  north: {
    family: '顾氏', name: '顾沉舟', title: '北炉铸剑师', kind: 'artisan', desire: '铸出断雪剑庭最后一柄剑',
    origin: '北炉顾氏守残剑，程氏守夜阵。两家都自称保存着剑庭覆灭的真相，雪原却不断有人失踪。',
    arrival: '极夜将至，顾沉舟在炉前锻一块不肯熔化的寒铁。程家守阵人指认它来自照夜剑冢，要求停炉。',
    dispute: '镜冰原的星轨与旧碑不符。顾氏想取剑胎，程氏先要修守夜阵，南来的买家已开始出价。',
    echo: '北炉还在燃烧，但守炉者已换了一代。有人凭你留下的剑纹，铸出了与你所想不同的兵器。',
    invitation: '青岚剑盟请你核对南来的剑谱；玉京旧院愿护送知道剑冢旧事的人去仙城。',
    destinations: ['qinglan','central'],
  },
  desert: {
    family: '燕氏', name: '燕无赦', title: '赤乌旧军后人', kind: 'avenger', desire: '为流亡族人找到新的落脚处',
    origin: '燕氏祖器失落，殷氏靠卖旧图发财。迁徙的后人不都想替上一代继续打仗。',
    arrival: '烬原集外，一队流民被迫改道。燕无赦认出殷家卖的假图，那上面的水源根本不存在。',
    dispute: '沉砂都露出旧城一角。殷氏持图求赏，燕氏要争回祖器，沙氏只想让迁徙营地平安过夜。',
    echo: '沉砂都来了新一队少年。他们知道燕氏的传闻，却更关心今晚有没有水喝。',
    invitation: '北溟铸剑师请人带残鞘北上；云泽水盟愿带迁徙者坐船离开荒原，同行者无需另付旅费。',
    destinations: ['north','river'],
  },
  central: {
    family: '苏氏', name: '苏流萤', title: '玉京浮槎器师', kind: 'artisan', desire: '让散修也能渡过黑潮',
    origin: '天衡议庭的旧名册漏掉一批修士。裴氏要保住秩序，苏氏想造渡海浮槎，秦家暗中买通行名额。',
    arrival: '万法坊里，苏流萤拿着未获批的渡海器图。裴氏要求先验名册，秦家愿买断整套图纸。',
    dispute: '旧院名册被证实遭到删改。散修被挡在讲坛外，世家互相指责；苏家浮槎能否启航，取决于谁能登船。',
    echo: '旧名册被重新装订。有人补回了被删的名字，也有人为你的决定写下另一种解释。',
    invitation: '赤霞有人持祖器线索来求证；云泽的归潮号愿带你核验渡海航线，不必缴纳玉京的通行费。',
    destinations: ['desert','river'],
  },
};
const regionIds = Object.keys(locales) as RegionId[];
const beats: Beat[] = ['arrival','dispute','apprentice','journey','echo'];
const beatsName: Record<Beat,string> = { arrival:'乡里初逢',dispute:'旧事纷争',apprentice:'师承来信',journey:'去往别处的路',echo:'后来的一页' };
export const REGIONAL_EVENTS: EventDef[] = regionIds.flatMap(region => beats.map(beat => ({
  id:'region-' + region + '-' + beat, title:beatsName[beat], text:'',
  category:'life' as const, kind:'turning' as const, once:true, weight:0, choices:[],
})));
const idFor = (region: RegionId, beat: Beat) => 'region-' + region + '-' + beat;
const flag = (region: RegionId, action: string) => 'region-decision:' + region + ':' + action;
const seen = (g: Game,id: string) => g.seen[id] !== undefined;
const elapsed = (g: Game,id: string,years: number) => seen(g,id) && g.age-g.seen[id]>=years;
const nameOf = (region: RegionId) => REGIONS.find(r=>r.id===region)!.name;
const actor = (g: Game,region: RegionId) => g.npcs.find(n=>n.id==='region-person-'+region);
const name = (g: Game,region: RegionId) => actor(g,region)?.name??locales[region].name;
const choice = (region:RegionId, action:string,label:string,effect:Effect={},text='',extra:Partial<Choice>={}):Choice =>
  ({label,hint:'',effect:{...effect,flag:flag(region,action)},successText:text,autoScore:5,...extra});
const result = (base: EventDef,title:string,text:string,choices:Choice[],cause?:string):EventDef =>
  ({...base,title,text,choices,...(cause?{cause}:{})});

export function bindRegionalEvent(g:Game,id:string,hooks:Hooks) {
  const match=/^region-(qinglan|river|north|desert|central)-arrival$/.exec(id);
  if (!match || g.npcs.length>=64) return;
  const region=match[1] as RegionId,local=locales[region];
  meetPerson(g,local.kind,hooks,'region-person-'+region,{name:local.name,title:local.title,desire:local.desire,family:local.family});
}
export function nextRegionalEvent(g:Game):string|undefined {
  if(!g.alive||g.age<16) return;
  const region=g.region as RegionId;
  if(!locales[region]) return;
  if(!seen(g,idFor(region,'arrival'))) return idFor(region,'arrival');
  if(!seen(g,idFor(region,'dispute')) && elapsed(g,idFor(region,'arrival'),6)) return idFor(region,'dispute');
  if(!g.sect&&!seen(g,idFor(region,'apprentice'))&&elapsed(g,idFor(region,'dispute'),5)
     &&SECTS.some(s=>s.home===region&&s.minRealm<=g.realm)&&regionalStanding(g,region).strength>=20) return idFor(region,'apprentice');
  if(!seen(g,idFor(region,'journey'))&&elapsed(g,idFor(region,'dispute'),10)) return idFor(region,'journey');
  const echoes=regionIds.filter(r=>seen(g,idFor(r,'dispute'))&&!seen(g,idFor(r,'echo'))&&elapsed(g,idFor(r,'dispute'),25));
  if(echoes.includes(region)) return idFor(region,'echo');
  if(echoes.length) return idFor(echoes[0],'echo');
}
export function getRegionalEvent(g:Game,id:string):EventDef|undefined {
  const match=/^region-(qinglan|river|north|desert|central)-(arrival|dispute|apprentice|journey|echo)$/.exec(id);
  if(!match) return;
  const region=match[1] as RegionId,beat=match[2] as Beat,local=locales[region];
  const base=REGIONAL_EVENTS.find(e=>e.id===id)!,person=name(g,region);
  const relation:Effect=actor(g,region)?.alive?{npcId:actor(g,region)!.id,npcRelation:6}:{};
  if(beat==='arrival') return result(base,nameOf(region)+' · '+local.family+'旧事',local.origin+local.arrival,[
    choice(region,'help','帮忙查清这件事',{stats:{insight:4},...relation},person+'与你一起记下证据，往后认得你的行事方式。'),
    choice(region,'business','听取另一方的条件',{stones:18,stats:{reputation:3}},'你听完另一方的打算，也因这段往来得到资用。'),
    choice(region,'observe','先把见闻记下',{stats:{mind:4}},'你没有匆忙站队，但记住了事情的来路。'),
  ]);
  if(beat==='dispute'){
    const opening=(g.flags.includes(flag(region,'help'))?'你曾帮助'+person+'查过旧事。':
      g.flags.includes(flag(region,'business'))?'当地另一方记得你接受过邀约。':'你此前并未站队。')+local.dispute;
    const choices:Record<RegionId,Choice[]>={
      qinglan:[
        choice(region,'protect','留下修泉，让村民先有水喝',{stats:{health:-12,reputation:7},...relation},'泉口没有立刻复原，但村里终于能取到干净的水。'),
        choice(region,'authority','交给剑盟封山，带走一块旧院断玉',{item:'relic-jade'},'封条立在泉口，你带走了上面有旧印的断玉。'),
        choice(region,'relocate','帮陆家挪水渠，安置沿线人家',{stones:-12,stats:{mind:5}},'新水渠绕开坏掉的山脚，原来的村舍还留在风雨里。'),
      ],
      river:[
        choice(region,'open','把药方抄给沿途药船',{stats:{alchemy:8,reputation:6},...relation},'许多药船拿到了方子，配药的人仍需自己分辨火候。'),
        choice(region,'contract','与沈氏合办药路',{stones:32,stats:{mind:-6}},'药路有了资用，码头上买不起药的人还在等下一条船。'),
        choice(region,'rescue','先护送病人越过黑潮',{stats:{health:-16,foundation:4}},'你和船员先带走了病人，旧账留待后来再查。'),
      ],
      north:[
        choice(region,'guard','和程氏修守夜阵，留下旧碑',{stats:{health:-15,insight:6},...relation},'守阵的人有了退路，旧碑上添了几个名字。'),
        choice(region,'forge','帮顾氏铸剑胎，承受寒铁反噬',{item:'relic-stardust',stats:{health:-18,combat:5}},'寒铁上的星砂亮了一次，顾氏把残余的一部分交给了你。'),
        choice(region,'open','把星图公开给诸门',{stats:{reputation:9,mind:-5}},'如今不止一门能读那张星图，争论却更激烈了。'),
      ],
      desert:[
        choice(region,'protect','护住迁徙营地，替燕氏挡追兵',{stats:{health:-20,reputation:8},...relation},'营地熬过长夜，有人把战旗裁成帐篷。'),
        choice(region,'relic','从殷氏的假图里找旧城',{item:'relic-scabbard',stats:{health:-12}},'沙下找到一只残鞘，没有找到殷氏许诺的宝库。'),
        choice(region,'expose','把旧图交给烬原盟，公开水源',{stats:{insight:6,reputation:5}},'水源贴到了集市，假图的生意断了一条路。'),
      ],
      central:[
        choice(region,'names','帮散修补齐被删掉的名字',{stats:{reputation:11,mind:-9},...relation},'新名册添回许多人的名字，世家开始追问谁公开旧账。'),
        choice(region,'craft','帮苏氏做成渡海浮槎',{stats:{alchemy:8,insight:5},item:'relic-seal'},'试航成功，铜牌上的旧印恰好与名册相合。'),
        choice(region,'patron','接受秦氏赞助，暂缓公开名录',{stones:48,stats:{reputation:-7}},'你得到资助，名册仍锁在藏书楼。'),
      ],
    };
    return result(base,nameOf(region)+' · 分歧之时',opening,choices[region],local.family+'的旧事与你曾在这里做过的事相连。');
  }
  if(beat==='apprentice') {
    const available=SECTS.filter(s=>s.home===region&&s.minRealm<=g.realm&&regionalStanding(g,region).strength>=20).slice(0,2);
    if(g.sect||!available.length) return;
    const choices=available.map(s=>choice(region,'join:'+s.id,'跟随'+s.name+'的传功人学艺',{},'引荐人替你作保，山门愿意收你。'));
    choices.push(choice(region,'free','暂不入门，仍以散修身份生活',{},'你谢过引荐，继续走自己的路。'));
    return result(base,'师承来信',local.family+'的风波过后，'+person+'送来引荐。有人认可你此前的行事，愿意承担入门资用；也有人认为师门不该替一个人规定全部生活。',choices);
  }
  if(beat==='journey'){
    const destinations=local.destinations.map(dest=>choice(region,'travel:'+dest,'随同行者前往'+nameOf(dest),{},'你与同行者穿过山海。来到'+nameOf(dest)+'后，遇上的已是另一片土地的人与事。'));
    destinations.push(choice(region,'stay','留在原地，继续这里的生活',{},'你送走了远行的人。这里仍有未尽的事。'));
    return result(base,nameOf(region)+' · 去往别处的路',local.invitation+'他们有自己的目的，并不会替你决定今后在哪一洲生活。',destinations);
  }
  const remote=g.region!==region;
  const consequence=g.flags.includes(flag(region,'protect'))?'当年被你护住的人还在此生活。':
    ['open','names','expose'].some(mark=>g.flags.includes(flag(region,mark)))?'曾被公开的证据，后来又有了不同解释。':
    ['patron','contract'].some(mark=>g.flags.includes(flag(region,mark)))?'当年的约定尚在，但有人不愿继续遵守。':'后来人记得旧事，却有了各自的新生活。';
  return result(base,local.family+' · 后来的一页',(remote?'远方来信说：':'你再次看见：')+local.echo+consequence,[
    choice(region,'letter','写信问候旧人，不替后来人作主',{stats:{mind:4}},'你写下还能记住的事实，留给后来人自行选择。'),
    choice(region,'record','整理真实的旧事，交给后来人',{stats:{insight:5}},'新旧记载并列留在书架上，过去没有变成唯一答案。'),
  ]);
}
export function recordRegionalChoice(g:Game,event:EventDef,selected:Choice,hooks:Hooks){
  if(!event.id.startsWith('region-')) return;
  const mark=selected.effect.flag?.split(':')??[];
  if(mark[0]!=='region-decision'||!regionIds.includes(mark[1] as RegionId)) return;
  const region=mark[1] as RegionId,action=mark.slice(2).join(':'),person=actor(g,region);
  if(person?.alive && ['help','protect','guard','open','names','rescue'].includes(action))
    person.relation=Math.min(100,person.relation+4);
  if(event.id.endsWith('-dispute')){
    const faction=factionForRegion(region),boost=['protect','open','guard','expose','names','relocate','rescue'].includes(action)?5:
      ['patron','contract','authority'].includes(action)?-3:1;
    g.history!.strength[faction]=Math.max(10,Math.min(95,g.history!.strength[faction]+boost));
    hooks.log(g,'地方局势',nameOf(region)+'的'+FACTIONS.find(f=>f.id===faction)!.name+
      (boost>0?'重新聚拢人心。':'因这次分歧受到影响。'),'world',true);
  }
  if(action.startsWith('join:')){
    const sect=SECTS.find(s=>s.id===action.slice(5));
    if(sect&&!g.sect&&g.realm>=sect.minRealm&&regionalStanding(g,region).strength>=20){
      g.sect=sect.id;g.sectRank=0;g.contribution=0;
      hooks.log(g,'有了师承',(person?.name??'当地修士')+'替你作保，'+sect.name+'收你为外门弟子；引荐人承担本次入门资用。','relationship',true);
    }
  }
  if(action.startsWith('travel:')){
    const destination=action.slice(7);
    if(REGIONS.some(r=>r.id===destination)&&destination!==g.region){
      g.region=destination;
      if(!g.visited.includes(destination)) g.visited.push(destination);
      hooks.log(g,'山河转折','你随'+nameOf(region)+'的同行者抵达'+nameOf(destination as RegionId)+'。船马由对方筹备，不另收路费；旧地关系与承诺仍在。','world',true);
    }
  }
}
export function regionalYear(g:Game,hooks:Hooks){
  if(g.age<16||g.age%37!==0) return;
  const region=g.region as RegionId,local=locales[region];
  if(!local||!seen(g,idFor(region,'arrival'))) return;
  const standing=regionalStanding(g,region);
  hooks.log(g,nameOf(region)+' · 近年见闻',standing.strength<38?
    local.family+'附近的旧路渐少人走，原有门派的供给已不如前。':
    local.family+'的旧事仍在流传，新来者沿着新的路生活。','world');
}
