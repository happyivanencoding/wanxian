import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { act, autoChoice, createGame, getEvent, planDirectedAction, requiresPlayerChoice, travelPrice } from '../src/game/engine.ts';
import { REALMS, SECTS, REGIONS } from '../src/game/data.ts';
import { SAVE_KEY, newProfile, settleProfile, parseProfile } from '../src/game/storage.ts';
import { preparationTarget } from '../src/game/progression.ts';

const baseURL = process.env.APP_URL || 'http://localhost:5188';
const output = path.resolve('.artifacts/browser');
await fs.mkdir(output, { recursive: true });
assert.equal((await fetch(baseURL)).status, 200, 'Start the local app before running browser tests.');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const errors = [];
const config = { name: '林听澜', gender: '女修', origin: 'merchant', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: true, seed: 'browser-life' };
const pages = ['journey', 'opportunities', 'world', 'sect', 'home', 'inventory', 'life', 'people', 'chronicle', 'archives'];
const secondsPerYear = (minutes, speed) => ({ 30: 2.25, 60: 4.5 })[minutes] / speed;
const watch = p => {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
};
async function check(name, run) {
  await run(); results.push({ name, passed: true }); console.log('PASS', name);
}
async function state(p) { return p.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY); }
async function waitState(p, predicate, description) {
  for (let i = 0; i < 80; i++) {
    const value = await state(p);
    if (predicate(value)) return value;
    await p.waitForTimeout(30);
  }
  assert.fail(description || 'The visible action did not update the stored game.');
}
async function navigate(p, id) {
  const desktop = p.getByTestId(`nav-${id}`);
  if (await desktop.isVisible()) { await desktop.click(); return; }
  const management = ['inventory', 'home', 'sect', 'world'].includes(id);
  const personal = ['life', 'people', 'chronicle', 'archives'].includes(id);
  await p.getByTestId(`mobile-nav-${management ? 'management' : personal ? 'life' : id}`).click();
  if (management || personal) await p.getByTestId(`subnav-${id}`).click();
}
async function waitClockYears(p, years) {
  const { durationMinutes, speed } = (await state(p)).settings;
  await p.waitForTimeout(Math.ceil(secondsPerYear(durationMinutes, speed) * 1000 * years) + 160);
}
async function waitForNextYear(p) {
  if ((await state(p)).game.pending) await choosePending(p);
  const before = (await state(p)).game.age;
  await navigate(p, 'journey');
  await p.getByTestId('speed-select').selectOption('8');
  if (await p.getByTestId('play-toggle').innerText() === '继续') await p.getByTestId('play-toggle').click();
  await waitState(p, s => s.game.age > before, 'The visible year progress bar did not advance time.');
}
async function close(p) { await p.getByRole('button', { name: '关闭弹窗', exact: true }).click(); }
async function choosePending(p) {
  for (let n = 0; n < 8 && (await state(p)).game?.pending; n++) {
    if (!(await p.getByRole('dialog').count())) {
      await navigate(p, 'journey'); await p.getByTestId('pending-event').click();
    }
    await p.locator('[data-testid^="event-choice-"]:not(:disabled)').last().click();
    await waitState(p, s => !s.game.pending);
  }
}
async function noOverflow(p, label) {
  const size = await p.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width + 1, `${label}: horizontal overflow ${JSON.stringify(size)}`);
}
async function assertGlobalStatus(p, label) {
  const game = (await state(p)).game;
  const ribbon = p.getByTestId('global-status');
  assert.ok(await ribbon.isVisible(), `${label}: missing status ribbon`);
  const expand = p.getByTestId('status-expand');
  const needsExpansion = await expand.isVisible() && await expand.getAttribute('aria-expanded') !== 'true';
  if (needsExpansion) await expand.click();
  assert.equal((await p.getByTestId('status-stones').innerText()).trim(), Math.round(game.stones).toLocaleString('zh-CN'));
  assert.match(await p.getByTestId('status-actions').innerText(), new RegExp(`^${game.actionsLeft}\\s*\\/\\s*3$`));
  assert.ok((await ribbon.locator('.status-calendar').textContent()).includes(`${2300 + game.age}年`));
  for (const stat of ['health', 'mind', 'foundation', 'insight', 'reputation', 'alchemy', 'combat']) {
    assert.equal((await p.getByTestId(`status-stat-${stat}`).locator('strong').innerText()).trim(), String(Math.round(game.stats[stat])));
  }
  const bounds = await ribbon.evaluate(node => {
    const r = node.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, within: [...node.querySelectorAll('.status-attribute')].every(el => {
      const box = el.getBoundingClientRect();
      return box.left >= -1 && box.right <= innerWidth + 1;
    }) };
  });
  const dock = await p.locator('.time-dock').boundingBox();
  const viewportHeight = p.viewportSize().height;
  assert.ok(bounds.top >= -1 && bounds.bottom <= Math.min(viewportHeight, dock.y) + 1 && bounds.within, `${label}: expanded attributes must stay inside the usable viewport: ${JSON.stringify(bounds)}`);
  if (needsExpansion) {
    await expand.click();
    const compact = await ribbon.boundingBox();
    assert.ok(compact.height <= 160 && compact.y >= -1 && compact.y + compact.height <= dock.y + 1, `${label}: the collapsed summary should leave room for the current page: ${JSON.stringify(compact)}`);
    assert.match(await expand.innerText(), /体魄.*道心/);
    for (const id of ['status-stones', 'status-actions']) assert.ok(await p.getByTestId(id).isVisible(), `${label}: ${id} should remain visible after collapsing attributes.`);
    assert.ok(await ribbon.locator('.status-name strong').isVisible());
  }
}
async function assertCoreVisible(p, label) {
  const boundary = await p.locator('.time-dock').boundingBox();
  for (const id of ['current-cultivation', 'focus-picker', 'breakthrough-open', 'opportunity-preview', 'preparation-methods']) {
    const box = await p.getByTestId(id).boundingBox();
    assert.ok(box && box.y >= 0 && box.x >= -1 && box.y + box.height <= boundary.y + 1, `${label}: ${id} is not entirely usable in the first screen: ${JSON.stringify(box)}`);
  }
  assert.equal(await p.getByTestId('story-panel').count(), 0, 'The cultivation homepage must not bury its core controls under the full life story.');
  const focusSize = await p.getByTestId('focus-picker').locator('strong').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(focusSize >= 14, `${label}: the main action text must not be shrunk to fit.`);
}
async function capture(p, name, fullPage = false) { await p.screenshot({ path: path.join(output, `${name}.png`), fullPage, animations: 'disabled' }); }
function fixture() {
  const g = createGame({ ...config, seed: 'browser-systems', fastStart: false });
  Object.assign(g, { age: 28, realm: 2, progress: REALMS[2].need, lifespan: 260, stones: 3500, totalStones: 3500, pending: null, rng: 0 });
  Object.assign(g.stats, { health: 90, mind: 85, insight: 85, foundation: 85, alchemy: 70, reputation: 55 });
  Object.assign(g.inventory, { herb: 35, jade: 8, breakpill: 2 });
  g.npcs.forEach(n => Object.assign(n, { age: 28, realm: 1, lifespan: 120, relation: 82 }));
  return settleProfile(newProfile(), g);
}
function directedYearFixture() {
  const game = createGame({ ...config, name: '预取边界', gender: '随缘', seed: 'prefetch-browser' });
  Object.assign(game, { age: 40, realm: 2, progress: 50, lifespan: 260, stones: 160, focus: 'adventure', pending: null, rng: 65537 });
  game.seen['story-call-guardian'] = 20;
  game.stats = { health: 70, mind: 60, insight: 55, foundation: 55, alchemy: 30, combat: 40, reputation: 35 };
  game.npcs.forEach(n => Object.assign(n, { age: 40, realm: 2, lifespan: 260, relation: 65, progress: 0 }));
  assert.equal(planDirectedAction(game, { type: 'advance' }).request?.kind, 'event');
  const profile = settleProfile(newProfile(), game); profile.settings.speed = 8;
  return profile;
}
async function primeNPC(p, id) {
  const received = p.waitForResponse(reply => reply.url().endsWith('/api/director/decide') && reply.request().postDataJSON().actorId === id);
  await p.getByTestId(`talk-${id}`).focus();
  const reply = await received; await reply.finished();
  // Let the client's JSON promise publish its ready value; no game action has occurred.
  await p.waitForTimeout(40);
  return reply.json();
}
function storyFixture() {
  const profile = fixture();
  profile.game.age = 21; profile.game.focus = 'rest';
  for (let step = 0; step < 50; step++) {
    const game = profile.game;
    if (game.pending?.startsWith('story-call-')) return profile;
    const result = act(game, game.pending ? { type: 'choose', index: autoChoice(game, 'safe') } : { type: 'advance' });
    assert.equal(result.error, undefined); profile.game = result.game;
  }
  assert.fail('The story fixture must reach a genuine opening through the engine.');
}
function storyConsequenceFixture() {
  const profile = storyFixture();
  profile.game = act(profile.game, { type: 'choose', index: 0 }).game;
  for (let step = 0; step < 120 && profile.game.alive; step++) {
    if (profile.game.seen['story-guardian-echo'] !== undefined && !profile.game.pending) return profile;
    const game = profile.game;
    const result = act(game, game.pending ? { type: 'choose', index: game.pending.startsWith('story-') ? 0 : autoChoice(game, 'safe') } : { type: 'advance' });
    assert.equal(result.error, undefined); profile.game = result.game;
  }
  assert.fail('The story fixture must reach its real automatic consequence.');
}
async function completeSpringThroughUI(p, label) {
  const scenario = fixture(); scenario.game.actionsLeft = 1;
  await install(p, scenario); await navigate(p, 'opportunities');
  const offer = p.locator('.expedition-offer').filter({ has: p.getByTestId('expedition-start-spring') });
  assert.match(await offer.innerText(), /18.*灵石/);
  assert.doesNotMatch(await offer.innerText(), /资质.*\+4|道心.*\+3/);
  await p.getByTestId('expedition-start-spring').click();
  await waitState(p, s => s.game.expeditions?.active?.stage === 0);
  assert.equal((await state(p)).game.actionsLeft, 0);
  assert.equal((await state(p)).game.stones, scenario.game.stones - 18);
  assert.ok(await p.getByTestId('expedition-choice-map').isEnabled());
  const font = await p.getByTestId('expedition-scene').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(font >= 16, `${label}: story prose must remain readable.`);
  await p.getByTestId('expedition-choice-map').click();
  await waitState(p, s => s.game.expeditions?.active?.stage === 1);
  assert.match(await p.getByTestId('expedition-scene').innerText(), /排水道/);
  await p.getByTestId('open-save').click(); await p.getByTestId('save-slot-0').click();
  await waitState(p, s => s.slots[0]?.game.expeditions?.active?.stage === 1);
  await close(p);
  const saved = (await state(p)).game;
  await p.reload(); await p.getByTestId('expedition-active').waitFor();
  assert.deepEqual((await state(p)).game, saved);
  await navigate(p, 'journey');
  assert.ok(await p.getByTestId('focus-picker').isDisabled());
  assert.ok(await p.getByTestId('auto-toggle').isDisabled());
  await waitClockYears(p, 1.2); assert.deepEqual((await state(p)).game, saved);
  await p.getByTestId('expedition-resume').click();
  await p.getByTestId('expedition-choice-channel').click();
  await waitState(p, s => s.game.expeditions?.active?.stage === 2);
  assert.match(await p.getByTestId('expedition-choice-vein').innerText(), /40%.*30.*体魄/);
  assert.doesNotMatch(await p.getByTestId('expedition-active').innerText(), /资质.*\+4|修炼.*8%|道心.*\+3/);
  await p.getByTestId('expedition-choice-clear').click();
  const result = (await waitState(p, s => s.game.expeditions?.completed?.some(r => r.id === 'spring'))).game;
  assert.equal(result.expeditions.active, undefined); assert.equal(result.actionsLeft, 0);
  assert.equal(result.age, saved.age); assert.equal(result.aptitude, Math.min(100, saved.aptitude + 4));
  await p.getByTestId('attainment-reveal').waitFor(); await close(p);
  await p.getByTestId('expedition-result').waitFor();
  assert.match(await p.getByTestId('expedition-result').innerText(), /清泉洗髓/);
  assert.match(await p.getByTestId('expedition-result').innerText(), /资质永久.*4/);
  assert.equal(await p.getByTestId('expedition-start-spring').count(), 0);
  const bounds = await p.getByTestId('expedition-result').boundingBox(), dock = await p.locator('.time-dock').boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y < dock.y, `${label}: the completed result should be shown before other opportunities.`);
  await noOverflow(p, `${label} complete expedition`);
}
async function install(p, profile = fixture()) {
  // Use the actual import flow: direct writes before reload are correctly overwritten by beforeunload autosave.
  if (await p.getByRole('dialog').count()) await close(p);
  await p.getByTestId('open-save').click();
  await p.getByTestId('import-save').setInputFiles({ name: 'scenario.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)) });
  await p.getByTestId('confirm-action').click();
  await waitState(p, s => JSON.stringify(s.game) === JSON.stringify(profile.game));
  await p.getByTestId('global-status').waitFor();
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route('**/api/director/status', route => route.fulfill({ json: { configured: false } }));
  const page = await context.newPage(); watch(page);
  await page.goto(baseURL);
  await check('Desktop landing renders, no overflow or external asset dependency', async () => {
    await page.getByTestId('start-life').waitFor(); await noOverflow(page, 'landing');
    const external = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => !r.name.startsWith(location.origin)).map(r => r.name));
    assert.deepEqual(external, []); await capture(page, '01-landing-desktop');
  });
  await check('Create a character through the real birth form and resolve the opening choice', async () => {
    await page.getByTestId('start-life').click();
    await page.getByTestId('birth-name').fill(config.name);
    await page.getByTestId('birth-origin').selectOption(config.origin);
    await page.getByTestId('birth-region').selectOption(config.region);
    await page.getByTestId('birth-duration').selectOption('60');
    await page.locator('.seed-details summary').click();
    await page.getByTestId('birth-seed').fill(config.seed);
    await page.getByTestId('create-life').click();
    await page.getByTestId('event-choice-0').waitFor();
    assert.equal((await state(page)).game.age, 16);
    await choosePending(page);
    assert.equal((await state(page)).game.name, config.name);
    assert.equal((await state(page)).settings.durationMinutes, 60);
    await capture(page, '02-journey-desktop');
  });
  await check('Automatic time starts on the life page; duration, speed and pause affect the visible year bar', async () => {
    const bar = page.getByTestId('year-progress');
    assert.equal(await page.getByTestId('advance-year').count(), 0);
    assert.equal(await page.getByTestId('advance-many').count(), 0);
    assert.ok((await page.getByTestId('year-clock').innerText()).includes(`${secondsPerYear(60, 1).toFixed(1)} 秒／年`));
    assert.match(await page.getByTestId('play-toggle').innerText(), /暂停/);
    const early = Number(await bar.getAttribute('aria-valuenow'));
    await page.waitForTimeout(Math.ceil(secondsPerYear(60, 1) * 1000 * 0.08));
    const later = Number(await bar.getAttribute('aria-valuenow'));
    assert.ok(later > early, 'The year progress bar must move without pressing Play.');
    await page.getByRole('button', { name: '偏好设置', exact: true }).last().click();
    await page.getByTestId('settings-duration').selectOption('30');
    assert.equal((await state(page)).settings.durationMinutes, 30);
    await close(page);
    await navigate(page, 'journey');
    await page.getByTestId('speed-select').selectOption('8');
    assert.ok((await page.getByTestId('year-clock').innerText()).includes(`${secondsPerYear(30, 8).toFixed(1)} 秒／年`));
    await navigate(page, 'world');
    const pausedAge = (await state(page)).game.age;
    const pausedProgress = Number(await bar.getAttribute('aria-valuenow'));
    await waitClockYears(page, 2);
    assert.equal(Number(await bar.getAttribute('aria-valuenow')), pausedProgress);
    assert.equal((await state(page)).game.age, pausedAge);
    await navigate(page, 'journey');
    await page.getByTestId('speed-select').selectOption('1');
    await choosePending(page);
  });
  await check('All ten screens render and have usable desktop layouts', async () => {
    for (const id of pages) {
      await navigate(page, id); await noOverflow(page, `desktop ${id}`); await assertGlobalStatus(page, `desktop ${id}`);
      assert.ok(await page.locator('main').innerText());
      if (['world', 'home', 'people'].includes(id)) await capture(page, `03-${id}-desktop`);
    }
  });
  await check('Global status remains pinned while scrolling a long page', async () => {
    await navigate(page, 'world');
    await page.evaluate(() => window.scrollTo({ top: 850, behavior: 'instant' }));
    const position = await page.getByTestId('global-status').evaluate(el => ({
      top: el.getBoundingClientRect().top, scroll: scrollY
    }));
    assert.ok(position.scroll > 78 && Math.abs(position.top) <= 1, `Status ribbon must remain pinned: ${JSON.stringify(position)}`);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await navigate(page, 'world');
  });
  await check('Annual focus and advancing one year change the actual stored simulation', async () => {
    await choosePending(page); await navigate(page, 'journey');
    await page.getByTestId('speed-select').selectOption('1');
    await choosePending(page);
    await page.getByTestId('focus-picker').click(); await page.getByTestId('focus-study').click();
    const before = (await state(page)).game;
    await waitForNextYear(page);
    const after = (await waitState(page, s => s.game.age === before.age + 1)).game;
    assert.equal(after.focus, 'study'); assert.ok(after.stats.insight > before.stats.insight);
    await assertGlobalStatus(page, 'after advancing one year');
    await choosePending(page);
  });
  await check('Market purchase consumes resources and adds real inventory', async () => {
    await navigate(page, 'inventory'); await page.getByTestId('tab-market').click();
    const before = (await state(page)).game;
    await page.getByTestId('buy-herb').click();
    const after = (await waitState(page, s => s.game.inventory.herb === before.inventory.herb + 1)).game;
    assert.equal(after.stones, before.stones - 8); assert.equal(after.actionsLeft, before.actionsLeft - 1);
    await assertGlobalStatus(page, 'after market purchase');
  });
  let exported;
  await check('Manual slot and downloadable export preserve a full valid save', async () => {
    await page.getByTestId('open-save').click(); await page.getByTestId('save-slot-0').click();
    await waitState(page, s => s.slots[0] !== null);
    const downloadPromise = page.waitForEvent('download'); await page.getByTestId('export-save').click();
    const download = await downloadPromise; const target = path.join(output, 'exported-save.json');
    await download.saveAs(target); exported = await fs.readFile(target, 'utf8');
    const parsed = parseProfile(exported); assert.equal(parsed.game.name, config.name); assert.ok(parsed.slots[0]);
    await close(page);
  });
  await check('Manual loading restores the saved moment after time has advanced', async () => {
    const before = (await state(page)).slots[0].game;
    await waitForNextYear(page); await waitState(page, s => s.game.age > before.age); await choosePending(page);
    await page.getByTestId('open-save').click(); await page.getByTestId('load-slot-0').click();
    await page.getByTestId('confirm-action').click(); await waitState(page, s => s.game.age === before.age);
    assert.equal((await state(page)).game.stones, before.stones);
  });
  await check('Invalid import leaves the current save intact; valid import requires confirmation', async () => {
    await page.getByTestId('open-save').click(); const before = (await state(page)).game;
    await page.getByTestId('import-save').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await page.locator('.import-message').waitFor(); assert.deepEqual((await state(page)).game, before);
    for (const fields of [
      { preparation: { realm: before.realm, selected: 'missing', progress: { temper: 0, meditate: 0, medicine: 0 } } },
      { expeditions: { completed: [], active: { id: 'spring', stage: 3, marks: [], startedAge: before.age } } },
    ]) {
      const invalidProgression = JSON.parse(exported); Object.assign(invalidProgression.game, fields);
      await page.getByTestId('import-save').setInputFiles({ name: 'invalid-progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidProgression)) });
      await page.locator('.import-message').waitFor(); assert.deepEqual((await state(page)).game, before);
      assert.equal(await page.getByTestId('confirm-action').count(), 0);
    }
    const invalidEvent = JSON.parse(exported); invalidEvent.game.pending = 'story-not-a-real-event';
    await page.getByTestId('import-save').setInputFiles({ name: 'invalid-story.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidEvent)) });
    await page.locator('.import-message').waitFor(); assert.deepEqual((await state(page)).game, before);
    const invalidEffect = JSON.parse(exported);
    invalidEffect.game.delayed.push({ at: before.age + 5, title: '旧信', text: '无效的命途。', effect: { storyPath: 'missing-path' } });
    await page.getByTestId('import-save').setInputFiles({ name: 'invalid-story-effect.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidEffect)) });
    await page.locator('.import-message').waitFor(); assert.deepEqual((await state(page)).game, before);
    await page.getByTestId('import-save').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
    await page.getByTestId('confirm-action').click(); await waitState(page, s => s.game.age === before.age);
  });
  await check('Dark mode persists across reload and automatic years stop at decisions', async () => {
    await page.getByTestId('theme-toggle').click(); await waitState(page, s => s.settings.theme === 'dark');
    await page.reload(); assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await capture(page, '04-night-desktop');
    await page.getByTestId('theme-toggle').click();
    const childhood = settleProfile(newProfile(), createGame({ ...config, fastStart: false }));
    await install(page, childhood); await waitForNextYear(page); await waitForNextYear(page);
    await page.getByTestId('event-choice-0').waitFor();
    const waiting = (await state(page)).game; assert.equal(waiting.age, 2); assert.equal(waiting.pending, 'child-pebble');
    await close(page); await waitClockYears(page, 2); assert.equal((await state(page)).game.age, 2);
    await page.getByTestId('pending-event').click(); await page.getByTestId('event-choice-0').waitFor(); await choosePending(page);
  });
  await check('Equipment, action limits and inventory selling operate on an isolated scenario', async () => {
    await install(page); await navigate(page, 'inventory'); await page.getByTestId('tab-market').click();
    await page.getByTestId('buy-sword').click(); await waitState(page, s => s.game.inventory.sword === 1);
    await page.getByTestId('tab-bag').click(); await page.getByTestId('use-sword').click();
    await waitState(page, s => s.game.equipped === 'sword'); assert.ok(await page.getByTestId('sell-sword').isDisabled());
    await page.getByTestId('use-sword').click(); await waitState(page, s => s.game.actionsLeft === 0);
    assert.ok(await page.getByTestId('sell-sword').isDisabled());
    await waitForNextYear(page); await waitState(page, s => s.game.age === 29); await choosePending(page);
    await navigate(page, 'inventory'); await page.getByTestId('sell-sword').click(); await waitState(page, s => s.game.inventory.sword === 0);
  });
  await check('Travel, sanctuary construction and real alchemy work through UI controls', async () => {
    await install(page); await navigate(page, 'world'); await page.getByTestId('region-river').click();
    await page.getByTestId('travel-selected').click(); await waitState(page, s => s.game.region === 'river');
    await navigate(page, 'home'); await page.getByTestId('home-furnace').click(); await waitState(page, s => s.game.home.furnace === 1);
    await navigate(page, 'inventory'); await page.getByTestId('tab-craft').click();
    const before = (await state(page)).game; await page.getByTestId('craft-heal').click();
    const after = (await waitState(page, s => s.game.actionsLeft === 0)).game;
    assert.equal(after.inventory.herb, before.inventory.herb - 3); assert.equal(after.inventory.heal, before.inventory.heal + 1);
  });
  await check('A story-built waystation shows its actual discount and enables a trip affordable at that price', async () => {
    const linked = fixture(); linked.game.flags.push('story-active-contract', 'fate-contract', 'story-waystations');
    const fare = travelPrice(linked.game, 'river'); linked.game.stones = fare;
    await install(page, linked); await navigate(page, 'world'); await page.getByTestId('region-river').click();
    assert.match(await page.getByTestId('travel-price').innerText(), new RegExp(String(fare)));
    assert.match(await page.locator('.region-detail').innerText(), /驿站照应/);
    assert.equal(await page.getByTestId('travel-selected').isDisabled(), false);
    await page.getByTestId('travel-selected').click();
    const arrived = (await waitState(page, s => s.game.region === 'river')).game;
    assert.equal(arrived.stones, 0);
  });
  await check('Sect admission and mission award actual contributions', async () => {
    await install(page); await navigate(page, 'sect'); await page.getByTestId('sect-card-qinglan').locator('summary').click(); await page.getByTestId('join-qinglan').click();
    await waitState(page, s => s.game.sect === 'qinglan');
    await page.getByTestId('sect-mission').click(); await waitState(page, s => s.game.contribution === 22);
    await capture(page, '05-sect-desktop');
  });
  await check('Local sect teaching grants a real unique item, shows the learned ability and cannot be purchased again', async () => {
    await install(page); await navigate(page, 'sect');
    await page.getByTestId('sect-region-river').click(); await page.getByTestId('sect-card-herb').locator('summary').click();
    assert.ok(await page.getByTestId('join-herb').isDisabled());
    const student = fixture(); student.game.region = 'river'; student.game.visited.push('river');
    student.game.sect = 'herb'; student.game.contribution = 80;
    await install(page, student); await navigate(page, 'sect');
    await page.getByTestId('learn-specialty').click();
    await waitState(page, s => s.game.inventory['sect-satchel'] === 1 && s.game.contribution === 0);
    await page.getByTestId('attainment-reveal').waitFor(); assert.match(await page.getByTestId('attainment-reveal').innerText(), /百草药理/); await close(page);
    assert.ok(await page.getByTestId('learn-specialty').isDisabled());
    await navigate(page, 'inventory'); await page.getByTestId('tab-market').click();
    assert.equal(await page.getByTestId('buy-sect-satchel').count(), 0);
    await page.getByTestId('tab-bag').click(); await page.getByTestId('use-sect-satchel').click();
    await waitState(page, s => s.game.equipped === 'sect-satchel');
    await navigate(page, 'people');
    for (let i = 0; i < 4; i++) assert.ok((await page.getByTestId(`companion-trait-peer-${i}`).innerText()).length > 15);
  });
  await check('Preparation is selected once, follows the chosen annual focus and keeps progress when paused or switched', async () => {
    await install(page);
    await page.getByTestId('preparation-methods').click();
    await page.getByTestId('prepare-meditate').click();
    await waitState(page, s => s.game.preparation?.selected === 'meditate');
    await page.getByTestId('preparation-focus').click();
    await waitState(page, s => s.game.focus === 'study');
    await waitForNextYear(page);
    await waitState(page, s => s.game.preparation?.progress.meditate > 0);
    await choosePending(page);
    if ((await page.getByTestId('play-toggle').innerText()).includes('暂停')) await page.getByTestId('play-toggle').click();
    const progress = (await state(page)).game.preparation.progress.meditate;
    await page.getByTestId('preparation-methods').click();
    await page.getByTestId('prepare-temper').click();
    await waitState(page, s => s.game.preparation?.selected === 'temper');
    assert.equal((await state(page)).game.preparation.progress.meditate, progress);
    await page.getByTestId('preparation-methods').click();
    await page.getByTestId('prepare-cancel').click(); await waitState(page, s => s.game.preparation?.selected === null);
    assert.equal((await state(page)).game.preparation.progress.meditate, progress);
  });
  await check('Successful prepared breakthrough presents and permanently retains the actual earned attainment', async () => {
    const ready = fixture();
    ready.game.preparation = { realm: ready.game.realm, selected: 'meditate', progress: { temper: 0, meditate: preparationTarget(ready.game.realm, 'meditate'), medicine: 0 } };
    await install(page, ready); await page.getByTestId('breakthrough-open').click();
    assert.match(await page.getByTestId('breakthrough-preparation').innerText(), /12\.0/);
    await page.getByTestId('confirm-breakthrough').click();
    const advanced = (await waitState(page, s => s.game.flags.includes('attainment-2-meditate'))).game;
    assert.equal(advanced.realm, 3); assert.equal(advanced.preparation, undefined);
    await page.getByTestId('attainment-reveal').waitFor(); assert.match(await page.getByTestId('attainment-reveal').innerText(), /丹心自照/); await close(page);
    await navigate(page, 'life'); assert.match(await page.getByTestId('attainments').innerText(), /丹心自照/);
  });
  await check('A full expedition starts, freezes the world, reloads mid-stage and presents its earned result', async () => {
    await completeSpringThroughUI(page, 'desktop');
    await capture(page, '05-expedition-result-desktop');
  });
  await check('Companion interaction is bounded per year and biography data can be exported', async () => {
    await install(page); await navigate(page, 'people'); const before = (await state(page)).game;
    const expected = act(before, { type: 'npc', id: 'peer-0', interaction: 'talk' }).game;
    await page.getByTestId('talk-peer-0').click(); await waitState(page, s => s.game.npcs[0].relation === expected.npcs[0].relation);
    assert.ok(await page.getByTestId('talk-peer-0').isDisabled());
    await navigate(page, 'chronicle');
    const downloadPromise = page.waitForEvent('download'); await page.getByTestId('export-chronicle').click();
    const d = await downloadPromise; await d.saveAs(path.join(output, 'chronicle.txt'));
    assert.match(await fs.readFile(path.join(output, 'chronicle.txt'), 'utf8'), /林听澜/);
  });
  await check('An old v1 fate decision still imports, resolves and displays its lasting rules', async () => {
    const chosen = fixture(); chosen.game.pending = 'fate-first'; chosen.game.seen['fate-first'] = 28;
    await install(page, chosen);
    await page.getByTestId('event-choice-1').click();
    const after = await waitState(page, s => s.game.flags.includes('fate-lone') && s.game.pending === null);
    assert.ok(after.game.stats.mind < chosen.game.stats.mind);
    await navigate(page, 'life');
    await page.getByTestId('fate-arc').locator('summary').click();
    assert.match(await page.getByTestId('fate-arc').innerText(), /孤峰问道/);
    assert.match(await page.getByTestId('fate-arc').innerText(), /修炼基准.*1.16/);
    await navigate(page, 'world');
    await assertGlobalStatus(page, 'destiny path navigation');
  });
  await check('Story decisions show their cause and recurring person; automatic play waits and resumes after a real choice', async () => {
    const opening = storyFixture(); opening.settings.speed = 8;
    await install(page, opening);
    const event = getEvent(opening.game);
    await page.getByTestId('event-cause').waitFor();
    assert.equal((await page.getByTestId('event-cause').innerText()).includes(event.cause), true);
    await close(page);
    if (!(await page.getByTestId('auto-toggle').isChecked())) await page.locator('.auto-toggle').click();
    await navigate(page, 'journey');
    await page.getByTestId('pending-event').click();
    await page.getByTestId('event-choice-0').waitFor();
    await waitClockYears(page, 3);
    assert.deepEqual((await state(page)).game, opening.game, 'Automation must leave the pending story and its RNG untouched.');
    assert.ok(await page.getByTestId('event-choice-0').isVisible(), 'A major choice must stay visible while automation is enabled.');
    await page.getByTestId('event-choice-0').click();
    await waitState(page, s => s.game.flags.includes('story-active-guardian'));
    await waitState(page, s => s.game.age > opening.game.age, 'The same running plan should resume after the player decides.');
    if ((await page.getByTestId('play-toggle').innerText()).includes('暂停')) await page.getByTestId('play-toggle').click();
    await navigate(page, 'life');
    assert.ok(await page.getByTestId('story-panel').isVisible());
    const person = await page.getByTestId('story-person').innerText();
    assert.ok((await state(page)).game.npcs.some(n => person.includes(n.name)), 'The panel must identify an actual companion.');
    assert.ok((await page.getByTestId('story-chapters').innerText()).includes(event.title));
    assert.doesNotMatch(await page.getByTestId('story-panel').innerText(), /再过\s*\d+\s*年|未来\s*\d+\s*年|将(?:会)?获得|下一(?:幕|阶段).*?(?:奖励|触发)/, 'The life panel should show current commitments and earned consequences, not future story timing or rewards.');
    await page.getByTestId('story-person').click();
    assert.equal(await page.getByTestId('nav-people').getAttribute('aria-current'), 'page');
    await navigate(page, 'journey');
    if (await page.getByTestId('auto-toggle').isChecked()) await page.locator('.auto-toggle').click();
    await capture(page, '05-story-desktop');
  });
  await check('A later story panel displays the original decision, concrete consequence and continuing benefits', async () => {
    const consequence = storyConsequenceFixture();
    await install(page, consequence);
    await navigate(page, 'life');
    const panel = await page.getByTestId('story-panel').innerText();
    assert.ok(panel.includes(getEvent(consequence.game, 'story-guardian-echo').title));
    assert.ok((await page.getByTestId('story-chapters').locator('li').count()) >= 3);
    assert.ok((await page.getByTestId('story-effects').innerText()).length > 20);
    assert.ok(consequence.game.npcs.some(n => panel.includes(n.name)));
    await capture(page, '05-story-desktop-consequence');
  });
  await check('Breakthrough confirmation spends resources and really advances the realm', async () => {
    await install(page); await page.getByTestId('breakthrough-open').click();
    assert.match(await page.getByRole('dialog').innerText(), /本次成功率/);
    await page.getByTestId('breakthrough-insight').locator('summary').click();
    assert.match(await page.getByTestId('breakthrough-insight').innerText(), /根基积累/);
    assert.match(await page.getByTestId('breakthrough-insight').innerText(), /不是一生的飞升率/);
    await page.getByTestId('confirm-breakthrough').click(); await waitState(page, s => s.game.realm === 3);
    const g = (await state(page)).game; assert.equal(g.stones, 3500 - REALMS[2].cost); assert.equal(g.successes, 1);
  });
  await check('Retirement creates an archive, downloadable biography and new-life entry', async () => {
    await page.getByRole('button', { name: '偏好设置', exact: true }).last().click();
    await page.getByTestId('retire').click(); await page.getByTestId('confirm-action').click();
    await waitState(page, s => s.game.ending === '归隐山林'); await close(page); await navigate(page, 'archives');
    assert.equal((await state(page)).archives.length, 1);
    const downloadPromise = page.waitForEvent('download'); await page.getByTestId('export-biography').click();
    const d = await downloadPromise; await d.saveAs(path.join(output, 'biography.txt'));
    assert.match(await fs.readFile(path.join(output, 'biography.txt'), 'utf8'), /归隐山林/);
    await capture(page, '06-biography-desktop');
    await page.getByTestId('new-life').click(); await page.getByTestId('birth-name').waitFor(); await close(page);
  });
  await check('Training explanation uses real state and changing pages pauses the running clock', async () => {
    await install(page);
    await page.getByTestId('training-insight').locator('summary').click();
    const explanation = await page.getByTestId('training-insight').innerText();
    assert.match(explanation, /洞府、道路与宗门/);
    assert.match(explanation, /当前闭关基准/);
    await page.getByTestId('play-toggle').click();
    assert.match(await page.getByTestId('play-toggle').innerText(), /暂停/);
    await navigate(page, 'home');
    assert.match(await page.getByTestId('play-toggle').innerText(), /继续/);
    const before = (await state(page)).game.age;
    await waitClockYears(page, 1.2);
    assert.equal((await state(page)).game.age, before);
  });
  await check('Starting a new life during a pending encounter archives the old life exactly once', async () => {
    const pending = settleProfile(newProfile(), createGame({ ...config, seed: 'retire-with-pending' }));
    assert.equal(pending.game.pending, 'departure');
    await install(page, pending);
    if (await page.getByRole('dialog').count()) await close(page);
    await navigate(page, 'archives');
    await page.getByTestId('new-life').click();
    await page.getByTestId('confirm-action').click();
    await page.getByTestId('birth-name').waitFor();
    await waitState(page, s => s.archives.length === 1 && s.game.ending === '归隐山林');
    await page.getByTestId('birth-name').fill('陆长宁');
    await page.getByTestId('create-life').click();
    const renewed = await waitState(page, s => s.game.name === '陆长宁');
    assert.equal(renewed.archives.length, 1);
    assert.equal(renewed.archives[0].id, pending.game.id);
    assert.equal(renewed.archives[0].ending, '归隐山林');
    await choosePending(page);
  });
  await check('A complete unmodified life reaches its ending with automatic years and explicit player decisions', async () => {
    const actual = settleProfile(newProfile(), createGame({ ...config, seed: 'browser-timer-10' }));
    actual.settings.speed = 8;
    await install(page, actual); await page.getByTestId('event-choice-0').click();
    await page.locator('.auto-toggle').click(); assert.ok(await page.getByTestId('auto-toggle').isChecked());
    await page.clock.install();
    if ((await page.getByTestId('play-toggle').innerText()).includes('继续')) await page.getByTestId('play-toggle').click();
    const playerDecisions = [];
    for (let i = 0; i < 240 && (await state(page)).game.alive; i++) {
      const game = (await state(page)).game;
      if (game.pending && requiresPlayerChoice(game)) {
        playerDecisions.push({ age: game.age, id: game.pending, title: getEvent(game).title });
        if (!(await page.getByRole('dialog').count())) await page.getByTestId('pending-event').click();
        await page.getByTestId(`event-choice-${autoChoice(game, 'safe')}`).click();
        await waitState(page, s => s.game.pending !== game.pending);
      }
      await page.clock.runFor(Math.ceil(secondsPerYear(actual.settings.durationMinutes, actual.settings.speed) * 1000 * 20));
    }
    const end = (await state(page)).game;
    assert.equal(end.alive, false, 'Normal timer loop should reach a genuine ending.');
    assert.equal((await state(page)).archives.length, 1);
    assert.ok(playerDecisions.length >= 2, 'The natural life must expose multiple genuine story decisions.');
    assert.ok(playerDecisions.every(d => end.seen[d.id] === d.age), 'The biography must retain the player-decided story history.');
    results.push({ name: 'Natural life outcome with player decisions', age: end.age, realm: REALMS[end.realm].name, ending: end.ending, choices: end.choices, playerDecisions });
    await close(page); await navigate(page, 'archives'); await capture(page, '07-natural-life-ending');
  });
  await context.close();

  const directed = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await directed.route('**/api/director/status', route => route.fulfill({ json: { configured: true } }));
  let directorMode = 'valid', directorCalls = 0, releaseReply;
  await directed.route('**/api/director/decide', async route => {
    directorCalls++;
    const request = route.request().postDataJSON();
    const mode = directorMode;
    if (mode === 'delayed') await new Promise(resolve => { releaseReply = resolve; });
    const candidateId = mode === 'invalid' ? 'invented-reward' : request.candidates.find(item => item.id === 'medicine')?.id || request.candidates[0].id;
    await route.fulfill({ json: { source: 'startlux', decision: { kind: request.kind, age: request.age, actorId: request.actorId, candidateId, source: 'startlux' } } }).catch(() => {});
  });
  const dp = await directed.newPage(); watch(dp); await dp.goto(baseURL);
  await check('A ready background NPC response is applied once without changing the game before the click', async () => {
    const scenario = fixture();
    await install(dp, scenario); await navigate(dp, 'people');
    await primeNPC(dp, 'peer-1');
    assert.deepEqual((await state(dp)).game, scenario.game, 'Preparing a response cannot spend resources or commit fictional events.');
    await dp.getByTestId('talk-peer-1').click();
    const after = (await waitState(dp, p => p.game.directorRecords?.at(-1)?.source === 'startlux')).game;
    assert.equal(after.directorRecords.at(-1).candidateId, 'medicine');
    assert.equal(after.inventory.herb, scenario.game.inventory.herb + 1);
    assert.equal(after.actionsLeft, scenario.game.actionsLeft - 1);
    await dp.getByTestId('open-settings').click();
    assert.match(await dp.getByTestId('director-last-source').innerText(), /StartLux/);
    await noOverflow(dp, 'mobile director settings'); await capture(dp, '13-director-settings'); await close(dp);
  });
  await check('Invalid online decisions and a disconnected browser both complete through local rules', async () => {
    directorMode = 'invalid';
    const scenario = fixture(), expected = act(scenario.game, { type: 'npc', id: 'peer-1', interaction: 'talk' }).game;
    await install(dp, scenario); await navigate(dp, 'people'); await primeNPC(dp, 'peer-1'); await dp.getByTestId('talk-peer-1').click();
    await waitState(dp, p => p.game.npcs[1].lastInteraction === scenario.game.age);
    assert.deepEqual((await state(dp)).game, expected);
    await install(dp, scenario); await navigate(dp, 'people');
    const callsBefore = directorCalls; await directed.setOffline(true);
    await dp.getByTestId('talk-peer-1').click();
    await waitState(dp, p => p.game.npcs[1].lastInteraction === scenario.game.age);
    assert.deepEqual((await state(dp)).game, expected); assert.equal(directorCalls, callsBefore);
    await directed.setOffline(false);
  });
  await check('A pending NPC request never delays the click and its late reply cannot alter a new life', async () => {
    directorMode = 'delayed'; releaseReply = undefined;
    const scenario = fixture(), expected = act(scenario.game, { type: 'npc', id: 'peer-1', interaction: 'talk' }).game;
    await install(dp, scenario); await navigate(dp, 'people'); await dp.getByTestId('talk-peer-1').focus();
    for (let i = 0; i < 50 && !releaseReply; i++) await dp.waitForTimeout(20);
    assert.equal(typeof releaseReply, 'function');
    await dp.getByTestId('talk-peer-1').click();
    await waitState(dp, p => p.game.npcs[1].lastInteraction === scenario.game.age);
    assert.deepEqual((await state(dp)).game, expected, 'Local settlement must finish while the network reply is still held.');
    assert.equal(await dp.getByTestId('director-busy').count(), 0);
    const replacement = fixture(); replacement.game.name = '新载入的人生';
    await install(dp, replacement); releaseReply(); await dp.waitForTimeout(100);
    assert.deepEqual((await state(dp)).game, replacement.game);
  });
  await dp.clock.install(); await dp.clock.pauseAt(new Date());
  await check('At 8x speed an unfinished background event never stops the year clock or rewrites a settled event', async () => {
    directorMode = 'delayed'; releaseReply = undefined;
    const scenario = directedYearFixture(), expected = planDirectedAction(scenario.game, { type: 'advance' }).result.game;
    await install(dp, scenario);
    await dp.getByTestId('play-toggle').click();
    for (let i = 0; i < 50 && !releaseReply; i++) await dp.waitForTimeout(20);
    assert.equal(typeof releaseReply, 'function', 'The event request should start before the year has elapsed.');
    assert.equal((await state(dp)).game.age, scenario.game.age);
    assert.equal(await dp.getByTestId('director-busy').count(), 0);
    await dp.clock.runFor(400);
    await waitState(dp, p => p.game.age === 41);
    assert.deepEqual((await state(dp)).game, expected, 'The normal annual deadline must immediately settle the local result.');
    releaseReply(); await dp.waitForTimeout(100);
    assert.deepEqual((await state(dp)).game, expected, 'A late arrangement must not replace an event the player already sees.');
    results.push({ name: 'Nonblocking year deadline evidence', speed: 8, advancedClockMilliseconds: 400, networkReplyHeldUntilAfterSettlement: true });
  });
  await check('A ready next-year arrangement is invisible until the normal year boundary and is consumed exactly once', async () => {
    directorMode = 'valid';
    const scenario = directedYearFixture(), plan = planDirectedAction(scenario.game, { type: 'advance' });
    await install(dp, scenario);
    const received = dp.waitForResponse(reply => reply.url().endsWith('/api/director/decide'));
    await dp.getByTestId('play-toggle').click();
    const reply = await received; await reply.finished(); await dp.waitForTimeout(40);
    assert.deepEqual((await state(dp)).game, scenario.game);
    await dp.clock.runFor(400);
    const after = (await waitState(dp, p => p.game.age === 41)).game;
    assert.equal(after.directorRecords.at(-1).source, 'startlux');
    assert.equal(after.pending, plan.request.candidates[0].id);
    assert.equal(after.directorRecords.length, 1);
    const callsAtSettlement = directorCalls;
    await dp.clock.runFor(800);
    assert.deepEqual((await state(dp)).game, after);
    assert.equal(directorCalls, callsAtSettlement, 'Player decisions pause as before and do not ask for another future arrangement.');
  });
  await directed.close();

  if (process.env.STARTLUX_LIVE === '1') {
    const live = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const lp = await live.newPage(); watch(lp); await lp.goto(baseURL);
    await check('Live StartLux prepares in the background and a later click synchronously consumes the result', async () => {
      const scenario = fixture(); scenario.game.stats.health = 45;
      await install(lp, scenario); await navigate(lp, 'people');
      const began = performance.now();
      const prepared = await primeNPC(lp, 'peer-1');
      const backgroundMilliseconds = Math.round(performance.now() - began);
      assert.equal(prepared.source, 'startlux');
      assert.deepEqual((await state(lp)).game, scenario.game);
      const clicked = performance.now();
      await lp.getByTestId('talk-peer-1').click();
      await lp.waitForFunction(key => JSON.parse(localStorage.getItem(key)).game.directorRecords?.length > 0, SAVE_KEY, { timeout: 6500 });
      const after = (await state(lp)).game;
      assert.equal(after.directorRecords.at(-1).source, 'startlux');
      assert.equal(after.actionsLeft, scenario.game.actionsLeft - 1);
      results.push({ name: 'Live StartLux response evidence', record: after.directorRecords.at(-1), backgroundMilliseconds, clickMilliseconds: Math.round(performance.now() - clicked), model: 'startlux-decision-27b-autothink' });
      await lp.getByTestId('open-settings').click(); await capture(lp, '14-live-startlux');
    });
    await live.close();
  }

  for (const width of [390, 360, 320]) {
    const mobile = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await mobile.route('**/api/director/status', route => route.fulfill({ json: { configured: false } }));
    const p = await mobile.newPage(); watch(p); await p.goto(baseURL);
    await check(`Mobile ${width}px landing and birth dialog are reachable`, async () => {
      await noOverflow(p, 'mobile landing');
      if (width === 390) await capture(p, '08-mobile-landing', true);
      await p.getByTestId('start-life').click(); await noOverflow(p, 'mobile birth');
      await p.getByTestId('birth-name').fill('沈见山'); await p.getByTestId('birth-region').selectOption('qinglan'); await p.getByTestId('create-life').click();
      await p.getByTestId('event-choice-0').waitFor(); await choosePending(p);
    });
    await check(`Mobile ${width}px cultivation controls fit the first screen with comfortable touch targets`, async () => {
      await assertCoreVisible(p, `mobile ${width} fresh life`);
      for (const id of ['focus-picker', 'breakthrough-open', 'opportunity-preview', 'preparation-methods', 'mobile-nav-journey', 'mobile-nav-opportunities', 'mobile-nav-management', 'mobile-nav-life']) {
        const box = await p.getByTestId(id).boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44, `mobile ${width}: ${id} is too small for a primary touch target`);
      }
      await p.getByTestId('focus-picker').click(); await p.getByTestId('focus-study').click();
      await waitState(p, s => s.game.focus === 'study');
      await p.getByTestId('preparation-methods').click();
      await p.getByTestId('prepare-meditate').click();
      await waitState(p, s => s.game.preparation?.selected === 'meditate');
      assert.ok((await p.getByTestId('preparation-current').innerText()).length > 10);
      await noOverflow(p, `mobile ${width} preparation`);
      await navigate(p, 'journey');
    });
    await check(`Mobile ${width}px all four main tabs and ten pages remain reachable without overflow`, async () => {
      for (const id of pages) { await navigate(p, id); await noOverflow(p, `mobile ${width} ${id}`); await assertGlobalStatus(p, `mobile ${width} ${id}`); }
      await navigate(p, 'journey');
      const dock = await p.locator('.time-dock').boundingBox(); const nav = await p.locator('.mobile-bottom-nav').boundingBox();
      assert.ok(dock.y + dock.height <= nav.y + 1, 'Time controls must not overlap mobile navigation.');
      if (width === 390) await capture(p, '09-mobile-journey');
      await p.getByTestId('open-settings').click(); assert.ok(await p.getByTestId('retire').isVisible());
      await p.getByRole('button', { name: '查看玩法说明与快捷键' }).click(); assert.match(await p.getByRole('dialog').innerText(), /初入仙途/); await close(p);
      await p.getByTestId('theme-toggle').click(); await waitState(p, s => s.settings.theme === 'dark');
      await noOverflow(p, 'mobile dark');
      if (width === 390) await capture(p, '10-mobile-night');
    });
    await check(`Mobile ${width}px story context and its choices remain readable without horizontal overflow`, async () => {
      const opening = storyFixture();
      await install(p, opening);
      await p.getByTestId('event-cause').waitFor();
      await noOverflow(p, `mobile ${width} story decision`);
      assert.ok(await p.getByTestId('event-choice-2').isVisible(), 'All three large directions must remain reachable on a narrow screen.');
      await p.getByTestId('event-choice-0').click();
      await waitState(p, s => s.game.flags.includes('story-active-guardian'));
      await navigate(p, 'life');
      await p.getByTestId('story-panel').scrollIntoViewIfNeeded();
      assert.ok(await p.getByTestId('story-person').isVisible());
      assert.ok((await p.getByTestId('story-chapters').innerText()).length > 0);
      await noOverflow(p, `mobile ${width} story history`);
      await install(p, storyConsequenceFixture());
      await navigate(p, 'life');
      assert.ok((await p.getByTestId('story-effects').innerText()).length > 20);
      await noOverflow(p, `mobile ${width} story consequence`);
      if (width === 390) await capture(p, '11-mobile-story', true);
    });
    await check(`Mobile ${width}px shows four local sects and all twenty regional cultures`, async () => {
      await install(p); await navigate(p, 'sect');
      assert.equal(await p.locator('[data-testid^="sect-card-"]').count(), 4);
      for (const region of REGIONS) {
        await p.getByTestId(`sect-region-${region.id}`).click();
        const local = SECTS.filter(sect => sect.home === region.id);
        assert.equal(await p.locator('[data-testid^="sect-card-"]').count(), 4);
        for (const sect of local) {
          const card = p.getByTestId(`sect-card-${sect.id}`);
          await card.locator('summary').click();
          assert.ok((await card.innerText()).includes(sect.specialty.name));
          assert.equal(await p.getByTestId(`join-${sect.id}`).isDisabled(), region.id !== 'qinglan' || sect.minRealm > 2 || sect.reputation > 55);
          await noOverflow(p, `mobile ${width} ${sect.name}`); await card.locator('summary').click();
        }
      }
      await p.getByTestId('sect-region-qinglan').click();
      await p.getByTestId('sect-card-cloudledger').locator('summary').click();
      if (width === 390) await capture(p, '15-local-sects-mobile', true);
    });
    await check(`Mobile ${width}px a three-stage expedition saves, reloads and shows its result`, async () => {
      await completeSpringThroughUI(p, `mobile ${width}`);
      await capture(p, `12-mobile-expedition-result-${width}`);
    });
    await mobile.close();
  }
  assert.deepEqual(errors, [], 'Browser console and page errors must be empty.');
  console.log('BROWSER_REPORT', JSON.stringify({ passed: results.filter(r => r.passed).length, errors, results }));
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ testedAt: new Date().toISOString(), url: baseURL, errors, results }, null, 2));
} catch (error) {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ testedAt: new Date().toISOString(), url: baseURL, errors, results, failure: String(error) }, null, 2));
  console.error(error); process.exitCode = 1;
} finally { await browser.close(); }
