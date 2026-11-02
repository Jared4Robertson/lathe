import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage, showCard } from './measure';
import { keepData } from './scenarios';
import { clickBox, clickErdBox, erdDrawn, erdSceneOf, expectKeyWhole, focusDrawn, sceneOf, traceDrawn, traceSceneOf } from './scene';

// Exploring's flow tests (LA-EXP-UC01-FL to UC13-FL): one per flow, each walking its main path in
// Chromium over the suite's copy of Lathe's data, as the Reader does. They prove the flow end to
// end; the scenarios beside them hold each move to "nothing jumps".

const WIKI = '.wiki-panel';
const STAGE_BOX = '.focus-stage';
const FLOW = `${STAGE_BOX} .graph-flow`;
const wikiTitle = (page: Page) => page.locator(`.header-strip h1`);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

/** Waits for the graph stage to draw its boxes and settle. */
async function graphReady(page: Page) {
  await page.locator(`${FLOW} .graph-box`).first().waitFor({ state: 'attached' });
  await page.waitForTimeout(700);
}

/** Opens quick find and the record whose ID is typed. */
async function quickFind(page: Page, id: string) {
  await page.keyboard.press('Control+k');
  const find = page.locator('.quick-open input');
  await expect(find).toBeFocused();
  await find.fill(id);
  await page.locator('.quick-open .palette-list li').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === `/${id}`);
}

