import type { Page } from '@playwright/test';
import { expect, test } from '../stability/test';
import { AGGREGATE, DOMAIN, EDITED, PRODUCT, RECORD, REFERENCED } from '../stability/scenarios';
import { audit, LOOKS, useLook, type Finding } from './axe';
import { withChat } from './chat';
import { asDesktop } from '../stability/desktop';
import { showCard } from '../stability/measure';

// LA-PAT-APP-UX-R10-T01: every page and state the stability suite visits passes axe-core at WCAG 2.2 AA, at
// desktop and phone widths, in the Lathe theme's light and dark and in High contrast's
// (LA-PAT-APP-UX-R10), each stage with its panels open and collapsed and under reduced transparency.
// Each page or state in each look is one test, so a failure names both.

/** A group: a domain's Technical specification folder, at its parent, stage and folder. */
const GROUP = '/LA-EXP/technical-specification';

/** What only a record's page in the wiki card draws: on a phone the card is a sheet the Reader opens. */
const inCard = (ready: string) => ready.startsWith('[data-aggregate=') || ready === '.interface-offers';

/**
 * Opens the page and waits for `ready`: drawn, or only attached when it is the Trace's list, which sits visually hidden
 * under its canvas for the keyboard. On a phone, a record's page is read in the wiki card's sheet, opened as the Reader does.
 */
async function open(page: Page, url: string, ready: string, state: 'visible' | 'attached' = 'visible') {
  await page.goto(url);
  await page.locator('.app[data-specs="ready"]').first().waitFor();
  if (inCard(ready) && (page.viewportSize()?.width ?? 1440) < 768) await page.getByRole('button', { name: 'Show the wiki card' }).click();
  await page.locator(ready).first().waitFor({ state });
  await page.waitForTimeout(400);
}

interface State { name: string; run: (page: Page) => Promise<void> }

/** A flow step a row shows; an entity; a Shared record (in no domain). */
const STEP = '/LA-EXP-UC12-FL-S01';
const ENTITY = '/LA-EXP-EN01';
const SHARED = '/LA-PAT-APP-UX';

/** The Trace drawn: its canvas (attached, as stability's traceDrawn), or on a phone its list, one use case at a time. */
const TRACE = '.focus-stage :is(.trace-flow[data-ready], .trace-list)';

/** Each stage, with every panel open. */
const STAGES = [
  { name: 'graph stage', url: `${RECORD}?stage=graph`, ready: '.focus-stage .graph-flow .graph-box' },
  { name: 'ERD stage', url: `${AGGREGATE}?stage=erd`, ready: '.focus-stage .erd-canvas' },
  { name: 'Trace stage, a use case\'s row', url: `${EDITED}?stage=trace`, ready: TRACE, state: 'attached' as const },
  { name: 'Trace stage, a domain (no box: the product\'s rows)', url: `${DOMAIN}?stage=trace`, ready: TRACE, state: 'attached' as const },
];

