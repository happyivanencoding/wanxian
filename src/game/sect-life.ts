import { SECTS, SECT_RANKS } from './data.ts';
import { factionForRegion, regionalStanding } from './history.ts';
import { meetPerson } from './relationships.ts';
import { sectMissionEffect } from './sects.ts';
import type { Choice, Effect, EventDef, Game, LogKind } from './types.ts';

type Stage = 'welcome' | 'errand' | 'division' | 'teaching' | 'legacy';
interface SectScene {
  mentor: string;
  arrival: string;
  errand: string;
  argument: string;
  later: string;
  duty: string;
  others: string;
  side: string;
}
const scenes: Record<string, SectScene> = {
  qinglan: { mentor: '看护西山的石阶', arrival: '新弟子在雨里练剑，山下运粮的车却陷进了泥。掌门让众人先收剑，几名师兄不肯。', errand: '西山小路塌了。粮车停在山腰，镇上的孩子正在等米。执事让人清出山道。', argument: '剑宗要在泉上布新阵，虞氏担心泉水被截走。弟子们在山门前吵了一夜。', later: '西山新修的石阶上又走来年轻弟子，他们不认识当年搬石头的人。', duty: '先把粮车送到山下', others: '到泉边听虞氏说清楚', side: '请山门暂缓封泉' },
  covenant: { mentor: '帮村里的病人记病历', arrival: '院子里只有两口药锅。新来的弟子想先领功法，药堂的长辈让他看看排队的人。', errand: '昨夜下雨，义诊棚塌了一角。村里有人发烧，药田也被水淹了。', argument: '同契院的公粮不够。有弟子主张先供山门，乡老说山下还没过冬。', later: '村里的药棚换了几次屋顶，老人们仍在用最初那张病历簿。', duty: '把药材和病人先安顿好', others: '去山下核对分粮的名册', side: '把院里的药先分给村民' },
  cloudledger: { mentor: '带你查一份旧账', arrival: '师兄把一箱灵材放在桌上，数目对不上账。收货人已经在门外等着。', errand: '白石渡的船迟了三日，一批灵材仍未到岸。仓库有人说货已在路上。', argument: '行会想加价保本，欠货的村子已经卖光了粮。两位掌柜不肯在同一张账簿上签名。', later: '旧账翻到最后，有人把欠款划掉了，也有人把它传给下一代。', duty: '亲自沿河查清货物去向', others: '先给欠货的村子送去存货', side: '把两边的账簿都摆出来' },
  stillpine: { mentor: '陪你守第一夜的灯', arrival: '松灯观的夜课没有钟声。师父把一盏旧灯交给你，山道上还有人没有归来。', errand: '夜里大风吹倒了路牌，几个采药人迷了山路。观里只有一盏能照远处的灯。', argument: '新任知客要把旧经封进库房，年轻弟子却觉得路上的人也该读到。', later: '观外的灯换了灯芯，读经的人也换了一拨。旧书的页角仍有你的批注。', duty: '拿灯去山路上找人', others: '留下来照看没有归来的家属', side: '把旧经抄成能借阅的本子' },
  herb: { mentor: '教你辨认潮湿药草', arrival: '谷中试药，师父让你先记病人的名字。有人只问这一炉能炼成多少丹。', errand: '码头送来三箱药草，最底下的一箱已经发热。病人还在渡口等药。', argument: '新药方治好了几个人。谷主想先留给门内试验，闻氏说外面还有更多人在等。', later: '那张药方被人改过几处，有些批注对，有些害了人。药房仍保存着初稿。', duty: '沿水路把药送到病人手里', others: '留下清点腐坏的药材', side: '把验证过的药方抄给外面的医者' },
  tideguild: { mentor: '带你走第一趟水驿', arrival: '新船下水，舵工发现旧图上少了一处暗礁。船东不愿改期开航。', errand: '一艘小货船在黑潮边搁浅，水驿只剩两条快舟。船员在岸边等消息。', argument: '水盟要征用民船绘航图，七桥船户怕一趟出海就赔上全家。', later: '旧航路上多了一座灯塔。年轻的船户说，祖父曾在那儿等过你的消息。', duty: '跟船去把搁浅的人接回来', others: '先帮水驿修好旧舟', side: '让船户自己决定是否出航' },
  tidebreath: { mentor: '领你看潮水的刻痕', arrival: '临潮修炼的石台被海水淹过半截，师兄想把堤闸全关上，岸边渔户不同意。', errand: '潮纹比往年提前了一刻。护堤阵还按旧时辰开启，低处的房屋已经进水。', argument: '宫中有人要截断外河保住修炼石台，渔户说那会让他们的田永远泡在水里。', later: '潮水改了岸线。旧石刻留在原地，新刻痕已经移到更高的堤上。', duty: '去堤上重校观潮刻度', others: '帮渔户先搬出屋里的东西', side: '调开一部分护堤阵替河岸泄水' },
  bellisle: { mentor: '交给你一张残碑拓纸', arrival: '师父拿出两张不同的古碑拓本。昨日抄成的一页，今天又发现抄错了。', errand: '沉钟岛露出一段石阶，赶潮的人已经上岸。残碑可能在下一次潮来前碎掉。', argument: '书院有人想把新发现的残刻叫作祖师真言，一位老校书指出日期根本对不上。', later: '那块残碑被一再翻印，原刻上的缺口后来竟成了弟子们争论的要点。', duty: '趁潮退下去拓下残碑', others: '先把已有的两个版本核对清楚', side: '把不一致的证据也留进书里' },
  star: { mentor: '带你守北坡星台', arrival: '师父把观测簿交给新弟子。有人说昨夜星轨变了，老观测者却认为是镜片出了问题。', errand: '雪压坏了北坡的观测架，今夜的星象再错过便要等数年。', argument: '问星阁的观测表与顾氏剑庭旧碑不符，几位长老坚持旧谱绝不可能有错。', later: '新弟子拿着当年的星表来问你，纸上的一处删改正是那次争论留下的。', duty: '带上器材去修北坡星台', others: '留下复核那张有争议的星图', side: '让后辈同时看到新旧两份星表' },
  northforge: { mentor: '让你替他掌第一炉火', arrival: '北炉开炉，顾氏弟子拿来一块寒铁。炉边几个年轻人争谁该先用这块料。', errand: '护夜队的刀都卷了刃。顾氏却把最好的料留给一柄新剑，交货的日子只剩三天。', argument: '炉会决定替名门铸剑换灵石，北坡守夜的人却拿不出足够的钱修兵器。', later: '旧炉早已换了砖，刻在炉壁上的三行字倒一直没磨去。', duty: '先把守夜队的旧兵器修好', others: '留在炉边把那块寒铁锻成剑胎', side: '让普通守夜人也能来炉会换修好的兵器' },
  nightward: { mentor: '带你巡守第一座冰关', arrival: '守阵院的人要轮流守夜。山门新到的弟子嫌夜路苦，老阵师却已经整整三天没合眼。', errand: '冰关的第三道阵旗断了。关外还有晚归的人，若今夜不补，雪就会封死路口。', argument: '守阵院准备封关保阵，顾家说北炉的煤还在路上。雪原几个村庄等着供暖。', later: '守夜人的名单换了一长串，旧关门上的手印却还在。', duty: '冒雪把阵旗重新立起来', others: '去关外引晚归的人过雪线', side: '在封关前给北炉留下最后一条路' },
  frostsword: { mentor: '带你看断雪剑庭旧碑', arrival: '剑庐新收了一份残剑谱。两位师兄都说自己抄的是正本。', errand: '剑庐要护送一件古剑回北坡，沿路的守阵人却怕剑意伤到村子。', argument: '旧剑出鞘的消息传开，剑庐年轻弟子想比武定归属，顾氏后人说那剑本属于被逐的人。', later: '那柄旧剑后来又换了几位主人，最早争论的人已不都在世。', duty: '先把古剑安全送回剑庐', others: '沿路替守阵人检查旧剑气', side: '让顾氏后人来读残谱上的名字' },
  emberescort: { mentor: '让你替队伍带一天路', arrival: '烬原盟一队人正在分水。走得快的修士先拿到了水囊，最小的孩子还在排队。', errand: '迁徙的车队在赤砂边走错了路，今夜若不到井边，牲口就要渴死。', argument: '烬原盟准备夺回旧城，队伍里有人却只想找一个能安家的地方。', later: '当年的迁徙小路成了商道。有些孩子长大后才知道那晚为什么绕路。', duty: '带队去找图上标记的古井', others: '留在后队照料走不动的人', side: '先问迁徙者愿不愿意再打那场仗' },
  redriver: { mentor: '把共修会的粮册递给你', arrival: '同修会的院子里挤着不少散修。有人连下一次冲关用的灵石都凑不齐。', errand: '共修会借出的药材迟迟未还。借药的人在荒原受了伤，另外两家又来求药。', argument: '赤河会的钱越来越少，修得快的弟子想离开，留守的人觉得自己被丢下了。', later: '共修会最初借出去的药箱还在，只是木头换过好几次。', duty: '把失联的借药人找回来', others: '留下为新来的散修分药', side: '让有能力的人先承担多一点供养' },
  sandbody: { mentor: '教你数砂地里的脚印', arrival: '炼身堂的弟子绕荒原跑了一整夜。几个新人受了伤，执教说还没到停的时候。', errand: '沙暴来前，外门弟子还在练耐热功。有人晕倒在试炼场上，教习却催着众人跑完。', argument: '炼身堂要把险地当入门考验，附近牧民说今年沙暴比往年更早。', later: '旧试炼场被沙掩过又清出来，新来的弟子仍会问当年那场风暴。', duty: '将倒下的弟子背出沙地', others: '留下帮教习立新的防沙桩', side: '把沙暴时撤退的规矩写进门规' },
  ashveil: { mentor: '教你辨别异息的症状', arrival: '照烬观收了一名修异息的人，夜里他发高烧。几个弟子想把人赶出观门。', errand: '荒原上有人误练禁法，体内异息乱窜。照烬观收到求救信，但送信人不肯署名。', argument: '观中有人主张把异法记载全部封存，年轻的医修认为不知道症状反而会害死人。', later: '后来的人在旧症状簿上多添了几笔，有些人靠它活了下来。', duty: '赶去查看那名练错功的人', others: '留下辨清异息与普通伤病', side: '只公布辨险之法，不散布危险口诀' },
  lawhall: { mentor: '带你听一场旧契审理', arrival: '明律院开庭，庭前站着一群没有名帖的散修。书记官说名册上找不到他们。', errand: '两家争一处旧院石阶，都拿出盖了印的契书。小吏却发现印章制式不一样。', argument: '议庭要按旧册分名额，有人拿出被删过的名单，席间几位长老不让念出来。', later: '那份案卷多年后被翻出，后辈在边角找到你留下的不同意见。', duty: '先把两份契书核实清楚', others: '去找被删名册上的当事人', side: '当庭念出被删掉的名字' },
  thousandseal: { mentor: '交给你一张未完成的符', arrival: '千符坊的徒弟把护身符交给来客试用，符上少了一道线，来客已经付了钱。', errand: '码头工人买了护身符，却在搬货时受伤。坊里说符只管外伤，工人说从没人告诉过他。', argument: '千符坊接到玉京的大订单，但要先收走散修手里旧符纸的买卖权。', later: '新一批护身符的背面印了说明，也留下几个仍难以回答的问题。', duty: '把出问题的符一张张验过', others: '去码头听用符的人怎么说', side: '把护身符的限制写在明处' },
  hundredschools: { mentor: '带你去听另一门的讲座', arrival: '百家道会有人在辩论剑法与炼丹谁更接近大道，真正来问路的新弟子被堵在门外。', errand: '道会要合编一册功法，三派的抄本在同一页写出了相反结论。', argument: '玉京议庭只准已在册的人登坛，百家道会里有几位没有师承的散修。', later: '道会的讲坛挪了位置，又收了一批不同门派的弟子。有人沿用你当年的讲法。', duty: '把几个版本拿去逐一验证', others: '先让门外的新弟子进来听课', side: '把讲坛留给有证据的人，而不是只看名帖' },
  jadeforge: { mentor: '让你辨一块有裂纹的玉', arrival: '琢玉山庄收到玉京的贵客订单，师兄发现玉料有裂纹，管事却说不能误了交期。', errand: '一件定脉冠在使用时碎了。制器的人说玉料不好，采玉的师傅说炉火过急。', argument: '山庄打算只为世家炼器，几个外门弟子觉得散修更需要能保命的法宝。', later: '那一批玉冠后来被重新检查，有的收回重炼，有的成了山庄最普通的货品。', duty: '先查清裂纹到底从哪里来', others: '把已经售出的玉冠逐件召回', side: '把验玉的方法教给没有名帖的修士' },
};

