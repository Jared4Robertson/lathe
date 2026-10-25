import { expect, test, type Page } from '@playwright/test';
import { DOMAIN, PRODUCT, RECORD } from '../stability/scenarios';

// What axe can't check, walked with the keyboard alone (LA-PAT-APP-UX-R10):
// LA-PLT-T95 every control on the main pages is reached by Tab and Shift+Tab, with no trap;
// LA-PLT-T96 the main tasks by keyboard: open a record, switch views, re-center the graph, fold
// rows, open and close the side bar, pick a theme, and the announcer saying what changed;
// LA-PLT-T97 focus after navigation, and back on the opener when a dialog or a sheet closes.

/** What has keyboard focus now: a short description, its accessible name and whether it is in view. */
const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return { tag: 'body', name: '', id: '', classes: '', visible: false, inMain: false, inDialog: false };
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 80),
    id: el.id,
    classes: el.className && typeof el.className === 'string' ? el.className : '',
    visible: r.width > 0 && r.height > 0,
    inMain: !!el.closest('#main'),
    inDialog: !!el.closest('[role="dialog"]'),
  };
});

/** Presses Tab until `match` holds for the focused element, at most `max` times; returns how many it took. */
async function tabUntil(page: Page, match: (el: Element) => boolean, what: string, max = 120, back = false): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const hit = await page.evaluateHandle(() => document.activeElement);
    if (await hit.evaluate(match)) return i;
  }
  throw new Error(`${what}: not reached in ${max} presses of ${back ? 'Shift+Tab' : 'Tab'}`);
}

const announcer = (page: Page) => page.getByTestId('announcer');

async function open(page: Page, url: string, ready = '.focus-views .pane-title') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await page.locator('.app[data-specs="ready"]').first().waitFor();
  await page.locator(ready).first().waitFor();
  await page.waitForTimeout(300);
}

