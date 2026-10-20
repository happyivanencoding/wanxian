import { ERAS, FOCUSES, HOMES, ITEMS, ORIGINS, REGIONS, ROUTES, SECTS } from './data.ts';
import { EVENT_MAP } from './events.ts';
import { archiveLife, earnedAchievements } from './engine.ts';
import { isValidExpeditions } from './expeditions.ts';
import { PREPARATION_METHODS, preparationTarget } from './progression.ts';
import { NPC_RESPONSE_IDS } from './director.ts';
import type { Game, Profile } from './types.ts';

export const SAVE_KEY = 'wanxian-life:profile:v1';
export const BACKUP_KEY = 'wanxian-life:previous:v1';
export function newProfile(): Profile {
  return { version: 1, game: null, archives: [], slots: [null, null, null], settings: { theme: 'light', speed: 1, durationMinutes: 30, policy: 'safe', reducedMotion: false, directorEnabled: true }, achievements: [] };
}
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const number = (v: unknown, min = 0, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const contains = (data: { id: string }[], id: unknown) => text(id) && data.some(d => d.id === id);
const statKeys = ['health', 'mind', 'insight', 'foundation', 'reputation', 'alchemy', 'combat'];
const validEffect = (v: unknown) => object(v) && (!v.stats || (object(v.stats) && Object.entries(v.stats).every(([k, n]) => statKeys.includes(k) && number(n, -100, 100)))) && ['stones', 'progress', 'lifespan', 'contribution', 'amount', 'npcRelation', 'rootBoost'].every(k => v[k] === undefined || number(v[k], -100000, 100000)) && (v.item === undefined || contains(ITEMS, v.item)) && (v.flag === undefined || text(v.flag)) && (v.storyPath === undefined || ['guardian', 'lone', 'contract'].includes(v.storyPath as string)) && (v.npcId === undefined || ['peer-0', 'peer-1', 'peer-2', 'peer-3'].includes(v.npcId as string));
const validLog = (l: unknown) => object(l) && number(l.id) && number(l.age, 0, 10000) && text(l.title) && text(l.text) && ['life', 'cultivation', 'encounter', 'world', 'relationship', 'economy', 'ending'].includes(l.kind as string) && typeof l.important === 'boolean';
export function validGame(value: unknown): value is Game {
  if (!object(value) || value.version !== 1) return false;
  const g = value;
  if (!['id', 'name', 'gender', 'root', 'talent', 'endingText', 'yearName'].every(k => text(g[k]))) return false;
  if (!['seed', 'rng'].every(k => number(g[k], 0, 4294967295) && Number.isInteger(g[k]))) return false;
  if (!number(g.age, 0, 10000) || !Number.isInteger(g.age) || !number(g.realm, 0, 6) || !Number.isInteger(g.realm)) return false;
  if (!['progress', 'stones', 'contribution', 'cooldownUntil', 'attempts', 'successes', 'totalStones', 'choices', 'logSeq'].every(k => number(g[k]))) return false;
  if (!number(g.aptitude, 15, 100) || !number(g.lifespan, 1, 10000) || !number(g.sectRank, 0, 3) || !Number.isInteger(g.sectRank) || !number(g.actionsLeft, 0, 3) || !Number.isInteger(g.actionsLeft)) return false;
  if (!contains(ORIGINS, g.origin) || !contains(ERAS, g.era) || !contains(ROUTES, g.route) || !contains(REGIONS, g.region) || !contains(FOCUSES, g.focus) || (g.sect !== null && !contains(SECTS, g.sect))) return false;
  if (!object(g.stats) || !statKeys.every(k => number((g.stats as ObjectValue)[k], 0, 100))) return false;
  if (!object(g.home) || !HOMES.every(h => number((g.home as ObjectValue)[h.id], 0, h.max) && Number.isInteger((g.home as ObjectValue)[h.id]))) return false;
  if (!object(g.inventory) || !Object.entries(g.inventory).every(([k, n]) => contains(ITEMS, k) && number(n, 0, 1e7) && Number.isInteger(n))) return false;
  if (g.equipped !== null && (!ITEMS.some(item => item.id === g.equipped && item.kind === 'gear') || !number(g.inventory[g.equipped as string], 1))) return false;
  if (!strings(g.flags) || !strings(g.visited) || !g.visited.every(id => contains(REGIONS, id))) return false;
  if (!object(g.seen) || !Object.entries(g.seen).every(([id, age]) => Boolean(EVENT_MAP[id]) && number(age, 0, 10000))) return false;
  if (g.pending !== null && (!text(g.pending) || !EVENT_MAP[g.pending])) return false;
  if (!Array.isArray(g.logs) || !g.logs.every(validLog)) return false;
  if (!Array.isArray(g.snapshots) || !g.snapshots.every(s => object(s) && number(s.age, 0, 10000) && number(s.realm, 0, 6) && ['health', 'mind', 'stones', 'progress'].every(k => number(s[k])))) return false;
  if (!Array.isArray(g.delayed) || !g.delayed.every(d => object(d) && number(d.at, 0, 10000) && text(d.title) && text(d.text) && validEffect(d.effect))) return false;
  if (!Array.isArray(g.npcs) || g.npcs.length !== 4 || !g.npcs.every(n => object(n) && ['id', 'name', 'title', 'personality', 'story'].every(k => text(n[k])) && ['friend', 'rival', 'companion', 'mentor'].includes(n.role as string) && number(n.realm, 0, 6) && Number.isInteger(n.realm) && number(n.relation, 0, 100) && number(n.aptitude, 0, 100) && number(n.progress) && number(n.age, 0, 10000) && number(n.lifespan, 1, 10000) && number(n.lastInteraction, -1, 10000) && typeof n.alive === 'boolean')) return false;
  if (g.preparation !== undefined) {
    const p = g.preparation;
    if (!object(p) || Object.keys(p).some(key => !['realm', 'selected', 'progress'].includes(key)) || !Number.isInteger(p.realm) || p.realm !== g.realm || !number(p.realm, 0, 5) || (p.selected !== null && !PREPARATION_METHODS.includes(p.selected as typeof PREPARATION_METHODS[number])) || !object(p.progress)) return false;
    const progress = p.progress;
    if (Object.keys(progress).length !== PREPARATION_METHODS.length || !PREPARATION_METHODS.every(method => number(progress[method], 0, preparationTarget(p.realm as number, method)))) return false;
  }
  if (!isValidExpeditions(g.expeditions, g as unknown as Game)) return false;
  if (g.directorRecords !== undefined) {
    if (!Array.isArray(g.directorRecords) || g.directorRecords.length > 64 || !g.directorRecords.every(record => {
      if (!object(record) || Object.keys(record).some(key => !['kind', 'age', 'actorId', 'candidateId', 'source'].includes(key))) return false;
      if (!number(record.age, 0, g.age as number) || !Number.isInteger(record.age) || !text(record.candidateId) || !['local', 'startlux'].includes(record.source as string)) return false;
      if (record.kind === 'npc') return NPC_RESPONSE_IDS.includes(record.candidateId as typeof NPC_RESPONSE_IDS[number]) && (g.npcs as Game['npcs']).some(npc => npc.id === record.actorId);
      const event = EVENT_MAP[record.candidateId];
      return record.kind === 'event' && record.actorId === undefined && Boolean(event) && typeof event.id === 'string' && event.kind !== 'turning' && event.kind !== 'routine' && !event.id.startsWith('story-') && !event.id.startsWith('fate-');
    })) return false;
  }
  return typeof g.alive === 'boolean' && (g.ending === null || text(g.ending)) && (!g.alive || (g.ending === null && g.realm < 6));
}
export function parseProfile(raw: string): Profile {
  if (raw.length > 12 * 1024 * 1024) throw new Error('存档超过12MB，请使用本项目导出的存档文件。');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('不是有效的 JSON 存档。原存档未被改动。'); }
  if (!object(value) || value.version !== 1) throw new Error('无法识别存档版本，需要「万仙之一」v1 存档。');
  if (value.game !== null && !validGame(value.game)) throw new Error('人物存档字段不完整或数值无效，未进行导入。');
  if (!Array.isArray(value.slots) || value.slots.length !== 3 || !value.slots.every(s => s === null || (object(s) && text(s.name) && text(s.savedAt) && validGame(s.game)))) throw new Error('手动存档槽损坏，未进行导入。');
  if (!Array.isArray(value.archives) || value.archives.length > 30 || !value.archives.every(a => object(a) && ['id', 'name', 'origin', 'route', 'ending', 'endingText', 'legacy', 'date'].every(k => text(a[k])) && number(a.age, 0, 10000) && number(a.realm, 0, 6) && Number.isInteger(a.realm) && number(a.totalStones) && number(a.choices) && Array.isArray(a.logs) && a.logs.every(validLog))) throw new Error('前世记录不完整，未进行导入。');
  if (!object(value.settings) || !['light', 'dark'].includes(value.settings.theme as string) || ![1, 2, 4, 8].includes(value.settings.speed as number) || (value.settings.durationMinutes !== undefined && ![30, 60].includes(value.settings.durationMinutes as number)) || (value.settings.directorEnabled !== undefined && typeof value.settings.directorEnabled !== 'boolean') || !['safe', 'bold', 'random'].includes(value.settings.policy as string) || typeof value.settings.reducedMotion !== 'boolean' || !strings(value.achievements)) throw new Error('存档设置无效，未进行导入。');
  const profile = value as unknown as Profile;
  return { ...profile, settings: { ...profile.settings, durationMinutes: profile.settings.durationMinutes ?? 30, directorEnabled: profile.settings.directorEnabled ?? true } };
}
export function settleProfile(profile: Profile, game: Game): Profile {
  let archives = profile.archives;
  if (!game.alive && !archives.some(a => a.id === game.id)) archives = [archiveLife(game), ...archives].slice(0, 30);
  return { ...profile, game, archives, achievements: [...new Set([...profile.achievements, ...earnedAchievements(game)])] };
}
export function loadProfile(storage: Pick<Storage, 'getItem'>): { profile: Profile; warning: string; canSave: boolean } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { profile: newProfile(), warning: '', canSave: true };
    try { return { profile: parseProfile(raw), warning: '', canSave: true }; }
    catch {
      const backup = storage.getItem(BACKUP_KEY);
      if (backup) { try { return { profile: parseProfile(backup), warning: '主存档异常，已读取上一份有效备份。建议立即导出存档。', canSave: true }; } catch { /* Preserve both damaged files for explicit recovery. */ } }
      return { profile: newProfile(), warning: '存档无法读取，原数据未被覆盖。请先在存档面板导出原始数据，再导入备份或开始新人生。', canSave: false };
    }
  } catch { return { profile: newProfile(), warning: '浏览器存储不可用。本次仍可游玩，请用导出存档保存进度。', canSave: false }; }
}
export function persistProfile(storage: Pick<Storage, 'getItem' | 'setItem'>, profile: Profile) {
  const previous = storage.getItem(SAVE_KEY);
  if (previous) { try { parseProfile(previous); storage.setItem(BACKUP_KEY, previous); } catch { /* Do not replace a good backup with an invalid primary save. */ } }
  storage.setItem(SAVE_KEY, JSON.stringify(profile));
}
