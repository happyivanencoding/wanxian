import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, BirthConfig, DirectedAction, Game, Profile } from './game/types.ts';
import { FOCUSES, REALMS, SECTS, STAT_NAMES } from './game/data.ts';
import { act as engineAct, breakthroughChance, choiceUnavailable, commitDirectedAction, createGame, currentRegion, getEvent, planDirectedAction, realmName, requiresPlayerChoice } from './game/engine.ts';
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
import Opportunities from './pages/Opportunities.tsx';
import Life from './pages/Life.tsx';
import { expeditionView } from './game/expeditions.ts';
import { preparationView, progressionBenefits } from './game/progression.ts';
import { BreakthroughPreparation } from './components/PreparationPanel.tsx';
import { createDirectorClient, type DirectorStatus } from './lib/directorClient.ts';
import { createDirectorPrefetch } from './lib/directorPrefetch.ts';
import DirectorSettings from './components/DirectorSettings.tsx';

const NAV: { id: PageId; label: string; en: string; icon: string }[] = [
  { id: 'journey', label: '人生', en: 'THIS MOMENT', icon: 'mountain' }, { id: 'opportunities', label: '机缘', en: 'OPPORTUNITIES', icon: 'spark' }, { id: 'world', label: '山河', en: 'THE WORLD', icon: 'compass' },
  { id: 'sect', label: '仙门', en: 'THE SECT', icon: 'shield' }, { id: 'home', label: '洞府', en: 'MY SANCTUARY', icon: 'home' },
  { id: 'inventory', label: '行囊', en: 'BELONGINGS', icon: 'bag' }, { id: 'people', label: '同道', en: 'COMPANIONS', icon: 'people' },
  { id: 'life', label: '此生', en: 'THIS LIFE', icon: 'leaf' }, { id: 'chronicle', label: '年谱', en: 'CHRONICLE', icon: 'book' }, { id: 'archives', label: '前尘', en: 'PAST LIVES', icon: 'rebirth' },
];
const MANAGEMENT_PAGES: PageId[] = ['inventory', 'home', 'sect', 'world'];
const LIFE_PAGES: PageId[] = ['life', 'people', 'chronicle', 'archives'];
type ModalName = 'birth' | 'save' | 'help' | 'breakthrough' | 'settings' | 'ending' | 'attainment' | null;
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
  const [page, setPage] = useState<PageId>(initial.profile.game && expeditionView(initial.profile.game).active ? 'opportunities' : 'journey');
  const [modal, setModal] = useState<ModalName>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; text: string; accept: string; action: () => void } | null>(null);
  const [eventOpen, setEventOpen] = useState(true);
  const [running, setRunning] = useState(Boolean(initial.profile.game?.alive));
  const [automatic, setAutomatic] = useState(false);
  const [usePill, setUsePill] = useState(false);
  const [toast, setToast] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [newAttainments, setNewAttainments] = useState<{ id: string; name: string; description: string }[]>([]);
  const [directorStatus, setDirectorStatus] = useState<DirectorStatus>({ configured: false, reachable: false });
  const directorClient = useRef(createDirectorClient(undefined, undefined, undefined, !__STATIC_HOSTING__));
  const directorPrefetch = useRef(createDirectorPrefetch(directorClient.current));
  const fileRef = useRef<HTMLInputElement>(null);
  const game = profile.game;
  const cancelDirector = useCallback(() => { directorPrefetch.current.cancel(); }, []);
  const replaceProfile = useCallback((next: Profile) => { cancelDirector(); profileRef.current = next; setProfile(next); }, [cancelDirector]);
  const commitGame = useCallback((next: Game, showEnding = true) => {
    const previous = profileRef.current;
    replaceProfile(settleProfile(previous, next));
    if (previous.game?.alive && !next.alive) { setRunning(false); if (showEnding) setModal('ending'); }
    else if (showEnding && previous.game?.id === next.id) {
      const owned = new Set(preparationView(previous.game).attainments.map(item => item.id));
      const learned = preparationView(next).attainments.filter(item => !owned.has(item.id));
      if (learned.length) { setNewAttainments(learned); setRunning(false); setModal('attainment'); }
    }
  }, [replaceProfile]);
  const prepareAction = useCallback((action: DirectedAction) => {
    const current = profileRef.current.game;
    if (!current || !current.alive || profileRef.current.settings.directorEnabled === false || document.hidden) { cancelDirector(); return; }
    const plan = planDirectedAction(current, action);
    if (!plan.result.error && plan.request) directorPrefetch.current.prepare(current, JSON.stringify(action), plan.request);
    else cancelDirector();
  }, [cancelDirector]);
  const runAction = useCallback((action: DirectedAction) => {
    const current = profileRef.current.game;
    if (!current) return;
    const decision = directorPrefetch.current.take(current, JSON.stringify(action));
    const plan = planDirectedAction(current, action);
    const result = !plan.result.error && plan.request && decision && profileRef.current.settings.directorEnabled !== false
      ? commitDirectedAction(current, action, decision) : plan.result;
    if (result.error) { if (action.type === 'advance' || action.type === 'auto') setRunning(false); setToast(result.error); if (current.pending) setEventOpen(true); return; }
    commitGame(result.game);
    if (result.game.pending) setEventOpen(true);
    if (!['advance', 'auto', 'focus', 'direction', 'star', 'choose', 'prepare'].includes(action.type) && !action.type.startsWith('expedition-')) setToast(result.game.logs.at(-1)?.title || '已完成');
  }, [commitGame]);
  const apply = useCallback((action: Action) => { runAction(action); }, [runAction]);
  const prefetchAction = useCallback((action: Action) => {
    if (page === 'people' && !modal && !confirmation && action.type === 'npc' && action.interaction !== 'bond') prepareAction(action);
  }, [page, modal, confirmation, prepareAction]);
  const refreshDirector = useCallback(() => { void directorClient.current.getStatus(true).then(setDirectorStatus); }, []);
  const openModal = useCallback((name: ModalName) => { cancelDirector(); setRunning(false); setModal(name); if (name === 'save') setImportMessage(''); if (name === 'settings') refreshDirector(); }, [cancelDirector, refreshDirector]);
  const navigate = useCallback((next: PageId) => { cancelDirector(); setRunning(next === 'journey'); setPage(next); window.scrollTo({ top: 0, behavior: 'instant' }); }, [cancelDirector]);
  useEffect(() => {
    refreshDirector();
    window.addEventListener('online', refreshDirector);
    const offline = () => { cancelDirector(); setDirectorStatus({ configured: false, reachable: false }); };
    window.addEventListener('offline', offline);
    return () => { cancelDirector(); window.removeEventListener('online', refreshDirector); window.removeEventListener('offline', offline); };
  }, [refreshDirector, cancelDirector]);
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
    const hide = () => { if (document.hidden) { cancelDirector(); setRunning(false); flush(); } };
    window.addEventListener('beforeunload', flush); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', hide); };
  }, [canSave, cancelDirector]);
  useEffect(() => { if (game?.pending) setEventOpen(true); }, [game?.pending]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  const onYearElapsed = useCallback(() => {
    const p = profileRef.current, g = p.game;
    if (!g?.alive || g.pending || expeditionView(g).active) return;
    runAction(automatic ? { type: 'auto', policy: p.settings.policy } : { type: 'advance' });
  }, [automatic, runAction]);
  useEffect(() => {
    if (!running || page !== 'journey' || modal || confirmation || !game?.alive || game.pending || expeditionView(game).active || profile.settings.directorEnabled === false || document.hidden) return;
    prepareAction(automatic ? { type: 'auto', policy: profile.settings.policy } : { type: 'advance' });
    return cancelDirector;
  }, [game, automatic, running, page, modal, confirmation, profile.settings, prepareAction, cancelDirector]);
  useEffect(() => {
    if (!automatic || !running || page !== 'journey' || modal || confirmation || !game?.alive || !game.pending || requiresPlayerChoice(game) || expeditionView(game).active) return;
    runAction({ type: 'auto', policy: profile.settings.policy });
  }, [automatic, running, page, modal, confirmation, game, profile.settings.policy, runAction]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!profileRef.current.game?.alive || page !== 'journey' || modal || confirmation || (eventOpen && profileRef.current.game.pending)) return;
      if ((e.target as HTMLElement)?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (e.code === 'Space') { e.preventDefault(); cancelDirector(); setRunning(v => !v); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [modal, confirmation, eventOpen, page, cancelDirector]);
  function changeSetting<K extends keyof Profile['settings']>(key: K, value: Profile['settings'][K]) {
    const current = profileRef.current; replaceProfile({ ...current, settings: { ...current.settings, [key]: value } });
  }
  function newLife() {
    cancelDirector();
    setRunning(false);
    if (game?.alive) setConfirmation({ title: '这一生，暂且结卷？', text: '继续后，当前人生将以「归隐山林」收进前尘录，再开启全新的出生。需要保留可继续游玩的进度时，请先保存至手动存档槽。', accept: '结卷并开启新生', action: () => { const g = profileRef.current.game; if (g?.alive) commitGame(engineAct(g, { type: 'retire' }).game, false); setConfirmation(null); setModal('birth'); } });
    else openModal('birth');
  }
  function create(config: BirthConfig) {
    const next = createGame(config); const p = profileRef.current;
    replaceProfile(settleProfile(p, next)); setCanSave(true); setWarning(''); setPage('journey'); setModal(null); setAutomatic(false); setEventOpen(true); setRunning(true); setToast(`这一生，已从${currentRegion(next).name}开始。`);
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
  const pageProps: PageProps | null = game ? { game, profile, act: apply, prefetchAction, navigate, openBreakthrough, openEvent: () => { setEventOpen(true); }, newLife, pauseTime: () => { cancelDirector(); setRunning(false); } } : null;
  const pageViews = pageProps ? { journey: <Journey {...pageProps}/>, opportunities: <Opportunities {...pageProps}/>, life: <Life {...pageProps}/>, world: <WorldPage {...pageProps}/>, sect: <SectPage {...pageProps}/>, home: <HomePage {...pageProps}/>, inventory: <InventoryPage {...pageProps}/>, people: <PeoplePage {...pageProps}/>, chronicle: <ChroniclePage {...pageProps}/>, archives: <ArchivesPage {...pageProps}/> } : null;
  const event = game ? getEvent(game) : undefined;
  const playerChoice = Boolean(game && requiresPlayerChoice(game));
  const expedition = game ? expeditionView(game).active : undefined;
  const mobileGroup = MANAGEMENT_PAGES.includes(page) ? 'management' : LIFE_PAGES.includes(page) ? 'life' : page;
  const mobileSubpages = mobileGroup === 'management' ? MANAGEMENT_PAGES : mobileGroup === 'life' ? LIFE_PAGES : [];
  const activeNav = NAV.find(n => n.id === page)!;
  const canBreak = Boolean(game?.alive && !game.pending && !expedition && game.age >= 16 && game.actionsLeft > 0 && game.realm < 6 && game.progress >= REALMS[game.realm].need && game.stones >= REALMS[game.realm].cost && game.age >= game.cooldownUntil && game.stats.health >= 25 && (!usePill || game.inventory.breakpill > 0));
  return <div className={`app-shell ${game ? 'in-game' : 'at-home'}`}>
    {game && <aside className="sidebar"><button className="brand" onClick={() => navigate('journey')} aria-label="万仙之一，返回人生"><span className="brand-mark">仙</span><span><strong>万仙之一</strong><small>浮 生 问 道</small></span></button><div className="sidebar-divider"/><nav aria-label="主导航">{NAV.map((item, index) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''} ${index === 6 ? 'nav-separator' : ''}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? 'page' : undefined} aria-label={item.label} title={item.label} data-testid={`nav-${item.id}`}><Icon name={item.icon}/><span>{item.label}</span><small>{String(index + 1).padStart(2, '0')}</small></button>)}</nav><div className="sidebar-poem">山河不足重，<br/>重在遇知己。</div><div className="sidebar-bottom"><button onClick={() => openModal('help')}><Icon name="help" size={17}/> 初入仙途</button><button onClick={() => openModal('settings')}><Icon name="settings" size={17}/> 偏好设置</button><small>万仙之一 · 浮生</small></div></aside>}
    <div className="app-main"><header className="topbar">{game ? <div className="breadcrumb"><span>浮生问道</span><Icon name="chevron" size={12}/><strong>{activeNav.label}</strong><small>{activeNav.en}</small></div> : <button className="brand" onClick={() => setPage('journey')}><span className="brand-mark">仙</span><span><strong>万仙之一</strong><small>浮 生 问 道</small></span></button>}<div className="topbar-actions"><span className={`save-status ${saveError || !canSave ? 'warning' : ''}`} title={saveError || (savedAt ? '上次保存 ' + savedAt : '自动保存已就绪')}><span className="live-dot"/>{saveError || !canSave ? '请导出备份' : '此生有迹'}</span><button className="icon-button compact-settings" aria-label="偏好设置" title="偏好设置与玩法说明" onClick={() => openModal('settings')} data-testid="open-settings"><Icon name="settings" size={18}/></button><button className="icon-button" aria-label={profile.settings.theme === 'light' ? '切换夜间模式' : '切换青岚配色'} title="切换明暗主题" onClick={() => changeSetting('theme', profile.settings.theme === 'light' ? 'dark' : 'light')} data-testid="theme-toggle"><Icon name={profile.settings.theme === 'light' ? 'moon' : 'sun'}/></button><button className="button save-button" onClick={() => openModal('save')} data-testid="open-save"><Icon name="save" size={17}/><span>存档</span></button></div></header>
    {game && <GlobalStatus game={game}/>}
    {game && mobileSubpages.length > 0 && <nav className="mobile-subnav" aria-label={mobileGroup === 'management' ? '经营事务' : '此生与同道'}>{mobileSubpages.map(id => <button key={id} aria-current={page === id ? 'page' : undefined} className={page === id ? 'active' : ''} onClick={() => navigate(id)} data-testid={`subnav-${id}`}>{NAV.find(item => item.id === id)!.label}</button>)}</nav>}
    {expedition && page !== 'opportunities' && <button className="expedition-resume" onClick={() => navigate('opportunities')} data-testid="expedition-resume"><Icon name="compass" size={19}/><span>你还在「{expedition.title}」之中 · 返回继续</span><Icon name="arrow" size={17}/></button>}
    {(warning || saveError) && <div className="global-warning" role="alert"><span>{saveError || warning}</span><button onClick={() => openModal('save')}>打开存档</button>{!saveError && canSave && <button onClick={() => setWarning('')} aria-label="关闭提示">×</button>}</div>}
    <main className={game ? `page-content ${page === 'journey' ? 'is-journey' : 'is-secondary'}` : 'landing-content'}>{game ? pageViews?.[page] : <Landing onStart={newLife} onHelp={() => openModal('help')}/>}</main>
    {game && <footer className={`time-dock ${expedition ? 'expedition-time-dock' : ''}`}>
      {expedition && <button className="expedition-time-note" onClick={() => navigate('opportunities')}><Icon name="clock" size={16}/><span>此刻身在机缘中 · 光阴暂驻</span><Icon name="arrow" size={15}/></button>}
      <YearClock active={Boolean(running && page === 'journey' && game.alive && !game.pending && !expedition && !modal && !confirmation)} age={game.age} lifeId={game.id} durationMinutes={profile.settings.durationMinutes} speed={profile.settings.speed} onYear={onYearElapsed}/>
      <div className="dock-life"><span className="live-dot"/><div><strong>{game.alive ? expedition ? '身在机缘中' : game.pending ? '抉择未定' : page !== 'journey' ? '处理事务中' : running ? '光阴流转' : '从容片刻' : '此生已结卷'}</strong><small>{game.age}岁 · {game.alive ? FOCUSES.find(f => f.id === game.focus)!.name : game.ending}</small></div></div>
      <div className="time-controls"><button className={`button ${running && page === 'journey' ? 'pause-button' : 'primary'}`} disabled={!game.alive || (page !== 'journey' && !expedition)} onClick={() => { if (expedition) { navigate('opportunities'); return; } if (game.pending) { setEventOpen(true); return; } cancelDirector(); setRunning(value => !value); }} title={expedition ? '回到当前机缘' : game.pending ? '查看眼前的抉择' : '空格：暂停或继续'} data-testid="play-toggle"><Icon name={expedition ? 'compass' : game.pending ? 'spark' : running && page === 'journey' ? 'pause' : 'play'} size={16}/>{expedition ? '回到机缘' : game.pending ? '抉择' : running && page === 'journey' ? '暂停' : '继续'}</button><select className="speed-select" aria-label="流转速度" value={profile.settings.speed} onChange={e => changeSetting('speed', Number(e.target.value))} data-testid="speed-select">{[1, 2, 4, 8].map(speed => <option key={speed} value={speed}>{speed}×</option>)}</select></div>
      <label className="auto-toggle" title="托管调整重心、处理普通机缘并尝试冲关；人生转折仍由你决定"><input type="checkbox" checked={automatic} disabled={Boolean(expedition)} onChange={e => { cancelDirector(); setAutomatic(e.target.checked); }} data-testid="auto-toggle"/><span className="switch-track"/><span>{game.direction ? '代选小事' : '托管修行'}<small>{automatic ? '机缘代选 · 大事亲决' : '重要选择由你决定'}</small></span></label>
    </footer>}
    </div>
    {game && <nav className="mobile-bottom-nav" aria-label="主要功能">{([
      { id: 'journey', page: 'journey', label: '人生', icon: 'mountain' },
      { id: 'opportunities', page: 'opportunities', label: '机缘', icon: 'spark' },
      { id: 'management', page: 'inventory', label: '经营', icon: 'home' },
      { id: 'life', page: 'life', label: '此生', icon: 'book' },
    ] as const).map(item => <button key={item.id} className={mobileGroup === item.id ? 'active' : ''} aria-current={mobileGroup === item.id ? 'page' : undefined} onClick={() => navigate(item.page)} data-testid={`mobile-nav-${item.id}`}><Icon name={item.icon} size={22}/><span>{item.label}</span>{item.id === 'opportunities' && (expedition || game.pending) && <i/>}</button>)}</nav>}
    {toast && <div className="toast" role="status"><Icon name="leaf" size={17}/>{toast}<button aria-label="关闭消息" onClick={() => setToast('')}><Icon name="close" size={14}/></button></div>}
    {confirmation ? <Modal title={confirmation.title} subtitle="请确认" onClose={() => setConfirmation(null)}><p className="modal-prose">{confirmation.text}</p><div className="modal-actions"><button className="button" onClick={() => setConfirmation(null)}>暂不更改</button><button className="button primary" onClick={confirmation.action} data-testid="confirm-action">{confirmation.accept}</button></div></Modal> : <>
    {modal === 'birth' && <Modal title="开始一段人生" wide onClose={() => setModal(null)}><BirthForm onCreate={create} durationMinutes={profile.settings.durationMinutes} onDurationChange={value => changeSetting('durationMinutes', value)}/></Modal>}
    {modal === 'breakthrough' && game && <Modal title={game.realm === 5 ? '叩问天门' : `破境 · ${REALMS[Math.min(6, game.realm + 1)].name}`} subtitle="欲过此关，先问此心" onClose={() => setModal(null)}><div className="breakthrough-summary"><div className="breakthrough-seal">{REALMS[Math.min(6, game.realm + 1)].short}</div><span>本次成功率</span><strong>{Math.round(breakthroughChance(game, usePill) * 100)}<small>%</small></strong></div><div className="breakthrough-facts"><span>消耗灵石<strong>{REALMS[game.realm].cost} / 持有 {game.stones}</strong></span><span>修为准备<strong>{game.progress} / {REALMS[game.realm].need}</strong></span><span>剩余行动<strong>{game.actionsLeft} 次</strong></span><span>调息状态<strong>{game.age < game.cooldownUntil ? `需等待至${game.cooldownUntil}岁` : '可以尝试'}</strong></span></div><BreakthroughPreparation game={game}/><BreakthroughInsight game={game} usePill={usePill}/><label className="check-label pill-option"><input type="checkbox" checked={usePill} onChange={e => setUsePill(e.target.checked)} disabled={!(game.inventory.breakpill > 0)}/><span>使用凝灵丹<small>成功率 +{((0.13 + progressionBenefits(game).pillChance) * 100).toFixed(1)} 个百分点（单次最高90%），持有 {game.inventory.breakpill || 0} 枚。</small></span></label><Notice>无论成败都会消耗灵石和所选丹药。失败会损耗修为、体魄与道心，并需调息。已学本领会影响实际损失与调息时间；体魄过低可能陨落。</Notice><button className="button primary full" disabled={!canBreak} onClick={() => { setModal(null); apply({ type: 'breakthrough', usePill }); }} data-testid="confirm-breakthrough">{canBreak ? '凝神静气，尝试突破' : game.pending ? '先处理眼前的抉择' : '条件尚未齐备'}<Icon name="spark" size={17}/></button></Modal>}
    {modal === 'save' && <Modal title="把这一生，妥善留存" subtitle="存档与迁移" wide onClose={() => setModal(null)}><Notice>每次状态变化都会自动保存，另保留上一份有效备份。手动槽保存完整人物快照；导出文件包含当前人生、前尘录、成就和三个槽。</Notice><div className="save-slots">{profile.slots.map((slot, index) => <section className="save-slot" key={index}><span className="slot-number">0{index + 1}</span><div><h3>{slot?.name || '空白的一页'}</h3><p>{slot ? new Date(slot.savedAt).toLocaleString('zh-CN') : '保存当前人物，可日后从这个时刻继续。'}</p><div className="slot-actions"><button className="button" disabled={!game} onClick={() => { if (slot) setConfirmation({ title: '覆盖这个手动槽？', text: '此槽旧快照将被当前进度替换。自动存档和前尘录不受影响。', accept: '确认覆盖', action: () => { saveSlot(index); setConfirmation(null); } }); else saveSlot(index); }} data-testid={`save-slot-${index}`}>{slot ? '覆盖保存' : '保存至此槽'}</button>{slot && <><button className="button primary" onClick={() => setConfirmation({ title: '回到这个时刻？', text: '当前活动人物将由手动快照替换。已有前尘录和成就仍保留，建议先保存尚未留存的当前进度。', accept: '确认载入', action: () => { const latest = profileRef.current.slots[index]; if (latest) commitGame(structuredClone(latest.game), false); setConfirmation(null); setModal(null); setPage('journey'); setToast('已载入手动存档'); } })} data-testid={`load-slot-${index}`}>载入</button><button className="text-button danger-text" onClick={() => setConfirmation({ title: '清空手动槽？', text: '只删除此槽的快照，不删除当前人物、其他槽或前尘录。', accept: '确认清空', action: () => { const p = profileRef.current; const slots = [...p.slots]; slots[index] = null; replaceProfile({ ...p, slots }); setConfirmation(null); } })}>清空</button></>}</div></div></section>)}</div><div className="save-transfer"><button className="button primary" onClick={() => downloadText(JSON.stringify(profileRef.current, null, 2), `万仙之一-完整存档-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')} data-testid="export-save"><Icon name="download" size={17}/>导出完整存档</button><button className="button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={17}/>导入存档文件</button><input type="file" accept=".json,application/json" hidden ref={fileRef} data-testid="import-save" onChange={e => { void importSave(e.target.files?.[0]); }}/></div>{importMessage && <p className="import-message" role="alert">{importMessage}</p>}{!canSave && <button className="text-button" onClick={() => { try { downloadText(localStorage.getItem(SAVE_KEY) || '{}', '万仙之一-原始存档备份.json', 'application/json'); } catch { setToast('浏览器不允许读取原始存储'); } }}>导出未解析的原始存档</button>}<p className="quiet">浏览器存储不是云备份。清理站点数据、更换浏览器、无痕窗口退出可能丢失记录。建议定期导出；本版没有账号与云同步。</p></Modal>}
    {modal === 'settings' && <Modal title="让光阴按你的方式流转" subtitle="偏好设置" onClose={() => setModal(null)}><button className="button full settings-guide" onClick={() => setModal('help')}><Icon name="help" size={17}/> 查看玩法说明与快捷键</button><label className="form-field">界面主题<select value={profile.settings.theme} onChange={e => changeSetting('theme', e.target.value as 'light' | 'dark')}><option value="light">青岚 · 玉青像素</option><option value="dark">月夜 · 墨蓝像素</option></select></label><label className="form-field">预计一局的现实时间<select value={profile.settings.durationMinutes} onChange={e => changeSetting('durationMinutes', Number(e.target.value) as 30 | 60)} data-testid="settings-duration"><option value={30}>预计半小时（1×约{secondsPerYear(30, 1).toFixed(1)}秒／年）</option><option value={60}>预计一小时（1×约{secondsPerYear(60, 1).toFixed(1)}秒／年）</option></select><small>当前约 {secondsPerYear(profile.settings.durationMinutes, profile.settings.speed).toFixed(1)} 秒／年，按{YEARS_PER_LIFE_ESTIMATE}年估算。</small></label><DirectorSettings available={!__STATIC_HOSTING__} enabled={profile.settings.directorEnabled !== false} status={directorStatus} last={game?.directorRecords?.at(-1)} onChange={enabled => changeSetting('directorEnabled', enabled)} onRefresh={refreshDirector}/><label className="form-field">托管普通机缘时的倾向<select value={profile.settings.policy} onChange={e => changeSetting('policy', e.target.value as 'safe' | 'bold' | 'random')}><option value="safe">稳健 · 更重视生存与积累</option><option value="bold">进取 · 更愿意争取修为和机缘</option><option value="random">随缘 · 从可选项中随机选择</option></select></label><label className="check-label"><input type="checkbox" checked={profile.settings.reducedMotion} onChange={e => changeSetting('reducedMotion', e.target.checked)}/><span>减少界面动画</span></label>{game?.alive && <button className="button danger full" onClick={() => setConfirmation({ title: '把余生留给山林？', text: '这不是陨落，而是主动结束当前求道历程。人物将以「归隐山林」结卷，无法继续推进；手动保存的旧快照仍可载入。', accept: '归隐并结卷', action: () => { setConfirmation(null); setModal(null); apply({ type: 'retire' }); } })} data-testid="retire">归隐山林 · 结束当前历程</button>}</Modal>}
    {modal === 'help' && <Modal title="初入仙途" wide onClose={() => setModal(null)}><div className="help-grid"><section><span>01</span><h3>先过这一生</h3><p>默认从出生开始，家世与地域随缘。姓名可以留空；详细开局设置可展开。人生页展示眼前发生的事、同世人物和最近的往事。</p></section><section><span>02</span><h3>选择生活的方向</h3><p>问道、远游、相守、自处会持续安排日常，兼顾生计与休养，并在条件满足时按真实概率尝试普通突破。也可展开重心，改为自己安排每年修行。</p></section><section><span>03</span><h3>重要的事亲自决定</h3><p>人物会成长、离世或飞升，后续会记得原来的相识与约定。机缘、传承和天门前的选择会暂停时间；开启「代选小事」也不会代答这些转折。</p></section><section><span>04</span><h3>细务仍然可做</h3><p>修行与事务中可查看突破准备、功法和行囊。机缘、宗门、炼丹、远行与洞府仍按原规则开放，每年三次主动行动；不必把次数全部用完。</p></section></div><Notice>在「人生」页时间自然流转，离开、隐藏标签或打开管理弹窗会暂停。空格暂停或继续，支持1×、2×、4×、8×；不结算离线时间。半小时或一小时按{YEARS_PER_LIFE_ESTIMATE}年估算，实际用时取决于寿命、阅读和选择，不会到点强制结卷。</Notice><p className="quiet">存档保存在当前浏览器，不自动跨设备同步。换电脑、手机或网址前，可在「存档」导出JSON，再到新入口导入。游戏中的人物、地理与概率均为虚构；不是现实人口统计。</p></Modal>}
    {modal === 'attainment' && <Modal title="这一世，多了一门本领" subtitle="已经练成 · 随此生保留" onClose={() => setModal(null)}><div className="attainment-reveal" data-testid="attainment-reveal">{newAttainments.map(item => <article key={item.id}><Icon name="spark" size={30}/><h3>{item.name}</h3><p>{item.description}</p></article>)}</div><button className="button primary full" onClick={() => { setModal(null); if (page === 'journey') setRunning(true); }}>记下此刻，继续前行 <Icon name="arrow" size={17}/></button></Modal>}
    {modal === 'ending'  && game && <Modal title={game.ending || '此生结卷'} subtitle={`${game.name} · ${game.age}岁 · ${REALMS[game.realm].name}`} onClose={() => setModal(null)}><div className="ending-modal"><Seal>浮生<br/>一卷</Seal><p>{game.endingText}</p><div className="ending-stats"><span><strong>{game.age}</strong>岁结卷</span><span><strong>{game.choices}</strong>次抉择</span><span><strong>{game.successes}</strong>次破境</span></div><button className="button primary full" onClick={() => { setModal(null); navigate('archives'); }}>翻开这一生的传记 <Icon name="book" size={18}/></button><button className="text-button" onClick={newLife}>再入轮回，重新启程 <Icon name="rebirth" size={16}/></button></div></Modal>}
    {!modal && !expedition && event && game && eventOpen && (!(automatic && running) || playerChoice) && <Modal title={event.title} subtitle={`${game.age}岁 · ${game.yearName}${2300 + game.age}年 · ${playerChoice ? '人生转折' : '路上机缘'}`} onClose={() => setEventOpen(false)}><p className="event-story">{event.text}</p>{event.cause && <div className="event-cause" data-testid="event-cause"><span>此事缘起</span><p>{event.cause}</p></div>}<div className="event-choices">{event.choices.map((choice, index) => { const blocked = choiceUnavailable(game, choice); return <button key={index} className="event-choice" onClick={() => apply({ type: 'choose', index })} disabled={Boolean(blocked)} data-testid={`event-choice-${index}`}><span className="choice-number">{['壹', '贰', '叁', '肆'][index]}</span><span><strong>{choice.label}</strong>{choice.hint && <small className="choice-mechanics">{choice.hint}</small>}{choice.requiresStat && <em>{STAT_NAMES[choice.requiresStat[0]]} {choice.requiresStat[1]} / 当前 {Math.round(game.stats[choice.requiresStat[0]])}</em>}{blocked && <em className="danger-text">{blocked}</em>}</span><Icon name="chevron" size={16}/></button>; })}</div></Modal>}
    </>}
  </div>;
}
