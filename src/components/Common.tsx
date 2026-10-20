import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Art.tsx';
import type { Action, Game, Log, Profile } from '../game/types.ts';
export type PageId = 'journey' | 'opportunities' | 'life' | 'world' | 'sect' | 'home' | 'inventory' | 'people' | 'chronicle' | 'archives';
export interface PageProps { game: Game; profile: Profile; act: (action: Action) => void; navigate: (page: PageId) => void; openBreakthrough: () => void; openEvent: () => void; newLife: () => void; pauseTime: () => void }
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, [tabindex="0"]') || [])].filter(e => e.offsetParent !== null);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
    <header className="modal-header"><div>{subtitle && <p className="eyebrow">{subtitle}</p>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><Icon name="close"/></button></header><div className="modal-body">{children}</div>
  </div></div>;
}
export function SectionTitle({ eyebrow, title, description, aside }: { eyebrow?: string; title: string; description?: string; aside?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{aside}</div>;
}
export function StatBar({ name, value, tone = 'jade', suffix = '' }: { name: string; value: number; tone?: string; suffix?: string }) {
  return <div className={`stat-bar ${tone}`}><div><span>{name}</span><strong>{Math.round(value)}<small>{suffix}</small></strong></div><span className="bar-track" role="meter" aria-label={name} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/></span></div>;
}
export function Empty({ icon = 'book', title, children }: { icon?: string; title: string; children: ReactNode }) {
  return <div className="empty-state"><span><Icon name={icon} size={32}/></span><h3>{title}</h3><p>{children}</p></div>;
}
export function Notice({ children, kind = '' }: { children: ReactNode; kind?: string }) { return <div className={`notice ${kind}`}><Icon name={kind === 'danger' ? 'shield' : 'leaf'} size={18}/><div>{children}</div></div>; }
export const kindLabels: Record<string, string> = { life: '浮生', cultivation: '修行', encounter: '机缘', world: '山河', relationship: '同道', economy: '营生', ending: '结卷' };
export function LogRow({ entry, onStar }: { entry: Log; onStar?: () => void }) {
  return <article className={`log-row ${entry.important ? 'important' : ''}`}><div className="log-age"><strong>{entry.age}</strong><small>岁</small></div><div className="log-content"><div><span className={`log-kind kind-${entry.kind}`}>{kindLabels[entry.kind]}</span><h4>{entry.title}</h4></div><p>{entry.text}</p></div>{onStar && <button className={`icon-button star-button ${entry.starred ? 'starred' : ''}`} onClick={onStar} aria-label={entry.starred ? '取消收藏记录' : '收藏记录'} aria-pressed={Boolean(entry.starred)}><Icon name="star" size={15}/></button>}</article>;
}
export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename.replace(/[<>:"/\\|?*]/g, '_');
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const numberText = (value: number) => Math.round(value).toLocaleString('zh-CN');
