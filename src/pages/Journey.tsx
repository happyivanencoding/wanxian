import { useState } from 'react';
import { FOCUSES, REALMS } from '../game/data.ts';
import { currentRegion, getEvent, realmName } from '../game/engine.ts';
import { LIFE_DIRECTIONS, lifeMemory } from '../game/lifelines.ts';
import { relationshipLabel } from '../game/relationships.ts';
import { cultivationState } from '../game/cultivation.ts';
import { Icon } from '../components/Art.tsx';
import { PixelScene, PixelPortrait } from '../components/PixelArt.tsx';
import { WorldPulse } from '../components/WorldHistory.tsx';
import { LogRow, Modal, Notice, type PageProps } from '../components/Common.tsx';
import { OpportunityPreview } from './Opportunities.tsx';
import './PixelJourney.css';
import './LifeJourney.css';

export default function Journey(props: PageProps) {
  const { game: g, act, navigate, openBreakthrough, openEvent, newLife, pauseTime, resumeTime } = props;
  const [choosingFocus, setChoosingFocus] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const realm = REALMS[g.realm], event = getEvent(g), region = currentRegion(g);
  const direction = LIFE_DIRECTIONS.find(item => item.id === g.direction);
  const focus = FOCUSES.find(item => item.id === g.focus)!;
  const progress = Math.min(100, g.progress / realm.need * 100);
  const recent = g.logs.filter(entry => entry.important && entry.title !== '命格初现').slice(-5).reverse();
  const latest = recent[0], person = g.npcs.find(npc => npc.id === selectedPerson);
  const memories = person ? g.logs.filter(entry => entry.kind === 'relationship' && entry.text.includes(person.name)).slice(-4).reverse() : [];
  const people = [...g.npcs].sort((a, b) => Number(b.alive) - Number(a.alive) || (b.metAt ?? 0) - (a.metAt ?? 0)).slice(0, 6);
  const closeFocus = () => { setChoosingFocus(false); resumeTime?.(); };
  const closePerson = () => { setSelectedPerson(null); resumeTime?.(); };
  return <div className="page-enter life-journey" data-testid="cultivation-home">
    {!g.alive && <div className="ending-banner"><div><h2>{g.ending}</h2><p>{g.endingText}</p></div><button className="button" onClick={() => navigate('archives')}>翻阅此生</button><button className="button primary" onClick={newLife}>再入轮回</button></div>}
    <div className="life-landscape"><PixelScene region={g.region} compact/><div><span>{region.name}</span><span>{g.age} 岁 · {realmName(g)}</span></div></div>
    <div className="life-layout"><section className="life-current">
      <div className="life-direction-bar" data-testid="current-cultivation">
        <button className="current-focus" data-testid="focus-picker" disabled={!g.alive || g.age < 6 || Boolean(g.expeditions?.active) || Boolean(g.pending)} onClick={() => { pauseTime(); setChoosingFocus(true); }}><Icon name={direction?.icon || focus.icon} size={19}/><span><small>{g.age < 6 ? '初生' : '重心'}</small><strong>{g.age < 6 ? '人间初见' : direction?.name || focus.name}</strong></span><Icon name="chevron" size={16}/></button>
        <button className="button life-breakthrough" onClick={() => progress >= 100 && g.age >= 16 ? openBreakthrough() : navigate('practice')} disabled={!g.alive || g.realm >= 6} data-testid="breakthrough-open" title={cultivationState(g)}>{g.realm >= 6 ? '已离人间' : progress < 100 ? `修为 ${Math.round(progress)}%` : g.age < 16 ? '养气' : g.realm === 5 ? '叩问天门' : '尝试突破'}</button>
      </div>
      {event && <button className="pending-banner" onClick={openEvent} data-testid="pending-event"><Icon name="spark" size={20}/><span><strong>{event.title}</strong></span><Icon name="arrow" size={18}/></button>}
      {latest && <article className="life-now" data-testid="life-now"><div className="life-now-meta"><time>{latest.age} 岁</time><button className="text-button" aria-label={latest.starred ? '取消珍藏此刻' : '珍藏此刻'} onClick={() => act({ type: 'star', id: latest.id })}>{latest.starred ? '★' : '☆'}</button></div><h1>{latest.title}</h1><p>{latest.text}</p></article>}
      {people.length > 0 && <section className="life-people" aria-label="相识的人"><div className="life-section-title"><h2>相识</h2><button className="text-button" onClick={() => navigate('people')}>全部 {g.npcs.length} <Icon name="arrow" size={14}/></button></div><div className="life-people-row">{people.map(npc => <button key={npc.id} className={npc.alive ? '' : 'person-departed'} onClick={() => { pauseTime(); setSelectedPerson(npc.id); }} data-testid={`life-person-${npc.id}`}><PixelPortrait name={npc.name} gender="随缘"/><strong>{npc.name}</strong><small>{npc.alive ? `${relationshipLabel(npc)} · ${REALMS[npc.realm].name}` : npc.realm === 6 ? '已飞升' : '已故'}</small>{lifeMemory(g, npc) && <span className="person-memory-mark" aria-label="有共同往事"/>}</button>)}</div></section>}
      {recent.length > 1 && <section className="life-recent"><div className="life-section-title"><h2>往事</h2><button className="text-button" onClick={() => navigate('chronicle')}>年谱 <Icon name="arrow" size={14}/></button></div>{recent.slice(1, 4).map(entry => <LogRow key={entry.id} entry={entry} onStar={() => act({ type: 'star', id: entry.id })}/>)}</section>}
    </section><aside className="life-aside">
      {g.stats.health < 35 && g.alive && <Notice kind="danger">体魄偏低 · 先休养</Notice>}
      <WorldPulse game={g} onOpen={() => navigate('world')}/>
      {(g.expeditions?.active || g.realm >= 1) && <OpportunityPreview {...props}/>}
    </aside></div>
    {choosingFocus && <Modal title="重心" onClose={closeFocus}><div className="life-direction-options">{LIFE_DIRECTIONS.map(item => <button key={item.id} className={`focus-picker-option ${g.direction === item.id ? 'active' : ''}`} data-testid={`direction-${item.id}`} aria-pressed={g.direction === item.id} title={item.detail} onClick={() => { act({ type: 'direction', direction: item.id }); closeFocus(); }}><Icon name={item.icon} size={23}/><strong>{item.name}</strong></button>)}</div><details className="manual-focus"><summary>手动安排</summary><div className="focus-picker-grid">{FOCUSES.map(item => <button key={item.id} className={`focus-picker-option ${!g.direction && g.focus === item.id ? 'active' : ''}`} data-testid={`focus-${item.id}`} onClick={() => { act({ type: 'focus', focus: item.id }); closeFocus(); }}><Icon name={item.icon} size={20}/><span><strong>{item.name}</strong><small>{item.subtitle}</small></span></button>)}</div></details></Modal>}
    {person && <Modal title={person.name} subtitle={`${relationshipLabel(person)} · ${person.age}岁 · ${person.alive ? REALMS[person.realm].name : person.realm === 6 ? '已飞升' : '已故'}`} onClose={closePerson}>
      {person.meeting && <p className="quiet">{person.metAt}岁 · {person.meeting}</p>}<p className="event-story">{person.grievance && person.role === 'enemy' ? person.grievance : person.story}</p>
      {person.gear && <p className="quiet">{person.gear.name}</p>}{memories.map(entry => <LogRow key={entry.id} entry={entry} onStar={() => act({ type: 'star', id: entry.id })}/>)}
      <button className="button full" onClick={() => { setSelectedPerson(null); navigate('people'); }}>相处</button>
    </Modal>}
  </div>;
}
