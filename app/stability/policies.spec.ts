import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { asDesktop } from './desktop';
import { openPage, showCard } from './measure';
import { RECORD } from './scenarios';

// Exploring's policies in a real browser (LA-EXP-PO01 to PO03): what a page opened, or a tab
// activated, leads to. Each test drives the app as the Reader does and reads the address, the
// tab strip (the desktop app's, with its bridge stood in for) and the rail.

/** The tab strip as "ID" with "<" for the active tab. */
async function tabsOf(page: Page): Promise<string[]> {
  return page.locator('[role="tablist"][aria-label="Open pages"] .tab').evaluateAll((tabs) => tabs.map((t) => {
    const id = t.querySelector('.tab-id')?.textContent ?? t.querySelector('.tab-title')?.textContent ?? '';
    return `${id}${t.querySelector('[role="tab"]')?.getAttribute('aria-selected') === 'true' ? '<' : ''}`;
  }));
}

/** Goes to a record by quick find, in the tab shown. */
async function quickFind(page: Page, id: string) {
  await page.keyboard.press('Control+k');
  const find = page.locator('.quick-open input');
  await expect(find).toBeFocused();
  await find.fill(id);
  await page.locator('.quick-open .palette-list li').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === `/${id}`);
}

/** Opens a box other than the focus in a new tab, by Cmd+click, and returns its ID. */
async function openBoxInNewTab(page: Page): Promise<string> {
  const box = page.locator('.focus-stage .graph-box:not(.is-focus)').first();
  await box.waitFor({ state: 'attached' });
  const id = (await box.getAttribute('data-id'))!;
  await box.dispatchEvent('click', { metaKey: true, button: 0 });
  await page.waitForURL((u) => u.pathname === `/${id}`);
  return id;
}

/** Follows the first link in the wiki card to a record other than the one shown, and returns its ID. */
async function followLink(page: Page): Promise<string> {
  const from = new URL(page.url()).pathname;
  // A new tab's place opens its card as a summary; the links are on the whole page.
  await showCard(page, 'whole');
  const links = page.locator('.wiki-panel .spec-body a.record-link[href^="/LA-"]');
  const target = await links.evaluateAll((all, here) => all.map((a) => a.getAttribute('href')!).find((h) => h !== here && !h.includes('?'))!, from);
  expect(target, `a link from ${from} to another record`).toBeTruthy();
  await page.locator(`.wiki-panel .spec-body a.record-link[href="${target}"]`).first().click();
  await page.waitForURL((u) => u.pathname === target);
  await page.locator('.header-strip h1').first().waitFor();
  return target.slice(1);
}

test.describe('Exploring policies', () => {
  test('LA-EXP-PO01-T a page opened in a space becomes its last page, which choosing the space opens', async ({ page }) => {
    await openPage(page, RECORD);
    const last = await followLink(page);
    // The rail's link to the space names its last page.
    const space = page.locator('.rail-spaces a.space-item[data-space="LA"]');
    await expect(space).toHaveAttribute('href', `/${last}`);
    // From the products picker, outside every space, choosing the space opens that page.
    await page.locator('nav#nav a.brand').click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.getByRole('dialog', { name: 'Products' }).getByRole('link', { name: /^LA Lathe/ }).click();
    await page.waitForURL((u) => u.pathname === `/${last}`);
  });

  test('LA-EXP-PO02-T a move changes only the active tab\'s place, even onto a record another tab holds', async ({ page }) => {
    await asDesktop(page);
    const first = RECORD.slice(1);
    await openPage(page, `${RECORD}?stage=graph`);
    expect(await tabsOf(page)).toEqual([`${first}<`]);
    // A second tab, by Cmd+click on a box, after the first and active.
    const box = await openBoxInNewTab(page);
    await expect.poll(() => tabsOf(page)).toEqual([first, `${box}<`]);
    // In it, a link followed and a move onto the record the first tab holds: still the second tab.
    const linked = await followLink(page);
    expect(await tabsOf(page)).toEqual([first, `${linked}<`]);
    await quickFind(page, first);
    expect(await tabsOf(page)).toEqual([first, `${first}<`]);
    // Back steps within the second tab.
    await page.goBack();
    await page.waitForURL((u) => u.pathname === `/${linked}`);
    await expect.poll(() => tabsOf(page)).toEqual([first, `${linked}<`]);
  });

  test('LA-EXP-PO03-T the address and the window\'s history follow the active tab, clicked or cycled', async ({ page }) => {
    await asDesktop(page);
    const first = RECORD.slice(1);
    await openPage(page, `${RECORD}?stage=graph`);
    const firstNext = await followLink(page);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === RECORD);
    const box = await openBoxInNewTab(page);
    const boxNext = await followLink(page);
    expect(await tabsOf(page)).toEqual([first, `${boxNext}<`]);
    // Clicking the first tab: the address is its place, and Back steps through its own history.
    await page.locator('.tab [role="tab"]').first().click();
    await page.waitForURL((u) => u.pathname === RECORD);
    await page.goForward();
    await page.waitForURL((u) => u.pathname === `/${firstNext}`);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === RECORD);
    expect(await tabsOf(page)).toEqual([`${first}<`, boxNext]);
    // Ctrl+Tab: the second tab's place, and Back through its own history.
    await page.keyboard.press('Control+Tab');
    await page.waitForURL((u) => u.pathname === `/${boxNext}`);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === `/${box}`);
    expect(await tabsOf(page)).toEqual([first, `${box}<`]);
  });
});
