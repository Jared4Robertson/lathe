import { expect, test, type Page } from '@playwright/test';
import { AGGREGATE, DOMAIN, EDITED, PRODUCT, RECORD } from '../stability/scenarios';
import { audit, LOOKS, useLook, type Finding } from './axe';
import { withChat } from './chat';

// LA-V61-R40-T01: every page and state the stability suite visits passes axe-core at WCAG 2.2 AA, at
// desktop and phone widths, in the Lathe theme's light and dark and in High contrast's
// (LA-PAT-APP-UX-R10), each stage with its panels open and collapsed and under reduced transparency.
// Each page or state in each look is one test, so a failure names both.

/** A group: a domain's Technical specification folder, at its parent, stage and folder. */
const GROUP = '/LA-EXP/technical-specification';

async function open(page: Page, url: string, ready: string) {
  await page.goto(url);
  await page.locator('.app[data-specs="ready"]').first().waitFor();
  await page.locator(ready).first().waitFor();
  await page.waitForTimeout(400);
}

interface State { name: string; run: (page: Page) => Promise<void> }

/** A flow step some requirement's chain holds; an entity; a Shared record (in no domain). */
const STEP = '/LA-EXP-UC12-FL01-S01';
const ENTITY = '/LA-EXP-EN01';
const SHARED = '/LA-PAT-APP-UX';

/** Each stage, with every panel open. */
const STAGES = [
  { name: 'graph stage', url: `${RECORD}?stage=graph`, ready: '.focus-stage .graph-flow .graph-box' },
  { name: 'ERD stage', url: `${AGGREGATE}?stage=erd`, ready: '.focus-stage .erd-canvas' },
  { name: 'Trace stage, a chain', url: `${EDITED}?stage=trace`, ready: '.focus-stage .trace-flow[data-ready]' },
  { name: 'Trace stage, a domain\'s lanes', url: `${DOMAIN}?stage=trace`, ready: '.focus-stage .trace-flow[data-ready]' },
];

/** Collapses the wiki card (w) and hides the side bar, so the stage has the whole window under the tab panel. */
async function collapsePanels(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('w');
  await page.locator('.wiki-panel').waitFor({ state: 'detached' });
  if (await page.locator('.stage-layout > .side-bar-column').count()) await page.keyboard.press('Control+Alt+b');
  await page.locator('.stage-layout > .side-bar-column').waitFor({ state: 'detached' });
  await page.waitForTimeout(500);
}

/** Every floating panel opaque, as under the system's reduced transparency. */
async function reduceTransparency(page: Page) {
  // One call sets every emulated feature, so the look's color scheme and reduced motion are set again with it.
  const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' },
    { name: 'prefers-reduced-motion', value: 'reduce' },
    { name: 'prefers-reduced-transparency', value: 'reduce' },
  ] });
  await page.waitForTimeout(200);
}

