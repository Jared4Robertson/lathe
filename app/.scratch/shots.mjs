// Scratch: screenshots of the app on port 5280 for review. Not part of the repo.
import { chromium } from '@playwright/test';

const base = 'http://localhost:5280';
const out = new URL('./', import.meta.url).pathname;
const shots = JSON.parse(process.argv[2]);
const browser = await chromium.launch();
for (const s of shots) {
  const context = await browser.newContext({ viewport: s.viewport ?? { width: 1440, height: 900 }, colorScheme: s.scheme ?? 'light', reducedMotion: 'reduce', isMobile: !!s.mobile, hasTouch: !!s.mobile });
  const page = await context.newPage();
  if (s.transparency) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  }
  if (s.storage) await page.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) window.sessionStorage.setItem(k, v); }, s.storage);
  await page.goto(base + s.url);
  await page.waitForSelector('[data-specs="ready"]', { timeout: 30000 });
  await page.waitForTimeout(s.wait ?? 2500);
  for (const step of s.steps ?? []) {
    if (step.click) await page.click(step.click);
    if (step.key) await page.keyboard.press(step.key);
    if (step.eval) await page.evaluate(step.eval);
    await page.waitForTimeout(step.wait ?? 800);
  }
  await page.screenshot({ path: `${out}${s.name}.png` });
  if (s.log) console.log(s.name, JSON.stringify(await page.evaluate(s.log)));
  await context.close();
}
await browser.close();
