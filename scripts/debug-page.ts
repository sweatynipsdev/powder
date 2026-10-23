// Diagnostics for one route of the production build at iPhone size: console output, page
// errors, and any element wider than the viewport.
//   npx tsx scripts/debug-page.ts '#/r/palisades'
import { devices, webkit } from 'playwright';
import { preview } from 'vite';

const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'warn' });
const browser = await webkit.launch();
const page = await (await browser.newContext({ ...devices['iPhone 14'], serviceWorkers: 'block' })).newPage();
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:4175/${process.argv[2] ?? '#/'}`);
await page.waitForTimeout(2500);
const wide = await page.evaluate(() => {
  const vw = window.innerWidth;
  return [...document.querySelectorAll('body *')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.right > vw + 1)
    .slice(0, 12)
    .map(({ el, r }) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)} width=${Math.round(r.width)}`);
});
console.log('viewport', await page.evaluate(() => `${innerWidth} scrollWidth=${document.documentElement.scrollWidth}`));
console.log(wide.join('\n'));
await browser.close();
server.httpServer.close();
