import { expect, test } from '@playwright/test';
import { openPage } from './measure';
import { RECORD } from './scenarios';

// Authoring's flow that the Reader walks in the app: reading how each kind and check works, from
// where they are, without leaving the workbench. The flows run from the command line are in
// lathe/test/flows/authoring.test.ts.

/** A record with a problem in the suite's copy of the data (its code is not served, so it is not built). */
const WITH_PROBLEM = '/LA-TRC-UC10-R03';

test.describe('Authoring flows', () => {
  test('LA-AUT-UC14-FL01-T look up a kind or check', async ({ page }) => {
    // S01: the record format, from the command palette.
    await openPage(page, RECORD);
    await page.keyboard.press('Control+Shift+p');
    await page.locator('.dialog-search').waitFor();
    await page.keyboard.type('Record format');
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/format');
    await expect(page.locator('#main h1')).toHaveText('Record format');
    await expect(page.locator('#main').getByRole('heading', { name: 'How records are kept', level: 2 })).toBeVisible();
    // S02: a kind's page, from the side bar's Kind row.
    await openPage(page, `${WITH_PROBLEM}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    await page.getByRole('complementary', { name: 'Side bar' }).getByRole('link', { name: 'UC requirement', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/format/kinds/uc_requirement');
    await expect(page.locator('#main h1')).toHaveText('UC requirement');
    await expect(page.locator('#main').getByRole('table', { name: 'The columns of the uc_requirement table' })).toBeVisible();
    // S03: a check's page, from a problem's code (on the page, or in the side bar while it is open).
    await openPage(page, WITH_PROBLEM);
    const code = page.getByRole('list', { name: 'Problems' }).first().getByRole('link').first();
    const check = (await code.textContent())!.trim();
    await code.click();
    await page.waitForURL((u) => u.pathname === `/format/checks/${check}`);
    await expect(page.locator('#main h1')).toHaveText(check);
    await expect(page.locator('#main').getByRole('heading', { name: 'Query', level: 2 })).toBeVisible();
    await expect(page.locator('#main').getByRole('heading', { name: /^Problems now [1-9]\d*$/, level: 2 })).toBeVisible();
    // S04: a kind by quick find.
    await page.keyboard.press('Control+k');
    await page.locator('.quick-find input').fill('Kind: Flow step');
    await page.getByRole('option', { name: /^Kind: Flow step/ }).first().click();
    await page.waitForURL((u) => u.pathname === '/format/kinds/flow_step');
    await expect(page.locator('#main h1')).toHaveText('Flow step');
  });
});