/** The pages, each audited once it has drawn. */
const PAGES: State[] = [
  { name: 'product page', url: PRODUCT, ready: '.header-strip h1' },
  { name: 'domain page', url: DOMAIN, ready: '.header-strip h1' },
  { name: 'record page', url: RECORD, ready: '.header-strip h1' },
  { name: 'interface page', url: '/LA-IF03', ready: '.interface-flows' },
  { name: 'group page', url: GROUP, ready: '.header-strip h1' },
  ...STAGES,
  // Every stage works on every focus (LA-PAT-APP-UX-R17): the shapes a stage takes outside its own kinds.
  { name: 'Trace stage, framed on the lanes a flow step belongs to', url: `${STEP}?stage=trace`, ready: '.focus-stage .trace-flow[data-ready]' },
  { name: 'Trace stage, an entity in its aggregate\'s lanes', url: `${ENTITY}?stage=trace`, ready: '.focus-stage .trace-note' },
  { name: 'ERD stage on a use case', url: `${RECORD}?stage=erd`, ready: '.focus-stage .erd-canvas' },
  { name: 'ERD stage on a Shared record', url: `${SHARED}?stage=erd`, ready: '.focus-stage .erd-canvas' },
  { name: 'Checks', url: `${PRODUCT}/checks`, ready: '#main h1' },
  { name: 'Format', url: '/format', ready: '#main h1' },
  { name: 'Appearance', url: '/settings/appearance', ready: '#main h1' },
].map((p) => ({ name: p.name, run: (page: Page) => open(page, p.url, p.ready) }));
// A design record nothing traces to: the untraced state, reached from the domain's Untraced list by the keyboard.
PAGES.push({ name: 'Trace stage, an untraced record', run: async (page: Page) => {
  await open(page, `${DOMAIN}?stage=trace`, '.focus-stage .trace-untraced');
  await page.locator('.focus-stage .trace-untraced a').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('.focus-stage .trace-note.is-untraced').waitFor();
  await page.waitForTimeout(400);
} });
// The Trace stage with only the lanes that have a gap.
PAGES.push({ name: 'Trace stage, gaps only', run: async (page: Page) => {
  await open(page, `${DOMAIN}?stage=trace`, '.focus-stage .trace-flow[data-ready]');
  await page.locator('.focus-stage').getByRole('checkbox', { name: 'Gaps only' }).check();
  await page.waitForTimeout(200);
} });
// Changing records: the form generated from the schema (Edit and Add) and the question before a
// removal with the store's refusal shown inline. None of them writes anything that stays: the
// forms are not sent, and the store refuses the removal.
PAGES.push(
  { name: 'the record form', run: async (page: Page) => {
    await open(page, EDITED, '.header-strip h1');
    await page.getByRole('toolbar', { name: `Change ${EDITED.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('form').waitFor();
  } },
  { name: 'the add form, with its problems shown', run: async (page: Page) => {
    await open(page, RECORD, '.header-strip h1');
    const actions = page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` });
    await actions.getByRole('button', { name: 'Add…' }).click();
    await actions.getByRole('group', { name: /Kinds to add/ }).getByRole('button', { name: 'UC requirement' }).click();
    await page.getByRole('form').getByRole('button', { name: 'Add UC requirement' }).click();
    await page.getByRole('form').getByRole('alert').waitFor();
  } },
  { name: 'the remove question and its refusal', run: async (page: Page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` }).getByRole('button', { name: 'Remove' }).click();
    const panel = page.getByRole('region', { name: `Remove ${RECORD.slice(1)}?` });
    await panel.getByRole('button', { name: `Remove ${RECORD.slice(1)}` }).click();
    await panel.getByRole('alert').waitFor({ timeout: 20_000 });
  } },
);
// The graph in its Nested and Voronoi layouts (LA-V93-R21, LA-V93-R22): the same roles and names as the Tree layout.
for (const layout of ['Nested', 'Voronoi'] as const) PAGES.push({ name: `graph, ${layout} layout`, run: async (page: Page) => {
  await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
  await page.locator('.focus-stage .graph-layout button', { hasText: layout }).click();
  await page.locator(`.focus-stage .graph-flow[data-layout="${layout.toLowerCase()}"] .graph-box`).first().waitFor();
  await page.waitForTimeout(900);
} });

/** On a wide screen: the stages with their panels collapsed and under reduced transparency, a deep breadcrumb's menu, and the overlays over a record page. */
const DESKTOP: State[] = [
  ...PAGES,
  { name: 'quick find', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.keyboard.press('Control+k');
    await page.locator('.quick-find input').fill('graph');
    await page.locator('.quick-find-results li').first().waitFor();
  } },
  { name: 'the command palette', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.keyboard.press('Control+Shift+p');
    await page.locator('.dialog-search').waitFor();
  } },
  { name: 'the shortcuts sheet', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+/');
    await page.locator('.dialog-search').waitFor();
  } },
  // Each stage with the panels collapsed, and with them open under reduced transparency.
  ...STAGES.map((s): State => ({ name: `${s.name}, panels collapsed`, run: async (page) => { await open(page, s.url, s.ready); await collapsePanels(page); } })),
  ...STAGES.map((s): State => ({ name: `${s.name}, reduced transparency`, run: async (page) => { await reduceTransparency(page); await open(page, s.url, s.ready); } })),
  { name: 'a deep breadcrumb with its hidden levels open', run: async (page) => {
    await open(page, EDITED, '.header-strip .crumb-more-button');
    await page.locator('.header-strip .crumb-more-button').click();
    await page.locator('.header-strip .crumb-menu').waitFor();
  } },
  // The desktop app's chat (LA-V99), with a stand-in for the shell: a conversation with a tool call open and a
  // permission prompt, and the session picker with its warning about a session open in another client.
  { name: 'the chat, a conversation with a tool call open and a permission prompt', run: async (page) => {
    await withChat(page, RECORD.slice(1));
    await open(page, RECORD, '.chat-log .chat-item');
    await page.locator('.chat-tool-row').first().click();
    await page.locator('.chat-tool-body').waitFor();
  } },
  { name: 'the chat, its session picker warning of a session open elsewhere', run: async (page) => {
    await withChat(page, RECORD.slice(1), 'picker');
    await open(page, RECORD, '.chat-session-open');
    await page.locator('.chat-session-open', { hasText: 'Plan the graph stage' }).click();
    await page.locator('.chat-warning').waitFor();
  } },
  // The wiki card opens as its summary on every page above; More shows the whole page in place (LA-V96-R22).
  { name: 'the wiki card expanded to the whole page', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.locator('.wiki-panel').getByRole('button', { name: 'More' }).click();
    await page.locator('.wiki-panel.is-expanded').waitFor();
  } },
  { name: 'a tooltip on keyboard focus', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    // A tooltip opens on keyboard focus: the last input is a key, as when the Reader tabs to it.
    await page.keyboard.press('Shift');
    await page.locator('.page-bar .stage-switch button').first().focus();
    await page.locator('.tooltip').waitFor();
  } },
];

/** The drawers and sheets on a phone. */
const PHONE: State[] = [
  ...PAGES,
  { name: 'the nav drawer', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.getByRole('button', { name: 'Open the navigation' }).click();
    await page.locator('nav#nav').waitFor();
  } },
  { name: 'the quick find sheet', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.locator('.topbar').getByRole('button', { name: 'Quick find' }).click();
    await page.locator('.find-sheet input').fill('graph');
    await page.waitForTimeout(300);
  } },
  { name: 'the wiki card sheet', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.getByRole('button', { name: 'Show the wiki card' }).click();
    await page.locator('.wiki-panel-sheet .wiki-panel').waitFor();
  } },
  { name: 'the side bar drawer', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.getByRole('button', { name: 'Show the side bar' }).first().click();
    await page.locator('.side-bar-drawer').waitFor();
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
const EXPLORER = ['domain page', 'record page', 'group page', ...STAGES.map((s) => s.name), 'Trace stage, gaps only'];

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
