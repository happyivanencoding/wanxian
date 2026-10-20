import { useState } from 'react';
import { FOCUSES, REALMS } from '../game/data.ts';
import { breakthroughChance, currentRegion, getEvent, realmName, trainingRate } from '../game/engine.ts';
import { storyView } from '../game/story.ts';
import { Icon } from '../components/Art.tsx';
import { TrainingInsight } from '../components/CultivationInsight.tsx';
import PreparationPanel from '../components/PreparationPanel.tsx';
import { Modal, Notice, type PageProps } from '../components/Common.tsx';
import { OpportunityPreview } from './Opportunities.tsx';

export default function Journey(props: PageProps) {
  const { game: g, act, navigate, openBreakthrough, openEvent, newLife } = props;
  const [choosingFocus, setChoosingFocus] = useState(false);
  const realm = REALMS[g.realm], progress = Math.min(100, g.progress / realm.need * 100);
  const focus = FOCUSES.find(item => item.id === g.focus)!, event = getEvent(g), story = storyView(g);
  return <div className="page-enter cultivation-home" data-testid="cultivation-home">
    {!g.alive && <div className="ending-banner"><div><span className="eyebrow">此生已结卷</span><h3>{g.ending}</h3><p>{g.endingText}</p></div><button className="button" onClick={() => navigate('archives')}>翻阅传记 <Icon name="book"/></button><button className="button primary" onClick={newLife}>再入轮回 <Icon name="rebirth"/></button></div>}
    {event && <button className="pending-banner" onClick={openEvent} data-testid="pending-event"><span className="pending-mark"><Icon name="spark"/></span><div><small>时光暂驻 · {event.kind === 'turning' ? '此生走向，由你决定' : '一段机缘正在等你'}</small><strong>{event.title}</strong></div><Icon name="arrow"/></button>}
    <div className="cultivation-home-grid"><div className="cultivation-primary">
      <section className="panel current-cultivation" data-testid="current-cultivation">
        <div className="compact-panel-title"><div><span className="eyebrow">{currentRegion(g).name} · 当前修行</span><h1>{realmName(g)}</h1></div><span className="cultivation-percent">{Math.round(progress)}<small>%</small></span></div>
        <progress className="cultivation-progress" max={realm.need} value={Math.min(g.progress, realm.need)} aria-label="当前修为"/>
        <div className="cultivation-progress-caption"><span>{g.progress.toFixed(1)} / {realm.need} 修为</span><span>修炼基准 +{trainingRate(g)} / 年</span></div>
        <button className="current-focus" onClick={() => { props.pauseTime(); setChoosingFocus(true); }} disabled={!g.alive || g.age < 6 || Boolean(g.expeditions?.active)} data-testid="focus-picker"><Icon name={focus.icon} size={22}/><span><small>光阴交给</small><strong>{focus.name}</strong></span><span className="focus-change">更换 <Icon name="chevron" size={16}/></span></button>
        <div className="next-realm"><span>下一境 · {REALMS[Math.min(6, g.realm + 1)].name}</span><span>需 {realm.cost} 灵石 · 当前胜算 {Math.round(breakthroughChance(g) * 100)}%</span></div>
        <button className="button primary full" onClick={openBreakthrough} disabled={!g.alive || g.realm >= 6 || g.age < 16 || progress < 100} data-testid="breakthrough-open">{g.age < 16 ? '少年养气 · 十六岁可冲关' : progress < 100 ? '静待修为圆满' : g.age < g.cooldownUntil ? `调息至 ${g.cooldownUntil} 岁` : `尝试突破 · ${REALMS[Math.min(6, g.realm + 1)].name}`}<Icon name="arrow" size={18}/></button>
        <TrainingInsight game={g}/>
      </section>
      {!event && <OpportunityPreview {...props}/>}
      <PreparationPanel game={g} act={act} pauseTime={props.pauseTime}/>
    </div><aside className="cultivation-secondary">
      {g.stats.health < 35 && g.alive && <Notice kind="danger">体魄偏低。可以改为静养，或在行囊服用回春丹。</Notice>}
      <button className="life-summary-link panel" onClick={() => navigate('life')} data-testid="life-summary-link"><span className="eyebrow">此生所系</span><h2>{story.title}</h2><p>{story.description}</p><span>看看此生留下的变化 <Icon name="arrow" size={17}/></span></button>
      <div className="cultivation-quick-links"><button onClick={() => navigate('inventory')}><Icon name="bag" size={20}/><span>行囊与坊市</span><Icon name="chevron" size={16}/></button><button onClick={() => navigate('people')}><Icon name="people" size={20}/><span>故人与同伴</span><Icon name="chevron" size={16}/></button></div>
    </aside></div>
    {choosingFocus && <Modal title="把光阴，放在何处" subtitle="选定后持续执行，随时可以改变" onClose={() => setChoosingFocus(false)}><div className="focus-picker-grid">{FOCUSES.map(item => <button key={item.id} data-testid={`focus-${item.id}`} className={`focus-picker-option ${g.focus === item.id ? 'active' : ''}`} disabled={!g.alive || g.age < 6 || Boolean(g.expeditions?.active)} onClick={() => { act({ type: 'focus', focus: item.id }); setChoosingFocus(false); }} aria-pressed={g.focus === item.id}><Icon name={item.icon} size={24}/><span><strong>{item.name}</strong><small>{item.description}</small></span>{g.focus === item.id && <Icon name="check" size={18}/>}</button>)}</div>{g.age < 16 && <p className="quiet">十六岁前以学识与根基积累为主。</p>}</Modal>}
  </div>;
}
