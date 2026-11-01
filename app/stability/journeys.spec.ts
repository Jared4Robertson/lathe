import { expect, test } from './test';
import { openPage, showCard } from './measure';
import { JOURNEY, JOURNEY_USE_CASE, keepData } from './scenarios';

// The journey pages in a real browser (LA-V156, LA-V101-R13): open a journey, follow a step to the use case it carries
// out and back through the use case's In journeys fact, and move a step up and down; the data is put back.

const WIKI = '.wiki-panel';

test.describe('Journeys', () => {
  test('LA-V156-R04-T01 a journey lists its steps in order, and a step leads to its use case and back by In journeys', async ({ page }) => {
    await openPage(page, JOURNEY);
    await showCard(page, 'whole');
    const steps = page.locator(`${WIKI} [data-aggregate="journey"] ol.journey-steps`).first();
    await expect(steps.locator('li.journey-step').first()).toBeVisible();
    const order = await steps.locator('li.journey-step .step-order').allTextContents();
    expect(order.map(Number)).toEqual([...order].map(Number).sort((a, b) => a - b));
    // The first step that carries out a use case leads to it.
    const link = steps.locator('.journey-carries a.record-link').first();
    const target = (await link.getAttribute('href'))!;
    await link.click();
    await page.waitForURL((u) => u.pathname === target);
    // Its In journeys fact leads back to the journey.
    await showCard(page, 'whole');
    const back = page.locator(`${WIKI} .in-journeys a.record-link[href="${JOURNEY}"]`).first();
    await expect(back).toBeVisible();
    await back.click();
    await page.waitForURL((u) => u.pathname === JOURNEY);
  });

  test('LA-V156-R02-T01 a step moves down and up again, the page holding still', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, JOURNEY);
      await showCard(page, 'whole');
      const first = page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').first();
      const id = (await first.getAttribute('data-step'))!;
      await first.getByRole('button', { name: `Move down ${id}` }).click();
      await expect(page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').nth(1)).toHaveAttribute('data-step', id);
      await page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').nth(1).getByRole('button', { name: `Move up ${id}` }).click();
      await expect(page.locator(`${WIKI} ol.journey-steps`).first().locator('li.journey-step').first()).toHaveAttribute('data-step', id);
    } finally {
      restore();
    }
  });

  test('LA-V101-R13-T01 a use case in a journey shows In journeys', async ({ page }) => {
    await openPage(page, JOURNEY_USE_CASE);
    await showCard(page, 'whole');
    await expect(page.locator(`${WIKI} .in-journeys`).first()).toBeVisible();
  });
});
