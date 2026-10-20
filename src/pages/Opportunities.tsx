import { useEffect } from 'react';
import { expeditionOffers, expeditionView } from '../game/expeditions.ts';
import { getEvent } from '../game/engine.ts';
import { REGIONS } from '../game/data.ts';
import { Icon } from '../components/Art.tsx';
import { Empty, SectionTitle, type PageProps } from '../components/Common.tsx';

export function OpportunityPreview({ game, navigate, openEvent }: PageProps) {
  const view = expeditionView(game), offers = expeditionOffers(game), event = getEvent(game);
  const available = offers.filter(offer => offer.available);
  return <button className="opportunity-preview" data-testid="opportunity-preview" onClick={() => event ? openEvent() : navigate('opportunities')}>
    <span className="opportunity-mark"><Icon name={view.active ? 'compass' : 'spark'} size={23}/></span>
    <span><small>{view.active ? '旅程尚未结束' : event ? '此刻有待决定' : available.length ? `${available.length} 段机缘可以亲自参与` : '山外的机会'}</small><strong>{view.active?.title || event?.title || available[0]?.title || '看看此刻的见闻'}</strong></span><Icon name="arrow" size={19}/>
  </button>;
}

export default function Opportunities({ game, act, openEvent, navigate }: PageProps) {
  const view = expeditionView(game), offers = expeditionOffers(game), event = getEvent(game);
  const active = view.active, completed = [...view.completed].reverse();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [active?.id, active?.stage, view.completed.length]);
  return <div className="page-enter opportunities-page">{!active && <SectionTitle eyebrow="A STEP INTO THE UNKNOWN" title="山外机缘" description="从已经听说的事情里，挑一段想亲自参与的经历。"/>}
    {!active && completed.length > 0 && <section className="panel expedition-results" data-testid="expedition-results"><h2>走过之后</h2>{completed.map((result, index) => index === 0 ? <article key={`${result.id}-${result.age}`} className="expedition-result" data-testid="expedition-result"><span className="eyebrow">{result.age}岁 · 已记入年谱</span><h3>{result.title}</h3><p>{result.text}</p></article> : <details className="expedition-result" key={`${result.id}-${result.age}`}><summary>{result.age}岁 · {result.title}</summary><p>{result.text}</p></details>)}</section>}
    {event && !active && <button className="pending-banner" onClick={openEvent}><span className="pending-mark"><Icon name="spark"/></span><div><small>先决定眼前这件事</small><strong>{event.title}</strong></div><Icon name="arrow"/></button>}
    {active ? <section className="panel expedition-active" data-testid="expedition-active">
      <div className="expedition-heading"><span className="eyebrow">{active.companion ? `与${active.companion.name}同行` : '此刻的经历'}</span><span data-testid="expedition-stage">第 {active.stage + 1} 幕</span></div><h2>{active.title}</h2>
      <p className="expedition-scene" data-testid="expedition-scene">{active.text}</p>
      <div className="expedition-choices">{active.choices.map(choice => <button className="event-choice" key={choice.id} disabled={Boolean(choice.disabled)} onClick={() => act({ type: 'expedition-choose', id: choice.id })} data-testid={`expedition-choice-${choice.id}`}><span><strong>{choice.label}</strong><small>{choice.hint}</small>{choice.disabled && <em>{choice.disabled}</em>}</span><Icon name="chevron" size={18}/></button>)}</div>
      <div className="expedition-retreat"><p>进度会随存档保留。离开此页仍会停在当前场景。</p><button className="text-button" onClick={() => act({ type: 'expedition-retreat' })} data-testid="expedition-retreat">退出这段经历 <Icon name="arrow" size={16}/></button></div>
    </section> : <div className="expedition-offers" data-testid="expedition-offers">{offers.length ? offers.map(offer => <section className="panel expedition-offer" key={offer.id}><h2>{offer.title}</h2><p>{offer.description}</p><div className="expedition-known"><span><Icon name="coins" size={17}/>启程 {offer.cost} 灵石 · 1 次行动</span><span><Icon name="shield" size={17}/>{offer.risk}</span></div><button className="button primary full" disabled={!offer.available || Boolean(event)} onClick={() => act({ type: 'expedition-start', id: offer.id })} data-testid={`expedition-start-${offer.id}`}>亲自走一趟 <Icon name="arrow" size={17}/></button>{!offer.available && <small className="expedition-reason">{offer.reason}</small>}{offer.region !== game.region && <button className="text-button expedition-travel" onClick={() => navigate('world')} data-testid={`expedition-travel-${offer.id}`}>去山河 · {REGIONS.find(region => region.id === offer.region)?.name}<Icon name="arrow" size={16}/></button>}</section>) : <section className="panel"><Empty icon="compass" title="此刻尚无新的线索">继续修行、走访山河，留意已经发生的相遇。你不必为了等待机缘停下自己的人生。</Empty></section>}</div>}

  </div>;
}
