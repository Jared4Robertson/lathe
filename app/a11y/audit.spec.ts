import { test, type Page } from '@playwright/test';
import { AGGREGATE, DOMAIN, PRODUCT, RECORD } from '../stability/scenarios';
import { audit, LOOKS, useLook } from './axe';

// LA-PLT-T94: every page and state the stability suite visits passes axe-core at WCAG 2.2 AA, at
// desktop and phone widths, in the Lathe theme's light and dark and in High contrast's
// (LA-PAT-APP-UX-R10). Each page or state in each look is one test, so a failure names both.

/** A group: a domain's Technical specification folder, at its parent, stage and folder. */
const GROUP = '/LA-EXP/design/technical-specification';

async function open(page: Page, url: string, ready: string) {
  await page.goto(url);
  await page.locator('.app[data-specs="ready"]').first().waitFor();
  await page.locator(ready).first().waitFor();
  await page.waitForTimeout(400);
}

interface State { name: string; run: (page: Page) => Promise<void> }

/** The pages, each audited once it has drawn. */
const PAGES: State[] = [
  { name: 'product page', url: PRODUCT, ready: '.pane-title' },
  { name: 'domain page', url: DOMAIN, ready: '.pane-title' },
  { name: 'record page', url: RECORD, ready: '.pane-title' },
  { name: 'group page', url: GROUP, ready: '.pane-title' },
  { name: 'graph', url: `${RECORD}?view=graph`, ready: '.pane-graph .graph-flow .react-flow__node' },
  { name: 'Model view', url: `${AGGREGATE}?view=model`, ready: '.pane-model .model-canvas' },
  { name: 'Checks', url: '/checks', ready: '#main h1' },
  { name: 'Format', url: '/format', ready: '#main h1' },
  { name: 'Appearance', url: '/settings/appearance', ready: '#main h1' },
].map((p) => ({ name: p.name, run: (page: Page) => open(page, p.url, p.ready) }));

/** The overlays on a wide screen, over a record page. (The graph's page shows the side bar open.) */
const DESKTOP: State[] = [
  ...PAGES,
  { name: 'quick find', run: async (page) => {
    await open(page, RECORD, '.focus-views .pane-title');
    await page.keyboard.press('Control+k');
    await page.locator('.quick-find input').fill('graph');
    await page.locator('.quick-find-results li').first().waitFor();
  } },
  { name: 'the command palette', run: async (page) => {
    await open(page, RECORD, '.focus-views .pane-title');
    await page.keyboard.press('Control+Shift+p');
    await page.locator('.dialog-search').waitFor();
  } },
  { name: 'the shortcuts sheet', run: async (page) => {
    await open(page, RECORD, '.focus-views .pane-title');
    await page.locator('#main').click({ position: { x: 400, y: 300 } });
    await page.keyboard.press('Control+/');
    await page.locator('.dialog-search').waitFor();
  } },
  { name: 'a tooltip on keyboard focus', run: async (page) => {
    await open(page, RECORD, '.focus-views .pane-title');
    // A tooltip opens on keyboard focus: the last input is a key, as when the Reader tabs to it.
    await page.keyboard.press('Shift');
    await page.locator('.page-bar .pane-views button').first().focus();
    await page.locator('.tooltip').waitFor();
  } },
];

/** The sheets on a phone. */
const PHONE: State[] = [
  ...PAGES,
  { name: 'the nav drawer', run: async (page) => {
    await open(page, RECORD, '.pane-title');
    await page.getByRole('button', { name: 'Open the navigation' }).click();
    await page.locator('nav#nav').waitFor();
  } },
  { name: 'the quick find sheet', run: async (page) => {
    await open(page, RECORD, '.pane-title');
    await page.locator('.topbar').getByRole('button', { name: 'Quick find' }).click();
    await page.locator('.find-sheet input').fill('graph');
    await page.waitForTimeout(300);
  } },
  { name: 'the side bar sheet', run: async (page) => {
    await open(page, RECORD, '.pane-title');
    await page.getByRole('button', { name: 'Show the side bar' }).first().click();
    await page.locator('.side-bar-sheet').waitFor();
  } },
];

for (const look of LOOKS) {
  test.describe(`desktop at 1440 px in ${look.name}`, () => {
    test.beforeEach(({ page }) => useLook(page, look));
    for (const s of DESKTOP) {
      test(`LA-PLT-T94 ${s.name} passes axe`, async ({ page }) => {
        await s.run(page);
        await audit(page, `${look.name}, desktop: ${s.name}`);
      });
    }
  });

  test.describe(`phone at 375 px in ${look.name}`, () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    test.beforeEach(({ page }) => useLook(page, look));
    for (const s of PHONE) {
      test(`LA-PLT-T94 ${s.name} passes axe`, async ({ page }) => {
        await s.run(page);
        await audit(page, `${look.name}, phone: ${s.name}`);
      });
    }
  });
}
