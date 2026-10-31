import type { Choice, Effect, EventDef, Game, NPC } from './types.ts';
import { REALMS } from './data.ts';
import { preparationTarget } from './progression.ts';

export const LIFE_DIRECTIONS = [
  { id: 'seek', name: '问道', icon: 'mountain', detail: '以修行为重，兼顾生计与休养' },
  { id: 'roam', name: '远游', icon: 'compass', detail: '历练与见闻，有受伤风险' },
  { id: 'belong', name: '相守', icon: 'people', detail: '留时间给故人，修行较缓' },
  { id: 'peace', name: '自处', icon: 'leaf', detail: '读书与静养，少些追赶' },
] as const;
export type LifeDirection = typeof LIFE_DIRECTIONS[number]['id'];

const titles: Record<string, string> = {
  'life-road': '渡口的约定',
  'life-pill': '只够炼成一枚',
  'life-house': '姓氏背后的家',
  'life-road-return': '各自走过的路',
  'life-pill-return': '没有写完的药方',
  'life-rival': '并不是同一座山',
  'life-sword-answer': '那句不外传的约定',
  'life-house-return': '长约到了下一页',
  'life-book-reader': '书不再只有一个读法',
  'life-visit': '这一次，谁来赴约',
  'life-farewell': '留在桌上的东西',
  'life-inherit': '来者不必像你',
  'life-revision': '书上的另一种答案',
  'life-division': '两扇门',
  'life-remember': '没有你名字的地方',
  'life-statue': '石像与你',
  'life-newcomer': '后来者的远方',
  'life-return': '旧地重新生长',
  'life-last-page': '一页还没有写满的纸',
  'life-heaven': '天门之外，人间之内',
};
export const LIFE_EVENTS: EventDef[] = Object.entries(titles).map(([id, title]) => ({
  id, title, text: '', category: 'relationship', kind: 'turning', once: true, weight: 0, choices: [],
}));
const has = (g: Game, flag: string) => g.flags.includes(flag);
const chosen = (g: Game, prefix: string) => g.flags.find(flag => flag.startsWith(prefix));
const seen = (g: Game, id: string) => g.seen[id] !== undefined;
const elapsed = (g: Game, id: string, years: number) => seen(g, id) && g.age - g.seen[id] >= years;
const person = (g: Game, index: number) => g.npcs.find(npc => npc.id === `peer-${index}`)!;
const relation = (npc: NPC, amount: number): Effect => npc.alive ? { npcId: npc.id, npcRelation: amount } : {};
const choice = (label: string, hint: string, effect: Effect, successText: string, extra: Partial<Choice> = {}): Choice => ({
  label, hint, effect, successText, autoScore: 5, ...extra,
});

