import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { RECORD } from './scenarios';

// Exploring's policies in a real browser (LA-EXP-PO01 to PO03): what a page opened, or a tab
// activated, leads to. Each test drives the app as the Reader does and reads the address, the
// tab strip and the rail.

/** The tab strip as "ID" with "*" for the preview and "<" for the active tab. */
async function tabsOf(page: Page): Promise<string[]> {
  return page.locator('[role="tablist"][aria-label="Open pages"] .tab').evaluateAll((tabs) => tabs.map((t) => {
    const id = t.querySelector('.tab-id')?.textContent ?? t.querySelector('.tab-title')?.textContent ?? '';
    return `${id}${t.classList.contains('is-preview') ? '*' : ''}${t.querySelector('[role="tab"]')?.getAttribute('aria-selected') === 'true' ? '<' : ''}`;
  }));
}

/** Follows the first link in the wiki card to a record other than the one shown, and returns its ID. */
async function followLink(page: Page): Promise<string> {
  const from = new URL(page.url()).pathname;
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

  test('LA-EXP-PO02-T a page opened shows in a tab: the preview is replaced in place, an open page activates its tab, and Back reopens a closed page as the preview', async ({ page }) => {
    const first = RECORD.slice(1);
    await openPage(page, RECORD);
    expect(await tabsOf(page)).toEqual([`${first}*<`]);
    // A plain open replaces the preview tab's page in place.
    const second = await followLink(page);
    expect(await tabsOf(page)).toEqual([`${second}*<`]);
    // Kept by a double-click; the next open adds a preview after it.
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    expect(await tabsOf(page)).toEqual([`${second}<`]);
    const third = await followLink(page);
    expect(await tabsOf(page)).toEqual([second, `${third}*<`]);
    // Back to a page already open activates its tab: no second tab.
    await page.goBack();
    await page.waitForURL((u) => u.pathname === `/${second}`);
    await expect.poll(() => tabsOf(page)).toEqual([`${second}<`, `${third}*`]);
    // Closing the preview, then Forward to its page, reopens it as the preview.
    await page.locator('.tab.is-preview .tab-close').click({ force: true });
    await expect.poll(() => tabsOf(page)).toEqual([`${second}<`]);
    await page.goForward();
    await page.waitForURL((u) => u.pathname === `/${third}`);
    await expect.poll(() => tabsOf(page)).toEqual([second, `${third}*<`]);
  });

  test('LA-EXP-PO03-T the address follows the active tab, clicked or cycled', async ({ page }) => {
    const first = RECORD.slice(1);
    await openPage(page, RECORD);
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    const second = await followLink(page);
    expect(await tabsOf(page)).toEqual([first, `${second}*<`]);
    // Clicking a tab activates it, and the address follows.
    await page.locator('.tab', { has: page.locator('.tab-id', { hasText: new RegExp(`^${first}$`) }) }).locator('[role="tab"]').click();
    await page.waitForURL((u) => u.pathname === `/${first}`);
    expect(await tabsOf(page)).toEqual([`${first}<`, `${second}*`]);
    // Ctrl+Tab cycles to the next tab, and the address follows.
    await page.keyboard.press('Control+Tab');
    await page.waitForURL((u) => u.pathname === `/${second}`);
    expect(await tabsOf(page)).toEqual([first, `${second}*<`]);
  });
});