const phases: Stage[] = ['welcome', 'errand', 'division', 'teaching', 'legacy'];
const idFor = (id: string, stage: Stage) => 'sect-life-' + id + '-' + stage;
export const SECT_LIFE_EVENTS: EventDef[] = SECTS.flatMap(sect => phases.map(stage => ({
  id: idFor(sect.id, stage), title: sect.name + ' · 门中事', text: '', category: 'relationship' as const,
  kind: 'turning' as const, once: true, weight: 0, choices: [],
})));
const joinedAt = (g: Game, id: string) => {
  const entry = g.flags.find(flag => flag.startsWith('sect-joined:' + id + ':'));
  return entry ? Number(entry.split(':')[2]) : Math.max(16, g.age - 6);
};
const personId = (id: string) => 'sect-teacher-' + id;
const person = (g: Game, id: string) => g.npcs.find(npc => npc.id === personId(id));
const chosen = (g: Game, id: string, action: string) => g.flags.includes('sect-decision:' + id + ':' + action);
const choice = (sectId: string, action: string, label: string, effect: Effect, successText: string): Choice => ({
  label, hint: '', effect: { ...effect, flag: 'sect-decision:' + sectId + ':' + action }, successText, autoScore: 5,
});
type StoryHooks = {
  random: (g: { rng: number }) => number;
  log: (g: Game, title: string, text: string, kind: LogKind, important?: boolean) => void;
  gain: (g: Game, effect: Effect) => void;
};
export function bindSectLifeEvent(g: Game, eventId: string, hooks: StoryHooks) {
  const sect = SECTS.find(entry => eventId === idFor(entry.id, 'welcome'));
  if (!sect || person(g, sect.id) || g.npcs.length >= 64) return;
  const mentor = meetPerson(g, 'elder', hooks, personId(sect.id), {
    title: sect.name + '传功人', desire: scenes[sect.id].mentor,
  });
  mentor.role = 'mentor';
  mentor.relation = 54;
  mentor.region = sect.home;
}
export function nextSectLifeEvent(g: Game): string | undefined {
  if (!g.alive || !g.sect || g.age < 17) return;
  const id = g.sect;
  if (!scenes[id]) return;
  if (g.age >= joinedAt(g, id) + 2 && g.seen[idFor(id, 'welcome')] === undefined) return idFor(id, 'welcome');
  if (g.seen[idFor(id, 'welcome')] !== undefined && g.age - g.seen[idFor(id, 'welcome')] >= 7 &&
      g.seen[idFor(id, 'errand')] === undefined) return idFor(id, 'errand');
  if (g.seen[idFor(id, 'errand')] !== undefined && g.seen[idFor(id, 'teaching')] === undefined &&
      !g.flags.includes(SECTS.find(item => item.id === id)!.specialty.id) &&
      g.contribution >= SECTS.find(item => item.id === id)!.specialty.cost) return idFor(id, 'teaching');
  if (g.seen[idFor(id, 'errand')] !== undefined && g.age - g.seen[idFor(id, 'errand')] >= 12 &&
      g.seen[idFor(id, 'division')] === undefined) return idFor(id, 'division');
  if (g.seen[idFor(id, 'division')] !== undefined && g.age - g.seen[idFor(id, 'division')] >= 20 &&
      g.seen[idFor(id, 'legacy')] === undefined) return idFor(id, 'legacy');
}
export function getSectLifeEvent(g: Game, eventId: string): EventDef | undefined {
  const sect = SECTS.find(item => phases.some(stage => idFor(item.id, stage) === eventId));
  if (!sect) return;
  const scene = scenes[sect.id], base = SECT_LIFE_EVENTS.find(event => event.id === eventId)!;
  const mentor = person(g, sect.id);
  const teacher = mentor?.alive ? mentor.name : '一位门中长者';
  const bond: Effect = mentor?.alive ? { npcId: mentor.id, npcRelation: 6 } : {};
  const previous = chosen(g, sect.id, 'errand') ? '你上次跟人出了趟门，'
    : chosen(g, sect.id, 'help') ? '你上次留在门里照看了人，'
    : '你前些年没有接下那件差事，';
  const event = (title: string, text: string, choices: Choice[], cause?: string): EventDef =>
    ({ ...base, title, text, choices, ...(cause ? { cause } : {}) });
  if (eventId.endsWith('-welcome')) return event(
    sect.name + ' · 新来的日子',
    scene.arrival + teacher + '看见你在门前停下，叫你过来一起搭把手。',
    [
      choice(sect.id, 'settle', '过去帮忙，跟大家一同做', { contribution: 8, stats: { foundation: 3 }, ...bond }, '忙完已经天黑。你记住了几位同门的名字。'),
      choice(sect.id, 'study', '先去把不懂的功课弄明白', { progress: 20, stats: { insight: 3 } }, '你在书房待了一下午，第二天才回到门前。'),
    ]);
  if (eventId.endsWith('-errand')) {
    const reward = sectMissionEffect(g);
    return event(sect.name + ' · ' + sect.mission.name, scene.errand,
      [
        choice(sect.id, 'errand', scene.duty, { ...reward }, '人和东西都安置妥了。执事把这一趟记进门中的账。'),
        choice(sect.id, 'help', scene.others, { contribution: Math.max(8, Math.round((reward.contribution ?? 20) * 0.5)), stats: { reputation: 6, mind: -4 }, ...bond }, '你做了另外那件事，回来时门内已经有人知道了。'),
        choice(sect.id, 'rest', '这趟不去，留在山门修行', { progress: 24, stats: { mind: 3 } }, '你留在山门继续自己的修行，没有拿这次委托的报酬。'),
      ]);
  }
  if (eventId.endsWith('-division')) {
    const earlier = previous + (chosen(g, sect.id, 'errand') ? '执事把你也叫到了议事堂。'
      : chosen(g, sect.id, 'help') ? '山外有人认得你的名字。' : '这次有人主动来问你的想法。');
    const standings = regionalStanding(g, sect.home);
    return event(sect.name + ' · 门内争执',
      earlier + scene.argument + (standings.label === '闭山' ? '山门如今闭守，值守的人已经拿不出往年的供给。' : ''),
      [
        choice(sect.id, 'rules', '照门里的规矩继续办', { contribution: 26, stats: { reputation: -4 }, ...bond }, '长老同意按旧规继续办理。山外的人没有因此改口。'),
        choice(sect.id, 'people', scene.side, { contribution: 11, stats: { reputation: 8, mind: -5 } }, '你提出了另一种办法，门中有人不赞成，事情却没有就此被压下。'),
        choice(sect.id, 'distance', '不替任何一方下结论', { stats: { mind: 5 } }, '议事堂的人散了。你没有签下自己的名字。'),
      ]);
  }
  if (eventId.endsWith('-teaching')) return event(sect.name + ' · 传功',
    '你在山门做事已有一段日子。' + teacher + '把一册' + sect.specialty.name + '放到你面前，想亲自教你。', [
      choice(sect.id, 'inherit', '留在山门，把这门法学完', {}, '你随传功人练了多日，终于把这门法学会。'),
      choice(sect.id, 'defer', '暂且不学，先做自己的事', {}, '传功人把书收回架上。你仍可以自己再来请教。'),
    ]);
  const change = chosen(g, sect.id, 'people') ? '当年你替山外的人说过话。'
    : chosen(g, sect.id, 'rules') ? '当年你站在旧规矩一边。' : '当年你没有替任何人作主。';
  const canLearn = g.sect === sect.id && !g.flags.includes(sect.specialty.id) && g.contribution >= sect.specialty.cost;
  const learnChoice = canLearn ? [choice(sect.id, 'inherit', '随师父把这门法学完', {}, '你在门中住了一段日子，把口诀和用法都学会了。')] : [];
  return event(sect.name + ' · 旧事又翻到一页',
    scene.later + change + (mentor?.alive ? teacher + '还记得当年那次议论。' : '当年的几位长者已经不在。'),
    [
      ...learnChoice,
      choice(sect.id, 'return', '帮年轻弟子把旧事讲清楚', { contribution: 12, stats: { insight: 5 } }, '年轻人记下了你的亲历，也会自己去问别人。'),
      choice(sect.id, 'leave', '把过去留给他们，继续自己的修行', { progress: 35 }, '你没有接下新的职务。门中后来还有人争论那件事。'),
    ]);
}
export function recordSectLifeChoice(g: Game, event: EventDef, selected: Choice, hooks: StoryHooks) {
  if (!event.id.startsWith('sect-life-') || !selected.effect.flag?.startsWith('sect-decision:')) return;
  const [, sectId, action] = selected.effect.flag.split(':');
  const sect = SECTS.find(entry => entry.id === sectId);
  if (!sect) return;
  if (event.id.endsWith('-division') && (action === 'rules' || action === 'people')) {
    const faction = factionForRegion(sect.home);
    const change = action === 'people' ? 5 : -3;
    g.history!.strength[faction] = Math.max(10, Math.min(95, g.history!.strength[faction] + change));
    hooks.log(g, sect.name + ' · 门内有了变动',
      action === 'people' ? '门中改了这一条旧规矩，附近的修士得以重新商量。' : '山门维持原来的办法，外面的争议暂时压了下来。',
      'world', true);
  }
  if (action === 'inherit' && g.sect === sectId && !g.flags.includes(sect.specialty.id) && g.contribution >= sect.specialty.cost) {
    g.contribution -= sect.specialty.cost;
    hooks.gain(g, { flag: sect.specialty.id, item: sect.specialty.gear.id });
    hooks.log(g, '学会 · ' + sect.specialty.name,
      '这门所学留在你身上。' + sect.specialty.gear.name + '也由传功人交给了你。', 'cultivation', true);
  }
}
export function advanceSectStanding(g: Game, hooks: StoryHooks) {
  if (!g.alive || !g.sect) return;
  const threshold = [60, 180, 450];
  const minRealm = [1, 2, 3];
  if (g.sectRank >= 3 || g.contribution < threshold[g.sectRank] || g.realm < minRealm[g.sectRank]) return;
  const sect = SECTS.find(item => item.id === g.sect)!;
  if (g.contribution >= sect.specialty.cost && !g.flags.includes(sect.specialty.id) &&
      g.seen[idFor(sect.id, 'errand')] !== undefined && g.seen[idFor(sect.id, 'teaching')] === undefined) return;
  const rank = g.sectRank + 1;
  g.contribution -= threshold[g.sectRank];
  g.sectRank = rank;
  hooks.log(g, '门中升任', '门里请你担任' + SECT_RANKS[rank] + '。这意味着往后会有新的责任，也会领到更多年例。', 'relationship', true);
}
export function sectLifeSnapshot(g: Game) {
  const sect = SECTS.find(entry => entry.id === g.sect);
  if (!sect) return null;
  const completed = phases.filter(phase => g.seen[idFor(sect.id, phase)] !== undefined);
  return {
    name: sect.name,
    mentor: person(g, sect.id),
    completed,
    last: g.logs.filter(entry => entry.title.startsWith(sect.name + ' · ') || entry.title === '有了师承' || entry.title === '门中升任').slice(-4).reverse(),
  };
}