export function nextLifeEvent(g: Game): string | undefined {
  if (!g.alive || g.age < 19) return;
  const available = (id: string, ready: boolean) => ready && !seen(g, id);
  if (available('life-heaven', Boolean(g.direction) && g.realm === 5 && g.progress >= REALMS[5].need)) return 'life-heaven';
  const offset = g.seed % 7;
  const candidates: [string, boolean][] = [
    ['life-road', g.age >= 19 + offset && g.age < 60 && Boolean(person(g, 2)?.alive && person(g, 2)?.role !== 'enemy')],
    ['life-pill', g.age >= 26 + offset && g.age < 90 && Boolean(person(g, 1)?.alive && person(g, 1)?.role !== 'enemy')],
    ['life-house', g.age >= 36 + offset && g.age < 110 && Boolean(person(g, 0)?.alive && person(g, 0)?.role !== 'enemy')],
    ['life-road-return', elapsed(g, 'life-road', 17)],
    ['life-pill-return', elapsed(g, 'life-pill', 19)],
    ['life-rival', g.age >= 48 + offset && g.age < 140 && Boolean(person(g, 3)?.alive && person(g, 3)?.role !== 'enemy')],
    ['life-house-return', elapsed(g, 'life-house', 25)],
    ['life-sword-answer', elapsed(g, 'life-rival', 28)],
    ['life-visit', g.age >= 64 + offset && g.npcs.some(npc => npc.alive && npc.role !== 'enemy')],
    ['life-farewell', g.age >= 75 && g.npcs.some(npc => !npc.alive && npc.role !== 'enemy')],
    ['life-inherit', g.age >= 130 + offset && g.realm >= 2],
    ['life-revision', elapsed(g, 'life-inherit', 48)],
    ['life-division', elapsed(g, 'life-revision', 72) && !has(g, 'life-legacy-book')],
    ['life-book-reader', elapsed(g, 'life-revision', 72) && has(g, 'life-legacy-book')],
    ['life-remember', elapsed(g, 'life-division', 110) || elapsed(g, 'life-book-reader', 110)],
    ['life-statue', elapsed(g, 'life-remember', 170)],
    ['life-newcomer', elapsed(g, 'life-statue', 230)],
    ['life-return', elapsed(g, 'life-newcomer', 310)],
    ['life-last-page', elapsed(g, 'life-return', 420)],
  ];
  return candidates.find(([id, ready]) => available(id, ready))?.[0];
}

export function bindLifeEvent(g: Game, id: string) {
  if (!['life-visit', 'life-farewell'].includes(id) || chosen(g, `${id}-person:`)) return;
  const candidates = g.npcs.filter(npc => id === 'life-visit' ? npc.alive && npc.role !== 'enemy' : !npc.alive && npc.role !== 'enemy');
  const actor = [...candidates].sort((a, b) => b.relation - a.relation)[0];
  if (actor) g.flags.push(`${id}-person:${actor.id}`);
}

