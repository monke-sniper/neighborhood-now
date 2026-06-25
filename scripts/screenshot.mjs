import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = process.env.BASE_URL || 'http://localhost:3939';
const OUT = 'verification/shots';

const CHIPS = [
  '123 QUEEN ST W, TORONTO',
  'CN TOWER, TORONTO',
  'KENSINGTON MARKET, TORONTO',
  'SCARBOROUGH TOWN CENTRE, TORONTO',
];

async function ensureOut() {
  if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });
}

async function main() {
  await ensureOut();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await ctx.newPage();

  page.on('pageerror', (e) => console.error('[ pageerror ]', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[ console.error ]', msg.text());
  });

  console.log(`[ 1 ] Loading home ${BASE}`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('text=NEIGHBORHOOD NOW', { timeout: 15000 });
  await wait(800);
  await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });
  console.log('     saved 01-home.png');

  for (let i = 0; i < CHIPS.length; i++) {
    const addr = CHIPS[i];
    const n = String(i + 2).padStart(2, '0');
    console.log(`[ ${i + 2} ] ${addr}`);

    const chipSelector = `button:has-text("${addr}")`;
    try {
      await page.waitForSelector(chipSelector, { timeout: 5000 });
      await page.click(chipSelector);
    } catch {
      console.log(`     chip not visible, typing instead`);
      await page.fill('input[placeholder*="ENTER ADDRESS"]', addr);
      await page.click('button:has-text("ANALYZE")');
    }

    try {
      await page.waitForSelector('text=LIVABILITY SCORE', { timeout: 30000 });
    } catch (e) {
      console.error(`     FAIL: never saw LIVABILITY SCORE`);
      await page.screenshot({ path: `${OUT}/${n}-${addr.replace(/[^a-z0-9]/gi, '_')}-failed.png`, fullPage: true });
      continue;
    }
    try {
      await page.waitForSelector('text=MODEL:', { timeout: 5000 });
      await page.waitForFunction(
        () => {
          const headers = Array.from(document.querySelectorAll('*'));
          return headers.some(
            (el) => el.textContent && /MODEL:\s+(FALLBACK|GPT-OSS)/i.test(el.textContent),
          );
        },
        { timeout: 15000 },
      );
    } catch {
      console.log('     AI recs still loading after wait');
    }
    await wait(1500);
    const slug = addr.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await page.screenshot({ path: `${OUT}/${n}-${slug}.png`, fullPage: true });
    console.log(`     saved ${n}-${slug}.png`);

    const scoreText = await page.locator('h2:has-text("LIVABILITY SCORE")').first().locator('xpath=..').textContent();
    const ratio = await page.locator('text=/\\/ \\d+/').first().textContent().catch(() => null);
    console.log(`     score: ${scoreText?.replace(/\s+/g, ' ').slice(0, 100) || 'N/A'}`);
    if (ratio) console.log(`     denominator: ${ratio.trim()}`);

    const srcBadges = await page.locator('text=/OSM|311|PERMITS|AIR|CENSUS/').allTextContents();
    console.log(`     sources: ${srcBadges.slice(0, 5).join(' | ')}`);

    const ideas = await page.locator('text=IDEAS // CREATIVE AI SUGGESTIONS').count();
    const thinking = await page.locator('text=THINKING // AI INPUT').count();
    console.log(`     ideas tab: ${ideas > 0 ? 'YES' : 'NO'}; thinking tab: ${thinking > 0 ? 'YES' : 'NO'}`);

    if (i === 0) {
      console.log(`     clicking [+ THINKING]`);
      try {
        await page.click('text=THINKING // AI INPUT', { timeout: 3000 });
        await wait(800);
        await page.screenshot({ path: `${OUT}/${n}b-thinking-open.png`, fullPage: true });
        console.log(`     saved ${n}b-thinking-open.png`);
        await page.click('text=IDEAS // CREATIVE AI SUGGESTIONS', { timeout: 3000 });
        await wait(800);
        await page.screenshot({ path: `${OUT}/${n}c-ideas-open.png`, fullPage: true });
        console.log(`     saved ${n}c-ideas-open.png`);
      } catch (e) {
        console.log(`     could not open thinking/ideas: ${e.message}`);
      }
    }
  }

  await browser.close();
  console.log('\n[ done ] screenshots in', OUT);
}

main().catch((e) => {
  console.error('[ fatal ]', e);
  process.exit(1);
});
