import { test } from '@playwright/test';
import { expectStable, firstLoad } from './measure';
import { DOMAIN, FOCUS, PRODUCT, RECORD, SHELL } from './scenarios';

// LA-PLT-T71: the first load of the product, domain and record pages shifts nothing.
test.describe('first load', () => {
  for (const [name, url] of [['product page', PRODUCT], ['domain page', DOMAIN], ['record page', RECORD]] as const) {
    test(`LA-PLT-T71 ${name}`, async ({ page }) => {
      const r = await firstLoad(page, `first load: ${name}`, url, { keys: [...SHELL, ...FOCUS], ready: '.focus-views .pane-title' });
      expectStable(r);
    });
  }

  // The fonts are the app's own (app/public/fonts), preloaded, with `font-display: optional`: held
  // back here, the page draws in the fallback fonts and keeps them, rather than swap and move every line.
  test('LA-PLT-T71 record page with slow fonts', async ({ page }) => {
    await page.route(/\/fonts\/.*\.woff2$/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    const r = await firstLoad(page, 'first load: record page, slow fonts', RECORD, { keys: [...SHELL, ...FOCUS], ready: '.focus-views .pane-title', settle: 4000 });
    expectStable(r);
  });
});