/** Collapses the wiki card (Enter), so the stage has the whole window under the tab panel. */
async function collapsePanels(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Enter');
  await page.locator('.wiki-panel').waitFor({ state: 'detached' });
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
  { name: 'interface page', url: '/LA-IF03', ready: '.interface-offers' },
  { name: 'business outcome page', url: '/LA-BO05', ready: '[data-aggregate="business-outcome"]' },
  { name: 'extension record page', url: '/LA-AUT-MOD10', ready: '[data-aggregate="extension-record"]' },
  { name: 'entry point page', url: '/LA-PLT-ENTRY01', ready: '[data-aggregate="entry-point"]' },
  { name: 'tooling page', url: '/LA-AUT-TOOL01', ready: '[data-aggregate="tooling"]' },
  // The Domain, Test data set, Pattern and Standard aggregates' own pages.
  { name: 'capability page', url: '/LA-AUT-CAP02', ready: '[data-aggregate="domain"] .capability-use-cases' },
  { name: 'test data set page', url: '/LA-AUT-TD30', ready: '[data-aggregate="test-data-set"] .record-lead' },
  { name: 'pattern page', url: '/LA-PAT-RECORD-PAGE', ready: '[data-aggregate="pattern"] .pattern-rules' },
  { name: 'standard page', url: '/LA-STD-MODELING', ready: '[data-aggregate="standard"] .standard-rules' },
  // The View and UI component aggregates' own pages.
  { name: 'view page', url: '/LA-V150', ready: '[data-aggregate="view"] .view-requirements' },
  { name: 'UI component page', url: '/LA-UI280', ready: '[data-aggregate="ui-component"] .traceability' },
  // The Endpoint and Integration aggregates' own pages.
  { name: 'endpoint page', url: '/LA-AUT-EP01', ready: '[data-aggregate="endpoint"] .endpoint-requirements' },
  { name: 'integration page', url: '/LA-INT04', ready: '[data-aggregate="integration"] .integration-tests' },
  // The Aggregate, Domain event and Command aggregates' own pages.
  { name: 'aggregate page', url: '/LA-AUT-A6', ready: '[data-aggregate="aggregate"] .aggregate-entities' },
  { name: 'domain event page', url: '/LA-AUT-EV03', ready: '[data-aggregate="domain-event"] .record-lead' },
  { name: 'command page', url: '/LA-AUT-CMD210', ready: '[data-aggregate="command"] .command-endpoints' },
  // The Table, Specification, Value object and Read model aggregates' own pages.
  { name: 'table page', url: '/LA-AUT-EN54-TB', ready: '[data-aggregate="table"] .table-keys' },
  { name: 'specification page', url: '/LA-AUT-SP09', ready: '[data-aggregate="specification"] .record-lead' },
  { name: 'value object page', url: '/LA-VO01', ready: '[data-aggregate="value-object"] .entity-fields' },
  { name: 'read model page', url: '/LA-AUT-RM25', ready: '[data-aggregate="read-model"] .read-model-queries' },
  { name: 'group page', url: GROUP, ready: '.header-strip h1' },
  ...STAGES,
  // Every stage works on every focus (LA-PAT-APP-UX-R17): the shapes a stage takes outside its own kinds.
  { name: 'Trace stage, a flow step in its row', url: `${STEP}?stage=trace`, ready: TRACE, state: 'attached' as const },
  { name: 'Trace stage, an entity (the product\'s rows)', url: `${ENTITY}?stage=trace`, ready: TRACE, state: 'attached' as const },
  { name: 'Trace stage, the product\'s rows', url: `${PRODUCT}?stage=trace`, ready: TRACE, state: 'attached' as const },
  { name: 'ERD stage on a use case', url: `${RECORD}?stage=erd`, ready: '.focus-stage .erd-canvas' },
  { name: 'ERD stage on a Shared record', url: `${SHARED}?stage=erd`, ready: '.focus-stage .erd-canvas' },
  // Nothing replaces the stage (LA-PAT-APP-UX-R20): every tool over it, and the products picker.
  { name: 'Checks panel', url: `${PRODUCT}?panel=checks`, ready: '.checks-panel .problems' },
  { name: 'Format page in the wiki card', url: `${PRODUCT}?page=format`, ready: '.wiki-panel.is-format h2' },
  { name: 'Kind page in the wiki card', url: `${RECORD}?page=format/kinds/use_case`, ready: '.wiki-panel.is-format h2' },
  // The Check aggregate's own page: a product's own check, with its actions.
  { name: 'Check page in the wiki card', url: `${PRODUCT}?page=format/checks/actor-not-a-role`, ready: '.wiki-panel.is-format [data-aggregate="check"]' },
  { name: 'Appearance popover', url: `${PRODUCT}?panel=appearance`, ready: '.appearance-popover .theme-rows' },
  { name: 'Products picker', url: '/', ready: '.dialog.products-picker h1' },
].map((p) => ({ name: p.name, run: (page: Page) => open(page, p.url, p.ready, 'state' in p ? p.state : 'visible') }));
// The Trace stage with a row opened: on a wide screen Expand row on the canvas, on a phone the list's first box.
PAGES.push({ name: 'Trace stage, a row opened', run: async (page: Page) => {
  await open(page, `${EDITED}?stage=trace`, TRACE, 'attached');
  const expandRow = page.locator('.focus-stage .stage-toolbar').getByRole('button', { name: 'Expand row' });
  if (await expandRow.count()) await expandRow.click();
  else await page.locator('.focus-stage .trace-list').getByRole('button', { name: /^Open/ }).first().click();
  await page.waitForTimeout(400);
} });
// A flow's page on an interface's tab: that interface's derived version of the flow, its gaps and refusal rules.
PAGES.push({ name: 'flow page, on an interface\'s tab', run: async (page: Page) => {
  await open(page, '/LA-AUT-UC06-FL', '[data-aggregate="use-case"] .flow-tabs');
  await page.locator('[data-aggregate="use-case"] .flow-tabs').getByRole('tab').nth(1).click();
  await page.waitForTimeout(400);
} });
// Changing records: the form generated from the schema (Edit and Add) and the question before a
// removal with the store's refusal shown inline. None of them writes anything that stays: the
// forms are not sent, and the store refuses the removal.
PAGES.push(
  { name: 'an aggregate\'s edit form', run: async (page: Page) => {
    await open(page, EDITED, '[data-aggregate="use-case"]');
    await page.getByRole('toolbar', { name: `Change ${EDITED.slice(1)}` }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('form').waitFor();
  } },
  { name: 'the add form, with its problems shown', run: async (page: Page) => {
    await open(page, RECORD, '[data-aggregate="use-case"]');
    const actions = page.getByRole('toolbar', { name: `Change ${RECORD.slice(1)}` });
    // A use case that has its flow can add one kind, a UC requirement, so its toolbar offers that lone button, not the Add… menu.
    await actions.getByRole('button', { name: 'Add UC requirement' }).click();
    await page.getByRole('form').getByRole('button', { name: 'Add UC requirement' }).click();
    await page.getByRole('form').getByRole('alert').waitFor();
  } },
  { name: 'the pattern form, its settings as rows', run: async (page: Page) => {
    await open(page, '/LA-PAT-RECORD-PAGE', '[data-aggregate="pattern"] .pattern-rules');
    await page.getByRole('toolbar', { name: 'Change LA-PAT-RECORD-PAGE' }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('form').locator('.form-parts').waitFor();
  } },
  { name: 'the set limits form', run: async (page: Page) => {
    await open(page, PRODUCT, '[data-aggregate="product"] .product-limits .record-actions');
    await page.getByRole('toolbar', { name: 'Change the limits of LA' }).getByRole('button', { name: 'Set limits' }).click();
    await page.getByRole('form', { name: 'Set limits' }).waitFor();
  } },
  { name: 'the following\'s Follow form', run: async (page: Page) => {
    await open(page, '/LA-PAT-RECORD-PAGE', '[data-aggregate="pattern"] .pattern-domain');
    await page.getByRole('toolbar', { name: 'Followers of LA-PAT-RECORD-PAGE' }).getByRole('button', { name: 'Follow' }).click();
    await page.getByRole('form', { name: 'Follow LA-PAT-RECORD-PAGE' }).waitFor();
  } },
  { name: 'the entity form, its fields as rows', run: async (page: Page) => {
    await open(page, '/LA-AUT-EN11', '[data-aggregate="aggregate"] .entity-commands');
    await page.getByRole('toolbar', { name: 'Change LA-AUT-EN11' }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('form').locator('.form-parts').waitFor();
  } },
  { name: 'the remove question and its refusal', run: async (page: Page) => {
    // A record others reference, so the removal is refused and the suite's data stays whole for the states after it.
    await open(page, REFERENCED, '[data-aggregate="use-case"]');
    await page.getByRole('toolbar', { name: `Change ${REFERENCED.slice(1)}` }).getByRole('button', { name: 'Remove' }).click();
    const panel = page.getByRole('region', { name: `Remove ${REFERENCED.slice(1)}?` });
    await panel.getByRole('button', { name: `Remove ${REFERENCED.slice(1)}` }).click();
    await panel.getByRole('alert').waitFor({ timeout: 20_000 });
  } },
);
// The graph in its Nested and Map layouts (LA-V93-R21, LA-V93-R74): the same roles and names as the Tree layout.
for (const layout of ['Nested', 'Map'] as const) PAGES.push({ name: `graph, ${layout} layout`, run: async (page: Page) => {
  await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box');
  // A narrow toolbar folds the layouts into its More menu.
  const choice = page.locator('.focus-stage .graph-layout').getByRole('button', { name: layout, exact: true });
  if (!(await choice.isVisible())) await page.locator('.focus-stage .stage-more > summary').click();
  await choice.click();
  await page.locator(`.focus-stage .graph-flow[data-layout="${layout.toLowerCase()}"] .graph-box`).first().waitFor();
  await page.waitForTimeout(900);
} });

/** On a wide screen: the stages with their panels collapsed and under reduced transparency, a deep breadcrumb's menu, and the overlays over a record page. */
const DESKTOP: State[] = [
  ...PAGES,
  { name: 'quick find', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.keyboard.press('Control+k');
    await page.locator('.quick-open input').fill('graph');
    await page.locator('.quick-open .palette-list li').first().waitFor();
  } },
  { name: 'the command palette', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.keyboard.press('Control+Shift+p');
    await page.locator('.quick-open input').waitFor();
  } },
  { name: 'the shortcuts sheet', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+/');
    await page.locator('.dialog-search').waitFor();
  } },
  // Binding a key (LA-V61-R52): the recording control has focus, then a key another shortcut has offers Swap.
  { name: 'the shortcuts sheet, recording a key', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+/');
    await page.getByRole('button', { name: 'Change Ctrl+B of Show or hide the navigation' }).click();
    await page.locator('.key-recorder').waitFor();
  } },
  { name: 'the shortcuts sheet, a key another shortcut has with Swap', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Control+/');
    await page.getByRole('button', { name: 'Change Ctrl+B of Show or hide the navigation' }).click();
    await page.keyboard.press('Control+Shift+m');
    await page.locator('.shortcut-offer').waitFor();
  } },
  // Each stage with the panels collapsed, and with them open under reduced transparency.
  ...STAGES.map((s): State => ({ name: `${s.name}, panels collapsed`, run: async (page) => { await open(page, s.url, s.ready, 'state' in s ? s.state : 'visible'); await collapsePanels(page); } })),
  ...STAGES.map((s): State => ({ name: `${s.name}, reduced transparency`, run: async (page) => { await reduceTransparency(page); await open(page, s.url, s.ready, 'state' in s ? s.state : 'visible'); } })),
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
  { name: 'the chat, its permission mode menu open', run: async (page) => {
    await withChat(page, RECORD.slice(1));
    await open(page, RECORD, '.chat-log .chat-item');
    await page.getByRole('button', { name: /^Permission mode/ }).click();
    await page.locator('.chat-mode-menu').waitFor();
  } },
  { name: 'the chat, the warning before Bypass, and its badge once on', run: async (page) => {
    await withChat(page, RECORD.slice(1));
    await open(page, RECORD, '.chat-log .chat-item');
    await page.getByRole('button', { name: /^Permission mode/ }).click();
    await page.locator('.chat-mode-item.is-bypass').click();
    await page.locator('.chat-bypass-warning').waitFor();
  } },
  { name: 'the chat, its session picker warning of a session open elsewhere', run: async (page) => {
    await withChat(page, RECORD.slice(1), 'picker');
    await open(page, RECORD, '.chat-session-open');
    await page.locator('.chat-session-open', { hasText: 'Plan the graph stage' }).click();
    await page.locator('.chat-warning').waitFor();
  } },
  // The desktop app's tab strip (LA-V103-R07), with a stand-in for the shell: two tabs, the second opened by Cmd+click.
  { name: 'the desktop app\'s tab strip with two tabs', run: async (page) => {
    await asDesktop(page);
    await open(page, `${RECORD}?stage=graph`, '.tab-strip [role="tab"]');
    const box = page.locator('.focus-stage .graph-box:not(.is-focus)').first();
    await box.waitFor({ state: 'attached' });
    await box.dispatchEvent('click', { metaKey: true, button: 0 });
    await page.locator('.tab-strip [role="tab"]').nth(1).waitFor();
  } },
  // The wiki card shows its whole page on every page above (useLook reads whole cards); Less shows its summary (LA-V102-R03).
  { name: 'the wiki card as its summary', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await showCard(page, 'summary');
  } },
  { name: 'a tooltip on keyboard focus', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    // A tooltip opens on keyboard focus: the last input is a key, as when the Reader tabs to it.
    await page.keyboard.press('Shift');
    await page.locator('.page-bar-actions .stage-switch button').first().focus();
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
  { name: 'quick find on a phone', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.locator('.topbar').getByRole('button', { name: 'Quick find' }).click();
    await page.locator('.quick-open input').fill('graph');
    await page.waitForTimeout(300);
  } },
  { name: 'the wiki card sheet', run: async (page) => {
    await open(page, RECORD, '.header-strip h1');
    await page.getByRole('button', { name: 'Show the wiki card' }).click();
    await page.locator('.wiki-panel-sheet .wiki-panel').waitFor();
  } },
  { name: 'the stage key sheet', run: async (page) => {
    await open(page, `${RECORD}?stage=graph`, '.stage-key-chip');
    await page.locator('.stage-key-chip').click();
    await page.locator('.stage-key-sheet .stage-key-sheet-list').waitFor();
  } },
];

