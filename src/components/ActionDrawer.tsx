import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Game } from '../game/types.ts';
import { Modal, type PageId } from './Common.tsx';
import { Icon } from './Art.tsx';

export default function ActionDrawer({ game, active, items, views, onSelect, onClose }: {
  game: Game; active: PageId | null; items: { id: PageId; label: string; icon: string }[];
  views: Partial<Record<PageId, ReactNode>>; onSelect: (id: PageId | null) => void; onClose: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const extra = ['sect','home','inventory'];
  const renderRow = (item: { id: PageId; label: string; icon: string }) =>
    <details key={item.id} open={active === item.id} data-section={item.id}>
      <summary onClick={event => { event.preventDefault(); onSelect(active === item.id ? null : item.id); }} data-testid={'drawer-' + item.id}>
        <Icon name={item.icon} size={19}/><span>{item.label}</span><Icon name="chevron" size={15}/>
      </summary>
      {active === item.id && <div className="drawer-section-body">{views[item.id]}</div>}
    </details>;
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      const row = container.current?.querySelector<HTMLElement>('[data-section="' + active + '"]');
      const body = container.current?.closest<HTMLElement>('.modal-body');
      if (!active && body) body.scrollTop = 0;
      else if (row && body) body.scrollTop += row.getBoundingClientRect().top - body.getBoundingClientRect().top - (body.querySelector<HTMLElement>('.drawer-resources')?.offsetHeight ?? 0);
    });
    return () => cancelAnimationFrame(timer);
  }, [active, showAdvanced]);
  return <Modal title="行事" className="action-drawer" onClose={onClose}>
    <div className="drawer-resources" data-testid="drawer-resources"><button className="text-button" disabled={!active} onClick={() => { setShowAdvanced(false); onSelect(null); }} aria-label="返回行事总览">总览</button><span>行动 <strong>{game.actionsLeft} / 3</strong></span><span>灵石 <strong>{game.stones}</strong></span></div>
    <div ref={container} className="drawer-sections" data-testid="action-drawer">
      {items.filter(item => item.id !== 'journey' && !extra.includes(item.id)).map(renderRow)}
      <details className="drawer-advanced" open={showAdvanced || !!active && extra.includes(active)}>
        <summary data-testid="drawer-advanced" onClick={event => { event.preventDefault(); setShowAdvanced(value => !value); }}>
          <Icon name="bag" size={19}/><span>修行细务</span><Icon name="chevron" size={15}/>
        </summary>
        {items.filter(item => extra.includes(item.id)).map(renderRow)}
      </details>
    </div>
  </Modal>;
}
