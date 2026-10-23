// Browser checks against the production build (run `npm run build` first):
//   1. iPhone-sized screenshots in WebKit (Safari's engine) of every screen and resort tab
//   2. The app stays dark even when the phone is in light mode
//   3. Tapping works: a timeline day opens its details, the model chart shows a tooltip
//   4. Offline: once the service worker has cached the app and data, the app still loads
//      with the network off and says it's showing cached data.
//
//   npm run e2e [-- <screenshot dir>]     (default: screens/, gitignored)
//   E2E_URL=https://you.github.io/powder/ npm run e2e    check the deployed site instead

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, devices, type Page, webkit } from 'playwright';
import { preview } from 'vite';

const PORT = 4174;
const URL = process.env.E2E_URL ?? `http://localhost:${PORT}/`;
const out = process.argv[2] ?? 'screens';
mkdirSync(out, { recursive: true });

const HOME = '.fav';
const SUMMARY = 'section[aria-label="Snow summary"]';

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures.push(what);
};

async function shoot(page: Page, name: string, hash: string, ready: string) {
  await page.goto(URL + hash);
  await page.waitForSelector(ready, { timeout: 15_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const server = process.env.E2E_URL ? null : await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
try {
  // --- Screenshots (WebKit, iPhone) -------------------------------------------------
  const wk = await webkit.launch();
  const ctx = await wk.newContext({ ...devices['iPhone 14'], colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // A fresh phone starts on the default resorts, with a nudge to pick its own.
  await page.goto(URL);
  await page.waitForSelector(HOME);
  check(await page.locator('.hint').isVisible(), 'a new phone sees the "pick your resorts" banner');

  const screens: [string, string, string][] = [
    ['home', '#/', HOME],
    ['resorts', '#/resorts', '.search'],
    ['forecasts', '#/forecasts', '.post, .card'],
    ['roads', '#/roads', '.section-title'],
    ['palisades-summary', '#/r/palisades', SUMMARY],
    ['mammoth-summary', '#/r/mammoth', SUMMARY],
    ['mammoth-weather', '#/r/mammoth/weather', 'figure'],
    ['mammoth-report', '#/r/mammoth/report', '.section-title'],
    ['mammoth-forecast', '#/r/mammoth/forecast', '.post'],
    ['bigbear-summary', '#/r/bigbear', SUMMARY],
  ];
  const wide: string[] = [];
  for (const [name, hash, ready] of screens) {
    await shoot(page, name, hash, ready);
    if (!(await noOverflow(page))) wide.push(name);
  }
  check(wide.length === 0, `no horizontal page scroll at iPhone width${wide.length ? `: ${wide.join(', ')}` : ''}`);

  // Each chart at real size, for checking labels and geometry by eye.
  await page.goto(URL + '#/r/mammoth/weather');
  await page.waitForSelector('figure');
  const figures = page.locator('figure');
  for (let i = 0; i < (await figures.count()); i++) await figures.nth(i).screenshot({ path: join(out, `mammoth-chart-${i + 1}.png`) });

  // Timeline: tap a forecast day, as on the phone, and its details open.
  await page.goto(URL + '#/r/mammoth');
  await page.waitForSelector(SUMMARY);
  const day = page.locator(`${SUMMARY} button.col:not([disabled])`).nth(2);
  await day.tap();
  await page.waitForTimeout(200);
  check(await page.locator(`${SUMMARY} .detail`).isVisible(), 'tapping a timeline day shows its details');
  await page.locator(SUMMARY).screenshot({ path: join(out, 'mammoth-timeline.png') });

  // Cams load once scrolled into view (they're lazy, so full-page shots show them empty).
  const cam = page.locator('.cam img').first();
  await cam.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => (document.querySelector('.cam img') as HTMLImageElement | null)?.naturalWidth, null, { timeout: 10_000 }).catch(() => null);
  check(await cam.evaluate((img: HTMLImageElement) => img.naturalWidth > 0), 'resort cam image loads');
  await page.locator('.carousel').screenshot({ path: join(out, 'mammoth-cams.png') });

  // Model chart: tap for the tooltip.
  const plume = page.locator('[aria-label="Running snowfall totals by model"]');
  await plume.scrollIntoViewIfNeeded();
  const box = (await plume.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height / 2);
  await page.waitForTimeout(200);
  check(await page.locator('.tip').isVisible(), 'model chart tooltip appears on tap');
  await plume.screenshot({ path: join(out, 'tooltip.png') });

  // Favorites: unstar Big Bear on its page, it leaves Favorites and stays gone after a
  // reload; star it again from the Resorts tab and it's back.
  const bigBearOnHome = () => page.locator(`${HOME}[href="#/r/bigbear"]`).count();
  await page.goto(URL + '#/r/bigbear');
  await page.waitForSelector(SUMMARY);
  await page.getByRole('button', { name: /^Remove .* from favorites$/ }).tap();
  await page.goto(URL + '#/');
  await page.waitForSelector(HOME);
  check((await bigBearOnHome()) === 0, 'an unstarred resort leaves Favorites');
  await page.reload();
  await page.waitForSelector(HOME);
  check((await bigBearOnHome()) === 0, 'it stays unstarred after a reload');
  check((await page.locator('.hint').count()) === 0, 'the "pick your resorts" banner goes once you pick');
  await page.goto(URL + '#/resorts');
  await page.waitForSelector('.search');
  await page.locator('li:has(a[href="#/r/bigbear"]) button.star').tap();
  await page.goto(URL + '#/');
  await page.waitForSelector(HOME);
  check((await bigBearOnHome()) === 1, 'starring from the Resorts tab adds it back');

  // Back from a shared link goes to Favorites, even after switching tabs on the resort; from
  // inside the app it returns to where you came from.
  await page.goto(URL + '#/r/mammoth');
  await page.reload();
  await page.waitForSelector(SUMMARY);
  await page.locator('nav.tabs a', { hasText: 'Weather' }).tap();
  await page.waitForSelector('figure');
  await page.locator('a.back').tap();
  await page.waitForSelector(HOME);
  check(new globalThis.URL(page.url()).hash === '#/', 'Back from a shared link goes to Favorites, even after switching tabs');
  await page.goto(URL + '#/resorts');
  await page.waitForSelector('.search');
  await page.locator('a[href="#/r/june"]').tap();
  await page.waitForSelector(SUMMARY);
  await page.locator('a.back').tap();
  await page.waitForSelector('.search');
  check(new globalThis.URL(page.url()).hash === '#/resorts', 'Back returns to the Resorts list you came from');

  // Search ignores case and punctuation and filters the list.
  await page.goto(URL + '#/resorts');
  await page.fill('.search', 'MAM');
  const listed = await page.locator('li .name').allTextContents();
  check(listed.some((n) => /Mammoth/.test(n)) && !listed.some((n) => /Palisades/.test(n)), `resort search filters the list (${listed.join(', ')})`);

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
  await ctx.close();

  // Always dark: a phone in light mode still gets the dark app.
  const light = await wk.newContext({ ...devices['iPhone 14'], colorScheme: 'light', serviceWorkers: 'block' });
  const lp = await light.newPage();
  await lp.goto(URL);
  await lp.waitForSelector(HOME);
  const bg = await lp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
  check(r + g + b < 120, `dark even in light mode (body ${bg})`);
  await light.close();
  await wk.close();

  // --- Offline (Chromium: service worker support) ------------------------------------
  const cr = await chromium.launch();
  const octx = await cr.newContext({ ...devices['Pixel 7'] });
  const op = await octx.newPage();
  await op.goto(URL);
  await op.waitForSelector(HOME);
  await op.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload so the now-active worker controls the page and caches data as it's fetched.
  await op.reload();
  await op.waitForSelector(HOME);
  check(await op.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
  await op.goto(URL + '#/r/mammoth');
  await op.waitForSelector(SUMMARY);

  await octx.setOffline(true);
  await op.goto(URL);
  await op.reload();
  await op.waitForSelector(HOME, { timeout: 10_000 }).catch(() => null);
  check((await op.locator(HOME).count()) > 0, 'home renders offline from cache');
  check((await op.locator('text=Offline · showing data from').count()) > 0, 'offline banner is shown');
  await op.goto(URL + '#/r/mammoth');
  await op.waitForSelector(SUMMARY, { timeout: 10_000 }).catch(() => null);
  check((await op.locator(SUMMARY).count()) > 0, 'a visited resort renders offline');
  await op.screenshot({ path: join(out, 'offline.png'), fullPage: false });
  await cr.close();
} finally {
  if (server) await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : `\nAll browser checks passed. Screenshots in ${out}/`);
process.exit(failures.length ? 1 : 0);
