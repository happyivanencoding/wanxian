import { useState } from 'react';
import { FOCUSES, ITEMS, REALMS } from '../game/data.ts';
import { breakthroughChance, currentRegion, getEvent, realmName } from '../game/engine.ts';
import { LIFE_DIRECTIONS, lifeMemory } from '../game/lifelines.ts';
import type { NPC } from '../game/types.ts';
import { Icon } from '../components/Art.tsx';
import { PixelScene, PixelPortrait } from '../components/PixelArt.tsx';
import { TrainingInsight } from '../components/CultivationInsight.tsx';
import PreparationPanel from '../components/PreparationPanel.tsx';
import { LogRow, Modal, Notice, type PageProps } from '../components/Common.tsx';
import { OpportunityPreview } from './Opportunities.tsx';
import './PixelJourney.css';
import './LifeJourney.css';

export default function Journey(props: PageProps) {
  const { game: g, act, navigate, openBreakthrough, openEvent, newLife, pauseTime } = props;
  const [choosingFocus, setChoosingFocus] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<NPC | null>(null);
  const realm = REALMS[g.realm], event = getEvent(g), region = currentRegion(g);
  const direction = LIFE_DIRECTIONS.find(item => item.id === g.direction);
  const focus = FOCUSES.find(item => item.id === g.focus)!;
  const progress = Math.min(100, g.progress / realm.need * 100);
  const recent = g.logs.filter(entry => entry.important && entry.title !== '命格初现').slice(-5).reverse();
  const latest = recent[0];
  const equipped = ITEMS.find(item => item.id === g.equipped);
  const person = selectedPerson && g.npcs.find(npc => npc.id === selectedPerson.id);
  const memories = person ? g.logs.filter(entry => entry.kind === 'relationship' && entry.text.includes(person.name)).slice(-4).reverse() : [];

  return <div className="page-enter life-journey" data-testid="cultivation-home">
    {!g.alive && <div className="ending-banner"><div><h2>{g.ending}</h2><p>{g.endingText}</p></div><button className="button" onClick={() => navigate('archives')}>翻阅此生</button><button className="button primary" onClick={newLife}>再入轮回</button></div>}
    <div className="life-landscape"><PixelScene region={g.region} compact/><div><span>{region.name}</span><span>{g.age} 岁 · {realmName(g)}</span></div></div>
    <div className="life-layout"><section className="life-current">
      <div className="life-direction-bar" data-testid="current-cultivation">
        <button className="current-focus" data-testid="focus-picker" disabled={!g.alive || g.age < 6 || Boolean(g.expeditions?.active)} onClick={() => { pauseTime(); setChoosingFocus(true); }}><Icon name={direction?.icon || focus.icon} size={19}/><span><small>{g.age < 6 ? '慢慢长大' : '把光阴放在'}</small><strong>{g.age < 6 ? '人间初见' : direction?.name || focus.name}</strong></span><Icon name="chevron" size={16}/></button>
        <button className="button life-breakthrough" onClick={openBreakthrough} disabled={!g.alive || g.realm >= 6 || g.age < 16 || progress < 100} data-testid="breakthrough-open">{g.realm >= 6 ? '已离人间' : progress < 100 ? `修为 ${Math.round(progress)}%` : g.realm === 5 ? '叩问天门' : '尝试突破'}</button>
      </div>
      {event && <button className="pending-banner" onClick={openEvent} data-testid="pending-event"><Icon name="spark" size={20}/><span><small>时光暂驻</small><strong>{event.title}</strong></span><Icon name="arrow" size={18}/></button>}
      {latest && <article className="life-now" data-testid="life-now"><div className="life-now-meta"><time>{latest.age} 岁</time><button className="text-button" aria-label={latest.starred ? '取消珍藏此刻' : '珍藏此刻'} onClick={() => act({ type: 'star', id: latest.id })}>{latest.starred ? '★' : '☆'}</button></div><h1>{latest.title}</h1><p>{latest.text}</p></article>}
      <section className="life-people" aria-label="与你同世的人"><div className="life-section-title"><h2>同世之人</h2><button className="text-button" onClick={() => navigate('people')}>相处 <Icon name="arrow" size={14}/></button></div><div className="life-people-row">{g.npcs.map(npc => { const memory = lifeMemory(g, npc); return <button key={npc.id} className={npc.alive ? '' : 'person-departed'} onClick={() => { pauseTime(); setSelectedPerson(npc); }} data-testid={`life-person-${npc.id}`}><PixelPortrait name={npc.name} gender="随缘"/><strong>{npc.name}</strong><small>{npc.alive ? REALMS[npc.realm].name : npc.realm === 6 ? '已飞升' : '已故'}</small>{memory && <span className="person-memory-mark" aria-label="有共同往事"/>}</button>; })}</div></section>
      <section className="life-recent"><div className="life-section-title"><h2>走过的日子</h2><button className="text-button" onClick={() => navigate('chronicle')}>年谱 <Icon name="arrow" size={14}/></button></div>{recent.slice(1, 4).map(entry => <LogRow key={entry.id} entry={entry} onStar={() => act({ type: 'star', id: entry.id })}/>)}{recent.length < 2 && <p className="quiet">这一生，刚刚开始。</p>}</section>
    </section><aside className="life-aside">
      {g.stats.health < 35 && g.alive && <Notice kind="danger">体魄偏低，先休养或服用回春丹。</Notice>}
      <OpportunityPreview {...props}/>
      <details className="life-practice panel" data-testid="cultivation-details" onToggle={event => { if (event.currentTarget.open) pauseTime(); }}><summary>修行与事务 <Icon name="chevron" size={16}/></summary><div className="life-practice-body"><div className="life-practice-status"><strong>{realmName(g)}</strong><span>{g.progress.toFixed(1)} / {realm.need} 修为</span></div><progress max={realm.need} value={Math.min(g.progress, realm.need)} aria-label="当前修为"/><p className="quiet">{g.direction ? `当前日常：${focus.name} · 自动照料生计、休养及普通突破` : `当前安排：${focus.name}`}。突破可能失败。</p><div className="life-practice-status"><span>下一境 {REALMS[Math.min(6, g.realm + 1)].name}</span><span>需 {realm.cost} 灵石 · {Math.round(breakthroughChance(g) * 100)}%</span></div><PreparationPanel game={g} act={act} pauseTime={pauseTime}/><div className="life-practice-links"><button className="button" data-testid="journey-equipment" onClick={() => navigate('inventory')}>{equipped?.name || '行囊与坊市'}</button><button className="button" onClick={() => navigate('sect')}>仙门</button><button className="button" onClick={() => navigate('world')}>远行</button><button className="button" onClick={() => navigate('home')}>洞府</button></div><TrainingInsight game={g}/></div></details>
      <button className="text-button life-details-link" onClick={() => navigate('life')} data-testid="life-summary-link">此生所学与承诺 <Icon name="arrow" size={16}/></button>
    </aside></div>
    {choosingFocus && <Modal title="把光阴放在何处" onClose={() => setChoosingFocus(false)}><div className="life-direction-options">{LIFE_DIRECTIONS.map(item => <button key={item.id} className={`focus-picker-option ${g.direction === item.id ? 'active' : ''}`} data-testid={`direction-${item.id}`} aria-pressed={g.direction === item.id} onClick={() => { act({ type: 'direction', direction: item.id }); setChoosingFocus(false); }}><Icon name={item.icon} size={23}/><span><strong>{item.name}</strong><small>{item.detail}</small></span></button>)}</div><p className="quiet">日常自动照料，普通突破按真实条件尝试；人生转折由你决定。</p><details className="manual-focus"><summary>亲自安排每年的重心</summary><div className="focus-picker-grid">{FOCUSES.map(item => <button key={item.id} className={`focus-picker-option ${!g.direction && g.focus === item.id ? 'active' : ''}`} data-testid={`focus-${item.id}`} onClick={() => { act({ type: 'focus', focus: item.id }); setChoosingFocus(false); }}><Icon name={item.icon} size={20}/><span><strong>{item.name}</strong><small>{item.subtitle}</small></span></button>)}</div></details></Modal>}
    {person && <Modal title={person.name} subtitle={`${person.title} · ${person.alive ? REALMS[person.realm].name : person.realm === 6 ? '已飞升离界' : '已故'}`} onClose={() => setSelectedPerson(null)}><p className="event-story">{person.story}</p>{memories.map(entry => <LogRow key={entry.id} entry={entry} onStar={() => act({ type: 'star', id: entry.id })}/>)}{!memories.length && <p className="quiet">尚未留下共同往事。</p>}<button className="button full" onClick={() => { setSelectedPerson(null); navigate('people'); }}>查看同道</button></Modal>}
  </div>;
}
