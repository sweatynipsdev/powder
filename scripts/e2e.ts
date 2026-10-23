// Browser checks against the production build (run `npm run build` first):
//   1. iPhone-sized screenshots in WebKit (Safari's engine), dark and light
//   2. Offline: once the service worker has cached the app and data, the app still loads
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

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? '✓' : '✗'} ${what}`);
  if (!ok) failures.push(what);
};

async function shoot(page: Page, name: string, hash: string, ready: string) {
  await page.goto(URL + hash);
  await page.waitForSelector(ready, { timeout: 15_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: true });
}

const server = process.env.E2E_URL ? null : await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
try {
  // --- Screenshots (WebKit, iPhone) -------------------------------------------------
  const wk = await webkit.launch();
  for (const scheme of ['dark', 'light'] as const) {
    const ctx = await wk.newContext({ ...devices['iPhone 14'], colorScheme: scheme, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await shoot(page, `home-${scheme}`, '#/', '.resort');
    await shoot(page, `palisades-${scheme}`, '#/r/palisades', 'figure');
    if (scheme === 'dark') {
      await shoot(page, 'mammoth-dark', '#/r/mammoth', 'figure');
      // Each chart at real size, for checking labels and geometry by eye.
      const figures = page.locator('figure');
      for (let i = 0; i < (await figures.count()); i++) await figures.nth(i).screenshot({ path: join(out, `mammoth-chart-${i + 1}.png`) });
      await page.locator('section.tiles').screenshot({ path: join(out, 'mammoth-totals.png') });
      await shoot(page, 'bigbear-dark', '#/r/bigbear', 'figure');
      // Tooltip: tap the snowfall chart, as on the phone.
      await page.goto(URL + '#/r/mammoth');
      const chart = page.locator('[aria-label="Daily snowfall forecast"]');
      await chart.scrollIntoViewIfNeeded();
      const box = (await chart.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height / 2);
      await page.waitForTimeout(200);
      await chart.screenshot({ path: join(out, 'tooltip-dark.png') });
      check(await page.locator('.tip').isVisible(), 'snowfall tooltip appears on tap');
    }
    check(errors.length === 0, `no page errors (${scheme})${errors.length ? `: ${errors.join('; ')}` : ''}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(!overflow, `no horizontal page scroll at iPhone width (${scheme})`);
    await ctx.close();
  }
  await wk.close();

  // --- Offline (Chromium: service worker support) ------------------------------------
  const cr = await chromium.launch();
  const ctx = await cr.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForSelector('.resort');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload so the now-active worker controls the page and caches data as it's fetched.
  await page.reload();
  await page.waitForSelector('.resort');
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker controls the page');
  await page.goto(URL + '#/r/mammoth');
  await page.waitForSelector('figure');

  await ctx.setOffline(true);
  await page.goto(URL);
  await page.reload();
  await page.waitForSelector('.resort', { timeout: 10_000 }).catch(() => null);
  check((await page.locator('.resort').count()) > 0, 'home renders offline from cache');
  check((await page.locator('text=Offline · showing data from').count()) > 0, 'offline banner is shown');
  await page.goto(URL + '#/r/mammoth');
  await page.waitForSelector('figure', { timeout: 10_000 }).catch(() => null);
  check((await page.locator('figure').count()) > 0, 'a visited resort renders offline');
  await page.screenshot({ path: join(out, 'offline.png'), fullPage: false });
  await cr.close();
} finally {
  if (server) await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : `\nAll browser checks passed. Screenshots in ${out}/`);
process.exit(failures.length ? 1 : 0);
