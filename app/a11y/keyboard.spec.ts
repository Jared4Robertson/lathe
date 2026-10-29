import { expect, test, type Page } from '@playwright/test';
import { DOMAIN, EDITED, keepData, PRODUCT, RECORD } from '../stability/scenarios';
import { withChat } from './chat';

// What axe can't check, walked with the keyboard alone (LA-PAT-APP-UX-R10):
// LA-V61-R41-T01 every control on the main pages is reached by Tab and Shift+Tab, with no trap;
// LA-V61-R41-T02 the main tasks by keyboard: open a record, switch views, re-center the graph, fold
// rows, open and close the side bar, pick a theme, and the announcer saying what changed;
// LA-V61-R42-T01 focus after navigation, and back on the opener when a dialog or a sheet closes;
// and changing a record by keyboard: Edit, the form's first field, Save, and focus back on Edit.

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

async function open(page: Page, url: string, ready = '.header-strip h1') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await page.locator('.app[data-specs="ready"]').first().waitFor();
  await page.locator(ready).first().waitFor();
  await page.waitForTimeout(300);
}

test.describe('keyboard', () => {
  test('LA-V61-R41-T01 Tab reaches every control and comes back round, with no trap', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
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

  test('LA-V61-R41-T02 open a record from the nav and from quick find', async ({ page }) => {
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
    await expect(page.locator('.header-strip h1').first()).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.quick-open input')).toBeFocused();
    await page.keyboard.type('LA-PLT-UC05');
    await page.locator('.quick-open .palette-list li').first().waitFor();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/LA-PLT-UC05/);
    await expect(page.locator('.header-strip h1').first()).toBeVisible();
    // LA-V61-R42-T01: after the move, focus is not lost on the body.
    expect((await focused(page)).tag).not.toBe('body');
  });

  test('LA-V61-R41-T02 switch the stage from the page bar and by its keys', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.getAttribute('aria-label') === 'ERD' && !!el.closest('.page-bar'), 'the ERD stage button');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/stage=erd/);
    await expect(page.locator('.page-bar').getByRole('button', { name: 'ERD', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await test.step('LA-V61-R43-T01 switching the stage is announced', () => expect(announcer(page)).toHaveText(/ERD stage/));
    // Focus stays on the button that was pressed.
    expect((await focused(page)).name).toBe('ERD');
    // Every stage works on every focus: the switch never disables one (LA-PAT-APP-UX-R17).
    await expect(page.locator('.page-bar .stage-switch button[aria-disabled]')).toHaveCount(0);
    // Off a Mac, Ctrl+3 for the Trace stage and Ctrl+1 for the graph.
    await page.keyboard.press('Control+3');
    await expect(page).toHaveURL(/stage=trace/);
    await test.step('LA-V61-R43-T01 switching the stage by its keys is announced', () => expect(announcer(page)).toHaveText(/Trace stage/));
    await page.keyboard.press('Control+1');
    await expect(page).toHaveURL(/stage=graph/);
  });

  test('LA-V61-R41-T02 collapse and show the wiki card with Enter, focus kept on the page', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator('.wiki-panel')).toHaveCount(0);
    await test.step('LA-V61-R43-T01 collapsing the wiki card is announced', () => expect(announcer(page)).toHaveText('Wiki card collapsed'));
    // LA-V61-R42-T01: collapsed from the page, focus stays there, and Enter brings the card back.
    expect((await focused(page)).tag).toBe('body');
    await page.keyboard.press('Enter');
    await expect(page.locator('.wiki-panel')).toBeVisible();
    await expect(announcer(page)).toHaveText('Wiki card shown');
    // From inside the card: its own collapse button.
    await page.locator('.wiki-panel').getByRole('button', { name: 'Collapse the wiki card' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.wiki-panel')).toHaveCount(0);
    expect((await focused(page)).classes).toContain('wiki-panel-toggle');
    await page.keyboard.press('Enter');
    await expect(page.locator('.wiki-panel')).toBeVisible();
  });

  test('LA-V61-R41-T02 re-center the graph with Tab and Enter, and step through the tree with the arrow keys', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    await tabUntil(page, (el) => !!el.closest('.graph-box'), 'a box in the graph');
    const first = await page.evaluate(() => document.activeElement!.closest('.graph-box')!.getAttribute('data-id'));
    let target = first;
    for (let i = 0; i < 8 && (target === first || target === RECORD.slice(1) || target!.includes('/')); i++) {
      await page.keyboard.press('Tab');
      target = await page.evaluate(() => document.activeElement!.closest('.graph-box')?.getAttribute('data-id') ?? '');
    }
    expect(target, 'Tab moves between boxes').not.toBe(first);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(target!));
    // LA-V61-R42-T01: focus follows the box that became the center.
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.graph-box')?.getAttribute('data-id'))).toBe(target);
    // In the Tree view the plain arrows step through the tree: Left to the parent, Right back in to its first child; the keyboard follows.
    const at = new URL(page.url()).pathname;
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => new URL(page.url()).pathname).not.toBe(at);
    const parent = new URL(page.url()).pathname;
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.graph-box')?.getAttribute('data-id'))).toBe(decodeURIComponent(parent.slice(1)));
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => new URL(page.url()).pathname).not.toBe(parent);
    // In the Nested view (v switches to it), which draws children inside their parent, Up steps out and Down back in.
    const child = new URL(page.url()).pathname;
    await page.keyboard.press('v');
    await expect(page.locator('.focus-stage .graph-flow')).toHaveAttribute('data-layout', 'nested');
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.graph-box')?.getAttribute('data-id'))).toBe(decodeURIComponent(child.slice(1)));
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => new URL(page.url()).pathname).toBe(parent);
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.graph-box')?.getAttribute('data-id'))).toBe(decodeURIComponent(parent.slice(1)));
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => new URL(page.url()).pathname).toBe(child);
  });

  test('LA-V61-R49-T03 the arrow keys walk the stage from the wiki card and the page bar, and stay with quick find', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    const path = () => decodeURIComponent(new URL(page.url()).pathname);
    const start = path();
    // Clicked into, the wiki card gives the arrows to the stage and does not scroll by them.
    const scroller = page.locator('.wiki-panel-scroll');
    await page.locator('.wiki-panel-title').click();
    const top = await scroller.evaluate((el) => el.scrollTop);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(path).not.toBe(start);
    await expect(announcer(page)).not.toHaveText('');
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(top);
    const parent = path();
    await page.keyboard.press('ArrowRight');
    await expect.poll(path).not.toBe(parent);
    // On the ERD stage, from a page bar button: Right to the region beside the domain's on the map.
    await page.keyboard.press('Control+2');
    await expect(page.locator('.focus-stage[data-stage="erd"] .erd-flow[data-framed]')).toBeVisible();
    const before = path();
    await page.locator('.page-bar .side-bar-toggle').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(path).not.toBe(before);
    // Quick find keeps its arrows: Down moves through its results, the focus stays.
    const here = path();
    await page.keyboard.press('Control+k');
    await expect(page.locator('.quick-open input')).toBeFocused();
    await page.keyboard.type('a');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    expect(path()).toBe(here);
    await page.keyboard.press('Escape');
  });

  test('LA-V61-R49-T07 W, A, S and D walk the stage from the wiki card and stay typed in quick find', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    const path = () => decodeURIComponent(new URL(page.url()).pathname);
    const start = path();
    // Clicked into, the wiki card gives the letters to the stage: A out to the parent, D back in.
    await page.locator('.wiki-panel-title').click();
    await page.keyboard.press('a');
    await expect.poll(path).not.toBe(start);
    await expect(announcer(page)).not.toHaveText('');
    const parent = path();
    await page.keyboard.press('d');
    await expect.poll(path).not.toBe(parent);
    // With Shift or Ctrl held, a letter keeps its own meaning: nothing steps.
    const here = path();
    await page.keyboard.press('Shift+A');
    await page.waitForTimeout(300);
    expect(path()).toBe(here);
    // In quick find the letters are typed.
    await page.keyboard.press('Control+k');
    await expect(page.locator('.quick-open input')).toBeFocused();
    await page.keyboard.type('wasd');
    await expect(page.locator('.quick-open input')).toHaveValue('wasd');
    expect(path()).toBe(here);
    await page.keyboard.press('Escape');
  });

  test('LA-V96-R19-T07 Enter on the focused box toggles the wiki card, and Escape collapses it once quick find has closed', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
    const focusBox = page.locator('.focus-stage .graph-box.is-focus');
    await focusBox.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.wiki-panel')).toHaveCount(0);
    await expect(focusBox).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.wiki-panel')).toBeVisible();
    // Escape closes quick find first, then the card.
    await page.keyboard.press('Control+k');
    await expect(page.locator('.quick-open input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.quick-open')).toHaveCount(0);
    await expect(page.locator('.wiki-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.wiki-panel')).toHaveCount(0);
    await test.step('LA-V61-R43-T01 collapsing the wiki card by Escape is announced', () => expect(announcer(page)).toHaveText('Wiki card collapsed'));
  });

  test('LA-V61-R41-T02 fold and unfold a row with the keyboard', async ({ page }) => {
    await open(page, DOMAIN);
    await tabUntil(page, (el) => el.classList.contains('tree-toggle') && !!el.closest('#main'), 'a row\'s fold button', 300);
    const toggle = page.locator(':focus');
    const before = await toggle.getAttribute('aria-expanded');
    await page.keyboard.press('Enter');
    await expect(page.locator(':focus')).toHaveAttribute('aria-expanded', before === 'true' ? 'false' : 'true');
    await page.keyboard.press('Space');
    await expect(page.locator(':focus')).toHaveAttribute('aria-expanded', before ?? 'false');
  });

  test('LA-V61-R41-T02 open and close the side bar, and focus it', async ({ page }) => {
    // On the Trace stage the side bar starts hidden.
    await open(page, `${RECORD}?stage=trace`, '.focus-stage .trace-page');
    const toggle = page.locator('.page-bar .side-bar-toggle');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await tabUntil(page, (el) => el.classList.contains('side-bar-toggle'), 'the side bar toggle');
    await page.keyboard.press('Enter');
    await expect(announcer(page)).toHaveText('Side bar shown');
    await expect(page.locator('.stage-layout > .side-bar-column')).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await test.step('LA-V61-R43-T01 hiding the side bar is announced', () => expect(announcer(page)).toHaveText('Side bar hidden'));
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // LA-V61-R42-T01: the toggle keeps focus when it hides the side bar, so the next Enter brings it back.
    expect((await focused(page)).classes).toContain('side-bar-toggle');
    await page.keyboard.press('Enter');
    await expect(announcer(page)).toHaveText('Side bar shown');
    await page.keyboard.press('Control+Shift+i');
    await expect.poll(async () => page.evaluate(() => !!document.activeElement?.closest('#side-bar'))).toBe(true);
  });

  test('LA-V99-R02-T01 the chat by keyboard: focus its message box, send, stop, and walk the messages', async ({ page }) => {
    await withChat(page, RECORD.slice(1));
    await open(page, RECORD, '.chat-log .chat-item');
    // Its key focuses the message box (Ctrl+Alt+C off a Mac); pressed there, it hides the chat, and again shows it.
    await page.keyboard.press('Control+Alt+c');
    await expect(page.getByRole('textbox', { name: 'Message Claude' })).toBeFocused();
    await page.keyboard.press('Control+Alt+c');
    await expect(page.locator('#chat-panel')).toHaveCount(0);
    await expect(announcer(page)).toHaveText('Chat hidden');
    await page.keyboard.press('Control+Alt+c');
    const box = page.getByRole('textbox', { name: 'Message Claude' });
    await expect(box).toBeFocused();
    // Enter sends; Shift+Enter is a new line.
    await page.keyboard.type('Add the tests');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('please');
    await page.keyboard.press('Enter');
    await expect(page.locator('.chat-item.is-user').last()).toHaveText('Add the tests\nplease');
    await expect(page.locator('.chat-status')).toHaveText('Claude is working…');
    // Escape stops the turn; focus stays in the box.
    await page.keyboard.press('Escape');
    await expect(page.locator('.chat-status')).toHaveText('');
    await expect(box).toBeFocused();
    // Shift+Tab from the box reaches the log's one tab stop, the last message; the arrows walk the messages.
    await tabUntil(page, (el) => el.classList.contains('chat-item'), 'a message in the chat', 10, true);
    await expect(page.locator('.chat-item').last()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.chat-item').nth(-2)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('.chat-item').first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator('.chat-item').last()).toBeFocused();
    // The permission prompt's buttons are reached with Tab and answered with Enter.
    await page.locator('.chat-item.is-permission').focus();
    await tabUntil(page, (el) => el.textContent === 'Allow once', 'Allow once', 10);
    await page.keyboard.press('Enter');
    await expect(page.locator('.chat-permission-answer')).toHaveText('Allowed once');
  });

  test('LA-V61-R41-T02 pick a theme, and focus comes back', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.getAttribute('aria-label') === 'Graph' && !!el.closest('.page-bar'), 'the Graph stage button');
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await page.locator('.dialog-search').waitFor();
    expect((await focused(page)).inDialog, 'focus moves into the theme picker').toBe(true);
    await page.keyboard.type('Midnight');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
    await test.step('LA-V61-R43-T01 choosing a theme is announced', () => expect(announcer(page)).toHaveText(/Color theme: Midnight/));
    // LA-V61-R42-T01: back on the control that had focus before the picker opened.
    expect((await focused(page)).name).toBe('Graph');
  });

  test('LA-V61-R41-T02 open a domain from its card: each card is one tab stop, and Enter opens it', async ({ page }) => {
    await open(page, PRODUCT);
    const inDomains = (el: Element) => el.classList.contains('card-title') && !!el.closest('ul[aria-label="Domains"]');
    await tabUntil(page, inDomains, 'a domain card', 400);
    const first = await page.evaluate(() => document.activeElement!.getAttribute('href'));
    // One tab stop per card (LA-PAT-APP-UX-R14): the next Tab lands on the next card's title, not inside this card.
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => ({ title: document.activeElement!.classList.contains('card-title'), href: document.activeElement!.getAttribute('href') }));
    expect(next.title, 'the next stop is the next card').toBe(true);
    expect(next.href).not.toBe(first);
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => document.activeElement!.getAttribute('href'))).toBe(first);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${first}$`));
  });

  test('LA-V61-R42-T01 the palette and the shortcuts sheet give focus back when they close', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.classList.contains('side-bar-toggle'), 'the side bar toggle');
    for (const [keys, box] of [['Control+Shift+p', '.quick-open input'], ['Control+/', '.dialog-search']]) {
      await page.keyboard.press(keys);
      await page.locator(box).waitFor();
      expect((await focused(page)).inDialog, `${keys} moves focus into its dialog`).toBe(true);
      // Tab stays inside the open dialog.
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        expect((await focused(page)).inDialog, `${keys}: Tab left the open dialog`).toBe(true);
      }
      await page.keyboard.press('Escape');
      await expect(page.locator(box)).toHaveCount(0);
      expect((await focused(page)).classes, `${keys}: focus back on the opener`).toContain('side-bar-toggle');
    }
  });
});

test.describe('keyboard on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('LA-V61-R42-T01 a drawer or a sheet gives focus back to the button that opened it', async ({ page }) => {
    await open(page, RECORD, '.header-strip h1');
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
      await page.locator('.side-bar-drawer').waitFor();
      await page.keyboard.press('Escape');
      await expect(page.locator('.side-bar-drawer')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Show the side bar' }).first()).toBeFocused();
    }
    // The wiki card's sheet, from the page bar's wiki button.
    const card = page.getByRole('button', { name: 'Show the wiki card' });
    await card.focus();
    await page.keyboard.press('Enter');
    await page.locator('.wiki-panel-sheet').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.locator('.wiki-panel-sheet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show the wiki card' })).toBeFocused();
  });

});

test.describe('changing records by keyboard', () => {
  test('LA-V92-R34-T01 edit a record with the keyboard, and focus comes back to its actions', async ({ page }) => {
    const restore = keepData();
    try {
      await open(page, EDITED);
      await tabUntil(page, (el) => el.textContent?.trim() === 'Edit' && !!el.closest('[role="toolbar"]'), 'the record\'s Edit');
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await focused(page)).name).toBe('');
      expect(await page.evaluate(() => document.activeElement?.id.endsWith('-field-title'))).toBe(true);
      await page.keyboard.press('End');
      await page.keyboard.type(', by keyboard');
      await tabUntil(page, (el) => el.textContent?.trim() === 'Save', 'Save');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('form')).toHaveCount(0, { timeout: 20_000 });
      await expect(announcer(page)).toHaveText(`Saved ${EDITED.slice(1)}`);
      await expect.poll(async () => (await focused(page)).name).toBe('Edit');
      await expect(page.locator('.header-strip h1')).toContainText(', by keyboard');
    } finally {
      restore();
    }
  });

  test('LA-V61-R42-T01 the remove question takes focus, and Cancel gives it back', async ({ page }) => {
    await open(page, RECORD);
    await tabUntil(page, (el) => el.textContent?.trim() === 'Remove' && !!el.closest('[role="toolbar"]'), 'the record\'s Remove');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await focused(page)).name).toBe(`Remove ${RECORD.slice(1)}?`);
    await tabUntil(page, (el) => el.textContent?.trim() === 'Cancel', 'Cancel');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await focused(page)).name).toBe('Edit');
  });
});