export function getLifeEvent(g: Game, id: string): EventDef | undefined {
  const base = LIFE_EVENTS.find(event => event.id === id);
  if (!base) return;
  const road = person(g, 2), healer = person(g, 1), heir = person(g, 0), rival = person(g, 3);
  if ((['life-road', 'life-road-return'].includes(id) && !road) || (['life-pill', 'life-pill-return'].includes(id) && !healer) || (['life-house', 'life-house-return'].includes(id) && !heir) || (['life-rival', 'life-sword-answer'].includes(id) && !rival)) return;
  const depart = (npc: NPC) => npc.realm === 6 ? '已经飞升离界' : '已经离世';
  const cost = 18 + g.realm * 10;
  const result = (text: string, choices: Choice[], cause?: string): EventDef => ({ ...base, text, choices, ...(cause ? { cause } : {}) });
  switch (id) {
    case 'life-road':
      return result(`${road.name}把一张手绘地图铺在渡口。你还记得初见时，那张在渡口晒着的地图。现在，${road.name}想沿河看看村镇，而你刚找到一处适合修炼的地方。船明早离岸。`, [
        choice('一起走这一程', '修为 −12；灵石 −12', { progress: -12, flag: 'life-road-together', ...relation(road, 9) }, `你与${road.name}共用一盏船灯。船在石滩搁浅过一夜，天亮后你们把湿地图晒在舷边。`, { cost: 12 }),
        choice('留下修行，请对方寄信', '', { flag: 'life-road-letters', progress: 12 }, `${road.name}独自上了船。你把住址写在地图背面，自己的日子也继续向前。`),
        choice('送到渡口，不约定重逢', '', { flag: 'life-road-free', ...relation(road, 3) }, `你送${road.name}到岸边。你们没有约定归期，也没有把这一别说成亏欠。`),
      ]);
    case 'life-pill': {
      const chance = Math.min(0.85, 0.48 + g.stats.alchemy * 0.004);
      return result(`你与${healer.name}合采的药，只炼成了一枚护脉丹。按先前的约定，它归你。${healer.name}近日经脉受损，还在抄写未完成的医方：“你先用吧，我再找别的办法。”`, [
        choice('按约留下，继续自己的修行', '修为 +40', { progress: 40, flag: 'life-dose-self' }, `${healer.name}把药盒推过来。你服下丹药，经脉中的滞涩渐渐散去；对方收起药方，另寻诊治。`),
        choice('把丹药留给对方', '', { flag: 'life-dose-given', ...relation(healer, 12) }, `${healer.name}的经脉稳了下来。你失去了眼前的修炼助力，对方收好药盒，留在桌上的医方多写了几行。`),
        choice('另配一炉，试着两人都留下药', `灵石 −${cost}；成功 ${Math.round(chance * 100)}%；失败损失药材`, { flag: 'life-dose-shared', progress: 18, ...relation(healer, 6) }, `新的一炉成了。你与${healer.name}各留半份药，药效不及原方，却都能继续往前。`, { cost, chance, failure: { flag: 'life-dose-failed' }, failureText: `火候没能守住。你与${healer.name}各自收拾药渣，这次尝试没有换来丹药。` }),
      ]);
    }
    case 'life-house':
      return result(`${heir.name}带来家族的一份长约：替族中看顾药田，就能领取固定报酬。但族中也要${heir.name}放弃独自行商。“我不是不愿照顾他们，只是不想一辈子都由这个姓氏作主。”`, [
        choice('一起接下长约', '每年收入 +4；修炼所得 −8%', { flag: 'life-house-contract', ...relation(heir, 5) }, `你与${heir.name}签下长约。药田需要你们分心，稳定的供给也让生计少了些波折。`),
        choice('帮对方筹一笔独立起步的钱', `灵石 −${cost}；没有还款约定`, { flag: 'life-house-independent', ...relation(heir, 8) }, `${heir.name}带着你的资助离开家中。这笔钱没有写成债，对方的往后仍须自己承担。`, { cost }),
        choice('把决定留给对方', '', { flag: 'life-house-distance' }, `你没有替${heir.name}作答。对方后来送来一封很短的信，只说自己的选择已经做了。`),
      ]);
    case 'life-road-return': {
      const beginning = has(g, 'life-road-together') ? '当年共用船灯的那段路' : has(g, 'life-road-letters') ? '那年写在地图背面的住址' : '当年没有约定归期的分别';
      return result(road.alive
        ? `${road.name}带着满是补丁的旧地图回来。${beginning}已过去许多年。对方如今更想找一处渡口安顿，并不觉得一直远行才算没有辜负年轻时的自己。`
        : `${road.name}${depart(road)}。一张旧地图辗转到你手里，末页画着一处想要安顿的渡口。你想起${beginning}，却无法再问对方后来怎么想。`, [
        choice(road.alive ? '帮对方把渡口的屋子修好' : '替旧图中的渡口修一间歇脚屋', `灵石 −${cost}；每年供养 2 灵石`, { flag: 'life-road-lodge', ...relation(road, 7) }, `渡口多了一处可以歇脚的地方。门边挂着${road.name}画过的河道图，上面添了几处新的地名。`, { cost, annualCost: 2 }),
        choice(road.alive ? '听完这些年的故事，再各自启程' : '把地图收进自己的行囊', '', { flag: 'life-road-keepsake', ...relation(road, 4) }, `你保存了${road.name}的旧地图，没有接下渡口的事务。那段路仍属于各自的人生。`),
      ], `${g.seen['life-road']}岁，渡口的那次选择。`);
    }
    case 'life-pill-return': {
      const memory = has(g, 'life-dose-given') ? '当年你留下的那枚护脉丹' : has(g, 'life-dose-shared') ? '当年你们合炼的那一炉药' : has(g, 'life-dose-failed') ? '当年炼坏的一炉药' : '当年按约留给你的护脉丹';
      const condition = healer.alive ? `${healer.name}寄来一本还没写完的药册。${memory}被记在其中一页；后面的字迹更多是在问：救治到底应该收多少钱。` : `${healer.name}${depart(healer)}，未完成的药册由保管人送到你手中。${memory}只占一行，余下几乎全是病人的记录。`;
      return result(condition, [
        choice('与行医的人一起整理，开放抄阅', '修为 −20；丹术 +6', { progress: -20, stats: { alchemy: 6 }, flag: 'life-medicine-open', ...relation(healer, 6) }, `${healer.name}的药册留下不同医者的批注，也保留了尚无把握的部分。有两页被重新装订，旧日批注仍能看清。`),
        choice('保留原稿，不替对方补上答案', '', { flag: 'life-medicine-kept', ...relation(healer, 2) }, `你把${healer.name}写过的与未写完的都原样留下。装订线换了新的，最后一页仍留着未干透似的墨点。`),
      ], `${g.seen['life-pill']}岁，只有一枚丹药的那次相处。`);
    }
    case 'life-rival':
      return result(`${rival.name}邀你同研一份残剑谱，却坚持不把它传给外人。你们都认真求道，只是对传承该归谁有不同看法。对方并不愿意为了与你亲近，就放弃自己的判断。`, [
        choice('接受约定，一起把剑谱研究下去', '悟性 +8；答应不公开剑谱', { stats: { insight: 8 }, flag: 'life-sword-private', ...relation(rival, 10) }, `你答应${rival.name}保密。信任有了具体的内容，也让此后公开所学不再只是你一个人的决定。`),
        choice('不接受限制，另寻自己的路', '关系 −8', { flag: 'life-sword-apart', ...relation(rival, -8) }, `${rival.name}收起残卷，没有指责你。你们仍认可彼此的本事，却不再是这份剑谱的同路人。`),
        choice('先一起整理可公开的基础部分', '修为 −15；悟性 +3', { progress: -15, stats: { insight: 3 }, flag: 'life-sword-common', ...relation(rival, 5) }, `你与${rival.name}把基础部分另抄了一册。并非所有分歧都解决了，但至少划清了能一起做的事。`),
      ]);
    case 'life-house-return': {
      const contract = has(g, 'life-house-contract');
      return result(`${heir.alive ? `${heir.name}带来新一页账簿。` : `${heir.name}${depart(heir)}，账簿交到了后来接手的人手里。`}${contract ? '看顾药田的长约该续了。新一辈已经学会打理，他们想重新安排种植，也愿意让你卸下这些年的事务。' : has(g, 'life-house-independent') ? '当年独立起步的生意做过几次变更。账上没有把你的资助记成欠款，新掌柜正准备另辟一条药路。' : '账簿里记着对方后来自己作出的决定。如今新的掌柜来找你，想请你照料一处药田。'}`, [
        choice(contract ? '续签长约，仍留一部分时间照料' : '接下这一份长约', '每年收入 +4；修炼所得 −8%', { flag: 'life-house-contract' }, '长约重新签了名字。你继续分心照料药田，领取约定的报酬。'),
        choice(contract ? '交给他们，结束长约' : '不接长约，让他们自己安排', contract ? '停止长约收入，恢复被占用的修炼时间' : '', { flag: 'life-house-released' }, '你把往年的账簿交回去。地里种什么、货物运到哪里，不再等你决定。'),
      ], `${g.seen['life-house']}岁，你与${heir.name}谈过家族与自己的生活。`);
    }
    case 'life-sword-answer': {
      if (has(g, 'life-sword-apart')) return result(`${rival.alive ? `${rival.name}托人送来一册自己新写的剑谱。` : `${rival.name}${depart(rival)}，生前托存的一册新剑谱辗转送到你手中。`}扉页记着你们当年争论的那句话，旁边添了几处新的注解。`, [
        choice(rival.alive ? '认真读完，把自己的注解寄回去' : '读完新谱，在旁边写下自己的注解', '修为 −12；悟性 +3', { progress: -12, stats: { insight: 3 }, flag: 'life-sword-answered', ...relation(rival, 4) }, `你在${rival.name}的注解旁留下自己的理解，有的地方赞同，有的仍然不同。`),
        choice('收好这册书，仍走自己的路', '', { flag: 'life-sword-separated' }, '书册放进了行囊。你没有因此改变自己的道路，也没有抹掉对方的名字。'),
      ], `${g.seen['life-rival']}岁，你没有接受那份传承的限制。`);
      const promise = has(g, 'life-sword-private');
      const trusted = rival.alive && rival.relation >= 55;
      return result(`${rival.alive ? `${rival.name}与你重新谈起旧剑谱。` : `${rival.name}${depart(rival)}，旧剑谱仍按原约保存在你这里。`}山下有人来求一份可以练习的抄本。${promise ? '你曾答应不外传，那句话并没有因为过了许多年就失效。' : '当年各自划定的界线，如今遇见了新的求学者。'}`, [
        choice(promise ? '只教自己的心得，不抄旧谱' : '另写一册自己的基础剑法', '修为 −18；战技 +3', { progress: -18, stats: { combat: 3 }, flag: 'life-sword-own' }, '你从自己的经历写起，把不能由你独自作主的内容留在原处。'),
        ...(trusted ? [choice('与对方一起重新商定公开范围', '修为 −28', { progress: -28, flag: 'life-sword-permission', ...relation(rival, 5) }, `你与${rival.name}逐页讨论。新抄本只保留双方认可的部分，两个人都署了名。`)] : []),
        choice('把自己保存的旧谱也交出去', promise ? `${rival.alive ? '违背旧约，关系 −25；可能结仇追杀' : '旧约无法再取得对方同意'}` : '', { flag: 'life-sword-published', ...(promise ? relation(rival, -25) : {}) }, promise && rival.alive ? `${rival.name}得知后要回了来往手札。求学者得到了剑谱，你们却不再像从前一样相处。` : `旧谱开始被抄阅。封面同时记着${rival.name}的名字与当年的约定。`),
      ], `${g.seen['life-rival']}岁，对旧剑谱作出的选择。`);
    }
    case 'life-book-reader':
      return result('一名读者把你的行记用作授课材料，却删掉了你当年最在意的一段。他说学生正在面对另一种困境，原文并不能直接回答。你没有收过他们为徒，他们也没有答应沿着你的道路生活。', [
        choice('与他对读，另外留下不同意见', '修为 −12；悟性 +3', { progress: -12, stats: { insight: 3 }, flag: 'life-reader-dialogue' }, '课堂同时保留原文与新的讲义。你写下不同意见，没有替读者作最后的判断。'),
        choice('要求注明删改，不干预他的讲法', '', { flag: 'life-reader-attribution' }, '讲义注明了删节与改写的位置。你的原稿仍在书架上，读者可以自己比较。'),
      ]);
    case 'life-visit': {
      const actorId = chosen(g, 'life-visit-person:')?.slice('life-visit-person:'.length);
      const actor = g.npcs.find(npc => npc.id === actorId) ?? road;
      if (!actor) return;
      return result(actor.alive ? `${actor.name}约你在旧茶亭坐一坐。没有求助，也没有新传承。恰好这几日你有所领悟，出关会让这段推演暂时中断。` : `${actor.name}${depart(actor)}。当年相约的茶亭还在，这次你只能独自赴约。`, [
        choice(actor.alive ? '放下推演，去坐一会儿' : '带着旧信，独自去茶亭看看', '修为 −18', { progress: -18, flag: 'life-visit-went', ...relation(actor, 9) }, actor.alive ? `你与${actor.name}在茶亭坐到天色暗下来，壶里的茶凉过两次。` : `你带着${actor.name}的旧信在茶亭坐到天色暗下来。没有人应约，但你记得那年的交谈。`),
        choice(actor.alive ? '这一次不去，把缘由写清楚' : '不去茶亭，把旧信收好', '', { flag: 'life-visit-missed' }, actor.alive ? `你写明缘由寄给${actor.name}。对方如何理解，还要留给之后的相处。` : '你把旧信收入书箱，没有写一封无人能收的回信。'),
      ]);
    }
    case 'life-farewell': {
      const actorId = chosen(g, 'life-farewell-person:')?.slice('life-farewell-person:'.length);
      const actor = g.npcs.find(npc => npc.id === actorId) ?? g.npcs.find(npc => !npc.alive && npc.role !== 'enemy') ?? road;
      if (!actor) return;
      return result(`${actor.name}${depart(actor)}。收拾旧物时，你发现一些与你无关的字句：未去过的地方、没做成的事，也有早已被忘掉的小快乐。你只是这段人生中的一部分。`, [
        choice('保留这些原话，包括与你不同的地方', '', { flag: 'life-farewell-true' }, `你按原样收好${actor.name}的字句。最后一页是张没画完的行路图，角落里写着一个你未曾听过的地名。`),
        choice('只留一件随身物，把其余交回旧居', '', { flag: 'life-farewell-private' }, `你留下能认出的那件旧物，其余交还${actor.name}曾经生活的地方。你不必保管对方的全部一生。`),
      ]);
    }
    case 'life-inherit':
      return result(`有几位年轻修士请你留下自己的经历。他们敬重你的年岁，却并不都想走你的路。其中一人问：“我们能不能只学有用的部分，不替您完成未竟的心愿？”`, [
        choice('留下可改写的书册，不立门规', '修为 −30', { progress: -30, flag: 'life-legacy-open' }, `你交出一册可以批注、删改的手稿。后来者从这里开始，但不需要把一生还给你。`),
        choice('立下师承，要求守住所传之法', '修为 −20；承诺保留原法', { progress: -20, flag: 'life-legacy-line' }, `你留下师承和原法的约定。愿意承接的人签了名，也有人坦然告辞。`),
        choice('不收门人，只记录自己的经历', '', { flag: 'life-legacy-book' }, `你没有建立门派，只把自己的经历写成书。这些人仍可以离开，去找更适合自己的老师。`),
      ]);
    case 'life-revision': {
      const open = has(g, 'life-legacy-open');
      return result(`距你留下${has(g, 'life-legacy-book') ? '行记' : '传承'}，已有${g.age - g.seen['life-inherit']}年。新抄本里有人改掉了你的一处结论，并附上自己验证的过程。${open ? '这正是你曾允许他们做的事，亲眼见到时却仍有一点不习惯。' : '书页旁同时夹着请求你认可的信，也有人认为不需要先得到你的许可。'}`, [
        choice('认真检验，只保留能成立的部分', '修为 −20；悟性 +6', { progress: -20, stats: { insight: 6 }, flag: 'life-revision-tested' }, '你花时间验证新解，留下它成立的条件，也承认旧稿的局限。书末多了别人的名字。'),
        choice('保留自己的版本，允许他们另署一册', '', { flag: 'life-revision-separate' }, '你没有改掉原稿，也没有阻止另一册流传。读者今后会遇见两种有分歧的答案。'),
      ]);
    }
    case 'life-division':
      return result(`沿着当年的书册，两处学堂已经走向不同的方向。一处重保全原法，一处愿意让没有资质的凡人也旁听。两方请你裁定谁才算正统。`, [
        choice('不定正统，请他们各自署名负责', '', { flag: 'life-schools-plural' }, '两处学堂不再共用一个名号。彼此仍有争论，但不能再把每次决定都推回你的身上。'),
        choice('亲自主持，把他们重新聚在一起', `灵石 −${cost}；每年修为所得 −5%`, { flag: 'life-schools-held' }, '你接下主持的责任。争论没有消失，此后你必须留出时间处理共同的事务。', { cost }),
        choice('退出这场争论，继续自己的生活', '', { flag: 'life-schools-left' }, '你不再为两方作最后的决定。留下的方法继续流传，后来的争论也不再等你点头。'),
      ]);
    case 'life-remember':
      return result(`你路过一处陌生的学舍，听见年轻人使用当年书中的办法。他们叫不出你的名字，也不知道这套方法如何辗转至此。窗里的读书声仍然清楚。`, [
        choice('坐下来，听他们如何使用', '', { flag: 'life-remember-listen' }, '你听完了一堂课。方法被改得认不全，却确实解决了眼前的问题；你的名字没有因此回到书页上。'),
        choice('说明自己的来历，补上被遗漏的历史', '', { flag: 'life-remember-name' }, '学舍把你的原稿与后人的修改并列保存。你争取了准确的署名，没有抹去后来者做过的事。'),
      ]);
    case 'life-statue':
      return result('有人照着传说为你立了像。石像的眉目并不像你，碑文把一些犹豫写成了英明，把一次偶然写成了安排。管理此地的人说，大家需要一个可以相信的故事。', [
        choice('改掉不实的碑文，留下曾经的犹豫', '灵石 −30', { flag: 'life-statue-revised' }, '石碑重新刻了字。故事不再那么圆满，但当年与你不同意的人也有了位置。', { cost: 30 }),
        choice('不争论石像，在旁边留下自己的手记', '', { flag: 'life-statue-notes' }, '石像旁多了一本可以翻阅的手记。有人看过，有人没有；你不再把所有理解都握在手中。'),
      ]);
    case 'life-newcomer':
      return result('一位年轻修士带来新的行路图。图上有你从未到过的地方。对方没有认出你，只问要不要同行一段。你已经很久没有以一个新朋友的身份开始相处。', [
        choice('带上行囊，不先讲自己的来历', '修为 −24；灵石 −40', { progress: -24, flag: 'life-new-road' }, '你走了一段不熟悉的路。对方首先认识的是同行的你，而不是书里的名字。', { cost: 40 }),
        choice('留下来，请对方日后寄一张新地图', '', { flag: 'life-new-letters' }, '你写下现在的住址，没有要求对方一定回来。仍然有值得期待的新消息。'),
      ]);
    case 'life-return':
      return result(`旧日的${has(g, 'life-road-lodge') ? '渡口歇脚屋' : '学舍'}已经换过许多主人。新住户按照自己的需要拆了一面墙。你认得地基，却不能说清从哪一年起，这里不再是记忆中的样子。`, [
        choice('留下旧图，尊重他们现在的生活', '', { flag: 'life-place-living' }, '旧图成了一份可参考的历史，而不是禁止改建的命令。这里继续属于正在生活的人。'),
        choice('出资保留一间旧屋，其余由他们决定', '灵石 −60', { flag: 'life-place-room' }, '一间旧屋留下了原来的门窗。其余地方继续翻新，新旧生活共用一条通道。', { cost: 60 }),
      ]);
    case 'life-last-page':
      return result('你整理这些年的书页，发现最后一张仍有很大一片空白。那些曾经以为一定要完成的事情，有的做到了，有的已经不再想做。明天仍然可以有新的安排。', [
        choice('保留空白，不把这一生写成定论', '', { flag: 'life-page-open' }, '你把空白页留在最后。此生还在继续，过去的选择也不必替未来作完所有回答。'),
        choice('写下此刻最愿意承认的选择', '', { flag: 'life-page-owned' }, '你只写已经发生的事，不替所有遗憾寻找好听的理由。那些选择确实属于你。'),
      ]);
    case 'life-heaven':
      return result('修为已近圆满，天门不再只是远处的传说。离开此界之后，尚在人间的人会继续自己的日子。你也可以暂不叩关，留一段时间给未完的事情。', [
        choice('准备叩关，继续向天门走去', '日常照料将按真实条件尝试飞升；突破仍有失败风险', { flag: 'life-gate-open' }, '你决定叩关。结果仍取决于眼前的准备与际遇，并不因为作出决定就注定成功。'),
        choice('再在人间留一段时间', '暂停自动飞升；仍可手动叩关', { flag: 'life-gate-stay' }, '你暂时留下。天门没有消失，往后的日子仍可以由你改变方向。'),
      ]);
  }
}