/** The records one axe run proves besides LA-PAT-APP-UX-R10, each by the axe rules that check it. */
const BY_RULE: { record: string; says: string; rules: string[] }[] = [
  { record: 'LA-V61-R44-T01', says: "a control's name holds its visible text", rules: ['label-content-name-mismatch'] },
  { record: 'LA-V61-R45-T01', says: 'no control sits inside another', rules: ['nested-interactive'] },
  { record: 'LA-V61-R46-T01', says: 'a box that scrolls can be reached by keyboard', rules: ['scrollable-region-focusable'] },
  { record: 'LA-V61-R47-T01', says: 'a target is at least 24 px, or has room around it', rules: ['target-size'] },
  { record: 'LA-V61-R48-T01', says: 'text sits on surfaces with enough contrast', rules: ['color-contrast'] },
];

/** The Explorer's pages and states: where it shows the spec, as the domain LA-EXP owns them. */
const EXPLORER = ['domain page', 'record page', 'group page', ...STAGES.map((s) => s.name), 'Trace stage, a row opened'];

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
      test(`LA-PAT-APP-UX-R10-T01 ${s.name} passes axe`, async ({ page }) => {
        await s.run(page);
        await auditAll(page, `${look.name}, desktop: ${s.name}`);
      });
    }
  });

  test.describe(`phone at 375 px in ${look.name}`, () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
    test.beforeEach(({ page }) => useLook(page, look));
    for (const s of PHONE) {
      test(`LA-PAT-APP-UX-R10-T01 ${s.name} passes axe`, async ({ page }) => {
        await s.run(page);
        await auditAll(page, `${look.name}, phone: ${s.name}`);
      });
    }
  });
}

