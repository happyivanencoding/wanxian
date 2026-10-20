import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, BirthConfig, Game, Profile } from './game/types.ts';
import { FOCUSES, REALMS, STAT_NAMES } from './game/data.ts';
import { act as engineAct, autoStep, breakthroughChance, choiceUnavailable, createGame, getEvent, realmName, requiresPlayerChoice } from './game/engine.ts';
import { SAVE_KEY, loadProfile, newProfile, parseProfile, persistProfile, settleProfile } from './game/storage.ts';
import { Icon, Seal } from './components/Art.tsx';
import { Modal, Notice, downloadText, type PageId, type PageProps } from './components/Common.tsx';
import { BirthForm, Landing } from './components/Birth.tsx';
import { BreakthroughInsight } from './components/CultivationInsight.tsx';
import GlobalStatus from './components/GlobalStatus.tsx';
import YearClock, { secondsPerYear, YEARS_PER_LIFE_ESTIMATE } from './components/YearClock.tsx';
import Journey from './pages/Journey.tsx';
import { HomePage, SectPage, WorldPage } from './pages/Places.tsx';
import { InventoryPage, PeoplePage } from './pages/PeopleAndItems.tsx';
import { ArchivesPage, ChroniclePage } from './pages/Chronicle.tsx';

const NAV: { id: PageId; label: string; en: string; icon: string }[] = [
  { id: 'journey', label: '此生', en: 'THIS LIFE', icon: 'mountain' }, { id: 'world', label: '山河', en: 'THE WORLD', icon: 'compass' },
  { id: 'sect', label: '仙门', en: 'THE SECT', icon: 'shield' }, { id: 'home', label: '洞府', en: 'MY SANCTUARY', icon: 'home' },
  { id: 'inventory', label: '行囊', en: 'BELONGINGS', icon: 'bag' }, { id: 'people', label: '同道', en: 'COMPANIONS', icon: 'people' },
  { id: 'chronicle', label: '年谱', en: 'CHRONICLE', icon: 'book' }, { id: 'archives', label: '前尘', en: 'PAST LIVES', icon: 'rebirth' },
];
type ModalName = 'birth' | 'save' | 'help' | 'breakthrough' | 'settings' | 'ending' | null;
function initialProfile() {
  try { return loadProfile(window.localStorage); }
  catch { return { profile: newProfile(), warning: '浏览器存储被禁用，请在游玩后导出存档。', canSave: false }; }
}
export default function App() {
  const [initial] = useState(initialProfile);
  const [profile, setProfile] = useState<Profile>(initial.profile);
  const profileRef = useRef(profile); profileRef.current = profile;
  const [canSave, setCanSave] = useState(initial.canSave);
  const [warning, setWarning] = useState(initial.warning);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [page, setPage] = useState<PageId>('journey');
  const [modal, setModal] = useState<ModalName>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; accept: string; action: () => void } | null>(null);
  const [eventOpen, setEventOpen] = useState(true);
  const [running, setRunning] = useState(Boolean(initial.profile.game?.alive));
  const [automatic, setAutomatic] = useState(false);
  const [usePill, setUsePill] = useState(false);
  const [toast, setToast] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const game = profile.game;
  const replaceProfile = useCallback((next: Profile) => { profileRef.current = next; setProfile(next); }, []);
  const commitGame = useCallback((next: Game, showEnding = true) => {
    const previous = profileRef.current;
    replaceProfile(settleProfile(previous, next));
    if (previous.game?.alive && !next.alive) { setRunning(false); if (showEnding) setModal('ending'); }
  }, [replaceProfile]);
  const apply = useCallback((action: Action) => {
    const current = profileRef.current.game;
    if (!current) return;
    const result = engineAct(current, action);
    if (result.error) { setToast(result.error); if (current.pending) setEventOpen(true); return; }
    commitGame(result.game);
    if (!['advance', 'focus', 'star', 'choose'].includes(action.type)) setToast(result.game.logs.at(-1)?.title || '已完成');
  }, [commitGame]);
  const openModal = useCallback((name: ModalName) => { setRunning(false); setModal(name); if (name === 'save') setImportMessage(''); }, []);
  const navigate = useCallback((next: PageId) => { setRunning(next === 'journey'); setPage(next); window.scrollTo({ top: 0, behavior: 'instant' }); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = profile.settings.theme;
    document.documentElement.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  }, [profile.settings.theme, profile.settings.reducedMotion]);
  useEffect(() => {
    if (!canSave) return;
    try {
      persistProfile(localStorage, profile); setSaveError(''); setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    } catch { setSaveError('自动保存失败，浏览器可能已满或禁止存储。请立即导出存档，当前内存中的进度仍然保留。'); }
  }, [profile, canSave]);
  useEffect(() => {
    const flush = () => { if (canSave) { try { persistProfile(localStorage, profileRef.current); } catch { /* Visible save status already reports failures. */ } } };
    const hide = () => { if (document.hidden) { setRunning(false); flush(); } };
    window.addEventListener('beforeunload', flush); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', hide); };
  }, [canSave]);
  useEffect(() => { if (game?.pending) setEventOpen(true); }, [game?.pending]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  const onYearElapsed = useCallback(() => {
    const p = profileRef.current, g = p.game;
    if (!g?.alive || g.pending) return;
    const result = automatic ? autoStep(g, p.settings.policy) : engineAct(g, { type: 'advance' });
    if (result.error) { setRunning(false); setToast(result.error); return; }
    commitGame(result.game);
    if (result.game.pending) setEventOpen(true);
  }, [automatic, commitGame]);
  useEffect(() => {
    if (!automatic || !running || page !== 'journey' || modal || confirmation || !game?.alive || !game.pending || requiresPlayerChoice(game)) return;
    const result = autoStep(game, profile.settings.policy);
    if (result.error) { setRunning(false); setToast(result.error); return; }
    commitGame(result.game);
  }, [automatic, running, page, modal, confirmation, game, profile.settings.policy, commitGame]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!profileRef.current.game?.alive || page !== 'journey' || modal || confirmation || (eventOpen && profileRef.current.game.pending)) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (e.code === 'Space') { e.preventDefault(); setRunning(v => !v); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [modal, confirmation, eventOpen, page]);
  function changeSetting<K extends keyof Profile['settings']>(key: K, value: Profile['settings'][K]) {
    const current = profileRef.current; replaceProfile({ ...current, settings: { ...current.settings, [key]: value } });
  }
  function newLife() {
    setRunning(false);
    if (game?.alive) setConfirmation({ title: '这一生，暂且结卷？', text: '继续后，当前人生将以「归隐山林」收进前尘录，再开启全新的出生。需要保留可继续游玩的进度时，请先保存至手动存档槽。', accept: '结卷并开启新生', action: () => { const g = profileRef.current.game; if (g?.alive) commitGame(engineAct(g, { type: 'retire' }).game, false); setConfirmation(null); setModal('birth'); } });
    else openModal('birth');
  }
  function create(config: BirthConfig) {
    const next = createGame(config); const p = profileRef.current;
    replaceProfile(settleProfile(p, next)); setCanSave(true); setWarning(''); setPage('journey'); setModal(null); setAutomatic(false); setEventOpen(true); setRunning(true); setToast('这一生，已从青岚开始。');
  }
  function openBreakthrough() { setUsePill(false); openModal('breakthrough'); }
  function saveSlot(index: number) {
    const p = profileRef.current; if (!p.game) return;
    const slots = [...p.slots]; slots[index] = { name: `${p.game.name} · ${p.game.age}岁 · ${realmName(p.game)}`, savedAt: new Date().toISOString(), game: structuredClone(p.game) };
    replaceProfile({ ...p, slots }); setToast(`已保存至第${index + 1}槽`);
  }
  async function importSave(file: File | undefined) {
    if (!file) return;
    try {
      const imported = parseProfile(await file.text());
      setConfirmation({ title: '载入外部存档？', text: '该操作会替换当前人物、前尘录、成就与三个手动槽。建议先导出当前存档留作备份。', accept: '确认导入', action: () => { replaceProfile(imported); setCanSave(true); setWarning(''); setImportMessage('存档已导入。'); setConfirmation(null); setModal(null); setPage('journey'); setRunning(false); setToast('外部存档已载入'); } });
    } catch (error) { setImportMessage(error instanceof Error ? error.message : '无法读取此文件，原存档未变。'); }
    if (fileRef.current) fileRef.current.value = '';
  }
  const pageProps: PageProps | null = game ? { game, profile, act: apply, navigate, openBreakthrough, openEvent: () => { setEventOpen(true); }, newLife } : null;
  const pageViews = pageProps ? { journey: <Journey {...pageProps}/>, world: <WorldPage {...pageProps}/>, sect: <SectPage {...pageProps}/>, home: <HomePage {...pageProps}/>, inventory: <InventoryPage {...pageProps}/>, people: <PeoplePage {...pageProps}/>, chronicle: <ChroniclePage {...pageProps}/>, archives: <ArchivesPage {...pageProps}/> } : null;
  const event = game ? getEvent(game) : undefined;
  const playerChoice = Boolean(game && requiresPlayerChoice(game));
  const activeNav = NAV.find(n => n.id === page)!;
  const canBreak = Boolean(game?.alive && !game.pending && game.age >= 16 && game.actionsLeft > 0 && game.realm < 6 && game.progress >= REALMS[game.realm].need && game.stones >= REALMS[game.realm].cost && game.age >= game.cooldownUntil && game.stats.health >= 25 && (!usePill || game.inventory.breakpill > 0));
  return <div className={`app-shell ${game ? 'in-game' : 'at-home'}`}>
    {game && <aside className="sidebar"><button className="brand" onClick={() => navigate('journey')} aria-label="万仙之一，返回此生"><span className="brand-mark">仙</span><span><strong>万仙之一</strong><small>浮 生 问 道</small></span></button><div className="sidebar-divider"/><nav aria-label="主导航">{NAV.map((item, index) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''} ${index === 6 ? 'nav-separator' : ''}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined} aria-label={item.label} title={item.label} data-testid={`nav-${item.id}`}><Icon name={item.icon}/><span>{item.label}</span><small>{String(index + 1).padStart(2, '0')}</small></button>)}</nav><div className="sidebar-poem">山河不足重，<br/>重在遇知己。</div><div className="sidebar-bottom"><button onClick={() => openModal('help')}><Icon name="help" size={17}/> 初入仙途</button><button onClick={() => openModal('settings')}><Icon name="settings" size={17}/> 偏好设置</button><small>LOCAL EDITION · 1.0</small></div></aside>}
    <div className="app-main"><header className="topbar">{game ? <div className="breadcrumb"><span>浮生问道</span><Icon name="chevron" size={12}/><strong>{activeNav.label}</strong><small>{activeNav.en}</small></div> : <button className="brand" onClick={() => setPage('journey')}><span className="brand-mark">仙</span><span><strong>万仙之一</strong><small>浮 生 问 道</small></span></button>}<div className="topbar-actions"><span className={`save-status ${saveError || !canSave ? 'warning' : ''}`} title={saveError || (savedAt ? '上次保存 ' + savedAt : '自动保存已就绪')}><span className="live-dot"/>{saveError || !canSave ? '请导出备份' : '此生有迹'}</span><button className="icon-button compact-settings" aria-label="偏好设置" title="偏好设置与玩法说明" onClick={() => openModal('settings')} data-testid="open-settings"><Icon name="settings" size={18}/></button><button className="icon-button" aria-label={profile.settings.theme === 'light' ? '切换夜间模式' : '切换纸本模式'} title="切换明暗主题" onClick={() => changeSetting('theme', profile.settings.theme === 'light' ? 'dark' : 'light')} data-testid="theme-toggle"><Icon name={profile.settings.theme === 'light' ? 'moon' : 'sun'}/></button><button className="button save-button" onClick={() => openModal('save')} data-testid="open-save"><Icon name="save" size={17}/><span>存档</span></button></div></header>
    {game && <GlobalStatus game={game}/>}
    {(warning || saveError) && <div className="global-warning" role="alert"><span>{saveError || warning}</span><button onClick={() => openModal('save')}>打开存档</button>{!saveError && canSave && <button onClick={() => setWarning('')} aria-label="关闭提示">×</button>}</div>}
    <main className={game ? 'page-content' : 'landing-content'}>{game ? pageViews?.[page] : <Landing onStart={newLife} onHelp={() => openModal('help')}/>}</main>
    {game && <footer className="time-dock">
      <YearClock active={Boolean(running && page === 'journey' && game.alive && !game.pending && !modal && !confirmation)} age={game.age} lifeId={game.id} durationMinutes={profile.settings.durationMinutes} speed={profile.settings.speed} onYear={onYearElapsed}/>
      <div className="dock-life"><span className="live-dot"/><div><strong>{game.alive ? game.pending ? '抉择未定' : page !== 'journey' ? '处理事务中' : running ? '光阴流转' : '从容片刻' : '此生已结卷'}</strong><small>{game.age}岁 · {game.alive ? FOCUSES.find(f => f.id === game.focus)!.name : game.ending}</small></div></div>
      <div className="time-controls"><button className={`button ${running && page === 'journey' ? 'pause-button' : 'primary'}`} disabled={!game.alive || page !== 'journey'} onClick={() => { if (game.pending) { setEventOpen(true); return; } setRunning(value => !value); }} title={game.pending ? '查看眼前的抉择' : '空格：暂停或继续'} data-testid="play-toggle"><Icon name={game.pending ? 'spark' : running && page === 'journey' ? 'pause' : 'play'} size={16}/>{game.pending ? '抉择' : running && page === 'journey' ? '暂停' : '继续'}</button><select className="speed-select" aria-label="流转速度" value={profile.settings.speed} onChange={e => changeSetting('speed', Number(e.target.value))} data-testid="speed-select">{[1, 2, 4, 8].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></div>
      <label className="auto-toggle" title="托管调整重心、处理普通机缘并尝试冲关；人生转折仍由你决定"><input type="checkbox" checked={automatic} onChange={e => setAutomatic(e.target.checked)} data-testid="auto-toggle"/><span className="switch-track"/><span>托管人生<small>{automatic ? '机缘代选 · 大事亲决' : '重要选择由你决定'}</small></span></label>
    </footer>}
    </div>
    {toast && <div className="toast" role="status"><Icon name="leaf" size={17}/>{toast}<button aria-label="关闭消息" onClick={() => setToast('')}><Icon name="close" size={14}/></button></div>}
    {confirmation ? <Modal title={confirmation.title} subtitle="请确认" onClose={() => setConfirmation(null)}><p className="modal-prose">{confirmation.text}</p><div className="modal-actions"><button className="button" onClick={() => setConfirmation(null)}>暂不更改</button><button className="button primary" onClick={confirmation.action} data-testid="confirm-action">{confirmation.accept}</button></div></Modal> : <>
    {modal === 'birth' && <Modal title="为这一生，落下第一笔" subtitle="一纸命书 · 由此入世" wide onClose={() => setModal(null)}><BirthForm onCreate={create} durationMinutes={profile.settings.durationMinutes} onDurationChange={value => changeSetting('durationMinutes', value)}/></Modal>}
    {modal === 'breakthrough' && game && <Modal title={game.realm === 5 ? '叩问天门' : `破境 · ${REALMS[Math.min(6, game.realm + 1)].name}`} subtitle="欲过此关，先问此心" onClose={() => setModal(null)}><div className="breakthrough-summary"><div className="breakthrough-seal">{REALMS[Math.min(6, game.realm + 1)].short}</div><span>本次成功率</span><strong>{Math.round(breakthroughChance(game, usePill) * 100)}<small>%</small></strong><p>根基、悟性、道心、资质和师承共同决定。</p></div><div className="breakthrough-facts"><span>消耗灵石<strong>{REALMS[game.realm].cost} / 持有 {game.stones}</strong></span><span>修为准备<strong>{game.progress} / {REALMS[game.realm].need}</strong></span><span>剩余行动<strong>{game.actionsLeft} 次</strong></span><span>调息状态<strong>{game.age < game.cooldownUntil ? `需等待至${game.cooldownUntil}岁` : '可以尝试'}</strong></span></div><BreakthroughInsight game={game} usePill={usePill}/><label className="check-label pill-option"><input type="checkbox" checked={usePill} onChange={e => setUsePill(e.target.checked)} disabled={!(game.inventory.breakpill > 0)}/><span>使用凝灵丹<small>成功率 +13 个百分点（单次最高90%），持有 {game.inventory.breakpill || 0} 枚。</small></span></label><Notice>无论成败都会消耗灵石和所选丹药。失败保留72%修为，并损耗15—27体魄、10道心，需要数年调息。体魄过低可能陨落。</Notice><button className="button primary full" disabled={!canBreak} onClick={() => { setModal(null); apply({ type: 'breakthrough', usePill }); }} data-testid="confirm-breakthrough">{canBreak ? '凝神静气，尝试突破' : game.pending ? '先处理眼前的抉择' : '条件尚未齐备'}<Icon name="spark" size={17}/></button></Modal>}
    {modal === 'save' && <Modal title="把这一生，妥善留存" subtitle="存档与迁移" wide onClose={() => setModal(null)}><Notice>每次状态变化都会自动保存，另保留上一份有效备份。手动槽保存完整人物快照；导出文件包含当前人生、前尘录、成就和三个槽。</Notice><div className="save-slots">{profile.slots.map((slot, index) => <section className="save-slot" key={index}><span className="slot-number">0{index + 1}</span><div><h3>{slot?.name || '空白的一页'}</h3><p>{slot ? new Date(slot.savedAt).toLocaleString('zh-CN') : '保存当前人物，可日后从这个时刻继续。'}</p><div className="slot-actions"><button className="button" disabled={!game} onClick={() => { if (slot) setConfirmation({ title: '覆盖这个手动槽？', text: '此槽旧快照将被当前进度替换。自动存档和前尘录不受影响。', accept: '确认覆盖', action: () => { saveSlot(index); setConfirmation(null); } }); else saveSlot(index); }} data-testid={`save-slot-${index}`}>{slot ? '覆盖保存' : '保存至此槽'}</button>{slot && <><button className="button primary" onClick={() => setConfirmation({ title: '回到这个时刻？', text: '当前活动人物将由手动快照替换。已有前尘录和成就仍保留，建议先保存尚未留存的当前进度。', accept: '确认载入', action: () => { const latest = profileRef.current.slots[index]; if (latest) commitGame(structuredClone(latest.game), false); setConfirmation(null); setModal(null); setPage('journey'); setToast('已载入手动存档'); } })} data-testid={`load-slot-${index}`}>载入</button><button className="text-button danger-text" onClick={() => setConfirmation({ title: '清空手动槽？', text: '只删除此槽的快照，不删除当前人物、其他槽或前尘录。', accept: '确认清空', action: () => { const p = profileRef.current; const slots = [...p.slots]; slots[index] = null; replaceProfile({ ...p, slots }); setConfirmation(null); } })}>清空</button></>}</div></div></section>)}</div><div className="save-transfer"><button className="button primary" onClick={() => downloadText(JSON.stringify(profileRef.current, null, 2), `万仙之一-完整存档-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')} data-testid="export-save"><Icon name="download" size={17}/>导出完整存档</button><button className="button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={17}/>导入存档文件</button><input type="file" accept=".json,application/json" hidden ref={fileRef} data-testid="import-save" onChange={e => { void importSave(e.target.files?.[0]); }}/></div>{importMessage && <p className="import-message" role="alert">{importMessage}</p>}{!canSave && <button className="text-button" onClick={() => { try { downloadText(localStorage.getItem(SAVE_KEY) || '{}', '万仙之一-原始存档备份.json', 'application/json'); } catch { setToast('浏览器不允许读取原始存储'); } }}>导出未解析的原始存档</button>}<p className="quiet">浏览器存储不是云备份。清理站点数据、更换浏览器、无痕窗口退出可能丢失记录。建议定期导出；本版没有账号与云同步。</p></Modal>}
    {modal === 'settings' && <Modal title="让光阴按你的方式流转" subtitle="偏好设置" onClose={() => setModal(null)}><button className="button full settings-guide" onClick={() => setModal('help')}><Icon name="help" size={17}/> 查看玩法说明与快捷键</button><label className="form-field">界面主题<select value={profile.settings.theme} onChange={e => changeSetting('theme', e.target.value as 'light' | 'dark')}><option value="light">纸本 · 青绿山水</option><option value="dark">夜读 · 松烟墨色</option></select></label><label className="form-field">预计一局的现实时间<select value={profile.settings.durationMinutes} onChange={e => changeSetting('durationMinutes', Number(e.target.value) as 30 | 60)} data-testid="settings-duration"><option value={30}>预计半小时（1×约{secondsPerYear(30, 1).toFixed(1)}秒／年）</option><option value={60}>预计一小时（1×约{secondsPerYear(60, 1).toFixed(1)}秒／年）</option></select><small>以{YEARS_PER_LIFE_ESTIMATE}年为基准估算；实际寿命、选择与操作停顿会改变总时长，不会到点强制结卷。当前每年约 {secondsPerYear(profile.settings.durationMinutes, profile.settings.speed).toFixed(1)} 秒。</small></label><label className="form-field">托管普通机缘时的倾向<select value={profile.settings.policy} onChange={e => changeSetting('policy', e.target.value as 'safe' | 'bold' | 'random')}><option value="safe">稳健 · 更重视生存与积累</option><option value="bold">进取 · 更愿意争取修为和机缘</option><option value="random">随缘 · 从可选项中随机选择</option></select></label><label className="check-label"><input type="checkbox" checked={profile.settings.reducedMotion} onChange={e => changeSetting('reducedMotion', e.target.checked)}/><span>减少界面动画<small>保留所有玩法与时间控制。</small></span></label><Notice>切换标签页时自动暂停，不计算离线收益；1×、2×、4×、8×缩短每一年的现实等待时间，不改变游戏内的年度结算。只在「此生」页面自动流转，进入其他页默认暂停；进度不会因暂停而跳过。</Notice>{game?.alive && <button className="button danger full" onClick={() => setConfirmation({ title: '把余生留给山林？', text: '这不是陨落，而是主动结束当前求道历程。人物将以「归隐山林」结卷，无法继续推进；手动保存的旧快照仍可载入。', accept: '归隐并结卷', action: () => { setConfirmation(null); setModal(null); apply({ type: 'retire' }); } })} data-testid="retire">归隐山林 · 结束当前历程</button>}</Modal>}
    {modal === 'help' && <Modal title="初入仙途" subtitle="不必懂得所有规则，先走出一步" wide onClose={() => setModal(null)}><div className="help-grid"><section><span>01</span><h3>从一个起点开始</h3><p>出生决定资质、家资与早期属性，但不预写结局。默认从十六岁启程，童年选择已记入年谱，也可从零岁观看。</p></section><section><span>02</span><h3>把一年交给一种重心</h3><p>闭关涨修为，参悟补根基，营生积灵石，静养恢复身心。选定后持续执行，岁序进度满时结算一年。可随时换重心，遇到抉择时暂停。</p></section><section><span>03</span><h3>圆满之后，尝试破境</h3><p>修为满、灵石足、体魄不少于25，才能冲关。根基、悟性和道心影响概率。失败不会退境界，但伤势与寿元压力是真实的。</p></section><section><span>04</span><h3>不止闭关一件事</h3><p>每年有三次主动行动，用于坊市、炼丹、宗门、建造、远行、拜访或冲关。每位同道每年只能拜访一次，行动次数随下一年自然恢复，不提供直接跳年的按钮。</p></section><section><span>05</span><h3>世界也在向前</h3><p>日常经历会自动记下，机缘随经历展开。重要选择决定你此后牵挂什么、与谁同行；旧日相识与承诺，也会在多年后带来回应。</p></section><section><span>06</span><h3>轮回不等于数值堆叠</h3><p>飞升、寿终、陨落或归隐都会留下传记。新的人生重新生成，只继承成就与记录，不永久加点。活着的方式不止一种。</p></section></div><div className="help-facts"><span>前事会有回响</span><span>7 种年度重心</span><span>5 域 · 3 宗门</span><span>四位同代人物</span></div><Notice>「托管人生」会调整重心、处理普通机缘并尝试冲关；决定命途的人生转折会停下来，等你亲自选择。选择后会继续托管，经营与探索仍可由你安排。预计一局半小时或一小时，以{YEARS_PER_LIFE_ESTIMATE}年作为估算基准：1×每年约{secondsPerYear(30, 1).toFixed(1)}秒或{secondsPerYear(60, 1).toFixed(1)}秒，8×则相应加速。实际寿命、选择与操作停顿会改变总时长，不会到点强制结卷。进度满才推进一年；重要事件暂停等待抉择。空格暂停/继续，离开「此生」页面自动暂停。</Notice><p className="quiet">本作原创实现，只借鉴概率人生模拟这一类型。所有地理、时代、概率与人物均为虚构游戏设定；无联网生成、无付费功能、无数据上传。</p></Modal>}
    {modal === 'ending' && game && <Modal title={game.ending || '此生结卷'} subtitle={`${game.name} · ${game.age}岁 · ${REALMS[game.realm].name}`} onClose={() => setModal(null)}><div className="ending-modal"><Seal>浮生<br/>一卷</Seal><p>{game.endingText}</p><div className="ending-stats"><span><strong>{game.age}</strong>岁结卷</span><span><strong>{game.choices}</strong>次抉择</span><span><strong>{game.successes}</strong>次破境</span></div><button className="button primary full" onClick={() => { setModal(null); navigate('archives'); }}>翻开这一生的传记 <Icon name="book" size={18}/></button><button className="text-button" onClick={newLife}>再入轮回，重新启程 <Icon name="rebirth" size={16}/></button></div></Modal>}
    {!modal && event && game && eventOpen && (!(automatic && running) || playerChoice) && <Modal title={event.title} subtitle={`${game.age}岁 · ${game.yearName}${2300 + game.age}年 · ${playerChoice ? '人生转折' : '路上机缘'}`} onClose={() => setEventOpen(false)}><p className="event-story">{event.text}</p>{event.cause && <div className="event-cause" data-testid="event-cause"><span>此事缘起</span><p>{event.cause}</p></div>}<div className="event-choices">{event.choices.map((choice, index) => { const blocked = choiceUnavailable(game, choice); return <button key={index} className="event-choice" onClick={() => apply({ type: 'choose', index })} disabled={Boolean(blocked)} data-testid={`event-choice-${index}`}><span className="choice-number">{['壹', '贰', '叁', '肆'][index]}</span><span><strong>{choice.label}</strong><small>{choice.hint}</small>{choice.requiresStat && <em>{STAT_NAMES[choice.requiresStat[0]]} {choice.requiresStat[1]} / 当前 {Math.round(game.stats[choice.requiresStat[0]])}</em>}{blocked && <em className="danger-text">{blocked}</em>}</span><Icon name="chevron" size={16}/></button>; })}</div><p className="event-footnote"><Icon name="clock" size={15}/>{playerChoice ? '这一步由你决定，托管也会等候。' : '在你决定之前，时光会停在这里。'}关闭弹窗可以查看人物状态。</p></Modal>}
    </>}
  </div>;
}