test.describe('Exploring flows', () => {
  test('LA-EXP-UC01-FL-T find a record in a domain: the nav, the domain page by stage, its filter, the record', async ({ page }) => {
    await openPage(page, '/LA');
    const domains = nav(page).getByRole('list', { name: 'Domains of Lathe' });
    await expect(domains.getByRole('link', { name: 'Exploring' })).toBeVisible();
    await domains.getByRole('link', { name: 'Exploring' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP');
    const wiki = page.locator(WIKI);
    for (const stage of ['Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan']) {
      await expect(wiki.getByRole('heading', { level: 2, name: new RegExp(`^${stage} \\d+`) })).toBeVisible();
    }
    await wiki.getByRole('searchbox', { name: 'Filter records' }).fill('Tab set');
    await expect(wiki.getByRole('list', { name: 'Aggregates' }).getByRole('listitem')).toHaveCount(1);
    await expect(wiki.getByText('Nothing matches.').first()).toBeVisible();
    await wiki.getByRole('link', { name: 'LA-EXP-A5 Tab set' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A5');
    await expect(wikiTitle(page)).toHaveText('Tab set');
  });

  test('LA-EXP-UC02-FL-T follow a record\'s links: its page, a link by its relation, a row anywhere', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03-FL');
    const wiki = page.locator(WIKI);
    await expect(wikiTitle(page)).toHaveText('Walk the model as a graph');
    // The places above it in the card's breadcrumb (the deep middle folded into "…"), the children in their table.
    const crumb = wiki.locator('.wiki-panel-head .breadcrumb');
    await expect(crumb.getByRole('link', { name: 'Lathe' })).toBeVisible();
    await crumb.locator('.crumb-more-button').click();
    await expect(crumb.getByRole('list', { name: 'Hidden levels' }).getByRole('link', { name: 'Exploring' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(crumb.locator('.crumb-more-button')).toBeFocused();
    await expect(wiki.getByRole('table', { name: 'Steps of LA-EXP-UC03-FL, in order' })).toBeVisible();
    // A link out, named by its relation: the first step invokes a command.
    const invokes = wiki.getByRole('list', { name: 'LA-EXP-UC03-FL-S01 invokes' });
    await invokes.getByRole('link', { name: 'LA-EXP-CMD01' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-CMD01');
    // And back in: the command's page lists what invokes it.
    await expect(wiki.getByRole('heading', { name: /^Invoked by/ })).toBeVisible();
    // A click anywhere on a row opens its record: here on its count of children, beside the link.
    await page.goto('/LA-EXP');
    const row = wiki.getByRole('list', { name: 'Aggregates' }).getByRole('listitem').filter({ hasText: 'LA-EXP-A2' });
    await row.getByText(/children$/).click({ force: true });
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A2');
  });

  test('LA-EXP-UC03-FL-T walk the model as a graph: turn it on, click a node, filter, switch layout, the keyboard, open a record', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03');
    // The Graph stage of the page in hand, from the page bar's stage switch.
    await page.getByRole('group', { name: 'Stage' }).getByRole('button', { name: 'Graph' }).click();
    await graphReady(page);
    // The wiki card collapsed (Enter, from the page rather than the stage switch's button), so the graph has the open space and its whole toolbar shows.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator(WIKI)).toHaveCount(0);
    await graphReady(page);
    await focusDrawn(page, 'LA-EXP-UC03');
    const parent = (await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-CAP03')!;
    const focus = (await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-UC03')!;
    expect(parent.map.x, 'the parent at the left').toBeLessThan(focus.map.x);
    // Nodes carry stage and kind; the key bar along the bottom names the stages' colors and the kinds' shapes.
    expect(focus.stage).toBe('use-cases');
    expect(focus.kind).toBe('use_case');
    const key = page.locator(STAGE_BOX).getByRole('region', { name: 'Key' });
    await expect(key).toBeVisible();
    await expect(key.locator('[data-key-entry="stage-use-cases"]')).toHaveAttribute('title', /capability, use case/);
    await expect(key.locator('[data-key-entry="shape-stadium"]')).toContainText('Use case');
    await expectKeyWhole(page);
    // Hovering spotlights; clicking focuses, and the address and the header strip follow (the wiki card, shown again below, too).
    await clickBox(page, 'LA-EXP-UC03-R18');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03-R18');
    await focusDrawn(page, 'LA-EXP-UC03-R18');
    await expect(page.locator('.header-strip-id')).toHaveText('LA-EXP-UC03-R18');
    await expect(page.locator('.header-strip .breadcrumb .crumb').first()).toContainText('Lathe');
    // Filters: the minimap.
    await page.locator(`${STAGE_BOX} .graph-filters > summary`).click();
    await page.locator(`${STAGE_BOX} .graph-filter-body input[role="switch"]`).check();
    await expect(page.locator(`${STAGE_BOX} .graph-minimap`)).toBeVisible();
    await page.locator(`${STAGE_BOX} .graph-filters > summary`).click();
    // Nested, then back to Tree.
    for (const layout of ['Nested', 'Tree']) {
      await page.locator(`${STAGE_BOX} .graph-layout button`, { hasText: layout }).click();
      await expect(page.locator(FLOW)).toHaveAttribute('data-layout', layout.toLowerCase());
    }
    await graphReady(page);
    // From the keyboard: step out to the parent.
    await page.locator(FLOW).focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    // Read the node's record page in the wiki card, shown again (Enter, from the stage).
    await page.keyboard.press('Enter');
    await expect(page.locator(`${WIKI} .wiki-panel-title h2`)).toHaveText('Walk the model as a graph');
    await expect(wikiTitle(page)).toHaveText('Walk the model as a graph');
  });

  test('LA-EXP-UC04-FL-T walk the graph through folder-like groups: a domain\'s stages and kinds, a group\'s address, events, a pattern\'s rules', async ({ page }) => {
    await openPage(page, '/LA-EXP?stage=graph');
    await graphReady(page);
    // The depth decides the levels drawn: a domain's stages are its first level, a stage's kinds its second.
    await page.locator(`${STAGE_BOX} .graph-depth:not(.graph-layout) button`, { hasText: '2' }).click();
    await expect.poll(async () => (await sceneOf(page)).boxes.some((b) => b.id === 'LA-EXP/interaction-design/flow')).toBe(true);
    const groups = (await sceneOf(page)).boxes.filter((b) => b.group && b.id.startsWith('LA-EXP/')).map((b) => b.id);
    expect(groups).toEqual(expect.arrayContaining(['LA-EXP/domain-model', 'LA-EXP/test-plan', 'LA-EXP/interaction-design/flow']));
    // A group becomes the focus at its own address; the wiki beside it follows.
    await page.locator(`${FLOW} .graph-box[data-id="LA-EXP/interaction-design/flow"]`).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/LA-EXP/interaction-design/flow');
    await expect(wikiTitle(page)).toHaveText(/^Flows \(\d+\)$/);
    // Under an aggregate, its events in a Domain events group.
    await page.goto('/LA-EXP-A1?stage=graph');
    await graphReady(page);
    const events = (await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-A1/domain_event');
    expect(events?.group).toBe(true);
    expect((await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-EV01')?.kind).toBe('domain_event');
    // Under a pattern, its rules. With the wiki card collapsed (Enter): beside it, the open space is narrow and the
    // pattern's fifteen rules are each under MIN_DRAWN pixels, drawn as one bar.
    await page.goto('/LA-PAT-APP-UX?stage=graph');
    await graphReady(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator(WIKI)).toHaveCount(0);
    await expect.poll(async () => (await sceneOf(page)).boxes.some((b) => b.id === 'LA-PAT-APP-UX-R01')).toBe(true);
    // Only the tree's lines: the domains that follow the pattern are the Trace stage's and the wiki card's.
    expect((await sceneOf(page)).lines.every((l) => !l.link)).toBe(true);
  });

  test('LA-EXP-UC05-FL-T read a record on a stage with its wiki card: quick find, stages, the card, links, Back and the nav', async ({ page }) => {
    await openPage(page, '/LA');
    await quickFind(page, 'LA-EXP-A1');
    await expect(wikiTitle(page)).toHaveText('Page');
    // An address names its stage.
    await page.goto('/LA-EXP-A1?stage=erd');
    await expect(page.locator('.focus-stage')).toHaveAttribute('data-stage', 'erd');
    await erdDrawn(page);
    await expect(page.locator(`${WIKI} .wiki-panel-title h2`)).toHaveText('Page');
    // Back to the graph; resize the wiki card from the keyboard, collapse it and bring it back.
    await page.keyboard.press('Control+1');
    await expect(page.locator('.focus-stage')).toHaveAttribute('data-stage', 'graph');
    await graphReady(page);
    const handle = page.getByRole('separator', { name: 'Resize the wiki card' });
    const before = await handle.getAttribute('aria-valuenow');
    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(handle).not.toHaveAttribute('aria-valuenow', before ?? '');
    // Enter on the handle collapses the card, and focus goes to the page bar's toggle, where Enter shows it again.
    await page.keyboard.press('Enter');
    await expect(page.locator(WIKI)).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(page.locator(WIKI)).toHaveCount(1);
    // A link in the card moves the stage and the strip; Back and Forward move them all.
    await page.locator(`${WIKI} .wiki-panel-head .crumb-more-button`).click();
    await page.locator(`${WIKI} .wiki-panel-head`).getByRole('list', { name: 'Hidden levels' }).getByRole('link', { name: 'Exploring' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP');
    await focusDrawn(page, 'LA-EXP');
    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A1');
    await focusDrawn(page, 'LA-EXP-A1');
    await expect(wikiTitle(page)).toHaveText('Page');
    await page.goForward();
    await page.waitForURL((u) => u.pathname === '/LA-EXP');
    // Long lists ten rows at a time, with their own filter; grouped rules under headings.
    await expect(page.locator(`${WIKI} .long-list-scroll`).first()).toBeVisible();
    await page.goto('/LA-PAT-APP-UX');
    await expect(page.locator(WIKI).getByRole('heading', { level: 3, name: /^Look and feel \d+/ })).toBeVisible();
    // Fold a nav section, collapse the nav to a rail and bring it back.
    const domainsFold = nav(page).getByRole('button', { name: /^(Fold|Unfold) Exploring$/ });
    const was = await domainsFold.getAttribute('aria-expanded');
    await domainsFold.click();
    await expect(domainsFold).not.toHaveAttribute('aria-expanded', was ?? 'false');
    await nav(page).getByRole('button', { name: 'Collapse the navigation' }).click();
    await expect(nav(page).getByRole('button', { name: 'Expand the navigation' })).toBeVisible();
    await nav(page).getByRole('button', { name: 'Expand the navigation' }).click();
    await expect(nav(page).getByRole('button', { name: 'Collapse the navigation' })).toBeVisible();
  });

  test('LA-EXP-UC06-FL-T read a flow step by step: its table, a step unfolded, the graph, a requirement traced to its step', async ({ page }) => {
    // The flow's steps as the data has them, in order: the table shows each, first to last.
    const flowSteps = readFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'flow_step.jsonl'), 'utf8')
      .split('\n').filter(Boolean).map((line) => JSON.parse(line) as { id: string; flow_id: string; path: string; position: number })
      .filter((s) => s.flow_id === 'LA-EXP-UC03-FL')
      .sort((a, b) => (a.path === b.path ? a.position - b.position : a.path === 'main' ? -1 : b.path === 'main' ? 1 : a.path.localeCompare(b.path)));
    await openPage(page, '/LA-EXP-UC03-FL');
    const steps = page.locator(WIKI).getByRole('table', { name: 'Steps of LA-EXP-UC03-FL, in order' });
    await expect(steps.getByRole('rowheader')).toHaveCount(flowSteps.length);
    await expect(steps.getByRole('rowheader').first()).toContainText(flowSteps[0].id);
    await expect(steps.getByRole('rowheader').last()).toContainText(flowSteps.at(-1)!.id);
    const unfold = steps.getByRole('button', { name: 'Expand LA-EXP-UC03-FL-S01' });
    await unfold.click();
    await expect(steps.getByRole('button', { name: 'Collapse LA-EXP-UC03-FL-S01' })).toHaveAttribute('aria-expanded', 'true');
    // On the Graph stage, with the wiki card collapsed, the steps sit under the flow.
    await page.getByRole('group', { name: 'Stage' }).getByRole('button', { name: 'Graph' }).click();
    await graphReady(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator(WIKI)).toHaveCount(0);
    await graphReady(page);
    await focusDrawn(page, 'LA-EXP-UC03-FL');
    await expect.poll(async () => (await sceneOf(page)).boxes.filter((b) => /^LA-EXP-UC03-FL-S\d+$/.test(b.id)).length).toBe(flowSteps.length);
    // A requirement's Trace stage: Expand row opens its use case's row, its box focused in the Use case column, its path
    // lit across the row to the flow whose step fulfills it, the rest faded.
    await page.goto('/LA-EXP-UC03-R18?stage=trace');
    await traceDrawn(page);
    const expandRow = page.locator('.focus-stage .stage-toolbar').getByRole('button', { name: 'Expand row' });
    if ((await expandRow.getAttribute('aria-pressed')) !== 'true') await expandRow.click();
    const own = 'LA-EXP-UC03|use-case/LA-EXP-UC03-R18';
    await expect.poll(async () => (await traceSceneOf(page, true)).boxes.find((b) => b.key === own)?.focus, { timeout: 5000 }).toBe(true);
    // Once the fade has glided to its end: the path at full strength.
    await expect.poll(async () => (await traceSceneOf(page, true)).boxes.find((b) => b.key === own)?.strength, { timeout: 5000 }).toBe(1);
    const lit = await traceSceneOf(page, true);
    expect(lit.boxes.find((b) => b.key === own)).toMatchObject({ column: 2, lit: true, strength: 1 });
    expect(lit.boxes.find((b) => b.key === 'LA-EXP-UC03|design/LA-EXP-UC03-FL')!.lit).toBe(true);
    expect(lit.lines.some((l) => l.kind === 'path' && l.lit && l.from === own)).toBe(true);
    // From the keyboard, through the list under the canvas: the flow opened, then the step's link and Enter.
    const design = page.locator('.focus-stage .trace-access').getByRole('region', { name: 'Design flow' });
    const flow = design.getByRole('listitem').filter({ has: page.getByRole('link', { name: /LA-EXP-UC03-FL(?!-)/ }) });
    if ((await flow.getByRole('button').getAttribute('aria-expanded')) !== 'true') {
      await flow.getByRole('button').focus();
      await page.keyboard.press('Enter');
    }
    // The flow's steps sit under the interface they happen through: open the Web app's.
    const webApp = design.getByRole('listitem').filter({ has: page.getByRole('link', { name: /LA-IF01 Web app/ }) }).getByRole('button');
    if ((await webApp.getAttribute('aria-expanded')) !== 'true') {
      await webApp.focus();
      await page.keyboard.press('Enter');
    }
    await design.getByRole('link', { name: /LA-EXP-UC03-FL-S01(?!\d)/ }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03-FL-S01');
    // The step's own page in the wiki card, shown again (Enter, from the page), and its box focused in its row.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    await expect(page.locator(WIKI).getByRole('link', { name: /LA-EXP-CMD01/ }).first()).toBeVisible();
    await expect.poll(async () => (await traceSceneOf(page, true)).boxes.find((b) => b.focus)?.id).toBe('LA-EXP-UC03-FL-S01');
  });

  test('LA-EXP-UC07-FL-T work in one product at a time: the rail, its last page, Alt+1 and Switch to, find, Checks, the phone, the products page', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03');
    const rail = page.locator('.rail-spaces');
    const space = rail.locator('a.space-item[data-space="LA"]');
    await expect(space).toHaveAttribute('aria-current', /.+/);
    // Leave the space for the products picker, over the space's dimmed stage; choosing the space opens its last page.
    await page.locator('nav#nav a.brand').click();
    await page.waitForURL((u) => u.pathname === '/');
    const picker = page.getByRole('dialog', { name: 'Products' });
    await expect(picker).toBeVisible();
    await expect(page.locator('.stage-layout.is-backdrop .focus-stage')).not.toBeEmpty();
    await picker.getByRole('link', { name: /^LA Lathe/ }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    // Alt and its number, and Switch to in the palette.
    await page.locator('nav#nav a.brand').click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.keyboard.press('Alt+1');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    await page.keyboard.press('Control+Shift+p');
    await page.locator('.quick-open input').fill('>Switch to');
    await expect(page.locator('.palette-list')).toContainText('Lathe');
    await page.keyboard.press('Escape');
    // Find a record in the space, and open Checks over its stage.
    await quickFind(page, 'LA-EXP-A2');
    await nav(page).getByRole('link', { name: /^Checks/ }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A2' && u.search === '?panel=checks');
    await expect(page.locator('.tool-panel.checks-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForURL((u) => u.search === '');
    // On a phone the rail sits in the nav sheet.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Open the navigation' }).click();
    await expect(page.locator('nav#nav .rail-spaces a.space-item[data-space="LA"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    // From the products picker, choose the space.
    await page.goto('/');
    await page.getByRole('dialog', { name: 'Products' }).getByRole('link', { name: /^LA Lathe/ }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/LA'));
  });

  test('LA-EXP-UC07-R12-T01 the rail shows with the workspace\'s two products, and not when it shows one', async ({ page }) => {
    await openPage(page, '/LA');
    const rail = page.locator('nav#nav .rail-spaces');
    await expect(rail.locator('a.space-item')).toHaveCount(2);
    await expect(rail.locator('a.space-item[data-space="TL"]')).toBeVisible();
    // The same workspace with its own product alone: no rail, the product at the top of the nav.
    await page.route('**/api/product/list-products*', async (route) => {
      const answer = await route.fetch();
      const products = (await answer.json()) as { id: string }[];
      await route.fulfill({ response: answer, json: products.filter((p) => p.id === 'LA') });
    });
    await page.reload();
    await nav(page).getByRole('link', { name: 'Lathe', exact: true }).first().waitFor();
    await expect(page.locator('nav#nav .space-rail')).toHaveCount(0);
    await expect(nav(page).locator('.space-items a[href="/LA"] .space-mark')).toBeVisible();
    await page.unroute('**/api/product/list-products*');
  });

  test('LA-EXP-UC08-FL-T read a product in stage folders: the nav\'s domains and stages, the open branch, capabilities in order, the domain page', async ({ page }) => {
    await openPage(page, '/LA');
    const n = nav(page);
    await expect(n.getByRole('link', { name: 'Lathe', exact: true }).first()).toBeVisible();
    await expect(n.getByRole('list', { name: 'Shared in Lathe' })).toBeVisible();
    await n.getByRole('button', { name: 'Unfold Exploring' }).click();
    const folders = n.getByRole('list', { name: 'Folders of Exploring' });
    for (const stage of ['Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan']) {
      await expect(folders.getByRole('button', { name: new RegExp(`^${stage} \\d+$`) })).toBeVisible();
    }
    // Opening a page opens the rows that hold it.
    await page.goto('/LA-PLT-UC07');
    await expect(n.getByRole('button', { name: 'Fold Platform' })).toHaveAttribute('aria-expanded', 'true');
    const platform = n.getByRole('list', { name: 'Folders of Platform' });
    await expect(platform.getByRole('button', { name: /^Use cases \d+$/ })).toHaveAttribute('aria-expanded', 'true');
    // Use cases holds only capabilities, so it lists them itself, with no Capabilities folder between.
    await expect(n.getByRole('list', { name: 'Use cases of Platform' }).getByRole('link', { name: /\S/ }).first()).toBeVisible();
    await expect(n.getByRole('list', { name: 'Use cases of Platform' }).getByRole('button', { name: /^Capabilities \d+$/ })).toHaveCount(0);
    // Use cases lists the capabilities in order.
    await page.goto('/LA-EXP/use-cases');
    const caps = page.locator(WIKI).getByRole('link', { name: /^LA-EXP-CAP\d+/ });
    await expect(caps.first()).toBeVisible();
    const ids = await caps.evaluateAll((as) => as.map((a) => a.querySelector('code')?.textContent ?? ''));
    expect(ids.slice(0, 3)).toEqual(['LA-EXP-CAP01', 'LA-EXP-CAP02', 'LA-EXP-CAP03']);
    // The domain page heads its records with the same stages.
    await page.goto('/LA-EXP');
    await expect(page.locator(WIKI).getByRole('heading', { level: 2, name: /^Test plan \d+/ })).toBeVisible();
    const headings = await page.locator(WIKI).getByRole('heading', { level: 2 }).allTextContents();
    expect(headings.map((h) => h.replace(/\s*\d+$/, '')).filter((h) => ['Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan'].includes(h)))
      .toEqual(['Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan']);
  });

  test('LA-EXP-UC09-FL-T read the technical specification and test plan by kind: the domain page, the nav\'s kind groups, the graph\'s groups', async ({ page }) => {
    await openPage(page, '/LA-EXP');
    const wiki = page.locator(WIKI);
    await expect(wiki.getByRole('heading', { level: 3, name: /^Repositories \d+/ })).toBeVisible();
    await expect(wiki.getByRole('heading', { level: 3, name: /^Constraint tests \d+/ })).toBeVisible();
    // A domain page opens no nav row (LA-V90-R18): its chevron shows the domain's folders.
    await nav(page).getByRole('button', { name: 'Unfold Exploring' }).click();
    const folders = nav(page).getByRole('list', { name: 'Folders of Exploring' });
    await folders.getByRole('button', { name: /^Technical specification \d+/ }).click();
    await expect(nav(page).getByRole('list', { name: 'Technical specification of Exploring' }).getByRole('button', { name: /^Repositories \d+$/ })).toBeVisible();
    await folders.getByRole('button', { name: /^Test plan \d+/ }).click();
    await expect(nav(page).getByRole('list', { name: 'Test plan of Exploring' }).getByRole('button', { name: /^Constraint tests \d+$/ })).toBeVisible();
    // The graph reaches the same records through the same groups; the header strip names each.
    await page.goto('/LA-EXP?stage=graph');
    await graphReady(page);
    await page.locator(`${FLOW} .graph-box[data-id="LA-EXP/technical-specification"]`).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/LA-EXP/technical-specification');
    await graphReady(page);
    await expect(wikiTitle(page)).toHaveText(/^Technical specification/);
    await expect(page.locator('.header-strip .breadcrumb .crumb').last()).toContainText('Exploring');
    // Its kinds are reached from it: In steps to its first kind's group (the focus is framed whole, its kinds beside it).
    await page.getByRole('button', { name: 'In to the first child', exact: true }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/LA-EXP/technical-specification/'));
  });

  test('LA-EXP-UC10-FL-T explore in browser tabs, each its own place: no tab strip, one entry per move, kept through a reload, Cmd+click a new browser tab', async ({ page, context }) => {
    await openPage(page, '/LA-EXP-A1?stage=graph');
    await graphReady(page);
    // No tab strip of the app's: the browser's tabs are the places.
    await expect(page.getByRole('tablist')).toHaveCount(0);
    // Each move is one entry of the browser's history, the address following it.
    const length = await page.evaluate(() => window.history.length);
    await page.locator(FLOW).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForURL((u) => u.pathname !== '/LA-EXP-A1');
    expect(await page.evaluate(() => window.history.length)).toBe(length + 1);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A1');
    // Depth 2 and a kind hidden, then a reload: the browser tab keeps them.
    await graphReady(page);
    await page.locator(`${STAGE_BOX} .graph-depth:not(.graph-layout) button`, { hasText: '2' }).click();
    await page.locator(`${STAGE_BOX} .graph-filters > summary`).click();
    await page.locator(`${STAGE_BOX} .graph-filter-body fieldset:not(:first-child) input[type="checkbox"]`).first().uncheck();
    await page.locator(`${STAGE_BOX} .graph-filters > summary`).click();
    await page.reload();
    await graphReady(page);
    await expect(page.locator(`${STAGE_BOX} .graph-depth:not(.graph-layout) button[aria-pressed="true"]`)).toHaveText('2');
    await expect(page.locator(`${STAGE_BOX} .graph-filters .section-count`)).toHaveText(/hidden/);
    // Cmd+click on a box: a new browser tab at its address; this one stays.
    const box = page.locator(`${FLOW} .graph-box:not(.is-focus)`).first();
    const id = await box.getAttribute('data-id');
    const opened = context.waitForEvent('page');
    await box.dispatchEvent('click', { metaKey: true, button: 0 });
    const other = await opened;
    await other.waitForURL((u) => u.pathname === `/${id}`);
    expect(new URL(page.url()).pathname).toBe('/LA-EXP-A1');
    await other.close();
  });

  test('LA-EXP-UC11-FL-T read a domain and its aggregates as an ERD: the ERD stage, an aggregate picked, an entity, the key', async ({ page }) => {
    await openPage(page, '/LA-EXP');
    await page.getByRole('group', { name: 'Stage' }).getByRole('button', { name: 'ERD' }).click();
    const model = page.getByRole('region', { name: /^ERD: / });
    await erdDrawn(page);
    await expect(model.getByRole('group', { name: /^Aggregate / }).first()).toBeAttached();
    expect(await model.getByRole('group', { name: /^Aggregate / }).count()).toBeGreaterThanOrEqual(2);
    await expect(model.getByRole('list', { name: 'Lines' }).getByRole('listitem').first()).toBeAttached();
    // An aggregate's box, by its head: its entities and fields.
    await clickErdBox(page, 'LA-EXP-A5');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A5');
    await expect(model.getByRole('list', { name: /^Fields of / }).first()).toBeAttached();
    // On an entity, the same map picks it out, framed; what lies outside its aggregate faded and hidden from the keyboard.
    await erdDrawn(page);
    const entity = (await erdSceneOf(page)).boxes.find((b) => b.kind === 'entity' && !b.focus && b.strength === 1)!;
    await clickErdBox(page, entity.id);
    await page.waitForURL((u) => /^\/LA-EXP-EN\d+$/.test(u.pathname));
    await expect.poll(async () => (await erdSceneOf(page)).boxes.some((b) => b.focus && b.pick)).toBe(true);
    // The key bar along the bottom, with the picked-out box and the faded ones.
    const key = page.locator('.focus-stage').getByRole('region', { name: 'Key' });
    await expect(key).toBeVisible();
    await expect(key).toContainText('Picked out');
  });

  test('LA-EXP-UC12-FL-T LA-EXP-UC12-R07-T01 read a record\'s history in the wiki card: its uncommitted change, a commit\'s diff and Load more', async ({ page }) => {
    const root = process.env.STABILITY_ROOT!;
    const restore = keepData();
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    const file = path.join(root, 'data', 'domain.jsonl');
    const original = readFileSync(file, 'utf8');
    const retitle = (title: string) => writeFileSync(file, original.replace(/("id":"LA-EXP","title":")[^"]*"/, `$1${title}"`));
    try {
      // History reads git: the suite's copy becomes a repository with more commits of the record than a page holds.
      git('init', '-q');
      git('-c', 'user.name=Stability', '-c', 'user.email=stability@example.test', 'add', '.');
      git('-c', 'user.name=Stability', '-c', 'user.email=stability@example.test', 'commit', '-q', '-m', 'The data');
      for (let i = 1; i <= 21; i++) {
        retitle(`Exploring ${i}`);
        git('-c', 'user.name=Stability', '-c', 'user.email=stability@example.test', 'commit', '-q', '-am', `Retitle ${i}`);
      }
      writeFileSync(file, original);
      await openPage(page, '/LA-EXP?stage=graph');
      await graphReady(page);
      // History, at the end of the wiki card's whole page (More), read from the repository only once asked.
      const card = page.locator(WIKI);
      await showCard(page, 'whole');
      await card.getByRole('button', { name: 'Show the history' }).click();
      const history = card.locator('.record-history');
      await expect(history).toContainText(/not committed|uncommitted/i, { timeout: 20_000 });
      await expect(history).toContainText('Retitle 21');
      await history.getByText('Retitle 20', { exact: true }).click();
      await expect(history).toContainText('Exploring 20');
      await history.getByRole('button', { name: /Load more/ }).click();
      await expect(history).toContainText('The data', { timeout: 20_000 });
    } finally {
      rmSync(path.join(root, '.git'), { recursive: true, force: true });
      restore();
    }
  });

  test('LA-EXP-UC13-FL-T read a domain\'s endpoints and integrations: the domain\'s Interaction design, a command\'s endpoint, an integration\'s steps', async ({ page }) => {
    await openPage(page, '/LA-PRD');
    const wiki = page.locator(WIKI);
    await expect(wiki.getByRole('list', { name: 'Endpoints' }).getByRole('link', { name: 'LA-PRD-EP121 POST /api/product/change-product' })).toBeVisible();
    await expect(wiki.getByRole('list', { name: 'Integrations' }).getByRole('listitem').first()).toBeVisible();
    // The command and its endpoint, method and route.
    await page.goto('/LA-PRD-CMD121');
    await expect(wiki.getByRole('link', { name: 'LA-PRD-EP121 POST /api/product/change-product' })).toBeVisible();
    await wiki.getByRole('link', { name: 'LA-PRD-EP121 POST /api/product/change-product' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-PRD-EP121');
    // An integration lists the steps that exchange with its system.
    await page.goto('/LA-INT04');
    await expect(wiki.getByRole('list', { name: 'Exchanged with by' }).getByRole('link').first()).toBeVisible();
  });
});
