import pkg from '/home/claude/.npm-global/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdirSync } from 'node:fs';

const OUT = '/home/claude/shots';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE || 'http://localhost:4321';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});

async function shoot(name, url, positions, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const height = await page.evaluate(() => document.body.scrollHeight);
  console.log(`${name}: page height ${height}px (${(height / viewport.height).toFixed(1)} screens)`);

  for (const p of positions) {
    const y = Math.round(height * p);
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(900);
    const pct = String(Math.round(p * 100)).padStart(3, '0');
    await page.screenshot({ path: `${OUT}/${name}-${pct}.png` });
    const dark = await page.evaluate(() => document.body.classList.contains('is-dark'));
    const ticker = await page.evaluate(() => {
      const el = document.getElementById('tickerSlot');
      return el ? el.textContent.trim() : null;
    });
    console.log(`  ${pct}%  dark=${dark}${ticker ? `  ticker="${ticker}"` : ''}`);
  }
  await ctx.close();
}

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

await shoot('home', BASE + '/', [0, 0.08, 0.16, 0.26, 0.36, 0.46, 0.58, 0.7, 0.82, 0.94], desktop);
await shoot('work', BASE + '/work', [0, 0.35, 0.8], desktop);
await shoot('phone', BASE + '/', [0, 0.16, 0.46, 0.7, 0.94], phone);

await browser.close();
console.log('\ndone');
