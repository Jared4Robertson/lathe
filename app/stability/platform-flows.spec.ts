import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { expectStable, openPage, step } from './measure';
import { FOCUS, GRAPH_CANVAS, keepData, RECORD, SHELL } from './scenarios';
import { cameraOf, focusDrawn, graphDrawn, sceneOf } from './scene';

// Platform's flow tests that happen in the app (LA-PLT-UC03-FL to UC10-FL): one per flow, each
// walking its main path in Chromium over the suite's copy of Lathe's data. The flows run through
// the CLI or the server alone are proved in lathe/test/cli/platform-flows.test.ts, and the native
// menus in the desktop smoke test.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WIKI = '.wiki-panel';
const FLOW = '.focus-stage .graph-flow';
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const announcer = (page: Page) => page.getByTestId('announcer');
const palette = (page: Page) => page.getByRole('dialog', { name: 'Command palette' });

/** Runs the real lathe CLI on the suite's copy of the data, as an Agent does. */
const lathe = (...args: string[]) => execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), ...args, '--root', process.env.STABILITY_ROOT!], { stdio: 'pipe' }).toString();

/** A two-finger pinch on the page through the browser's own touch input, its fingers moving apart (out) or together. */
async function pinch(page: Page, at: { x: number; y: number }, from: number, to: number) {
  const cdp = await page.context().newCDPSession(page);
  const points = (d: number) => [{ x: at.x - d, y: at.y, id: 0 }, { x: at.x + d, y: at.y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + ((to - from) * i) / 8) });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** A one-finger swipe through the browser's own touch input. */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 0 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10, id: 0 }] });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** Drags with the pointer from one point to another, in steps. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test.describe('Platform flows in the app', () => {
  test('LA-PLT-UC03-FL-T LA-PAT-PAGE-STEPS-R01-T04 the page shows the files on disk: an Agent\'s write reloads it in place, and data that cannot load is said so', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, '/LA-EXP-UC03');
      await expect(page.locator(`.header-strip h1`)).toHaveText('Walk the model as a graph');
      // An Agent changes the record through the command layer while the page is open.
      lathe('use-case', 'change-use-case', '--id', 'LA-EXP-UC03', '--title', 'Walk the model as a graph, retitled by an Agent');
      await expect(page.locator(`.header-strip h1`)).toHaveText('Walk the model as a graph, retitled by an Agent', { timeout: 20_000 });
      expect(new URL(page.url()).pathname).toBe('/LA-EXP-UC03');
      // A data file the store refuses: the page says what is wrong, not other data.
      appendFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'use_case.jsonl'), '{"id":"LA-EXP-UC99","title":"Under no capability","goal":"A use case whose capability is not there.","capability_id":"LA-EXP-CAP99"}\n');
      await expect(page.getByText(/Couldn.t (re)?load the specs/).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/LA-EXP-CAP99/).first()).toBeVisible();
    } finally {
      restore();
    }
    // Put back, the page loads the data again.
    await expect(page.locator(`.header-strip h1`)).toHaveText('Walk the model as a graph', { timeout: 20_000 });
  });

  test('LA-STD-EXPERIENCE-R05-T02 work the app from the keyboard: the palette, VS Code keys, the announcement, a search box, the shortcuts sheet', async ({ page }) => {
    await openPage(page, RECORD);
    await page.keyboard.press('Control+Shift+p');
    await expect(palette(page)).toBeVisible();
    await page.keyboard.type('navigation');
    await expect(palette(page).getByRole('option', { name: /^Show or hide the navigation Ctrl\+B$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette(page)).toHaveCount(0);
    // Cmd/Ctrl+B hides the navigation, and a screen reader hears it.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+b');
    await expect(nav(page).getByRole('button', { name: 'Expand the navigation' })).toBeVisible();
    await expect(announcer(page)).not.toBeEmpty();
    await page.keyboard.press('Control+b');
    await expect(nav(page).getByRole('button', { name: 'Collapse the navigation' })).toBeVisible();
    // Typing in a search box: single keys type, they don't fire.
    const find = page.locator(WIKI).getByRole('searchbox').first();
    if (await find.count()) {
      await find.fill('');
      await find.pressSequentially('gt?');
      await expect(find).toHaveValue('gt?');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.goto('/LA-EXP');
    const filter = page.locator(WIKI).getByRole('searchbox', { name: 'Filter records' });
    await filter.pressSequentially('gt?');
    await expect(filter).toHaveValue('gt?');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // ? opens the shortcuts sheet: every shortcut by group, a search, and each shortcut's keys to change.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Shift+?');
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('region', { name: 'Navigate' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Add a key to Command palette' })).toBeVisible();
    await sheet.getByRole('searchbox', { name: 'Search shortcuts' }).fill('palette');
    await expect(sheet.getByRole('rowheader', { name: 'Command palette' })).toBeVisible();
  });

  test('LA-STD-EXPERIENCE-R06-T02 LA-PLT-UC24-FL-T see each command\'s shortcut where it is used: a tooltip, the palette, the screen reader, a rebinding followed everywhere', async ({ page }) => {
    await openPage(page, RECORD);
    const graphButton = page.getByRole('group', { name: 'Stage' }).getByRole('button', { name: 'Graph' });
    await graphButton.hover();
    await expect(page.locator('.tooltip')).toContainText('Alt+G');
    await expect(graphButton).toHaveAttribute('aria-keyshortcuts', /Alt\+G/i);
    await page.keyboard.press('Control+Shift+p');
    await page.keyboard.type('navigation');
    await expect(palette(page).getByRole('option', { name: /Show or hide the navigation Ctrl\+B$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    // Rebind toggleNav in the shortcuts sheet: every hint follows at once, and after a reload.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Shift+?');
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await sheet.getByRole('searchbox', { name: 'Search shortcuts' }).fill('navigation');
    await sheet.getByRole('button', { name: 'Change Ctrl+B of Show or hide the navigation' }).click();
    await expect(sheet.getByRole('button', { name: /^Press a key for Show or hide the navigation/ })).toBeFocused();
    await page.keyboard.press('Control+j');
    await expect(sheet.getByRole('row', { name: /^Show or hide the navigation/ })).toContainText('Ctrl+J');
    // The key taken, Escape closes the sheet, pressed straight away.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    for (const when of ['now', 'after a reload']) {
      if (when === 'after a reload') { await page.reload(); await page.locator('.header-strip h1').first().waitFor(); }
      await nav(page).getByRole('button', { name: 'Collapse the navigation' }).hover();
      await expect(page.locator('.tooltip'), when).toContainText('Ctrl+J');
      await expect(nav(page).getByRole('button', { name: 'Collapse the navigation' }), when).toHaveAttribute('aria-keyshortcuts', /Control\+J/);
    }
    await page.keyboard.press('Control+Shift+p');
    await page.keyboard.type('navigation');
    await expect(palette(page).getByRole('option', { name: /Show or hide the navigation Ctrl\+J$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+j');
    await expect(nav(page).getByRole('button', { name: 'Expand the navigation' })).toBeVisible();
  });

  test('LA-V61-R10-T03 a walk key and a stage key rebound in the shortcuts sheet walk the stage and switch it, and the old ones no longer do', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=erd`);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Shift+?');
    const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    // Step right: L becomes Y. Graph stage: Ctrl+1 becomes Ctrl+Alt+1.
    await sheet.getByRole('button', { name: 'Change l of Step right' }).click();
    await page.keyboard.press('y');
    await expect(sheet.getByRole('row', { name: /^Step right/ })).toContainText('y');
    await sheet.getByRole('button', { name: 'Change Ctrl+1 of Graph stage' }).click();
    await page.keyboard.press('Control+Alt+1');
    await expect(sheet.getByRole('row', { name: /^Graph stage/ })).toContainText('Ctrl+Alt+1');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    // The old stage key does nothing; the new one shows the Graph.
    await page.keyboard.press('Control+1');
    await page.waitForTimeout(300);
    expect(new URL(page.url()).searchParams.get('stage')).toBe('erd');
    await page.keyboard.press('Control+Alt+1');
    await page.locator(GRAPH_CANVAS).waitFor();
    // The walk keys walk once the graph has drawn its focus.
    await graphDrawn(page);
    await focusDrawn(page, RECORD.slice(1));
    // Y walks right, as L did; L no longer walks.
    const start = new URL(page.url()).pathname;
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('l');
    await page.waitForTimeout(300);
    expect(new URL(page.url()).pathname).toBe(start);
    await page.keyboard.press('y');
    await page.waitForURL((u) => u.pathname !== start);
  });

  test('LA-PLT-UC06-FL-T arrange the panels: drag and step an edge, sizes kept, reset by double-click, fold by dragging small, collapse the wiki card', async ({ page }) => {
    await openPage(page, RECORD);
    const handle = page.getByRole('separator', { name: 'Resize the navigation' });
    const start = Number(await handle.getAttribute('aria-valuenow'));
    const box = (await handle.boundingBox())!;
    await drag(page, { x: box.x + box.width / 2, y: box.y + 200 }, { x: box.x + box.width / 2 + 60, y: box.y + 200 });
    const dragged = Number(await handle.getAttribute('aria-valuenow'));
    expect(dragged).toBeGreaterThan(start);
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    const stepped = Number(await handle.getAttribute('aria-valuenow'));
    expect(stepped).toBeGreaterThan(dragged);
    // Remembered across a reload; a double-click resets it.
    await page.reload();
    await page.locator('.header-strip h1').first().waitFor();
    await expect(handle).toHaveAttribute('aria-valuenow', String(stepped));
    await handle.dblclick();
    await expect(handle).toHaveAttribute('aria-valuenow', String(start));
    // Dragging the navigation small folds it away.
    const b = (await handle.boundingBox())!;
    await drag(page, { x: b.x + b.width / 2, y: b.y + 200 }, { x: 20, y: b.y + 200 });
    await expect(nav(page).getByRole('button', { name: 'Expand the navigation' })).toBeVisible();
    await nav(page).getByRole('button', { name: 'Expand the navigation' }).click();
    // The wiki card, on the right, collapses by its button, the open space over the stage taking its room, and comes back by the page bar's.
    const openRight = () => page.locator('.focus-stage').evaluate((el) => parseFloat((el as HTMLElement).style.getPropertyValue('--open-right')));
    const withCard = await openRight();
    await page.locator('.wiki-panel').getByRole('button', { name: 'Collapse the wiki card' }).click();
    await expect(page.locator('.wiki-panel')).toHaveCount(0);
    await expect.poll(openRight).toBeLessThan(withCard);
    await page.getByRole('button', { name: 'Show the wiki card' }).click();
    await expect(page.locator('.wiki-panel')).toBeVisible();
  });

  test('LA-PLT-UC07-FL-T set how Lathe looks: g t, Escape, the palette, Appearance, duplicate, change, reset, delete, export, import', async ({ page, browser }) => {
    await openPage(page, RECORD);
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    // g then t: each theme shown on the whole app as the arrows reach it; Escape puts back the one before.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await page.locator('.dialog-search').waitFor();
    await page.keyboard.press('ArrowDown');
    await expect(html).not.toHaveAttribute('data-theme', before ?? '');
    await page.keyboard.press('Escape');
    await expect(html).toHaveAttribute('data-theme', before ?? '');
    // Enter keeps one.
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await page.locator('.dialog-search').fill('Midnight');
    await page.keyboard.press('Enter');
    await expect(html).toHaveAttribute('data-theme', /midnight/);
    // Light, Dark or System from the palette.
    await page.keyboard.press('Control+Shift+p');
    await page.keyboard.type('Light, dark or system');
    await expect(palette(page).getByRole('option', { name: 'Light, dark or system' })).toBeVisible();
    await page.keyboard.press('Enter');
    await page.locator('.dialog-search').fill('Dark');
    await page.keyboard.press('Enter');
    await expect(html).toHaveAttribute('data-mode', 'dark');
    // Appearance, a popover from the nav's footer over the stage: every theme with a preview, live on the stage when pointed at.
    await nav(page).getByRole('link', { name: 'Appearance' }).click();
    await page.waitForURL((u) => u.search.endsWith('panel=appearance'));
    await expect(page.locator('.focus-stage')).toBeVisible();
    await page.getByRole('radio', { name: 'System' }).check();
    const themes = page.getByRole('list', { name: 'Themes' });
    await themes.getByRole('button', { name: 'Use Graphite' }).hover();
    await expect(html).toHaveAttribute('data-theme', 'graphite');
    await page.mouse.move(1, 1);
    await expect(html).toHaveAttribute('data-theme', /midnight/);
    await expect(themes.getByRole('listitem')).toHaveCount(await themes.getByRole('listitem').count());
    expect(await themes.getByRole('listitem').count()).toBeGreaterThanOrEqual(5);
    // Duplicate the closest, change a color, its font and density; a warning where text gets hard to read.
    await themes.getByRole('button', { name: 'Duplicate and edit Workshop' }).click();
    const editor = page.getByRole('region', { name: /^Edit “Workshop copy”$/ });
    await expect(editor).toBeVisible();
    const muted = editor.getByRole('textbox', { name: 'Muted text, light, value' });
    await muted.fill('#EEEEEE');
    await muted.press('Enter');
    await expect(editor.locator('.contrast-warning').first()).toBeVisible();
    await editor.getByRole('radio', { name: 'Compact' }).check();
    await expect(editor.getByRole('radio', { name: 'Compact' })).toBeChecked();
    // Reset to the theme it came from.
    await editor.getByRole('button', { name: 'Reset to Workshop' }).click();
    await expect(editor.locator('.contrast-warning')).toHaveCount(0);
    await expect(editor.getByRole('radio', { name: 'Comfortable' })).toBeChecked();
    // Export it to share as a file.
    const [download] = await Promise.all([page.waitForEvent('download'), editor.getByRole('button', { name: 'Export' }).click()]);
    const file = await download.path();
    const exported = JSON.parse(readFileSync(file, 'utf8')) as { name?: string };
    expect(exported.name).toBe('Workshop copy');
    // Delete the copy, after being asked.
    await editor.getByRole('button', { name: 'Delete…' }).click();
    await editor.getByRole('group', { name: 'Confirm delete' }).getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL((u) => u.search.endsWith('panel=appearance'));
    await expect(page.getByRole('list', { name: 'Themes' }).getByText('Workshop copy')).toHaveCount(0);
    // Someone else, in their own browser, imports the file as a theme of their own.
    const other = await browser.newContext();
    try {
      const theirs = await other.newPage();
      await theirs.goto('/LA?panel=appearance');
      await theirs.locator('input[type="file"]').setInputFiles(file);
      await expect(theirs.getByRole('list', { name: 'Themes' }).getByText('Workshop copy')).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

    test('LA-STD-EXPERIENCE-R03-T02 read the spec on a phone: search, the graph by touch, the sheets, the nav, Back, a tablet', async ({ page }) => {
      await openPage(page, '/LA', '.topbar');
      await expect(page.getByRole('banner')).toBeVisible();
      // Search from the top bar, and open a use case.
      await page.getByRole('banner').getByRole('button', { name: 'Quick find' }).tap();
      await page.locator('.quick-open input').fill('LA-PLT-UC07');
      const hit = page.locator('.quick-open .palette-list li').filter({ hasText: /LA-PLT-UC07(?![-\d])/ }).first();
      await hit.waitFor();
      await hit.tap();
      await page.waitForURL((u) => u.pathname === '/LA-PLT-UC07');
      // The stage fills the screen under the bars; the wiki card opens as a bottom sheet.
      const stage = (await page.locator('.focus-stage').boundingBox())!;
      expect(stage.width).toBeGreaterThan(360);
      await page.getByRole('button', { name: 'Show the wiki card' }).tap();
      await expect(page.locator('.wiki-panel-sheet .wiki-panel-title h2')).toHaveText(/./);
      await page.locator('.wiki-panel-sheet').getByRole('button', { name: 'Collapse the wiki card' }).tap();
      await expect(page.locator('.wiki-panel-sheet')).toHaveCount(0);
      // Graph, from the page bar's stage switch.
      await page.getByRole('group', { name: 'Stage' }).getByRole('button', { name: 'Graph' }).tap();
      await page.locator(`${FLOW} .graph-box`).first().waitFor({ state: 'attached' });
      await page.waitForTimeout(900);
      // Pinch out: the camera zooms in.
      const s = await sceneOf(page);
      const zoom = s.camera.zoom;
      await pinch(page, { x: s.canvas.left + s.canvas.width / 2, y: s.canvas.top + s.canvas.height / 2 }, 40, 120);
      await expect.poll(async () => (await sceneOf(page)).camera.zoom).toBeGreaterThan(zoom);
      await page.locator('.focus-stage').getByRole('button', { name: 'Frame the focus' }).tap();
      await page.waitForTimeout(1300);
      // Tap a node to see its name, and Open.
      const scene = await sceneOf(page);
      const node = scene.boxes.find((b) => b.id.startsWith('LA-') && !b.focus && b.label.top > scene.canvas.top + 30 && b.label.top + b.label.height < scene.canvas.top + scene.canvas.height - 60 && b.label.left > 0 && b.label.left + b.label.width < 375);
      expect(node, 'a node on screen').toBeTruthy();
      await page.touchscreen.tap(node!.label.left + node!.label.width / 2, node!.label.top + node!.label.height / 2);
      const open = page.locator('.focus-stage').getByRole('button', { name: /^Open / });
      await expect(open).toBeVisible();
      await open.tap();
      await page.waitForURL((u) => u.pathname === `/${node!.id}`);
      // The wiki card's sheet: up, to full height, swiped away.
      await page.getByRole('button', { name: 'Show the wiki card' }).tap();
      const sheet = page.locator('.wiki-panel-sheet');
      await expect(sheet).toBeVisible();
      // Once it has slid up into place.
      await page.waitForTimeout(600);
      const grab = (await sheet.locator('.sheet-grab').boundingBox())!;
      await swipe(page, { x: grab.x + grab.width / 2, y: grab.y + grab.height / 2 }, { x: grab.x + grab.width / 2, y: 40 });
      await expect(sheet).toHaveClass(/is-full/);
      await page.waitForTimeout(600);
      const top = (await sheet.locator('.sheet-grab').boundingBox())!;
      await swipe(page, { x: top.x + top.width / 2, y: top.y + top.height / 2 }, { x: top.x + top.width / 2, y: 800 });
      await expect(sheet).toHaveCount(0);
      // The nav sheet, and the domain.
      await page.getByRole('button', { name: 'Open the navigation' }).tap();
      await nav(page).getByRole('link', { name: 'Platform', exact: true }).tap();
      await page.waitForURL((u) => u.pathname === '/LA-PLT');
      // Back, twice, takes them back to the use case: the browser tab's own history (no Open pages on the web).
      await expect(page.getByRole('button', { name: /^Open pages/ })).toHaveCount(0);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === `/${node!.id}`);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === '/LA-PLT-UC07');
      // A tablet in landscape keeps the floating panels, with targets sized for a finger.
      await page.setViewportSize({ width: 1180, height: 820 });
      await expect(page.locator('nav#nav')).toBeVisible();
      await expect(page.locator('.topbar')).toHaveCount(0);
      const target = (await page.getByRole('group', { name: 'Stage' }).getByRole('button', { name: 'Graph' }).boundingBox())!;
      expect(target.height).toBeGreaterThanOrEqual(40);
    });
  });

  test('LA-STD-EXPERIENCE-R01-T02 read without anything jumping: open, move, stages, folds, resize, the graph, a reload, overlays, the theme', async ({ page }) => {
    const KEYS = [...SHELL, ...FOCUS];
    const CONTENT = ['.wiki-panel-scroll', '.header-strip'];
    await openPage(page, RECORD);
    // Move by a link and Back: the frame stays.
    expectStable(await step(page, 'flow', 'a link', { keys: KEYS, allow: CONTENT }, async () => {
      // The domain sits in the card's breadcrumb, behind "…" when the trail is long.
      const more = page.locator(`${WIKI} .wiki-panel-head .crumb-more-button`);
      if (await more.count()) await more.click();
      await page.locator(WIKI).getByRole('link', { name: 'Platform (LA-PLT)', exact: true }).click();
      await page.waitForURL((u) => u.pathname === '/LA-PLT');
    }));
    expectStable(await step(page, 'flow', 'Back', { keys: KEYS, allow: CONTENT }, async () => {
      await page.goBack();
      await page.waitForURL((u) => u.pathname === RECORD);
    }));
    // Switch to the ERD stage and back: only the stage changes.
    expectStable(await step(page, 'flow', 'switch the stage', { keys: KEYS, allow: ['.focus-stage', '.header-strip-counts'] }, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.focus-stage .erd-page').first().waitFor();
      await page.keyboard.press('Control+1');
      await page.locator(`${FLOW} .graph-box`).first().waitFor({ state: 'attached' });
    }));
    // Fold rows with Expand all. The Reader scrolls to the button first; the step measures the rows opening.
    const expand = page.locator(WIKI).getByRole('button', { name: 'Expand all' }).first();
    await expand.scrollIntoViewIfNeeded();
    expectStable(await step(page, 'flow', 'Expand all', { keys: KEYS, allow: ['.wiki-panel-scroll'] }, async () => {
      await expand.click();
      await expect(page.locator(WIKI).getByRole('button', { name: 'Collapse all' }).first()).toBeVisible();
    }));
    // The Reader scrolls back to the top, where the steps below start.
    await page.locator(`${WIKI} .wiki-panel-scroll`).evaluate((e) => e.scrollTo(0, 0));
    // The graph: change its depth; the canvas and its bars hold still.
    const graphKeys = ['nav#nav', GRAPH_CANVAS, '.focus-stage .stage-tools'];
    expectStable(await step(page, 'flow', 'graph depth', { keys: graphKeys, allow: ['.focus-stage .graph-flow'] }, async () => {
      await page.locator('.focus-stage .graph-flow').focus();
      const camera = await cameraOf(page);
      await page.locator('.focus-stage .stage-zoom-out').click({ trial: false }).catch(() => page.keyboard.press('-'));
      await expect.poll(() => cameraOf(page)).not.toBe(camera);
    }));
    // Resize the wiki card: it follows the pointer, the stage and the other panels hold still.
    const handle = page.getByRole('separator', { name: 'Resize the wiki card' });
    expectStable(await step(page, 'flow', 'resize the wiki card', { keys: ['nav#nav', '.focus-stage'], allow: ['*'], resizes: ['.wiki-panel'] }, async () => {
      const b = (await handle.boundingBox())!;
      await drag(page, { x: b.x + b.width / 2, y: b.y + 100 }, { x: b.x + b.width / 2 + 80, y: b.y + 100 });
    }));
    // A reload of the specs while scrolled part-way: what was in view stays.
    const restore = keepData();
    try {
      expectStable(await step(page, 'flow', 'specs reload', { keys: ['nav#nav', '.wiki-panel-head'], allow: ['.wiki-panel-scroll'], settle: 1500 }, async () => {
        lathe('use-case', 'change-use-case', '--id', RECORD.slice(1), '--goal', 'A goal the flow test writes while the Reader reads.');
        await expect(page.locator(WIKI)).toContainText('A goal the flow test writes', { timeout: 20_000 });
      }));
    } finally {
      restore();
    }
    // The put-back goal reloads the page too: let it land before the next step measures.
    await expect(page.locator(WIKI)).not.toContainText('A goal the flow test writes', { timeout: 20_000 });
    // Overlays are placed before they show. Quick find previews the resting result on the stage (LA-V64), so the stage's drawing and key, the header's counts and the card (its page, and its height: summary while previewing, LA-V64-R06) change with it; the frame around them holds still.
    expectStable(await step(page, 'flow', 'quick find', { keys: [...SHELL, '.page-bar-actions', '.header-strip', '.quick-find-button'], allow: ['.quick-open-backdrop', '.focus-stage', '.wiki-panel', '.header-strip-counts'] }, async () => {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('graph', { delay: 40 });
      await page.locator('.quick-open .palette-list li').first().waitFor();
      await page.keyboard.press('Escape');
    }));
    // The theme: only colors change.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await page.locator('.dialog-search').fill('Graphite');
    expectStable(await step(page, 'flow', 'theme', { keys: [...SHELL, ...FOCUS] }, async () => {
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('data-theme', /graphite/);
    }));
  });

  test('LA-STD-EXPERIENCE-R04-T02 use Lathe with a keyboard and a screen reader: Tab round, focus kept on the page, announcements, High contrast, a held dialog', async ({ page }) => {
    await openPage(page, RECORD);
    // Tab round the nav, the page bar, the wiki card and the stage.
    const reached = new Set<string>();
    for (let i = 0; i < 250 && reached.size < 4; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return '';
        if (el.closest('nav#nav')) return 'nav';
        if (el.closest('.page-bar-actions')) return 'page bar';
        if (el.closest('.wiki-panel')) return 'wiki card';
        if (el.closest('.focus-stage')) return 'stage';
        return '';
      });
      if (where) reached.add(where);
    }
    expect([...reached].sort()).toEqual(['nav', 'page bar', 'stage', 'wiki card']);
    // Open a record from quick find: focus stays on the page.
    await page.keyboard.press('Control+k');
    await page.locator('.quick-open input').fill('LA-EXP-UC03');
    await page.locator('.quick-open .palette-list li').first().waitFor();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    // Focus is not dropped to the document's body by the move.
    expect(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body && document.activeElement.isConnected)).toBe(true);
    // Switch the stage and collapse the wiki card: each change is announced.
    await page.keyboard.press('Control+2');
    await expect(announcer(page)).toContainText(/ERD stage/i);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(announcer(page)).toContainText(/wiki card collapsed/i);
    await page.keyboard.press('Enter');
    // High contrast, by keyboard.
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    await page.locator('.dialog-search').fill('High contrast');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', /high-contrast/);
    // A dialog holds focus inside, and gives it back to its opener.
    const opener = nav(page).getByRole('button', { name: 'Go to…' });
    await opener.focus();
    await page.keyboard.press('Control+Shift+p');
    await expect(palette(page)).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
  });
});