test.describe('keyboard', () => {
  test('LA-PLT-T95 Tab reaches every control and comes back round, with no trap', async ({ page }) => {
    await open(page, `${RECORD}?view=wiki,graph`, '.pane-graph .graph-flow .react-flow__node');
    // Every control the page draws that Tab should reach: buttons, links and fields not hidden or disabled.
    const reachable = await page.evaluate(() => {
      const all = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
      return all.filter((el) => {
        if (el.closest('[aria-hidden="true"], [inert]')) return false;
        if (el.tabIndex < 0) return false;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
      }).length;
    });
    const seen: string[] = [];
    let wrapped = false;
    let hidden = 0;
    for (let i = 0; i < reachable + 40; i++) {
      await page.keyboard.press('Tab');
      const f = await focused(page);
      if (f.tag !== 'body' && !f.visible) hidden++;
      const key = `${f.tag}#${f.id}.${f.classes}|${f.name}`;
      if (seen.length > 3 && key === seen[0]) { wrapped = true; break; }
      seen.push(key);
    }
    // Tab went all the way round the page and back to its first stop: nothing held focus.
    expect(wrapped, `Tab never came back to the first stop after ${seen.length} presses; last: ${seen.slice(-5).join('  ')}`).toBe(true);
    expect(hidden, 'a Tab stop that is not drawn').toBe(0);
    // Shift+Tab goes back the same way.
    const back = await focused(page);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    expect(await focused(page)).toEqual(back);
  });

  test('LA-PLT-T96 open a record from the nav and from quick find', async ({ page }) => {
    await open(page, PRODUCT);
    // The skip link is the first stop and moves focus to the page.
    await page.keyboard.press('Tab');
    expect((await focused(page)).name).toBe('Skip to the page');
    // From the nav, by keyboard: the first record link the nav offers.
    await page.keyboard.press('Control+Shift+e');
    await tabUntil(page, (el) => !!el.closest('nav#nav') && el.tagName === 'A' && /^\/[A-Z][A-Z0-9]*-[A-Z0-9-]+$/.test(el.getAttribute('href') ?? ''), 'a record link in the nav');
    const href = await page.evaluate(() => document.activeElement!.getAttribute('href'));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href!.split('?')[0]}`));
    // From quick find.
    await expect(page.locator('.focus-views .pane-title').first()).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.quick-find input')).toBeFocused();
    await page.keyboard.type('LA-PLT-UC04');
    await page.locator('.quick-find-results li').first().waitFor();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/LA-PLT-UC04/);
    await expect(page.locator('.focus-views .pane-title h1').first()).toBeVisible();
    // LA-PLT-T97: after the move, focus is not lost on the body.
    expect((await focused(page)).tag).not.toBe('body');
  });

  test('LA-PLT-T96 switch views from the page bar', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.getAttribute('aria-label') === 'Graph' && !!el.closest('.page-bar'), 'the Graph view toggle');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/view=wiki(%2C|,)graph/);
    await expect(page.locator('.page-bar').getByRole('button', { name: 'Graph', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(announcer(page)).toHaveText(/Graph view/);
    // Focus stays on the toggle that was pressed.
    expect((await focused(page)).name).toBe('Graph');
    await page.keyboard.press('Space');
    await expect(page).not.toHaveURL(/graph/);
  });

  test('LA-PLT-T96 re-center the graph with the arrow keys and Enter', async ({ page }) => {
    await open(page, `${RECORD}?view=graph`, '.pane-graph .graph-flow .react-flow__node');
    await tabUntil(page, (el) => !!el.closest('.react-flow__node'), 'a box in the graph');
    const first = await page.evaluate(() => document.activeElement!.closest('.react-flow__node')!.getAttribute('data-id'));
    let target = first;
    for (let i = 0; i < 8 && (target === first || target === 'LA-PLT-UC04' || target!.startsWith('file:') || target!.includes('/')); i++) {
      await page.keyboard.press('ArrowRight');
      target = await page.evaluate(() => document.activeElement!.closest('.react-flow__node')?.getAttribute('data-id') ?? '');
    }
    expect(target, 'the arrow keys move between boxes').not.toBe(first);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(target!));
    // LA-PLT-T97: focus follows the box that became the center.
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.react-flow__node')?.getAttribute('data-id'))).toBe(target);
  });

  test('LA-PLT-T96 fold and unfold a row with the keyboard', async ({ page }) => {
    await open(page, DOMAIN);
    await tabUntil(page, (el) => el.classList.contains('tree-toggle') && !!el.closest('#main'), 'a row\'s fold button', 300);
    const toggle = page.locator(':focus');
    const before = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await expect(page.locator(':focus')).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
    await page.keyboard.press('Space');
    await expect(page.locator(':focus')).toHaveAttribute('aria-expanded', before ?? 'false');
  });

  test('LA-PLT-T96 open and close the side bar, and focus it', async ({ page }) => {
    // With the wiki alone the side bar starts hidden.
    await open(page, RECORD);
    const toggle = page.locator('.page-bar .side-bar-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await tabUntil(page, (el) => el.classList.contains('side-bar-toggle'), 'the side bar toggle');
    await page.keyboard.press('Enter');
    await expect(announcer(page)).toHaveText('Side bar shown');
    await expect(page.locator('.side-bar-column')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(announcer(page)).toHaveText('Side bar hidden');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // LA-PLT-T97: the toggle keeps focus when it hides the side bar, so the next Enter brings it back.
    expect((await focused(page)).classes).toContain('side-bar-toggle');
    await page.keyboard.press('Enter');
    await expect(announcer(page)).toHaveText('Side bar shown');
    await page.keyboard.press('Control+Shift+i');
    await expect.poll(async () => page.evaluate(() => !!document.activeElement?.closest('#side-bar'))).toBe(true);
  });

  test('LA-PLT-T96 pick a theme, and focus comes back', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.getAttribute('aria-label') === 'Wiki' && !!el.closest('.page-bar'), 'the Wiki view toggle');
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await page.locator('.dialog-search').waitFor();
    expect((await focused(page)).inDialog, 'focus moves into the theme picker').toBe(true);
    await page.keyboard.type('Midnight');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
    await expect(announcer(page)).toHaveText(/Color theme: Midnight/);
    // LA-PLT-T97: back on the control that had focus before the picker opened.
    expect((await focused(page)).name).toBe('Wiki');
  });

  test('LA-PLT-T97 the palette and the shortcuts sheet give focus back when they close', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.classList.contains('side-bar-toggle'), 'the side bar toggle');
    for (const keys of ['Control+Shift+p', 'Control+/']) {
      await page.keyboard.press(keys);
      await page.locator('.dialog-search').waitFor();
      expect((await focused(page)).inDialog, `${keys} moves focus into its dialog`).toBe(true);
      // Tab stays inside the open dialog.
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        expect((await focused(page)).inDialog, `${keys}: Tab left the open dialog`).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('.dialog-search')).toHaveCount(0);
      expect((await focused(page)).classes, `${keys}: focus back on the opener`).toContain('side-bar-toggle');
    }
  });
});

test.describe('keyboard on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('LA-PLT-T97 a sheet gives focus back to the button that opened it', async ({ page }) => {
    await open(page, RECORD, '.pane-title');
    const opener = page.getByRole('button', { name: 'Open the navigation' });
    await opener.focus();
    await page.keyboard.press('Enter');
    await page.locator('nav#nav').waitFor();
    expect(await page.evaluate(() => !!document.activeElement?.closest('nav#nav, .sheet, [role="dialog"]')), 'focus moves into the drawer').toBe(true);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    const sideBar = page.getByRole('button', { name: 'Show the side bar' });
    if (await sideBar.count()) {
      await sideBar.first().focus();
      await page.keyboard.press('Enter');
      await page.locator('.side-bar-sheet').waitFor();
      await page.keyboard.press('Escape');
      await expect(page.locator('.side-bar-sheet')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Show the side bar' }).first()).toBeFocused();
    }
  });
});
