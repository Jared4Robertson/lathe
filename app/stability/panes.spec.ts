import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { AGGREGATE, RECORD } from './scenarios';

// LA-BRW-T482: opening and closing the Wiki, Graph and Model panes, the maximize command
// (Ctrl+3) and the side bar. The panes are what changes (each takes its share of the width),
// so shifts inside `.focus-views` are the change itself; the nav, the pane bars' height and the
// side bar must hold still, and a pane that stays open must not be thrown away and drawn anew.

const PANES = ['.focus-views'];
const NAV = 'nav#nav';
const SIDE_BAR = '.side-bar-column';
const WIKI_BAR = '.pane-wiki > .pane-bar';
/** A canvas's first box: it appears where the fitted picture puts it, never at the default view and then moved. */
const FIRST_NODE = (view: 'graph' | 'model') => `.pane-${view} .react-flow__node`;

test.describe('panes', () => {
  test('LA-BRW-T625 at 1024 px with three panes and the side bar open, no two panels overlap', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await openPage(page, `${AGGREGATE.split('?')[0]}?view=wiki,graph,model`);
    await page.locator('.side-bar-column').waitFor();
    const spans = await page.evaluate(() => [document.querySelector('nav#nav'), ...document.querySelectorAll('.focus-views > .pane'), document.querySelector('.side-bar-column')]
      .map((e) => { const b = e!.getBoundingClientRect(); return { left: b.left, right: b.right }; }));
    expect(spans).toHaveLength(5);
    for (let i = 1; i < spans.length; i++) expect(spans[i].left, `panel ${i} starts after panel ${i - 1} ends`).toBeGreaterThanOrEqual(spans[i - 1].right);
    expect(spans[spans.length - 1].right).toBeLessThanOrEqual(1024);
  });

  test('LA-BRW-T482 open and close the Graph pane', async ({ page }) => {
    await openPage(page, RECORD);
    const open = await step(page, 'panes', 'open Graph (Ctrl+2)', { keys: [NAV, SIDE_BAR, '.pane-wiki .pane-title h1', FIRST_NODE('graph')], allow: PANES, resizes: ['.pane-wiki .pane-title h1'] }, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.pane-graph .graph-flow .react-flow__node').first().waitFor();
    });
    expectStable(open);
    const close = await step(page, 'panes', 'close Graph (Ctrl+2)', { keys: [NAV, SIDE_BAR, WIKI_BAR], allow: PANES, resizes: [WIKI_BAR] }, async () => {
      await page.keyboard.press('Control+2');
      await expect(page.locator('.pane-graph')).toHaveCount(0);
    });
    expectStable(close);
  });

  test('LA-BRW-T482 open and close the Model pane', async ({ page }) => {
    await openPage(page, AGGREGATE);
    const open = await step(page, 'panes', 'open Model (Ctrl+4)', { keys: [NAV, SIDE_BAR, FIRST_NODE('model')], allow: PANES }, async () => {
      await page.keyboard.press('Control+4');
      await page.locator('.pane-model .model-flow .react-flow__node').first().waitFor();
    });
    expectStable(open);
    const graph = await step(page, 'panes', 'add Graph beside Model', { keys: [NAV, SIDE_BAR, '.pane-model .model-canvas'], allow: PANES, resizes: ['.pane-model .model-canvas'] }, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.pane-graph .graph-flow .react-flow__node').first().waitFor();
    });
    expectStable(graph);
    const wiki = await step(page, 'panes', 'close Wiki with two others open', { keys: [NAV, SIDE_BAR, '.pane-graph > .pane-bar'], allow: PANES, resizes: ['.pane-graph > .pane-bar'] }, async () => {
      await page.keyboard.press('Control+1');
      await expect(page.locator('.pane-wiki')).toHaveCount(0);
    });
    expectStable(wiki);
  });

  test('LA-BRW-T482 maximize a pane and come back', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    await page.locator('.pane-graph .graph-flow .react-flow__node').first().waitFor();
    await page.locator('.pane-graph .graph-canvas').click({ position: { x: 5, y: 5 } });
    const full = await step(page, 'panes', 'maximize (Ctrl+3)', { keys: [NAV], allow: PANES }, async () => {
      await page.keyboard.press('Control+3');
      await expect(page.locator('.pane.is-fullscreen')).toHaveCount(1);
    });
    expectStable(full);
    const back = await step(page, 'panes', 'leave full screen (Escape)', { keys: [NAV, SIDE_BAR], allow: PANES }, async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.pane.is-fullscreen')).toHaveCount(0);
    });
    expectStable(back);
  });

  test('LA-BRW-T482 hide and show the side bar', async ({ page }) => {
    await openPage(page, RECORD);
    const bar = '.pane-wiki > .pane-bar';
    const hide = await step(page, 'panes', 'hide the side bar', { keys: [NAV, bar], allow: ['.focus-layout'], resizes: [bar] }, async () => {
      await page.keyboard.press('Control+Alt+b');
      await expect(page.locator(SIDE_BAR)).toHaveCount(0);
    });
    expectStable(hide);
    const show = await step(page, 'panes', 'show the side bar', { keys: [NAV, bar], allow: ['.focus-layout'], resizes: [bar] }, async () => {
      await page.keyboard.press('Control+Alt+b');
      await expect(page.locator(SIDE_BAR)).toHaveCount(1);
    });
    expectStable(show);
  });
});
