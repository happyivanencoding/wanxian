import type { DirectorRecord } from '../game/types.ts';
import type { DirectorStatus } from '../lib/directorClient.ts';
import './DirectorSettings.css';

export default function DirectorSettings({ enabled, status, last, onChange, onRefresh }: {
  enabled: boolean; status: DirectorStatus; last?: DirectorRecord; onChange: (enabled: boolean) => void; onRefresh: () => void;
}) {
  const label = !enabled ? '本地规则 · 已关闭联网安排' : !status.reachable ? '本地规则 · 当前未连接' : !status.configured ? '本地规则 · 服务尚未配置' : 'StartLux 已配置 · 需要时联网安排';
  return <section className="director-settings" aria-label="机缘与同道安排">
    <label className="check-label"><input type="checkbox" checked={enabled} onChange={event => onChange(event.target.checked)} data-testid="director-enabled"/><span>联网机缘安排<small>StartLux · 根据经历和关系选择回应</small></span></label>
    <p data-testid="director-status">{label}</p>
    <details className="director-privacy"><summary>联网信息</summary><p>开启后会向 StartLux 发送虚构人物经历、地域和关系摘要，不发送完整存档。服务不可用时直接按本地规则结算，重要抉择仍由玩家决定。</p></details>
    <div className="director-status-line"><span data-testid="director-last-source">{last ? `${last.age}岁 · ${last.kind === 'npc' ? '同道回应' : '机缘安排'} · ${last.source === 'startlux' ? 'StartLux' : '本地规则'}` : '尚未发生需要安排的机缘或互动'}</span><button className="text-button" onClick={onRefresh} data-testid="director-refresh">检查连接</button></div>
  </section>;
}
