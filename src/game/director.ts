import { FOCUSES, ORIGINS, REALMS, REGIONS, ROUTES, SECTS, SECT_RANKS } from './data.ts';
import { regionWorld } from './world.ts';
import type { DirectorCandidate, DirectorDecision, DirectorRecord, DirectorRequest, Effect, Game, NPC } from './types.ts';

/** One invocation owns this cursor. No network, global state or original RNG is used. */
export interface DirectorControl { decision?: DirectorDecision; request?: DirectorRequest }

/** Only already-observed fiction is sent; no saves, archives, delayed rewards or player profile. */
export function directorContext(g: Game, npc?: NPC, interaction?: string): Record<string, unknown> {
  const sect = SECTS.find(s => s.id === g.sect);
  const describeNPC = (person: NPC) => ({
    id: person.id, name: person.name, title: person.title, personality: person.personality,
    realm: REALMS[person.realm].name, alive: person.alive, relation: person.relation, role: person.role,
    sharedExperience: g.flags.includes(`companion-bond:${person.id}`), latestKnownExperience: person.story.slice(0, 160),
  });
  return {
    person: {
      name: g.name, age: g.age, realm: REALMS[g.realm].name,
      origin: ORIGINS.find(o => o.id === g.origin)?.name, route: ROUTES.find(r => r.id === g.route)?.name,
      focus: FOCUSES.find(f => f.id === g.focus)?.name,
      health: g.stats.health, mind: g.stats.mind, reputation: g.stats.reputation, stones: g.stones,
      foundation: g.stats.foundation, insight: g.stats.insight, alchemy: g.stats.alchemy, combat: g.stats.combat,
      sect: sect ? { name: sect.name, rank: SECT_RANKS[g.sectRank], description: sect.description, culture: sect.culture, preferences: sect.preferences } : null,
    },
    location: { name: REGIONS.find(r => r.id === g.region)?.name, culture: regionWorld(g.region).culture },
    livedExperience: g.logs.filter(entry => entry.important).slice(-6).map(entry => ({ age: entry.age, title: entry.title, text: entry.text.slice(0, 240) })),
    relationships: g.npcs.map(describeNPC),
    ...(npc ? { interaction, actor: describeNPC(npc) } : {}),
    recentReactions: (g.directorRecords ?? []).filter(record => record.kind === 'npc').slice(-4).map(record => ({ age: record.age, actorId: record.actorId, reaction: record.candidateId })),
  };
}

/** An online reply may only replace the already legal local choice, never introduce effects. */
export function directCandidate(
  g: Game, kind: 'event' | 'npc', candidates: DirectorCandidate[], localId: string,
  control?: DirectorControl, npc?: NPC, interaction?: string,
): string {
  if (!candidates.length || !candidates.some(candidate => candidate.id === localId)) return localId;
  // A multi-year step can encounter one opportunity only; NPC actions likewise have one reply.
  if (control && candidates.length > 1 && !control.request) control.request = {
    kind, age: g.age, ...(npc ? { actorId: npc.id } : {}),
    context: directorContext(g, npc, interaction), candidates,
  };
  const decision = control?.decision;
  const accepted = candidates.length > 1 && decision?.source === 'startlux' && decision.kind === kind
    && decision.age === g.age && decision.actorId === npc?.id
    && candidates.some(candidate => candidate.id === decision.candidateId);
  const candidateId = accepted ? decision.candidateId : localId;
  const record: DirectorRecord = {
    kind, age: g.age, ...(npc ? { actorId: npc.id } : {}), candidateId, source: accepted ? 'startlux' : 'local',
  };
  g.directorRecords = [...(g.directorRecords ?? []), record].slice(-64);
  return candidateId;
}

export const NPC_RESPONSE_IDS = ['reserved', 'resonance', 'caution', 'guidance', 'medicine', 'trail', 'accounts', 'sparring'] as const;
interface NPCResponse extends DirectorCandidate { effect: Effect; text: string }

