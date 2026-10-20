import { REALMS, REGIONS, SECTS, SECT_RANKS } from './data.ts';
import type { Game } from './types.ts';

export interface RegionWorld {
  continent: string;
  culture: string;
  practice: string;
  factions: string[];
  opportunities: string[];
}

export const WORLD_REGIONS: Record<string, RegionWorld> = {
  qinglan: {
    continent: '青衡洲 · 青岚九府',
    culture: '山门、村镇与修真家族共用水脉。宗门以庇护乡里换取供奉，散修依靠手艺与行路立足，旧日的人情常比一纸名帖更有分量。',
    practice: '重视根基与师承，三种准备均可稳步进行；青岚剑宗在此收徒授法。',
    factions: ['青岚剑宗 · 护山剑阵与传功师承', '九府乡约 · 村镇互助与药堂', '山间散修 · 古法、手艺与行路'],
    opportunities: ['山雨后显露的古修洞天', '山城与旧识的托付'],
  },
  river: {
    continent: '沧溟洲 · 云泽水乡',
    culture: '河港连着外海，药师、船户和商盟依潮水生活。契约要在水驿留副本，施药的人与贩药的人往往在同一条船上。',
    practice: '以潮汐与药性温养经脉，药性准备每个有效年份推进1.3份；百草谷在此收徒。',
    factions: ['百草谷 · 医方、丹炉与药性合脉', '渡潮盟 · 水驿、船契与供给', '折梅药库 · 旧商路留下的争执'],
    opportunities: ['熟悉字迹带来的求援', '水路、药材与失落的旧账'],
  },
  north: {
    continent: '玄朔洲 · 北溟雪域',
    culture: '漫长寒季让炉火和守夜成为公共的责任。星轨映在冰原上，锻体者与观象者各有一套应付天地的办法。',
    practice: '风雪磨砺筋骨，行山锻体准备每个有效年份推进1.3份；问星阁在此授业。',
    factions: ['问星阁 · 观象、阵势与周天推演', '断雪剑庭旧址 · 昔日守阵者的遗迹', '北溟炉会 · 行旅补给与锻体旧法'],
    opportunities: ['冰雪下仍在运转的剑冢', '守夜人留存的旧物与见闻'],
  },
  desert: {
    continent: '赤曜洲 · 赤霞荒原',
    culture: '古战场与迁徙营地交错，出身名帖抵不过一次共同守夜。这里既有互助的行旅盟，也有以危险灵息修行的异道遗脉。',
    practice: '艰险行路促进淬体（每有效年1.2份），残阵有益推演（1.1份）；异法的力量与约束须由亲历者承担。',
    factions: ['烬原盟 · 散修护行与遗迹交换', '蚀日道遗脉 · 以冒险炼体的失传方法', '迁徙营地 · 互助、欠契与新故乡'],
    opportunities: ['荒原幻城与失落遗址', '行旅者对古代异法的传闻'],
  },
  central: {
    continent: '玉京洲 · 玉京仙城',
    culture: '诸洲商路交会于此，传承需要名录，术法讲究可以验证的来历。富裕山门掌握精制法器，来求道的散修也能以本事换取席位。',
    practice: '典籍与诸家论道促进推演，参悟准备每个有效年份推进1.3份。',
    factions: ['玉京议庭 · 山门协商与传承名录', '天衡算院旧址 · 古代周天学问', '百家道会 · 各洲修士的交锋与互证'],
    opportunities: ['旧线索引来的高台残图', '百家论道与跨洲传承'],
  },
};

export function regionWorld(id: string): RegionWorld { return WORLD_REGIONS[id] ?? WORLD_REGIONS.qinglan; }
export function regionPractice(id: string, method: string): number {
  if (id === 'river' && method === 'medicine') return 1.3;
  if (id === 'north' && method === 'temper') return 1.3;
  if (id === 'desert') return method === 'temper' ? 1.2 : method === 'meditate' ? 1.1 : 1;
  if (id === 'central' && method === 'meditate') return 1.3;
  return 1;
}
export function sectHome(id: string): string { return ({ qinglan: 'qinglan', herb: 'river', star: 'north' } as Record<string, string>)[id] ?? 'qinglan'; }

/** Identity describes what this person has actually become; it is not a birth class. */
export function lifeIdentity(g: Game): { title: string; description: string; facets: string[] } {
  const sect = SECTS.find(s => s.id === g.sect);
  const birthplace = REGIONS.find(r => r.id === g.visited[0]) ?? REGIONS[0];
  const current = REGIONS.find(r => r.id === g.region) ?? birthplace;
  const rare = g.flags.filter(flag => flag.startsWith('exp-'));
  const heterodox = g.flags.includes('legacy-eclipse');
  let title = g.age < 16 ? '尚在长大的孩子' : g.realm === 0 ? '初踏仙途的求道者' : '独自求道的散修';
  let description = g.age < 16 ? '出身给了起点，往后怎样生活，还没有写下。' : '你的修行仍在展开，眼前的选择与所遇之人会逐渐留下痕迹。';
  if (sect) {
    title = `${sect.name} · ${SECT_RANKS[g.sectRank]}`;
    description = g.sectRank === 3 ? '你从山门中的修行与功绩走到传功长老之位，已有能授予后来者的本领。'
      : g.sectRank >= 1 ? '境界与功绩让你在山门里站稳脚跟；师承、专长和同门往来构成了这段人生。'
      : '你已在一座山门落脚，既接受师承与供给，也开始为这个宗门积累功绩。';
  } else if (g.realm >= 2) {
    title = g.stones < REALMS[g.realm].cost ? '清贫自持的散修' : '自立求道的散修';
    description = '你在山门之外积累修为，靠自己的营生、手艺与际遇承担每一次破境的资用。';
  }
  if (!sect && g.visited.length >= 4 && g.realm >= 1) {
    title = '行过诸洲的修士';
    description = '几处山河留下不同的生活与学问；迁居与远行已经成为你求道的一部分。';
  }
  if (heterodox) {
    title = sect ? `${title} · 身负异法` : '逐险炼体的异道修士';
    description = '蚀日传承改变了你应对山河的方式：冒险中的修炼和强健的体魄，与持续的供养和世人的戒惧一同留在此生。';
  } else if (rare.length && !sect) {
    title = '身负奇遇传承的散修';
    description = '你曾亲自走进险地，带回了改变后来修行的学问；所得有具体来处，也有自己的适用之处。';
  }
  const facets = [`生于${regionWorld(birthplace.id).continent}`, `如今在${current.name}`];
  if (g.visited.length > 1) facets.push(`走过${g.visited.length}片地域`);
  if (g.realm > 0) facets.push(`${REALMS[g.realm].name}境`);
  if (rare.length) facets.push(`已领悟${rare.length}种际遇所得`);
  if (g.flags.includes('forbidden-art') && !heterodox) facets.push('曾涉足禁法');
  if (g.flags.includes('story-caravan')) facets.push('曾带人迁居');
  if (g.flags.includes('story-clinic')) facets.push('曾建立药堂');
  if (g.flags.includes('story-school')) facets.push('曾开门共学');
  if (g.npcs.some(n => n.role === 'companion')) facets.push('曾与一人结为道侣');
  return { title, description, facets };
}
