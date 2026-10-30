/**
 * Persistent visual inventory for the pixel mobile UI.
 * Run with the local app at 5188: node tests/pixel-ui.mjs
 * Uses a fresh Chrome profile and the real save-import flow; no user saves touched.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createGame } from '../src/game/engine.ts';
import { REALMS } from '../src/game/data.ts';
import { SAVE_KEY, newProfile, settleProfile, parseProfile } from '../src/game/storage.ts';

const baseURL = process.env.APP_URL || 'http://localhost:5188';
const output = path.resolve('.artifacts/pixel-ui');
const pages = ['journey', 'opportunities', 'world', 'sect', 'home', 'inventory', 'life', 'people', 'chronicle', 'archives'];
const assetPaths = ['/art/pixel-scene.png', '/art/pixel-portraits.png', '/art/pixel-items.png'];
const config = { name: '林听澜', gender: '女修', origin: 'merchant', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: false, seed: 'pixel-ui-systems' };
const manifest = { viewport: { width: 390, height: 844 }, themes: ['light', 'dark'], expectedPages: pages, assets: [], surfaces: [], errors: [], passed: false };
await fs.mkdir(output, { recursive: true });
assert.equal((await fetch(baseURL)).status, 200, 'Start the local game on port 5188 before visual validation.');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let currentPage;

function fixture(theme) {
  const game = createGame(config);
  Object.assign(game, { id: 'pixel-ui-current-life', age: 28, realm: 2, progress: REALMS[2].need, lifespan: 260, stones: 3500, totalStones: 3500, pending: null, rng: 0, actionsLeft: 3 });
  Object.assign(game.stats, { health: 90, mind: 85, insight: 85, foundation: 85, alchemy: 70, reputation: 55 });
  Object.assign(game.inventory, { herb: 35, jade: 8, breakpill: 2, sword: 1 });
  Object.assign(game.home, { furnace: 1, garden: 1 });
  game.npcs.forEach(npc => Object.assign(npc, { age: 28, realm: 1, lifespan: 120, relation: 82 }));
  const profile = settleProfile(newProfile(), game);
  Object.assign(profile.settings, { theme, durationMinutes: 60, reducedMotion: true, directorEnabled: false });
  return parseProfile(JSON.stringify(profile));
}
async function state(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY); }
async function waitState(page, predicate) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const value = await state(page);
    if (predicate(value)) return value;
    await page.waitForTimeout(25);
  }
  assert.fail('The visible action did not update the saved state.');
}
async function close(page) {
  const button = page.getByRole('button', { name: '关闭弹窗', exact: true });
  if (await button.count()) await button.click();
}
async function pause(page) {
  const button = page.getByTestId('play-toggle');
  if (await button.count() && await button.isEnabled() && (await button.innerText()).includes('暂停')) await button.click();
}
async function install(page, profile) {
  await close(page);
  await page.getByTestId('open-save').click();
  await page.getByTestId('import-save').setInputFiles({ name: 'pixel-ui-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(profile)) });
  await page.getByTestId('confirm-action').click();
  await waitState(page, value => JSON.stringify(value.game) === JSON.stringify(profile.game));
  await page.getByTestId('global-status').waitFor();
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, profile.settings.theme);
  await pause(page);
}
async function navigate(page, id) {
  const management = ['inventory', 'home', 'sect', 'world'].includes(id);
  const personal = ['life', 'people', 'chronicle', 'archives'].includes(id);
  await page.getByTestId(`mobile-nav-${management ? 'management' : personal ? 'life' : id}`).click();
  if (management || personal) await page.getByTestId(`subnav-${id}`).click();
  if (id === 'journey') await pause(page);
}
async function snapshot(page, theme, surface, pageId, target) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const modal = page.getByRole('dialog');
  const isModal = await modal.count() > 0;
  if (isModal) await modal.evaluate(element => { element.scrollTop = 0; element.querySelector('.modal-body').scrollTop = 0; });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
  });
  const evidence = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const imageNodes = [...document.images].filter(img => img.src.includes('/art/'));
    const backgrounds = [...document.querySelectorAll('.pixel-sprite,.pixel-portrait-face')].map(node => getComputedStyle(node).backgroundImage);
    return {
      documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
      design: document.documentElement.dataset.design || document.querySelector('[data-design]')?.getAttribute('data-design'),
      theme: document.documentElement.dataset.theme,
      modalBackground: dialog ? getComputedStyle(dialog).backgroundColor : null,
      modalWidth: dialog?.scrollWidth ?? null, modalClientWidth: dialog?.clientWidth ?? null,
      images: imageNodes.map(img => ({ url: new URL(img.src).pathname, loaded: img.complete && img.naturalWidth > 0 })),
      spriteBackgrounds: [...new Set(backgrounds)],
    };
  });
  assert.equal(evidence.design, 'pixel', `${surface}: old UI or missing pixel root marker`);
  assert.equal(evidence.theme, theme);
  assert.ok(evidence.documentWidth <= evidence.viewportWidth + 1, `${surface}: horizontal page overflow ${evidence.documentWidth}`);
  assert.ok(evidence.images.every(img => img.loaded), `${surface}: missing landscape image`);
  assert.ok(evidence.spriteBackgrounds.every(background => background.includes('/art/pixel-')), `${surface}: missing local sprite atlas`);
  if (isModal) {
    assert.ok(evidence.modalWidth <= evidence.modalClientWidth + 1, `${surface}: horizontal dialog overflow`);
    const rgb = evidence.modalBackground.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    assert.ok(rgb.length === 3 && Math.max(...rgb) < 180, `${surface}: dialog retained a light paper background: ${evidence.modalBackground}`);
  }
  const screenshots = [`${theme}-${surface}.png`];
  await page.screenshot({ path: path.join(output, screenshots[0]), fullPage: !isModal, animations: 'disabled' });
  if (isModal) {
    const scrolling = await modal.evaluate(element => {
      const body = element.querySelector('.modal-body');
      const scroller = element.scrollHeight > element.clientHeight + 24 ? element : body;
      return { selector: scroller === element ? '.modal' : '.modal-body', max: scroller.scrollHeight - scroller.clientHeight, step: Math.max(200, scroller.clientHeight - element.querySelector('.modal-header').clientHeight - 40) };
    });
    if (scrolling.max > 24) {
      const offsets = [];
      for (let top = scrolling.step; top < scrolling.max; top += scrolling.step) offsets.push(top);
      offsets.push(scrolling.max);
      for (const [index, top] of offsets.entries()) {
        await page.locator(scrolling.selector).evaluate((element, offset) => { element.scrollTop = offset; }, top);
        const suffix = index === offsets.length - 1 ? 'bottom' : `part${index + 2}`;
        screenshots.push(`${theme}-${surface}-${suffix}.png`);
        await page.screenshot({ path: path.join(output, screenshots.at(-1)), animations: 'disabled' });
      }
    }
  }
  const reachable = target || (isModal ? modal.getByRole('button', { name: '关闭弹窗', exact: true }) : page.getByTestId('open-settings'));
  await reachable.click({ trial: true, timeout: 5000 });
  assert.equal(manifest.errors.length, 0, 'Browser JavaScript/console errors detected');
  manifest.surfaces.push({ theme, surface, page: pageId, modal: isModal, passed: true, buttonReachable: true, screenshots, ...evidence });
  console.log(`PASS ${theme} ${surface}`);
}

try {
  for (const theme of manifest.themes) {
    const context = await browser.newContext({ viewport: manifest.viewport, isMobile: true, hasTouch: true, acceptDownloads: true, locale: 'zh-CN', timezoneId: 'UTC' });
    await context.route('**/api/director/status', route => route.fulfill({ json: { configured: false } }));
    const page = await context.newPage(); currentPage = page;
    page.on('pageerror', error => manifest.errors.push({ theme, type: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') manifest.errors.push({ theme, type: 'console', message: message.text() }); });
    await page.goto(baseURL);
    await page.getByTestId('start-life').waitFor();
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByTestId('theme-toggle').click();
    for (const asset of assetPaths) {
      const response = await context.request.get(`${baseURL}${asset}`);
      assert.equal(response.status(), 200, `Missing pixel asset ${asset}`);
      const dimensions = await page.evaluate(async src => {
        const image = new Image(); image.src = src; await image.decode();
        return { width: image.naturalWidth, height: image.naturalHeight };
      }, asset);
      assert.ok(dimensions.width > 0 && dimensions.height > 0);
      manifest.assets.push({ theme, path: asset, status: response.status(), decoded: true, ...dimensions });
    }
    await snapshot(page, theme, 'landing', 'landing', page.getByTestId('start-life'));
    await page.getByTestId('start-life').click();
    await page.getByTestId('birth-name').fill('林听澜');
    await snapshot(page, theme, 'birth', 'landing', page.getByTestId('create-life'));
    await close(page);

    await install(page, fixture(theme));
    for (const id of pages) {
      await navigate(page, id);
      await snapshot(page, theme, `page-${id}`, id);
    }
    await navigate(page, 'sect');
    await page.getByTestId('sect-card-qinglan').locator('summary').click();
    await snapshot(page, theme, 'sect-expanded', 'sect', page.getByTestId('join-qinglan'));
    await page.getByTestId('join-qinglan').click();
    await waitState(page, value => value.game.sect === 'qinglan');
    await snapshot(page, theme, 'sect-joined', 'sect', page.getByTestId('sect-mission'));
    await navigate(page, 'inventory');
    await page.getByTestId('tab-market').click();
    await snapshot(page, theme, 'inventory-market', 'inventory', page.getByTestId('buy-herb'));
    await page.getByTestId('tab-craft').click();
    await snapshot(page, theme, 'inventory-craft', 'inventory', page.getByTestId('craft-heal'));

    await page.getByTestId('open-settings').click();
    await snapshot(page, theme, 'settings', 'inventory', page.locator('.settings-guide'));
    await page.locator('.settings-guide').click();
    await snapshot(page, theme, 'help', 'inventory');
    await close(page);
    await page.getByTestId('open-save').click();
    await snapshot(page, theme, 'save', 'inventory', page.getByTestId('save-slot-0'));
    await page.getByTestId('save-slot-0').click();
    await waitState(page, value => Boolean(value.slots[0]));
    await page.getByTestId('save-slot-0').click();
    await snapshot(page, theme, 'overwrite-confirm', 'inventory', page.getByTestId('confirm-action'));
    await page.getByTestId('confirm-action').click();
    const beforeInvalid = (await state(page)).game;
    await page.getByTestId('import-save').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
    await page.locator('.import-message').waitFor();
    await snapshot(page, theme, 'invalid-import', 'inventory');
    assert.deepEqual((await state(page)).game, beforeInvalid);
    await close(page);

    await navigate(page, 'journey');
    await page.getByTestId('focus-picker').click();
    await page.locator('.manual-focus > summary').click();
    await snapshot(page, theme, 'focus-picker', 'journey', page.getByTestId('focus-rest'));
    await page.getByTestId('focus-rest').click();
    await waitState(page, value => value.game.focus === 'rest');
    await page.getByTestId('cultivation-details').locator('summary').first().click();
    await page.getByTestId('preparation-methods').click();
    await snapshot(page, theme, 'preparation-methods', 'journey', page.getByTestId('prepare-temper'));
    await page.getByTestId('prepare-temper').click();
    await waitState(page, value => value.game.preparation?.selected === 'temper');
    await page.getByTestId('breakthrough-open').click();
    await snapshot(page, theme, 'breakthrough', 'journey', page.getByTestId('confirm-breakthrough'));
    await page.getByTestId('confirm-breakthrough').click();
    await waitState(page, value => value.game.realm === 3);

    const eventProfile = settleProfile(newProfile(), createGame({ ...config, fastStart: true, seed: 'pixel-ui-event' }));
    Object.assign(eventProfile.settings, { theme, directorEnabled: false, reducedMotion: true });
    await install(page, eventProfile);
    if (!(await page.getByRole('dialog').count())) await page.getByTestId('pending-event').click();
    await page.getByTestId('event-choice-0').waitFor();
    await snapshot(page, theme, 'event-choices', 'journey', page.getByTestId('event-choice-0'));
    await page.getByTestId('event-choice-0').click();
    await waitState(page, value => value.game.pending === null);
    await pause(page);

    await install(page, fixture(theme));
    await navigate(page, 'opportunities');
    await page.getByTestId('expedition-start-spring').click();
    await waitState(page, value => value.game.expeditions?.active?.stage === 0);
    await snapshot(page, theme, 'expedition-active', 'opportunities', page.getByTestId('expedition-choice-map'));
    await page.getByTestId('expedition-choice-map').click();
    await waitState(page, value => value.game.expeditions?.active?.stage === 1);
    await snapshot(page, theme, 'expedition-stage-two', 'opportunities', page.getByTestId('expedition-choice-channel'));
    await page.getByTestId('expedition-choice-channel').click();
    await waitState(page, value => value.game.expeditions?.active?.stage === 2);
    await snapshot(page, theme, 'expedition-stage-three', 'opportunities', page.getByTestId('expedition-choice-clear'));
    await page.getByTestId('expedition-choice-clear').click();
    await page.getByTestId('attainment-reveal').waitFor();
    await snapshot(page, theme, 'attainment', 'opportunities');
    await close(page);
    await page.getByTestId('expedition-result').waitFor();
    await snapshot(page, theme, 'expedition-completed', 'opportunities');

    const empty = fixture(theme); empty.game.inventory = {}; empty.game.equipped = null;
    await install(page, empty); await navigate(page, 'inventory');
    await page.getByTestId('tab-bag').click();
    await page.getByRole('heading', { name: '行囊清简' }).waitFor();
    await snapshot(page, theme, 'inventory-empty', 'inventory', page.getByTestId('tab-market'));

    await install(page, fixture(theme));
    await page.getByTestId('open-settings').click();
    await page.getByTestId('retire').click();
    await snapshot(page, theme, 'retire-confirm', 'journey', page.getByTestId('confirm-action'));
    await page.getByTestId('confirm-action').click();
    await waitState(page, value => value.game.ending === '归隐山林' && value.archives.length === 1);
    await snapshot(page, theme, 'ending', 'journey');
    await close(page); await navigate(page, 'archives');
    await page.locator('.archive-card').first().click();
    await page.getByTestId('export-biography').waitFor();
    await snapshot(page, theme, 'archive-selected', 'archives', page.getByTestId('export-biography'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-biography').click();
    const download = await downloadPromise;
    await download.saveAs(path.join(output, `${theme}-biography.txt`));
    assert.match(await fs.readFile(path.join(output, `${theme}-biography.txt`), 'utf8'), /归隐山林/);
    assert.deepEqual(manifest.surfaces.filter(surface => surface.theme === theme && surface.surface.startsWith('page-')).map(surface => surface.page), pages);
    await context.close(); currentPage = undefined;
  }
  assert.equal(manifest.errors.length, 0);
  manifest.passed = true;
  console.log(`PASS ${manifest.surfaces.length} pixel UI surfaces across both themes`);
} catch (error) {
  manifest.failure = error.stack || String(error);
  if (currentPage) await currentPage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true, animations: 'disabled' }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
}
