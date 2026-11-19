// Render the local architecture HTMLs; never calls application APIs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(repo, 'docs/architecture/diagrams');
const bundledModule = resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : existsSync(bundledModule) ? pathToFileURL(bundledModule).href : 'playwright');
const bundledChromium = resolve(homedir(), '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome');
const executablePath = process.env.CHROMIUM_EXECUTABLE || (existsSync(bundledChromium) ? bundledChromium : undefined);
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--font-render-hinting=none'] });
const names = ['01-system-map', '02-identity-access', '03-order-lifecycle', '04-wallet-shipping', '05-inventory-aftersales', '06-admin-realtime-telegram', '07-ai-catalog-intelligence'];
const diagrams = [];

try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
  for (const name of names) {
    await page.goto(pathToFileURL(resolve(root, `${name}.html`)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '.scroller{border-radius:0!important;border:none!important}.canvas{border-radius:0!important}' });
    const check = await page.evaluate(() => {
      const canvas = document.querySelector('.canvas').getBoundingClientRect();
      return {
        nodes: document.querySelectorAll('.node').length,
        brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).length,
        overflow: [...document.querySelectorAll('.node')].filter(n => {
          const r = n.getBoundingClientRect();
          return r.left < canvas.left || r.right > canvas.right || r.top < canvas.top || r.bottom > canvas.bottom;
        }).map(n => n.textContent),
      };
    });
    await page.locator('.canvas').screenshot({ path: resolve(root, `${name}.png`) });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.locator('.canvas').screenshot({ path: resolve(root, `${name}-dark.png`) });
    diagrams.push({ diagram: name, ...check });
  }

  const atlasPath = resolve(root, 'project-flows.html');
  await page.goto(pathToFileURL(atlasPath).href);
  await page.evaluate(() => document.fonts.ready);
  const atlas = await page.evaluate(() => ({
    sections: document.querySelectorAll('.section').length,
    canvases: document.querySelectorAll('.canvas').length,
    unresolved: document.documentElement.outerHTML.includes('%%ICON_'),
    brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).length,
    sourceLinks: [...document.querySelectorAll('.files a')].map(a => a.getAttribute('href')),
  }));
  atlas.missingLocalSources = atlas.sourceLinks.filter(href => !existsSync(fileURLToPath(new URL(href, pathToFileURL(atlasPath)))));
  await page.locator('#theme').click();
  atlas.darkToggle = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
  await page.getByRole('link', { name: '6. Chat & Telegram', exact: true }).click();
  atlas.navigation = await page.evaluate(() => location.hash === '#section-6');
  await page.setViewportSize({ width: 390, height: 844 });
  atlas.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const report = { diagrams, atlas };
  writeFileSync(resolve(root, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (diagrams.some(d => d.brokenImages || d.overflow.length) || atlas.unresolved || atlas.brokenImages || atlas.missingLocalSources.length || !atlas.darkToggle || !atlas.navigation || atlas.mobileOverflow) {
    throw new Error('Architecture artifact verification failed; see verification.json');
  }
  for (const name of names) {
    if (readFileSync(resolve(root, `${name}.html`), 'utf8').includes('%%ICON_')) throw new Error(`Unresolved icon in ${name}`);
  }
} finally {
  await browser.close();
}
