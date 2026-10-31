import { useEffect, useRef } from 'react';
import { expeditionView } from '../game/expeditions.ts';
import { Icon } from '../components/Art.tsx';
import type { PageProps } from '../components/Common.tsx';

export function OpportunityPreview({ game, openEvent }: PageProps) {
  const active = expeditionView(game).active;
  if (!active) return null;
  return <button className="opportunity-preview" data-testid="opportunity-preview" onClick={openEvent}>
    <span className="opportunity-mark"><Icon name="compass" size={23}/></span>
    <span><small>旅程尚未结束</small><strong>{active.title}</strong></span><Icon name="arrow" size={19}/>
  </button>;
}

export default function Opportunities({ game, act }: PageProps) {
  const active = expeditionView(game).active;
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = content.current?.closest<HTMLElement>('.modal-body');
    if (body && content.current) body.scrollTop += content.current.getBoundingClientRect().top - body.getBoundingClientRect().top;
  }, [active?.id, active?.stage]);
  if (!active) return null;
  return <div ref={content} className="page-enter opportunities-page">
    <section className="panel expedition-active" data-testid="expedition-active">
      <div className="expedition-heading">
        <span className="eyebrow">{active.companion ? `与${active.companion.name}同行` : '此刻的经历'}</span>
        <span data-testid="expedition-stage">第 {active.stage + 1} 幕</span>
      </div>
      <h2>{active.title}</h2>
      <p className="expedition-scene" data-testid="expedition-scene">{active.text}</p>
      <div className="expedition-choices">{active.choices.map(choice => {
        const risk = /陨落|极险|重伤/.test(choice.hint) ? '有生命危险'
          : /受伤|危险|失手/.test(choice.hint) ? '可能受伤' : null;
        return <button className="event-choice" key={choice.id} disabled={Boolean(choice.disabled)}
          onClick={() => act({ type: 'expedition-choose', id: choice.id })}
          data-testid={`expedition-choice-${choice.id}`}>
          <span><strong>{choice.label}</strong>{risk && <small className="choice-risk">{risk}</small>}
            {choice.disabled && <em>{choice.disabled.includes('灵石') || choice.disabled.includes('灵草') ? '资用不足' : '目前无法采取'}</em>}</span>
          <Icon name="chevron" size={18}/>
        </button>;
      })}</div>
      <div className="expedition-retreat">
        <button className="text-button" onClick={() => act({ type: 'expedition-retreat' })} data-testid="expedition-retreat">
          退出这段经历 <Icon name="arrow" size={16}/>
        </button>
      </div>
    </section>
  </div>;
}
