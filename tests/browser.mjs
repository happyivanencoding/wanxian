import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { act, autoChoice, createGame, getEvent, itemPrice, random, travelPrice } from '../src/game/engine.ts';
import { REALMS } from '../src/game/data.ts';
import { HISTORY_CHAPTERS, worldYear } from '../src/game/history.ts';
import { bindRelationshipEvent } from '../src/game/relationships.ts';
import { preparationTarget } from '../src/game/progression.ts';
import { SAVE_KEY, newProfile, parseProfile, settleProfile, validGame } from '../src/game/storage.ts';
import { withLegacyPeers, ordinaryYear } from './fixtures.ts';

const baseURL = process.env.APP_URL || 'http://localhost:5188';
const visualOnly = process.argv.includes('--visual'), publicRun = process.argv.includes('--public');
const output = path.resolve(`.artifacts/${publicRun ? 'world-public' : visualOnly ? 'world-visual' : 'world-browser'}`);
await fs.mkdir(output, { recursive: true });
assert.equal((await fetch(baseURL)).status, 200, 'The application must be running.');
const config = { name: '沈听澜', gender: '女修', origin: 'merchant', era: 'peace', region: 'qinglan', route: 'balanced', mode: 'seeker', fastStart: false, seed: 'continuous-browser' };
const sections = ['practice', 'world', 'sect', 'home', 'inventory', 'people', 'life', 'chronicle', 'archives'];
const results = [], errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let activePage;
function profileOf(game) {
  const profile = settleProfile(newProfile(), game);
  Object.assign(profile.settings, { directorEnabled: false, reducedMotion: true, speed: 8 });
  return profile;
}
function fixture() {
  const g = withLegacyPeers(createGame(config));
  Object.assign(g, { age: 28, realm: 2, lifespan: 260, progress: 230, stones: 3500, totalStones: 3500, pending: null, rng: 0 });
  Object.assign(g.stats, { health: 90, mind: 85, insight: 85, foundation: 85, alchemy: 80, reputation: 65, combat: 70 });
  Object.assign(g.inventory, { herb: 35, jade: 8, breakpill: 2, 'relic-jade': 1 });
  g.npcs.forEach(n => Object.assign(n, { age: 38, realm: 1, lifespan: 120, relation: 82, metAt: 20 }));
  g.history.lastYear = worldYear(g);
  g.seen[`history-${HISTORY_CHAPTERS[0].id}`] = 20;
  return profileOf(g);
}
async function context(width = 1440, height = 1000) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', acceptDownloads: true });
  if (!publicRun) await ctx.route('**/api/director/status', route => route.fulfill({ json: { configured: false } }));
  const page = await ctx.newPage(); activePage = page; page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(baseURL);
  return { ctx, page };
}
async function check(name, run) { await run(); results.push({ name, passed: true }); console.log('PASS', name); }
async function state(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY); }
async function changed(page, predicate, message = 'The action must change the persisted simulation') {
  for (let i = 0; i < 80; i++) { const value = await state(page); if (predicate(value)) return value; await page.waitForTimeout(25); }
  assert.fail(message);
}
async function close(page) { await page.getByRole('dialog').last().getByRole('button', { name: '关闭弹窗', exact: true }).click(); }
async function clearDialogs(page) { for (let i = 0; i < 6 && await page.getByRole('dialog').count(); i++) await close(page); }
async function nav(page, section) {
  if (section === 'journey') { if (await page.getByTestId('action-drawer').count()) await close(page); return; }
  if (!await page.getByTestId('action-drawer').count()) await page.getByTestId('open-actions').click();
  if (['sect', 'home', 'inventory'].includes(section) && !await page.locator('.drawer-advanced').evaluate(node => node.open)) await page.getByTestId('drawer-advanced').click();
  const row = page.locator(`[data-section="${section}"]`);
  if (!await row.evaluate(node => node.open)) await page.getByTestId(`drawer-${section}`).click();
}
async function install(page, profile = fixture()) {
  assert.ok(validGame(profile.game), 'Test scenario must be a valid import');
  await clearDialogs(page); await page.getByTestId('open-save').click();
  await page.getByTestId('import-save').setInputFiles({ name: 'scenario.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)) });
  await page.getByTestId('confirm-action').click();
  await changed(page, s => JSON.stringify(s.game) === JSON.stringify(profile.game));
  await page.getByTestId('global-status').waitFor();
}
async function nextYear(page) {
  await nav(page, 'journey');
  const before = (await state(page)).game.age;
  if ((await page.getByTestId('play-toggle').innerText()).includes('继续')) await page.getByTestId('play-toggle').click();
  await changed(page, s => s.game.age > before);
  if (!await page.getByRole('dialog').count() && (await page.getByTestId('play-toggle').innerText()).includes('暂停')) await page.getByTestId('play-toggle').click();
}
async function noOverflow(page, label) {
  const measurements = await page.evaluate(() => {
    const drawer = document.querySelector('.action-drawer .modal-body');
    return { width: innerWidth, document: document.documentElement.scrollWidth, drawer: drawer?.scrollWidth, drawerClient: drawer?.clientWidth };
  });
  assert.ok(measurements.document <= measurements.width + 1 && (!measurements.drawer || measurements.drawer <= measurements.drawerClient + 1), `${label}: ${JSON.stringify(measurements)}`);
}
async function shot(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' }); }
async function market(page, open = true) {
  const summary = page.getByTestId('market-toggle'), details = summary.locator('..');
  if ((await details.evaluate(node => node.open)) !== open) await summary.click();
}
const hooks = { random, log() {}, gain() {} };
function fatalProfile() {
  let g = fixture().game;
  g.npcs = []; bindRelationshipEvent(g, 'meet-heir', hooks); g.pending = 'meet-heir';
  g = act(g, { type: 'choose', index: getEvent(g).choices.findIndex(c => c.effect.flag?.endsWith(':take')) }).game;
  const enemy = g.npcs[0]; Object.assign(enemy, { realm: 4, lifespan: 1120, pursuitAt: g.age, gear: { name: '离火宝轮', tier: 4 } });
  g.realm = 1; g.stats.health = 25;
  bindRelationshipEvent(g, 'rival-pursuit', hooks); g.pending = 'rival-pursuit';
  for (let i = 1; i < 100; i++) { g.rng = i * 65537; if (!act(g, { type: 'choose', index: 0 }).game.alive) return profileOf(g); }
  throw new Error('No fatal combat seed found');
}

try {
  if (!visualOnly) {
    const { ctx, page } = await context();
    await check('Landing uses local assets and starts without an account', async () => {
      await page.getByTestId('start-life').waitFor(); await noOverflow(page, 'landing');
      const external = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => !r.name.startsWith(location.origin)).map(r => r.name));
      assert.deepEqual(external, []);
    });
    await check('A previous major save version is not silently migrated into this prototype', async () => {
      const old = fixture();
      old.version = 1; old.game.version = 1;
      await page.evaluate(({ profile, key }) => {
        localStorage.setItem('wanxian-life:profile:v1', JSON.stringify(profile));
        localStorage.removeItem(key);
      }, { profile: old, key: SAVE_KEY });
      await page.reload();
      await page.getByTestId('start-life').waitFor();
      assert.equal((await state(page)).game, null);
    });
    await check('Default birth is from zero, knows nobody, and does not require advanced setup', async () => {
      await page.getByTestId('start-life').click();
      assert.equal(await page.getByTestId('birth-advanced').evaluate(node => node.open), false);
      await page.getByTestId('birth-name').fill(config.name); await page.getByTestId('create-life').click();
      const profile = await changed(page, s => s.game?.name === config.name);
      assert.equal(profile.game.age, 0); assert.deepEqual(profile.game.npcs, []);
      assert.equal(await page.locator('.life-people').count(), 0);
    });
    await check('The annual bar advances and stops at a real childhood decision', async () => {
      await page.getByTestId('speed-select').selectOption('8');
      await page.getByTestId('event-choice-0').waitFor();
      const g = (await state(page)).game; assert.equal(g.age, 2); assert.equal(g.pending, 'child-pebble');
      await page.waitForTimeout(400); assert.equal((await state(page)).game.age, 2);
      await page.getByTestId('event-choice-0').click();
      await changed(page, s => s.game.pending === null);
    });
    await check('A current v2 life retains the people actually known in this run', async () => {
      const known = fixture();
      await install(page, known); assert.deepEqual((await state(page)).game.npcs, known.game.npcs);
      assert.equal(await page.locator('.life-people-row > button').count(), 4);
    });
    await check('Choices conceal numeric rewards until the result is recorded in the life log', async () => {
      const p = fixture(); p.game.pending = 'child-root'; p.game.seen['child-root'] = 6;
      await install(page, p);
      const option = await page.getByTestId('event-choice-0').innerText();
      assert.doesNotMatch(option, /修为\s*\+\s*10|悟性\s*\+\s*3/);
      await page.getByTestId('event-choice-0').click();
      const after = (await changed(page, s => s.game.pending === null)).game;
      assert.match(after.logs.at(-1).text, /本次变化：/);
      assert.match(after.logs.at(-1).text, /修为/);
    });
    await check('One action drawer exposes all tools without replacing the main life scene', async () => {
      await install(page); await page.evaluate(() => { window.lifeScene = document.querySelector('[data-testid="cultivation-home"]'); });
      await page.getByTestId('open-actions').click();
      assert.equal(await page.locator('.drawer-sections > details').count(), 7);
      assert.equal(await page.locator('.sidebar, .mobile-bottom-nav').count(), 0);
      await nav(page, 'inventory');
      assert.ok(await page.evaluate(() => window.lifeScene === document.querySelector('[data-testid="cultivation-home"]')));
      assert.equal(await page.getByRole('tablist').count(), 0);
      await close(page);
    });
    await check('Opening pauses time, closing resumes prior playback, and a manual pause remains paused', async () => {
      await install(page); await page.getByTestId('play-toggle').click(); await page.getByTestId('open-actions').click();
      const before = (await state(page)).game.age; await page.waitForTimeout(500); assert.equal((await state(page)).game.age, before);
      await close(page); await changed(page, s => s.game.age > before);
      await clearDialogs(page); await install(page); await page.getByTestId('open-actions').click(); await close(page);
      const paused = (await state(page)).game.age; await page.waitForTimeout(400); assert.equal((await state(page)).game.age, paused);
    });
    await check('Drawer scrolling preserves background position and keeps action count in view', async () => {
      await install(page); await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 180));
      const background = await page.evaluate(() => scrollY);
      const trigger = await page.getByTestId('open-actions').boundingBox();
      assert.ok(trigger.y >= 0 && trigger.height >= 43.5);
      // Locator clicks auto-scroll sticky targets; a real pointer preserves this precondition.
      await page.mouse.click(trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
      await nav(page, 'inventory'); await market(page);
      await page.locator('.action-drawer .modal-body').evaluate(node => { node.scrollTop = node.scrollHeight; });
      const bounds = await page.getByTestId('drawer-resources').boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= page.viewportSize().height);
      await page.getByRole('button', { name: '返回行事总览' }).click();
      assert.equal(await page.locator('.drawer-sections > details[open]').count(), 0);
      await page.keyboard.press('Escape'); assert.equal(await page.getByTestId('action-drawer').count(), 0);
      assert.ok(Math.abs((await page.evaluate(() => scrollY)) - background) <= 2, `Background changed from ${background} to ${await page.evaluate(() => scrollY)}`);
      await page.setViewportSize({ width: 1440, height: 1000 });
    });
    await check('The drawer traps keyboard focus and returns it to the opening button', async () => {
      await page.evaluate(() => window.scrollTo(0, 0)); await page.getByTestId('open-actions').click();
      for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); const focus = await page.evaluate(() => ({ inside: Boolean(document.activeElement?.closest('[role="dialog"]')), tag: document.activeElement?.tagName, name: document.activeElement?.getAttribute('aria-label'), html: document.activeElement?.outerHTML.slice(0, 180) })); if (!focus.inside) console.log('FOCUS ESCAPED', i, focus); assert.ok(focus.inside); }
      await page.keyboard.press('Escape'); assert.ok(await page.getByTestId('open-actions').evaluate(node => node === document.activeElement));
    });
    await check('Purchases charge the actual world price and use one action', async () => {
      await install(page); await nav(page, 'inventory'); await market(page);
      const before = (await state(page)).game, price = itemPrice(before, 'herb');
      await page.getByTestId('buy-herb').click(); const after = (await changed(page, s => s.game.inventory.herb === before.inventory.herb + 1)).game;
      assert.equal(after.stones, before.stones - price); assert.equal(after.actionsLeft, before.actionsLeft - 1);
    });
    await check('New equipment is immediately worn; unequipping and selling remain real actions', async () => {
      await install(page); await nav(page, 'inventory'); await market(page);
      await page.getByTestId('buy-sword').click(); await changed(page, s => s.game.equipped === 'sword');
      await market(page, false); assert.ok(await page.getByTestId('sell-sword').isDisabled());
      await page.getByTestId('use-sword').click(); await changed(page, s => s.game.equipped === null);
      await page.getByTestId('sell-sword').click(); await changed(page, s => s.game.inventory.sword === 0 && s.game.actionsLeft === 0);
      await market(page); assert.ok(await page.getByTestId('buy-herb').isDisabled());
    });
    await check('A purchased cultivation book is learned without another inventory task', async () => {
      await install(page); await nav(page, 'inventory'); await market(page);
      await page.getByTestId('buy-manual').click(); const g = (await changed(page, s => s.game.flags.includes('read-manual'))).game;
      assert.equal(g.inventory.manual, 0); assert.equal(g.actionsLeft, 2); assert.ok(await page.getByTestId('buy-manual').isDisabled());
    });
    await check('Unknown relics stay in the bag without use, sale or spoiled future rewards', async () => {
      await install(page); await nav(page, 'inventory');
      const relic = page.getByTestId('item-relic-jade'); assert.ok(await relic.isVisible());
      assert.equal(await relic.getByRole('button').count(), 0); assert.doesNotMatch(await relic.innerText(), /七桥|浮槎|悟性.*5/);
    });
    await check('Travel, construction and alchemy all work inside the same drawer', async () => {
      await install(page); await nav(page, 'world'); await page.getByTestId('region-river').click();
      const before = (await state(page)).game, fare = travelPrice(before, 'river');
      await page.getByTestId('travel-selected').click(); await changed(page, s => s.game.region === 'river' && s.game.stones === before.stones - fare);
      await nav(page, 'home'); await page.getByTestId('home-furnace').click(); await changed(page, s => s.game.home.furnace === 1);
      await nav(page, 'inventory'); await page.getByTestId('craft-toggle').click();
      const herbs = (await state(page)).game.inventory.herb; await page.getByTestId('craft-heal').click();
      await changed(page, s => s.game.inventory.herb === herbs - 3 && s.game.actionsLeft === 0);
      assert.ok(await page.getByTestId('action-drawer').isVisible());
    });
    await check('Sect entry and missions change membership and contributions', async () => {
      const story = fixture(); story.game.pending = 'region-qinglan-apprentice'; story.game.seen['region-qinglan-arrival'] = 18; story.game.seen['region-qinglan-dispute'] = 24;
      await install(page, story); await page.getByTestId('event-choice-0').click(); await changed(page, s => s.game.sect === 'qinglan'); await nav(page, 'sect');
      await page.getByTestId('sect-mission').click(); await changed(page, s => s.game.contribution === 22);
    });
    await check('A learned sect art grants its equipment once and returns from the reveal to the same drawer', async () => {
      const p = fixture(); p.game.sect = 'herb'; p.game.region = 'river'; p.game.contribution = 80;
      await install(page, p); await nav(page, 'sect'); await page.getByTestId('learn-specialty').click();
      await page.getByTestId('attainment-reveal').waitFor(); await close(page);
      assert.ok(await page.getByTestId('learn-specialty').isDisabled());
      const g = (await state(page)).game; assert.equal(g.inventory['sect-satchel'], 1); assert.equal(g.equipped, 'sect-satchel');
    });
    await check('Preparation opens a nested dialog, retains the drawer, and accumulates on a real year', async () => {
      await install(page); await nav(page, 'practice'); await page.getByTestId('preparation-methods').click();
      await page.getByTestId('prepare-meditate').click(); await changed(page, s => s.game.preparation?.selected === 'meditate');
      assert.ok(await page.getByTestId('action-drawer').isVisible());
      await page.getByTestId('preparation-focus').click(); await nextYear(page);
      await changed(page, s => s.game.preparation?.progress.meditate > 0);
    });
    await check('A prepared breakthrough consumes resources and grants a durable attainment', async () => {
      const p = fixture(); p.game.progress = REALMS[2].need; p.game.preparation = { realm: 2, selected: 'meditate', progress: { temper: 0, meditate: preparationTarget(2, 'meditate'), medicine: 0 } };
      for (let i = 1; i < 100; i++) { p.game.rng = i * 65537; if (act(p.game, { type: 'breakthrough' }).game.realm === 3) break; }
      await install(page, p); await page.getByTestId('breakthrough-open').click(); await page.getByTestId('confirm-breakthrough').click();
      await changed(page, s => s.game.realm === 3); await page.getByTestId('attainment-reveal').waitFor();
      assert.ok((await state(page)).game.flags.includes('attainment-2-meditate')); await close(page);
    });
    await check('An expedition carries causal stage choices, pauses years and consumes only its entry action', async () => {
      const p = fixture(); p.game.actionsLeft = 1; p.game.pending = 'venture-spring';
      await install(page, p); await page.getByTestId('event-choice-0').click();
      await changed(page, s => s.game.expeditions?.active?.stage === 0); assert.equal((await state(page)).game.actionsLeft, 0);
      await page.getByTestId('expedition-choice-map').click(); await changed(page, s => s.game.expeditions?.active?.stage === 1);
      assert.match(await page.getByTestId('expedition-scene').innerText(), /排水道/);
      await close(page); await page.waitForTimeout(400); assert.equal((await state(page)).game.age, 28);
      await page.getByTestId('expedition-resume').click(); await page.getByTestId('expedition-choice-channel').click();
      await page.getByTestId('expedition-choice-clear').click(); await changed(page, s => s.game.expeditions?.completed?.length === 1);
      await page.getByTestId('attainment-reveal').waitFor(); await close(page); assert.ok((await state(page)).game.expeditions.completed.some(result => /清泉洗髓/.test(result.title)));
      assert.equal((await state(page)).game.actionsLeft, 0);
    });
    await check('People show their actual ages and interactions change only a valid living relationship', async () => {
      await install(page); await nav(page, 'people'); assert.match(await page.locator('.people-grid').innerText(), /38/);
      const before = (await state(page)).game; await page.getByTestId('talk-peer-1').click();
      const after = (await changed(page, s => s.game.actionsLeft === 2)).game;
      assert.ok(after.npcs[1].relation > before.npcs[1].relation); assert.ok(await page.getByTestId('talk-peer-1').isDisabled());
    });
    await check('A later world scene recognizes the retained relic without a manual use action', async () => {
      const p = fixture(); p.game.age = 39; p.game.region = 'river'; p.game.history.lastYear = 2339;
      await install(page, p); await nextYear(page);
      const g = (await state(page)).game; assert.ok(g.flags.includes('relic-known:relic-jade'));
      assert.equal(g.inventory['relic-jade'], 1); assert.ok(g.logs.some(entry => entry.title === '旧物有了来历'));
      await clearDialogs(page); await nav(page, 'inventory'); assert.match(await page.getByTestId('item-relic-jade').innerText(), /已辨来历/);
    });
    await check('Current world history is visible but future chapters are not spoiled', async () => {
      await install(page); await nav(page, 'world');
      assert.match(await page.getByTestId('world-history').innerText(), /2328/);
      assert.equal(await page.locator('[data-testid^="faction-"]').count(), 5);
      assert.doesNotMatch(await page.getByTestId('world-history').innerText(), /天门重光|后来者之世/);
    });
    await check('Historical faction decline changes the displayed sect allowance, not just flavor text', async () => {
      const p = fixture(); p.game.sect = 'qinglan'; p.game.history.strength.sword = 10;
      await install(page, p); await nav(page, 'sect'); assert.match(await page.getByTestId('sect-allowance').innerText(), /0/);
      assert.match(await page.locator('.sect-hero').innerText(), /闭山/);
    });
    await check('A known enemy has no gift/friend buttons and actual equipment is displayed', async () => {
      const p = fatalProfile(); p.game.pending = null;
      await install(page, p); await nav(page, 'people');
      assert.match(await page.locator('.people-grid').innerText(), /仇人|仇敌/); assert.match(await page.locator('.people-grid').innerText(), /离火宝轮/);
      assert.equal(await page.getByTestId(`talk-${p.game.npcs[0].id}`).count(), 0);
    });
    await check('Lethal pursuit presents the danger and archives the actual killer after the chosen fight', async () => {
      const p = fatalProfile(), name = p.game.npcs[0].name;
      await install(page, p); await page.getByTestId('event-choice-0').waitFor();
      assert.match(await page.getByTestId('event-choice-0').innerText(), /陨落/);
      await page.getByTestId('event-choice-0').click(); const after = await changed(page, s => !s.game.alive);
      assert.equal(after.game.ending, '旧怨中陨落'); assert.ok(after.game.endingText.includes(name)); assert.equal(after.archives.length, 1);
      await clearDialogs(page); await nav(page, 'archives'); assert.ok((await page.locator('.drawer-section-body').innerText()).includes(name));
    });
    await check('Manual save, export, overwrite confirmation and loading retain complete state', async () => {
      await install(page); await page.getByTestId('open-save').click(); await page.getByTestId('save-slot-0').click();
      await changed(page, s => Boolean(s.slots[0]));
      await page.getByTestId('save-slot-0').click(); await page.getByTestId('confirm-action').waitFor(); await close(page);
      const downloadPromise = page.waitForEvent('download'); await page.getByTestId('export-save').click();
      const download = await downloadPromise; await download.saveAs(path.join(output, 'export.json'));
      const parsed = parseProfile(await fs.readFile(path.join(output, 'export.json'), 'utf8')); assert.equal(parsed.slots[0].game.age, 28);
      await close(page); await nextYear(page); await clearDialogs(page);
      await page.getByTestId('open-save').click(); await page.getByTestId('load-slot-0').click(); await page.getByTestId('confirm-action').click();
      await changed(page, s => s.game.age === 28); assert.equal(await page.getByTestId('action-drawer').count(), 0);
    });
    await check('Invalid imports never replace the active save or bypass confirmation', async () => {
      await install(page); await page.getByTestId('open-save').click(); const before = (await state(page)).game;
      for (const buffer of [Buffer.from('{broken'), Buffer.from(JSON.stringify({ ...fixture(), game: { ...before, npcs: [...before.npcs, before.npcs[0]] } }))]) {
        await page.getByTestId('import-save').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer });
        await page.locator('.import-message').waitFor(); assert.deepEqual((await state(page)).game, before);
        assert.equal(await page.getByTestId('confirm-action').count(), 0);
      }
      await close(page);
    });
    await check('Theme, duration and current life survive reload', async () => {
      await page.getByTestId('open-settings').click(); await page.getByTestId('settings-duration').selectOption('60');
      await page.getByLabel('界面主题', { exact: true }).selectOption('dark'); await close(page);
      const before = (await state(page)).game; await page.reload(); await page.getByTestId('global-status').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark'); assert.equal((await state(page)).settings.durationMinutes, 60);
      assert.deepEqual((await state(page)).game, before);
    });
    await check('Retirement requires confirmation and preserves the completed biography', async () => {
      await install(page); await page.getByTestId('open-settings').click(); await page.getByTestId('retire').click();
      assert.equal((await state(page)).game.alive, true); await page.getByTestId('confirm-action').click();
      await changed(page, s => !s.game.alive && s.archives.length === 1); await clearDialogs(page); await nav(page, 'archives');
      assert.match(await page.locator('.drawer-section-body').innerText(), /归隐山林/);
    });
    await ctx.close();
  }

  for (const theme of ['light', 'dark']) for (const width of (publicRun ? [390, 320, 1440] : [320, 360, 390, 768, 1440])) {
    await check(`${theme} ${width}px: all action sections fit, load art and retain a readable life scene`, async () => {
      const { ctx, page } = await context(width, width === 1440 ? 1000 : 844);
      const p = fixture(); p.settings.theme = theme; await install(page, p);
      await noOverflow(page, `${theme} ${width} life`); await shot(page, `${theme}-${width}-life`);
      const progress = await page.getByTestId('breakthrough-open').boundingBox(), dock = await page.locator('.time-dock').boundingBox();
      assert.ok(progress.y + progress.height < dock.y); assert.ok(progress.height >= 43.5);
      for (const section of sections) {
        await nav(page, section); await noOverflow(page, `${theme} ${width} ${section}`);
        assert.ok((await page.locator(`[data-section="${section}"] .drawer-section-body`).innerText()).length > 0);
        assert.ok(await page.evaluate(() => [...document.images].filter(img => img.getClientRects().length).every(img => img.complete && img.naturalWidth > 0)));
        if (width === 390) await shot(page, `${theme}-${width}-${section}`);
      }
      await close(page); assert.ok(await page.getByTestId('life-now').isVisible()); await ctx.close();
    });
  }
  assert.deepEqual(errors, [], 'No page exceptions or console errors');
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ baseURL, results, errors }, null, 2));
  console.log(`Completed ${results.length} browser checks; ${errors.length} errors.`);
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    await fs.writeFile(path.join(output, 'failure.txt'), `${error.stack}\n\n${await activePage.locator('body').innerText().catch(() => '')}`);
  }
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ baseURL, results, errors, failed: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
