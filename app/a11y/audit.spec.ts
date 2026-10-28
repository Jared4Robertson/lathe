import { expect, test, type Page } from '@playwright/test';
import { AGGREGATE, DOMAIN, EDITED, PRODUCT, RECORD } from '../stability/scenarios';
import { audit, LOOKS, useLook, type Finding } from './axe';

// LA-V61-R40-T01: every page and state the stability suite visits passes axe-core at WCAG 2.2 AA, at
// desktop and phone widths, in the Lathe theme's light and dark and in High contrast's
// (LA-PAT-APP-UX-R10). Each page or state in each look is one test, so a failure names both.

/** A group: a domain's Technical specification folder, at its parent, stage and folder. */
const GROUP = '/LA-EXP/technical-specification';

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
  { name: 'interface page', url: '/LA-IF03', ready: '.interface-flows' },
  { name: 'group page', url: GROUP, ready: '.pane-title' },
  { name: 'graph', url: `${RECORD}?view=graph`, ready: '.pane-graph .graph-flow .graph-box' },
  { name: 'Model view', url: `${AGGREGATE}?view=model`, ready: '.pane-model .model-canvas' },
  { name: 'Checks', url: `${PRODUCT}/checks`, ready: '#main h1' },
  { name: 'Format', url: '/format', ready: '#main h1' },
  { name: 'Appearance', url: '/settings/appearance', ready: '#main h1' },
].map((p) => ({ name: p.name, run: (page: Page) => open(page, p.url, p.ready) }));
// Changing records: the form generated from the schema (Edit and Add) and the question before a
// removal with the store's refusal shown inline. None of them writes anything that stays: the
// forms are not sent, and the store refuses the removal.
PAGES.push(
  { name: 'the record form', run: async (page: Page) => {
    await open(page, EDITED, '.pane-title');
    await page.getByRole('toolbar', { name: `Change ${EDITED.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('form').waitFor();
  } },
  { name: 'the add form, with its problems shown', run: async (page: Page) => {
    await open(page, RECORD, '.pane-title');
    const actions = page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` });
    await actions.getByRole('button', { name: 'Add…' }).click();
    await actions.getByRole('group', { name: /Kinds to add/ }).getByRole('button', { name: 'UC requirement' }).click();
    await page.getByRole('form').getByRole('button', { name: 'Add UC requirement' }).click();
    await page.getByRole('form').getByRole('alert').waitFor();
  } },
  { name: 'the remove question and its refusal', run: async (page: Page) => {
    await open(page, RECORD, '.pane-title');
    await page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` }).getByRole('button', { name: 'Remove' }).click();
    const panel = page.getByRole('region', { name: `Remove ${RECORD.slice(1)}?` });
    await panel.getByRole('button', { name: `Remove ${RECORD.slice(1)}` }).click();
    await panel.getByRole('alert').waitFor({ timeout: 20_000 });
  } },
);
// The graph in its Nested and Voronoi layouts (LA-V93-R21, LA-V93-R22): the same roles and names as the Tree layout.
for (const layout of ['Nested', 'Voronoi'] as const) PAGES.push({ name: `graph, ${layout} layout`, run: async (page: Page) => {
  await open(page, `${RECORD}?view=graph`, '.pane-graph .graph-flow .graph-box');
  await page.locator('.pane-graph .graph-layout button', { hasText: layout }).click();
  await page.locator(`.pane-graph .graph-flow[data-layout="${layout.toLowerCase()}"] .graph-box`).first().waitFor();
  await page.waitForTimeout(900);
} });

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

/** The records one axe run proves besides LA-V61-R40, each by the axe rules that check it. */
const BY_RULE: { record: string; says: string; rules: string[] }[] = [
  { record: 'LA-V61-R44-T01', says: "a control's name holds its visible text", rules: ['label-content-name-mismatch'] },
  { record: 'LA-V61-R45-T01', says: 'no control sits inside another', rules: ['nested-interactive'] },
  { record: 'LA-V61-R46-T01', says: 'a box that scrolls can be reached by keyboard', rules: ['scrollable-region-focusable'] },
  { record: 'LA-V61-R47-T01', says: 'a target is at least 24 px, or has room around it', rules: ['target-size'] },
  { record: 'LA-V61-R48-T01', says: 'text sits on surfaces with enough contrast', rules: ['color-contrast'] },
];

/** The Explorer's pages and states: where it shows the spec, as the domain LA-EXP owns them. */
const EXPLORER = ['domain page', 'record page', 'group page', 'graph', 'Model view'];

/** Audits the page, then names each record's share of the one run's findings, and the pattern rule's whole. */
async function auditAll(page: Page, state: string) {
  await audit(page, state);
  const attached = test.info().attachments.at(-1)?.body;
  const findings = JSON.parse(attached ? attached.toString() : '[]') as Finding[];
  for (const r of BY_RULE) {
    await test.step(`${r.record} ${r.says}`, () => {
      expect.soft(findings.filter((f) => r.rules.includes(f.rule)).map((f) => f.targets), state).toEqual([]);
    });
  }
  await test.step('LA-PAT-APP-UX-R10-T01 the page passes the accessibility audit with no finding', () => {
    expect.soft(findings.map((f) => f.rule), state).toEqual([]);
  });
  if (EXPLORER.some((name) => state.endsWith(`: ${name}`))) {
    await test.step("LA-PAT-APP-UX-R10-T02 the Explorer's page passes the accessibility audit with no finding", () => {
      expect.soft(findings.map((f) => f.rule), state).toEqual([]);
    });
  }
}

for (const look of LOOKS) {
  test.describe(`desktop at 1440 px in ${look.name}`, () => {
    test.beforeEach(({ page }) => useLook(page, look));
    for (const s of DESKTOP) {
      test(`LA-V61-R40-T01 ${s.name} passes axe`, async ({ page }) => {
        await s.run(page);
        await auditAll(page, `${look.name}, desktop: ${s.name}`);
      });
    }
  });

  test.describe(`phone at 375 px in ${look.name}`, () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    test.beforeEach(({ page }) => useLook(page, look));
    for (const s of PHONE) {
      test(`LA-V61-R40-T01 ${s.name} passes axe`, async ({ page }) => {
        await s.run(page);
        await auditAll(page, `${look.name}, phone: ${s.name}`);
      });
    }
  });
}
