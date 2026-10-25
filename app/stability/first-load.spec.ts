import { test } from '@playwright/test';
import { expectStable, firstLoad } from './measure';
import { DOMAIN, FOCUS, PRODUCT, RECORD, SHELL } from './scenarios';

// LA-BRW-T480: the first load of the product, domain and record pages shifts nothing.
test.describe('first load', () => {
  for (const [name, url] of [['product page', PRODUCT], ['domain page', DOMAIN], ['record page', RECORD]] as const) {
    test(`LA-BRW-T480 ${name}`, async ({ page }) => {
      const r = await firstLoad(page, `first load: ${name}`, url, { keys: [...SHELL, ...FOCUS], ready: '.focus-views .pane-title' });
      expectStable(r);
    });
  }

  // The fonts come from Google Fonts with `display=swap`: on a slow network the page first draws
  // in the fallback fonts and then swaps, and every line of text changes width and height.
  test('LA-BRW-T480 record page with slow fonts', async ({ page }) => {
    await page.route(/fonts\.gstatic\.com/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    const r = await firstLoad(page, 'first load: record page, slow fonts', RECORD, { keys: [...SHELL, ...FOCUS], ready: '.focus-views .pane-title', settle: 4000 });
    expectStable(r);
  });
});
