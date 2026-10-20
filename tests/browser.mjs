import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createGame, simulateLife } from '../src/game/engine.ts';
import { REALMS } from '../src/game/data.ts';
import { SAVE_KEY, newProfile, settleProfile, parseProfile } from '../src/game/storage.ts';

const baseURL = process.env.APP_URL || 'http://localhost:5188';
const output = path.resolve('.artifacts/browser');
await fs.mkdir(output, { recursive: true });
assert.equal((await fetch(baseURL)).status, 200, 'Start the local app before running browser tests.');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
const errors = [];
const config = { name: '林听澜', gender: '女修', origin: 'merchant', era: 'peace', route: 'balanced', mode: 'seeker', fastStart: true, seed: 'browser-life' };
const pages = ['journey', 'world', 'sect', 'home', 'inventory', 'people', 'chronicle', 'archives'];
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
async function navigate(p, id) { await p.getByTestId(`nav-${id}`).click(); }
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
  assert.equal((await p.getByTestId('status-stones').innerText()).trim(), Math.round(game.stones).toLocaleString('zh-CN'));
  assert.match(await p.getByTestId('status-actions').innerText(), new RegExp(`^${game.actionsLeft}\\s*\\/\\s*3$`));
  assert.ok((await ribbon.locator('.status-calendar').innerText()).includes(`${2300 + game.age}年`));
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
  assert.ok(bounds.top >= -1 && bounds.bottom <= 320 && bounds.within, `${label}: ribbon is not fully visible: ${JSON.stringify(bounds)}`);
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
async function install(p, profile = fixture()) {
  // Use the actual import flow: direct writes before reload are correctly overwritten by beforeunload autosave.
  if (await p.getByRole('dialog').count()) await close(p);
  await p.getByTestId('open-save').click();
  await p.getByTestId('import-save').setInputFiles({ name: 'scenario.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)) });
  await p.getByTestId('confirm-action').click();
  await waitState(p, s => JSON.stringify(s.game) === JSON.stringify(profile.game));
  await p.getByTestId('nav-journey').waitFor();
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
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
    assert.match(await page.getByTestId('year-clock').innerText(), /8.0 秒／年/);
    assert.match(await page.getByTestId('play-toggle').innerText(), /暂停/);
    const early = Number(await bar.getAttribute('aria-valuenow'));
    await page.waitForTimeout(380);
    const later = Number(await bar.getAttribute('aria-valuenow'));
    assert.ok(later > early, 'The year progress bar must move without pressing Play.');
    await page.getByRole('button', { name: '偏好设置', exact: true }).last().click();
    await page.getByTestId('settings-duration').selectOption('30');
    assert.equal((await state(page)).settings.durationMinutes, 30);
    await close(page);
    await navigate(page, 'journey');
    await page.getByTestId('speed-select').selectOption('8');
    assert.match(await page.getByTestId('year-clock').innerText(), /0.5 秒／年/);
    await page.waitForTimeout(160);
    const beforePause = Number(await bar.getAttribute('aria-valuenow'));
    await navigate(page, 'world');
    const pausedAge = (await state(page)).game.age;
    await page.waitForTimeout(420);
    assert.ok(Math.abs(Number(await bar.getAttribute('aria-valuenow')) - beforePause) <= 2);
    assert.equal((await state(page)).game.age, pausedAge);
    await navigate(page, 'journey');
  });
  await check('All eight screens render and have usable desktop layouts', async () => {
    for (const id of pages) {
      await navigate(page, id); await noOverflow(page, `desktop ${id}`); await assertGlobalStatus(page, `desktop ${id}`);
      assert.ok(await page.locator('main').innerText());
      if (['world', 'home', 'people'].includes(id)) await capture(page, `03-${id}-desktop`);
    }
  });
  await check('Global status remains pinned while scrolling a long page', async () => {
    await navigate(page, 'journey');
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
    await page.getByTestId('focus-study').click();
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
    await close(page); await page.waitForTimeout(700); assert.equal((await state(page)).game.age, 2);
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
  await check('Sect admission and mission award actual contributions', async () => {
    await install(page); await navigate(page, 'sect'); await page.getByTestId('join-qinglan').click();
    await waitState(page, s => s.game.sect === 'qinglan');
    await page.getByTestId('sect-mission').click(); await waitState(page, s => s.game.contribution === 22);
    await capture(page, '05-sect-desktop');
  });
  await check('Companion interaction is bounded per year and biography data can be exported', async () => {
    await install(page); await navigate(page, 'people'); const before = (await state(page)).game.npcs[0].relation;
    await page.getByTestId('talk-peer-0').click(); await waitState(page, s => s.game.npcs[0].relation === before + 7);
    assert.ok(await page.getByTestId('talk-peer-0').isDisabled());
    await navigate(page, 'chronicle');
    const downloadPromise = page.waitForEvent('download'); await page.getByTestId('export-chronicle').click();
    const d = await downloadPromise; await d.saveAs(path.join(output, 'chronicle.txt'));
    assert.match(await fs.readFile(path.join(output, 'chronicle.txt'), 'utf8'), /林听澜/);
  });
  await check('A major turning point visibly changes the destiny path and underlying annual rules', async () => {
    const chosen = fixture(); chosen.game.pending = 'fate-first'; chosen.game.seen['fate-first'] = 28;
    await install(page, chosen);
    await page.getByTestId('event-choice-1').click();
    const after = await waitState(page, s => s.game.flags.includes('fate-lone') && s.game.pending === null);
    assert.ok(after.game.stats.mind < chosen.game.stats.mind);
    await navigate(page, 'journey');
    assert.match(await page.getByTestId('fate-arc').innerText(), /孤峰问道/);
    assert.match(await page.getByTestId('fate-arc').innerText(), /修行.*1.16/);
    await navigate(page, 'world');
    await assertGlobalStatus(page, 'destiny path navigation');
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
    await page.waitForTimeout(1350);
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
  await check('A complete unmodified life runs through the browser timer to its real ending', async () => {
    const actual = settleProfile(newProfile(), createGame({ ...config, seed: 'browser-timer-10' }));
    actual.settings.speed = 8;
    await install(page, actual); await page.getByTestId('event-choice-0').click();
    await page.locator('.auto-toggle').click(); assert.ok(await page.getByTestId('auto-toggle').isChecked());
    await page.clock.install();
    if ((await page.getByTestId('play-toggle').innerText()).includes('继续')) await page.getByTestId('play-toggle').click();
    for (let i = 0; i < 180 && (await state(page)).game.alive; i++) await page.clock.runFor(6000);
    const end = (await state(page)).game;
    assert.equal(end.alive, false, 'Normal timer loop should reach a genuine ending.');
    assert.equal((await state(page)).archives.length, 1); assert.ok(end.choices > 10);
    results.push({ name: 'Natural life outcome', age: end.age, realm: REALMS[end.realm].name, ending: end.ending, choices: end.choices });
    await close(page); await navigate(page, 'archives'); await capture(page, '07-natural-life-ending');
  });
  await context.close();

  for (const width of [390, 360, 320]) {
    const mobile = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const p = await mobile.newPage(); watch(p); await p.goto(baseURL);
    await check(`Mobile ${width}px landing and birth dialog are reachable`, async () => {
      await noOverflow(p, 'mobile landing');
      if (width === 390) await capture(p, '08-mobile-landing', true);
      await p.getByTestId('start-life').click(); await noOverflow(p, 'mobile birth');
      await p.getByTestId('birth-name').fill('沈见山'); await p.getByTestId('create-life').click();
      await p.getByTestId('event-choice-0').waitFor(); await choosePending(p);
    });
    await check(`Mobile ${width}px all eight pages, dock and settings have no overflow`, async () => {
      for (const id of pages) { await navigate(p, id); await noOverflow(p, `mobile ${width} ${id}`); await assertGlobalStatus(p, `mobile ${width} ${id}`); }
      await navigate(p, 'journey');
      const dock = await p.locator('.time-dock').boundingBox(); const nav = await p.locator('.sidebar').boundingBox();
      assert.ok(dock.y + dock.height <= nav.y + 1, 'Time controls must not overlap mobile navigation.');
      if (width === 390) await capture(p, '09-mobile-journey');
      await p.getByTestId('open-settings').click(); assert.ok(await p.getByTestId('retire').isVisible());
      await p.getByRole('button', { name: '查看玩法说明与快捷键' }).click(); assert.match(await p.getByRole('dialog').innerText(), /初入仙途/); await close(p);
      await p.getByTestId('theme-toggle').click(); await waitState(p, s => s.settings.theme === 'dark');
      await noOverflow(p, 'mobile dark');
      if (width === 390) await capture(p, '10-mobile-night');
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
