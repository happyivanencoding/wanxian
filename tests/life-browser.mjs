import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { createGame } from '../src/game/engine.ts';
import { SAVE_KEY, newProfile, settleProfile } from '../src/game/storage.ts';

const output = path.resolve('.artifacts/life-browser');
await fs.mkdir(output, { recursive: true });
let staticServer;
let baseURL = process.env.APP_URL || 'http://localhost:5188';
if (process.env.STATIC_DIR) {
  const root = path.resolve(process.env.STATIC_DIR);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  staticServer = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const relative = decodeURIComponent(url.pathname.replace(/^\/wanxian\//, '')) || 'index.html';
    const file = path.resolve(root, relative);
    try {
      if (!file.startsWith(root + path.sep)) throw new Error('Not found');
      const bytes = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${staticServer.address().port}/wanxian/`;
}
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [], requests = [];
async function check(name, fn) { await fn(); checks.push(name); console.log('PASS', name); }
const state = p => p.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
async function settle(p, predicate) {
  for (let i = 0; i < 80; i++) { const current = await state(p); if (predicate(current)) return current; await p.waitForTimeout(25); }
  assert.fail('The interaction did not produce the expected saved state.');
}
function scenario() {
  const g = createGame({ name: '沈见微', gender: '女修', origin: 'merchant', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: true, seed: 'life-browser', guided: true });
  Object.assign(g, { age: 40, realm: 2, lifespan: 260, progress: 180, stones: 300, pending: 'life-pill' });
  g.seen['life-pill'] = 40;
  g.npcs.forEach(npc => Object.assign(npc, { age: 40, realm: 2, lifespan: 260, relation: 65 }));
  const profile = settleProfile(newProfile(), g); profile.settings.directorEnabled = false; profile.settings.durationMinutes = 60;
  return profile;
}
async function importProfile(p, profile) {
  if (await p.getByRole('dialog').count()) await p.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await p.getByTestId('open-save').click();
  await p.getByTestId('import-save').setInputFiles({ name: 'life-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)) });
  await p.getByTestId('confirm-action').click();
  await settle(p, current => current.game.id === profile.game.id && current.game.age === profile.game.age);
}
async function noOverflow(p) { assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  p.on('pageerror', error => errors.push(error.message));
  p.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  p.on('request', request => requests.push(request.url()));
  if (!process.env.STATIC_DIR && !process.env.APP_URL) await p.route('**/api/director/status', route => route.fulfill({ json: { configured: false } }));
  await p.goto(baseURL);
  await check('Default birth needs no configuration and begins at age zero with daily care', async () => {
    await p.getByTestId('start-life').click();
    assert.equal(await p.getByTestId('birth-origin').isVisible(), false);
    await p.getByTestId('birth-name').fill('江照月');
    await p.screenshot({ path: path.join(output, 'birth-390.png') });
    await p.getByTestId('create-life').click();
    await p.getByTestId('play-toggle').click();
    const born = (await state(p)).game;
    assert.equal(born.age, 0); assert.equal(born.direction, 'seek');
    assert.equal(await p.getByTestId('life-person-peer-2').count(), 1);
    await noOverflow(p);
  });
  await check('Named choices, their immediate costs and the shared memory come from the saved engine', async () => {
    const profile = scenario(); await importProfile(p, profile);
    const name = profile.game.npcs[1].name;
    assert.ok((await p.getByRole('dialog').innerText()).includes(name));
    assert.match(await p.getByTestId('event-choice-2').innerText(), /失败损失药材/);
    await p.getByTestId('event-choice-1').click();
    const next = (await settle(p, current => current.game.flags.includes('life-dose-given'))).game;
    assert.equal(next.npcs[1].relation, profile.game.npcs[1].relation + 12);
    assert.equal(next.stones, profile.game.stones);
    await p.getByTestId('life-person-peer-1').click();
    assert.ok((await p.getByRole('dialog').innerText()).includes('把丹药留给对方'));
    await p.screenshot({ path: path.join(output, 'shared-memory-390.png') });
    await p.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  });
  await check('Changing a life direction persists and manual focus remains available', async () => {
    await p.getByTestId('focus-picker').click(); await p.getByTestId('direction-belong').click();
    await settle(p, current => current.game.direction === 'belong');
    await p.getByTestId('focus-picker').click(); await p.locator('.manual-focus > summary').click(); await p.getByTestId('focus-study').click();
    const current = (await settle(p, value => value.game.focus === 'study' && !value.game.direction)).game;
    assert.equal(current.direction, undefined);
    await p.getByTestId('focus-picker').click(); await p.getByTestId('direction-seek').click();
  });
  await check('A departed friend stays departed across a pending choice, reload and resolution', async () => {
    const profile = scenario(); profile.game.age = 90; profile.game.pending = 'life-pill-return'; profile.game.seen['life-pill-return'] = 90;
    profile.game.flags.push('life-dose-given'); profile.game.npcs[1].alive = false;
    await importProfile(p, profile); await p.reload();
    await p.getByTestId('event-choice-0').waitFor();
    assert.match(await p.getByRole('dialog').innerText(), /已经离世/);
    assert.ok((await p.getByRole('dialog').innerText()).includes(profile.game.npcs[1].name));
    await p.getByTestId('event-choice-0').click();
    const current = (await settle(p, value => !value.game.pending)).game;
    assert.equal(current.npcs[1].alive, false);
    assert.ok(current.flags.includes('life-medicine-open'));
    if ((await p.getByTestId('play-toggle').innerText()).includes('暂停')) await p.getByTestId('play-toggle').click();
  });
  await check('Unaffordable choices cannot be selected and the affordable alternatives work', async () => {
    const profile = scenario(); profile.game.stones = 0; await importProfile(p, profile);
    assert.ok(await p.getByTestId('event-choice-2').isDisabled());
    await p.getByTestId('event-choice-1').click();
    assert.equal((await settle(p, value => !value.game.pending)).game.stones, 0);
  });
  await check('Current v2 manual play can switch to a life direction', async () => {
    const profile = scenario(); delete profile.game.direction; profile.game.pending = null;
    await importProfile(p, profile);
    assert.equal((await state(p)).game.direction, undefined);
    await p.getByTestId('focus-picker').click(); await p.getByTestId('direction-peace').click();
    assert.equal((await settle(p, value => value.game.direction === 'peace')).game.direction, 'peace');
    await p.getByTestId('cultivation-details').locator('summary').first().click();
    assert.ok(await p.getByTestId('preparation-methods').isVisible());
  });
  for (const width of [320, 360, 390, 1440]) {
    await p.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await importProfile(p, scenario()); await p.getByTestId('event-choice-1').click();
    await p.waitForTimeout(350);
    await check(`Life view and relationship dialog fit ${width}px in both themes`, async () => {
      for (const theme of ['light', 'dark']) {
        if ((await state(p)).settings.theme !== theme) await p.getByTestId('theme-toggle').click();
        await p.evaluate(() => window.scrollTo(0, 0)); await noOverflow(p);
        const story = await p.getByTestId('life-now').locator('h1').boundingBox();
        const dock = await p.locator('.time-dock').boundingBox();
        assert.ok(story.y + story.height < dock.y, 'The current scene should appear before the controls at the bottom.');
        await p.screenshot({ path: path.join(output, `life-${width}-${theme}.png`) });
        await p.getByTestId('life-person-peer-1').click(); await noOverflow(p);
        await p.getByRole('button', { name: '关闭弹窗', exact: true }).click();
      }
    });
  }
  await check('All visible landscape assets load and there are no browser errors', async () => {
    assert.ok(await p.locator('.pixel-scene img').evaluateAll(images => images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0)));
    assert.deepEqual(errors, []);
    if (process.env.STATIC_DIR || process.env.PUBLIC_STATIC === '1') assert.equal(requests.some(url => url.includes('/api/director/')), false, 'Static publishing must not call an absent model backend.');
  });
  await context.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ baseURL, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, errors: errors.length, baseURL }));
} finally {
  await browser.close();
  if (staticServer) await new Promise(resolve => staticServer.close(resolve));
}