export function lifeAnnualEffects(g: Game): Effect[] {
  const effects: Effect[] = [];
  if (has(g, 'life-house-contract') && !has(g, 'life-house-released')) effects.push({ stones: 4 });
  if (has(g, 'life-road-lodge')) effects.push({ stones: -2 });
  return effects;
}

export function lifeTrainingMultiplier(g: Game) {
  return (has(g, 'life-house-contract') && !has(g, 'life-house-released') ? 0.92 : 1) * (has(g, 'life-schools-held') ? 0.95 : 1);
}

export function npcLifeFactors(g: Game, npc: NPC) {
  const treated = npc.id === 'peer-1' && (has(g, 'life-dose-given') || has(g, 'life-dose-shared'));
  return { training: treated ? 1.08 : 1, risk: treated ? 0.8 : 1 };
}

export function arrangeLife(g: Game) {
  if (!g.direction || g.age < 16) return;
  const need = REALMS[g.realm];
  if (g.stats.health < 65 || g.stats.mind < 48) { g.focus = 'rest'; return; }
  if (g.stones < 15 + g.realm * 12 || (g.progress >= need.need * 0.6 && g.stones < need.cost * 1.2)) { g.focus = 'work'; return; }
  const preparing = g.preparation?.selected;
  if (preparing && g.preparation?.realm === g.realm && g.preparation.progress[preparing] < preparationTarget(g.realm, preparing)) {
    g.focus = ({ temper: 'adventure', meditate: 'study', medicine: 'alchemy' } as const)[preparing];
    return;
  }
  if (g.progress >= need.need && g.realm < 5 && g.stats.foundation < 52) { g.focus = 'study'; return; }
  const schedules = {
    seek: ['cultivate', 'cultivate', 'cultivate', 'study', 'cultivate'],
    roam: ['adventure', 'adventure', 'study', 'cultivate', 'adventure'],
    belong: ['social', 'cultivate', 'study', 'social', 'cultivate'],
    peace: ['study', 'rest', 'cultivate', 'study', 'cultivate'],
  } as const;
  g.focus = schedules[g.direction][g.age % 5];
}

export function lifeMemory(g: Game, npc: NPC) {
  return [...g.logs].reverse().find(entry => entry.kind === 'relationship' && entry.text.includes(npc.name) && LIFE_EVENTS.some(event => event.title === entry.title));
}

export function lifeLegacyText(g: Game) {
  const memories = [
    has(g, 'life-dose-given') ? `你曾把本该属于自己的丹药留给${person(g, 1)?.name ?? '旧识'}。` : '',
    has(g, 'life-road-lodge') ? `${person(g, 2)?.name ?? '旧识'}的旧地图留在一处渡口。` : '',
    has(g, 'life-sword-apart') ? `你与${person(g, 3)?.name ?? '旧识'}曾因传承的分歧各走一途。` : '',
    has(g, 'life-legacy-open') ? '你允许后来者改写所传之法。' : has(g, 'life-legacy-line') ? '你留下了愿意承接原法的师承。' : has(g, 'life-legacy-book') ? '你没有开宗立派，留下的是自己的行记。' : '',
    has(g, 'life-remember-listen') ? '曾有一个地方使用你的方法，却不再记得你的名字。' : '',
  ];
  return memories.filter(Boolean).join('');
}
