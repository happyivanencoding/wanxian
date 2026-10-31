import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Art.tsx';
import type { Action, Game, Log, Profile } from '../game/types.ts';
export type PageId = 'journey' | 'practice' | 'opportunities' | 'life' | 'world' | 'sect' | 'home' | 'inventory' | 'people' | 'chronicle' | 'archives';
export interface PageProps { game: Game; profile: Profile; act: (action: Action) => void; prefetchAction: (action: Action) => void; navigate: (page: PageId) => void; openBreakthrough: () => void; openEvent: () => void; newLife: () => void; pauseTime: () => void; resumeTime?: () => void }
export function Modal({ title, subtitle, children, onClose, wide = false, className = '' }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const backgrounds = [...document.querySelectorAll<HTMLElement>('.app-main')].filter(element => !element.contains(ref.current));
    const priorInert = backgrounds.map(element => element.inert);
    backgrounds.forEach(element => { element.inert = true; });
    ref.current?.querySelector<HTMLElement>('button:not(:disabled), summary, input:not(:disabled), select:not(:disabled), textarea, [tabindex="0"]')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if ([...document.querySelectorAll('[role="dialog"]')].at(-1) !== ref.current) return;
      if (event.key === 'Escape') { event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const focusable = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, input:not(:disabled), select:not(:disabled), textarea, [tabindex="0"]') || [])]
        .filter(element => element.checkVisibility({ checkVisibilityCSS: true }));
      const active = focusable.indexOf(document.activeElement as HTMLElement);
      const next = active < 0 ? (event.shiftKey ? focusable.length - 1 : 0)
        : (active + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => { backgrounds.forEach((element, index) => { element.inert = priorInert[index]; }); document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', onKey); previous?.focus({ preventScroll: true }); };
  }, []);
  return <div className={`modal-backdrop ${className}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
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
const changeToken = /(宗门贡献|修为|悟性|道心|根基|战技|体魄|声望|丹术|灵石|情谊|资质|寿元)\s*([+＋−-])\s*(\d+(?:\.\d+)?)/g;
function coloredProse(content: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of content.matchAll(changeToken)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(content.slice(last, at));
    parts.push(<span key={at} className={'log-value ' + (match[2] === '+' || match[2] === '＋' ? 'gain' : 'loss')}>{match[0]}</span>);
    last = at + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts;
}
export function LogText({ text }: { text: string }) {
  const marker = '本次变化：', index = text.indexOf(marker);
  if (index < 0) return <>{coloredProse(text)}</>;
  const description = text.slice(0, index).trim();
  const changes = text.slice(index + marker.length).replace(/。$/, '').split('，').filter(Boolean);
  return <>{description && <span>{coloredProse(description)}</span>}
    <span className="log-changes" aria-label="实际变化">{changes.map((change, i) => {
      const gain = /[+＋]\s*\d/.test(change), loss = /[−-]\s*\d/.test(change);
      return <span key={i} className={'log-change ' + (gain ? 'gain' : loss ? 'loss' : 'neutral')}>{change}</span>;
    })}</span></>;
}
export function LogRow({ entry, onStar }: { entry: Log; onStar?: () => void }) {
  return <article className={`log-row ${entry.important ? 'important' : ''}`}><div className="log-age"><strong>{entry.age}</strong><small>岁</small></div><div className="log-content"><div><span className={`log-kind kind-${entry.kind}`}>{kindLabels[entry.kind]}</span><h4>{entry.title}</h4></div><p><LogText text={entry.text}/></p></div>{onStar && <button className={`icon-button star-button ${entry.starred ? 'starred' : ''}`} onClick={onStar} aria-label={entry.starred ? '取消收藏记录' : '收藏记录'} aria-pressed={Boolean(entry.starred)}><Icon name="star" size={15}/></button>}</article>;
}
export function downloadText(text: string, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename.replace(/[<>:"/\\|?*]/g, '_');
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const numberText = (value: number) => Math.round(value).toLocaleString('zh-CN');