// LA-V96-R28-T02: the Changes controls every stage shows, with Highlight changes on, and the Changes panel over the stage, at
// desktop and phone widths in every look. The stability suite's data has nothing changed since its last commit, so the
// panel shows its empty answer and the controls their count of none.
for (const look of LOOKS) {
  for (const phone of [false, true]) {
    test.describe(`the Changes controls and panel, ${phone ? 'phone at 375 px' : 'desktop at 1440 px'} in ${look.name}`, () => {
      if (phone) test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
      test.beforeEach(({ page }) => useLook(page, look));
      test('LA-V96-R28-T02 the Changes controls, Highlight changes on and the Changes panel pass axe', async ({ page }) => {
        // Highlight changes on first (a narrow toolbar folds it into More; a phone's panel is a sheet over the stage), then the panel.
        await open(page, `${RECORD}?stage=graph`, '.focus-stage .graph-flow .graph-box', 'attached');
        const highlight = page.getByRole('group', { name: 'Changes' }).getByRole('button', { name: 'Highlight changes' });
        if (!(await highlight.isVisible())) await page.locator('.focus-stage .stage-more > summary').click();
        await highlight.click();
        await expect(highlight).toHaveAttribute('aria-pressed', 'true');
        await open(page, `${RECORD}?stage=graph&panel=changes`, '.changes-panel .tool-panel-title, .tool-sheet.changes-panel');
        await page.waitForTimeout(300);
        await auditAll(page, `${look.name}, ${phone ? 'phone' : 'desktop'}: the Changes controls and panel`);
      });
    });
  }
}