/** Costs and the selected player action are settled by the engine before these small responses. */
export function npcResponses(g: Game, npc: NPC, interaction: 'talk' | 'gift' | 'duel'): NPCResponse[] {
  if (!g.alive || !npc.alive || npc.realm >= 6 || g.stats.health <= 0) return [];
  const sameRoad = g.flags.includes(`companion-bond:${npc.id}`);
  const responses: NPCResponse[] = [{
    id: 'reserved', label: '留有分寸地相待', description: `${npc.personality}的${npc.name}认真听完，仍保留自己的修行安排。`,
    text: `${npc.name}收好茶盏，认真听完你的近况，没有许下轻易的承诺。你理清了几分心绪，道心增加1。`, effect: { stats: { mind: 1 } },
  }];
  if (npc.relation >= 45 || sameRoad || npc.role === 'companion') responses.push({
    id: 'resonance', label: '以相知回应', description: `已经建立的信任${sameRoad ? '与共同历险' : ''}使${npc.name}愿意谈起自己的忧虑。`,
    text: `${npc.name}${sameRoad ? '提起你们一同走过的险地' : '谈起自己的修行与忧虑'}。这一次，你们都不必把话留在客套里。情谊额外增加2，道心增加2。`,
    effect: { npcId: npc.id, npcRelation: 2, stats: { mind: 2 } },
  });
  if (g.stats.health < 65 || g.stats.mind < 45 || g.flags.includes('legacy-eclipse') || g.flags.includes('forbidden-art')) responses.push({
    id: 'caution', label: '关切地提醒休整', description: `${npc.name}留意到你当前的伤势、心境或异法负担，帮你调匀气息。`,
    text: `${npc.name}没有催你赶路，而是陪你把紊乱的气息慢慢理顺。体魄恢复2，道心增加1。`, effect: { stats: { health: 2, mind: 1 } },
  });
  if (npc.realm > g.realm || (npc.id === 'peer-3' && npc.relation >= 40)) responses.push({
    id: 'guidance', label: '指出修行中的疏漏', description: `${npc.name}用自己的修行经历回应你的疑惑，并不替你决定以后走哪条路。`,
    text: `${npc.name}取过你画下的周天，指出一处反复绕远的气路。悟性增加2，根基增加1。`, effect: { stats: { insight: 2, foundation: 1 } },
  });
  if (npc.id === 'peer-1' && npc.relation >= 50) responses.push({
    id: 'medicine', label: '把药理落实在眼前', description: '药师同道按你眼下的身体状况辨药，分出自己随身的一株灵草。',
    text: `${npc.name}辨过你带来的药叶，把一株适合温养的灵草放入行囊，并教你认清叶脉。灵草增加1，丹术增加1。`, effect: { item: 'herb', amount: 1, stats: { alchemy: 1 } },
  });
  if (npc.id === 'peer-2' && npc.relation >= 45 && (g.focus === 'adventure' || g.visited.length > 1)) responses.push({
    id: 'trail', label: '分享行路的经验', description: `熟悉山野的同道根据${REGIONS.find(r => r.id === g.region)?.name}的地势，教你辨认险处和退路。`,
    text: `${npc.name}在沙土上画出当地几种险坡与退路，带你练了几步稳住重心的走法。战技增加2，根基增加1。`, effect: { stats: { combat: 2, foundation: 1 } },
  });
  if (npc.id === 'peer-0' && npc.relation >= 55 && g.stones < REALMS[g.realm].cost) {
    const stones = 5 + g.realm * 2;
    responses.push({
      id: 'accounts', label: '帮你渡过资用紧张', description: '熟悉账目的同道看到你眼下的资用缺口，从自己的结余里给出一小笔资助。',
      text: `${npc.name}陪你核过近来的收支，将自己的一小笔结余放在桌上，愿你先渡过这一段紧张。灵石增加${stones}。`, effect: { stones },
    });
  }
  if (interaction === 'duel' && (npc.realm >= g.realm || npc.id === 'peer-3')) responses.push({
    id: 'sparring', label: '停手后再演一招', description: `${npc.name}在已经结束的切磋后，拆开一招给你看，不再追加伤害。`,
    text: `${npc.name}收起兵刃，又把方才那一招放慢演了一遍。你终于看清破绽，战技额外增加2。`, effect: { stats: { combat: 2 } },
  });
  return responses;
}
