import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { keepData } from './scenarios';
import { clickBox, focusDrawn, sceneOf } from './scene';

// Exploring's flow tests (LA-EXP-UC01-FL01 to UC13-FL01): one per flow, each walking its main path in
// Chromium over the suite's copy of Lathe's data, as the Reader does. They prove the flow end to
// end; the scenarios beside them hold each move to "nothing jumps".

const WIKI = '.pane-wiki';
const GRAPH_PANE = '.pane-graph';
const FLOW = `${GRAPH_PANE} .graph-flow`;
const wikiTitle = (page: Page) => page.locator(`${WIKI} .pane-title h1`);
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const sideBarViews = (page: Page) => page.getByRole('group', { name: 'Side bar views' });

/** Waits for the graph pane to draw its boxes and settle. */
async function graphReady(page: Page) {
  await page.locator(`${FLOW} .graph-box`).first().waitFor({ state: 'attached' });
  await page.waitForTimeout(700);
}

/** Opens quick find and the record whose ID is typed. */
async function quickFind(page: Page, id: string) {
  await page.keyboard.press('Control+k');
  const find = page.locator('.quick-find input');
  await expect(find).toBeFocused();
  await find.fill(id);
  await page.locator('.quick-find-results li').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === `/${id}`);
}

test.describe('Exploring flows', () => {
  test('LA-EXP-UC01-FL01-T find a record in a domain: the nav, the domain page by stage, its filter, the record', async ({ page }) => {
    await openPage(page, '/LA');
    const domains = nav(page).getByRole('list', { name: 'Domains of Lathe' });
    await expect(domains.getByRole('link', { name: 'Exploring' })).toBeVisible();
    await domains.getByRole('link', { name: 'Exploring' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP');
    const wiki = page.locator(WIKI);
    for (const stage of ['Domain model', 'Use cases', 'Interaction design', 'Technical specification', 'Test plan']) {
      await expect(wiki.getByRole('heading', { level: 2, name: new RegExp(`^${stage} \\d+`) })).toBeVisible();
    }
    await wiki.getByRole('searchbox', { name: 'Filter records' }).fill('Tab group');
    await expect(wiki.getByRole('list', { name: 'Aggregates' }).getByRole('listitem')).toHaveCount(1);
    await expect(wiki.getByText('Nothing matches.').first()).toBeVisible();
    await wiki.getByRole('link', { name: 'LA-EXP-A5 Tab group' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A5');
    await expect(wikiTitle(page)).toHaveText('Tab group');
  });

  test('LA-EXP-UC02-FL01-T follow a record\'s links: its page, a link by its relation, a row anywhere', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03-FL01');
    const wiki = page.locator(WIKI);
    await expect(wikiTitle(page)).toHaveText('Walk the model as a graph');
    // The parent in the crumb, the children in their table.
    await expect(wiki.locator('.pane-title').getByRole('link', { name: 'Exploring' })).toBeVisible();
    await expect(wiki.getByRole('table', { name: 'Steps of LA-EXP-UC03-FL01, in order' })).toBeVisible();
    // A link out, named by its relation: the first step invokes a command.
    const invokes = wiki.getByRole('list', { name: 'LA-EXP-UC03-FL01-S01 invokes' });
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

  test('LA-EXP-UC03-FL01-T walk the model as a graph: turn it on, click a node, filter, switch layout, the keyboard, open a record', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03');
    // The Graph view of the page in hand, from the page bar.
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Graph' }).click();
    await graphReady(page);
    // The graph alone, so its whole toolbar shows.
    await page.keyboard.press('Control+1');
    await expect(page.locator(WIKI)).toHaveCount(0);
    await graphReady(page);
    await focusDrawn(page, 'LA-EXP-UC03');
    const parent = (await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-CAP03')!;
    const focus = (await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-UC03')!;
    expect(parent.map.x, 'the parent at the left').toBeLessThan(focus.map.x);
    // Nodes carry stage and kind; the legend sits in the side bar's Details.
    expect(focus.stage).toBe('use-cases');
    expect(focus.kind).toBe('use_case');
    await expect(page.locator('.side-bar .graph-legend')).toBeAttached();
    // Hovering spotlights; clicking focuses, the address and the trail follow, the side bar describes it.
    await clickBox(page, 'LA-EXP-UC03-R18');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03-R18');
    await focusDrawn(page, 'LA-EXP-UC03-R18');
    await expect(page.locator(`${GRAPH_PANE} .graph-trail li`)).toHaveCount(2);
    await expect(page.getByRole('complementary', { name: 'Side bar' }).getByRole('region', { name: 'Details' })).toContainText('LA-EXP-UC03-R18');
    // Filters: Links on, the minimap.
    await page.locator(`${GRAPH_PANE} .graph-links button`).click();
    await expect(page.locator(`${GRAPH_PANE} .graph-links button`)).toHaveAttribute('aria-pressed', 'true');
    await page.locator(`${GRAPH_PANE} .graph-filters > summary`).click();
    await page.locator(`${GRAPH_PANE} .graph-filter-body input[role="switch"]`).check();
    await expect(page.locator(`${GRAPH_PANE} .graph-minimap`)).toBeVisible();
    await page.locator(`${GRAPH_PANE} .graph-filters > summary`).click();
    // Nested, then Voronoi.
    for (const layout of ['Nested', 'Voronoi', 'Tree']) {
      await page.locator(`${GRAPH_PANE} .graph-layout button`, { hasText: layout }).click();
      await expect(page.locator(FLOW)).toHaveAttribute('data-layout', layout.toLowerCase());
    }
    await graphReady(page);
    // From the keyboard: step out to the parent.
    await page.locator(FLOW).focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    // Open the node's record page in the wiki.
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Wiki' }).click();
    await expect(wikiTitle(page)).toHaveText('Walk the model as a graph');
  });

  test('LA-EXP-UC04-FL01-T walk the graph through folder-like groups: a domain\'s stages and kinds, a group\'s address, events, a pattern\'s rules', async ({ page }) => {
    await openPage(page, '/LA-EXP?view=wiki,graph');
    await graphReady(page);
    const groups = (await sceneOf(page)).boxes.filter((b) => b.group && b.id.startsWith('LA-EXP/')).map((b) => b.id);
    expect(groups).toEqual(expect.arrayContaining(['LA-EXP/domain-model', 'LA-EXP/test-plan', 'LA-EXP/interaction-design/flow']));
    // A group becomes the focus at its own address; the wiki beside it follows.
    await page.locator(`${FLOW} .graph-box[data-id="LA-EXP/interaction-design/flow"]`).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/LA-EXP/interaction-design/flow');
    await expect(wikiTitle(page)).toHaveText(/^Flows \(\d+\)$/);
    // Under an aggregate, its events in a Domain events group.
    await page.goto('/LA-EXP-A1?view=wiki,graph');
    await graphReady(page);
    const events = (await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-A1/domain_event');
    expect(events?.group).toBe(true);
    expect((await sceneOf(page)).boxes.find((b) => b.id === 'LA-EXP-EV01')?.kind).toBe('domain_event');
    // Under a pattern, its rules; follows is a cross-link once Links is on.
    await page.goto('/LA-PAT-APP-UX?view=wiki,graph');
    await graphReady(page);
    expect((await sceneOf(page)).boxes.some((b) => b.id === 'LA-PAT-APP-UX-R01')).toBe(true);
    // Links, by its key (the pane beside the wiki folds it into the toolbar's More).
    await page.locator(FLOW).focus();
    await page.keyboard.press('l');
    await expect.poll(async () => (await sceneOf(page)).lines.some((l) => l.link && l.target === 'LA-PAT-APP-UX' && l.label === 'Follows')).toBe(true);
  });

  test('LA-EXP-UC05-FL01-T read a record as wiki, graph and model side by side: quick find, panes, links, Back, the nav and the side bar', async ({ page }) => {
    await openPage(page, '/LA');
    await quickFind(page, 'LA-EXP-A1');
    await expect(wikiTitle(page)).toHaveText('Page');
    // An address names its views.
    await page.goto('/LA-EXP-A1?view=wiki,graph,model');
    await expect(page.locator('.focus-views > .pane')).toHaveCount(3);
    await graphReady(page);
    // Close Model, resize the panes from the keyboard, show one alone.
    await page.keyboard.press('Control+4');
    await expect(page.locator('.pane-erd')).toHaveCount(0);
    const handle = page.getByRole('separator', { name: 'Resize the wiki and graph panes' });
    const before = await handle.getAttribute('aria-valuenow');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).not.toHaveAttribute('aria-valuenow', before ?? '');
    await page.locator(`${WIKI} .pane-title`).click();
    await page.keyboard.press('Control+3');
    await expect(page.locator('.pane.is-fullscreen')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pane.is-fullscreen')).toHaveCount(0);
    // A link in the wiki moves every pane; Back and Forward move both.
    await page.locator(`${WIKI} .pane-title`).getByRole('link', { name: 'Exploring' }).click();
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
    // Fold the side bar away from the page bar.
    if (await page.getByRole('complementary', { name: 'Side bar' }).count()) await page.getByRole('complementary', { name: 'Side bar' }).getByRole('button', { name: 'Hide the side bar' }).click();
    await page.getByRole('button', { name: 'Show the side bar' }).click();
    await expect(page.getByRole('complementary', { name: 'Side bar' })).toBeVisible();
    await page.getByRole('complementary', { name: 'Side bar' }).getByRole('button', { name: 'Hide the side bar' }).click();
    await expect(page.getByRole('complementary', { name: 'Side bar' })).toHaveCount(0);
  });

  test('LA-EXP-UC06-FL01-T read a flow step by step: its table, a step unfolded, the graph, a requirement traced to its step', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03-FL01');
    const steps = page.locator(WIKI).getByRole('table', { name: 'Steps of LA-EXP-UC03-FL01, in order' });
    await expect(steps.getByRole('rowheader')).toHaveCount(9);
    await expect(steps.getByRole('rowheader').first()).toContainText('LA-EXP-UC03-FL01-S01');
    await expect(steps.getByRole('rowheader').last()).toContainText('LA-EXP-UC03-FL01-S09');
    const unfold = steps.getByRole('button', { name: 'Expand LA-EXP-UC03-FL01-S01' });
    await unfold.click();
    await expect(steps.getByRole('button', { name: 'Collapse LA-EXP-UC03-FL01-S01' })).toHaveAttribute('aria-expanded', 'true');
    // In the Graph view the steps sit under the flow.
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Graph' }).click();
    await graphReady(page);
    await page.keyboard.press('Control+1');
    await expect(page.locator(WIKI)).toHaveCount(0);
    await graphReady(page);
    await focusDrawn(page, 'LA-EXP-UC03-FL01');
    await expect.poll(async () => (await sceneOf(page)).boxes.filter((b) => /^LA-EXP-UC03-FL01-S\d+$/.test(b.id)).length).toBe(9);
    // A requirement names the step that fulfills it, with its flow and what it invokes.
    await page.goto('/LA-EXP-UC03-R18?view=wiki');
    await expect(page.locator(WIKI).getByRole('heading', { name: /^Designed by/ })).toBeVisible();
    const wiki = page.locator(WIKI);
    await expect(wiki.getByRole('link', { name: /^LA-EXP-UC03-FL01-S01/ }).first()).toBeVisible();
    await wiki.getByRole('link', { name: /^LA-EXP-UC03-FL01-S01/ }).first().click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03-FL01-S01');
    await expect(wiki.getByRole('link', { name: /LA-EXP-CMD01/ }).first()).toBeVisible();
  });

  test('LA-EXP-UC07-FL01-T work in one product at a time: the rail, its last page, Alt+1 and Switch to, find, Checks, the phone, the products page', async ({ page }) => {
    await openPage(page, '/LA-EXP-UC03');
    const rail = page.locator('.rail-spaces');
    const space = rail.locator('a.space-item[data-space="LA"]');
    await expect(space).toHaveAttribute('aria-current', /.+/);
    // Leave the space for the products page; choosing the space opens its last page.
    await page.locator('nav#nav a.brand').click();
    await page.waitForURL((u) => u.pathname === '/');
    await rail.locator('a.space-item[data-space="LA"]').click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    // Alt and its number, and Switch to in the palette.
    await page.locator('nav#nav a.brand').click();
    await page.waitForURL((u) => u.pathname === '/');
    await page.keyboard.press('Alt+1');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-UC03');
    await page.keyboard.press('Control+Shift+p');
    await page.locator('.dialog-search').fill('Switch to');
    await expect(page.locator('.palette-list')).toContainText('Lathe');
    await page.keyboard.press('Escape');
    // Find a record in the space, and open its Checks.
    await quickFind(page, 'LA-EXP-A2');
    await nav(page).getByRole('link', { name: /^Checks/ }).click();
    await page.waitForURL((u) => u.pathname === '/LA/checks');
    // On a phone the rail sits in the nav sheet.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Open the navigation' }).click();
    await expect(page.locator('nav#nav .rail-spaces a.space-item[data-space="LA"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    // From the products page, choose the space.
    await page.goto('/');
    await page.getByRole('main').getByRole('link', { name: /^LA Lathe/ }).click();
    await page.waitForURL((u) => u.pathname.startsWith('/LA'));
  });

  test('LA-EXP-UC07-R12-T01 the rail shows with the workspace\'s two products, and not when it shows one', async ({ page }) => {
    await openPage(page, '/LA');
    const rail = page.locator('nav#nav .rail-spaces');
    await expect(rail.locator('a.space-item')).toHaveCount(2);
    await expect(rail.locator('a.space-item[data-space="TL"]')).toBeVisible();
    // The same workspace with its own product alone: no rail, the product at the top of the nav.
    await page.route('**/api/spec', async (route) => {
      const answer = await route.fetch();
      const spec = (await answer.json()) as { sources: unknown[] };
      await route.fulfill({ response: answer, json: { ...spec, sources: spec.sources.slice(0, 1) } });
    });
    await page.reload();
    await nav(page).getByRole('link', { name: 'Lathe', exact: true }).first().waitFor();
    await expect(page.locator('nav#nav .space-rail')).toHaveCount(0);
    await expect(nav(page).locator('.space-items a[href="/LA"] .space-mark')).toBeVisible();
    await page.unroute('**/api/spec');
  });

  test('LA-EXP-UC08-FL01-T read a product in stage folders: the nav\'s domains and stages, the open branch, capabilities in order, the domain page', async ({ page }) => {
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
    await page.goto('/LA-PLT-UC05');
    await expect(n.getByRole('button', { name: 'Fold Platform' })).toHaveAttribute('aria-expanded', 'true');
    const platform = n.getByRole('list', { name: 'Folders of Platform' });
    await expect(platform.getByRole('button', { name: /^Use cases \d+$/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(n.getByRole('list', { name: 'Use cases of Platform' }).getByRole('button', { name: /^Capabilities \d+$/ })).toHaveAttribute('aria-expanded', 'true');
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

  test('LA-EXP-UC09-FL01-T read the technical specification and test plan by kind: the domain page, the nav\'s kind groups, the graph\'s groups', async ({ page }) => {
    await openPage(page, '/LA-EXP');
    const wiki = page.locator(WIKI);
    await expect(wiki.getByRole('heading', { level: 3, name: /^Repositories \d+/ })).toBeVisible();
    await expect(wiki.getByRole('heading', { level: 3, name: /^Constraint tests \d+/ })).toBeVisible();
    const folders = nav(page).getByRole('list', { name: 'Folders of Exploring' });
    await folders.getByRole('button', { name: /^Technical specification \d+/ }).click();
    await expect(nav(page).getByRole('list', { name: 'Technical specification of Exploring' }).getByRole('button', { name: /^Repositories \d+$/ })).toBeVisible();
    await folders.getByRole('button', { name: /^Test plan \d+/ }).click();
    await expect(nav(page).getByRole('list', { name: 'Test plan of Exploring' }).getByRole('button', { name: /^Constraint tests \d+$/ })).toBeVisible();
    // The graph reaches the same records through the same groups; the trail names each visit.
    await page.goto('/LA-EXP?view=graph');
    await graphReady(page);
    await page.locator(`${FLOW} .graph-box[data-id="LA-EXP/technical-specification"]`).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL((u) => u.pathname === '/LA-EXP/technical-specification');
    await graphReady(page);
    expect((await sceneOf(page)).boxes.some((b) => b.id === 'LA-EXP/technical-specification/repository')).toBe(true);
    await expect(page.locator(`${GRAPH_PANE} .graph-trail li`)).toHaveCount(2);
  });

  test('LA-EXP-UC10-FL01-T keep several records open in tabs: the preview, keep, Ctrl+Tab, each tab\'s views, close, reload', async ({ page }) => {
    const tabs = page.getByRole('tablist', { name: 'Open pages' });
    await openPage(page, '/LA-EXP-A1');
    await expect(tabs.getByRole('tab')).toHaveCount(1);
    await expect(page.locator('.tab.is-preview')).toHaveCount(1);
    // Keep it with a double-click; the next open takes a new preview.
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    await expect(page.locator('.tab.is-preview')).toHaveCount(0);
    await quickFind(page, 'LA-EXP-A2');
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    // A change to its views keeps a tab too; each keeps its own.
    await page.keyboard.press('Control+2');
    await graphReady(page);
    await expect(page.locator('.tab.is-preview')).toHaveCount(0);
    await page.keyboard.press('Control+Tab');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A1');
    await expect(page.locator('.pane-graph')).toHaveCount(0);
    await page.keyboard.press('Control+Tab');
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A2');
    await expect(page.locator('.pane-graph')).toHaveCount(1);
    // A reload brings the tabs back as they were.
    await page.reload();
    await page.locator('.focus-views .pane-title').first().waitFor();
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    // Close one by Alt+Shift+W, then the other's button.
    await quickFind(page, 'LA-EXP-A3');
    await expect(tabs.getByRole('tab')).toHaveCount(3);
    await page.keyboard.press('Alt+Shift+w');
    await expect(tabs.getByRole('tab')).toHaveCount(2);
    await page.locator('.tab', { has: page.locator('.tab-id', { hasText: /^LA-EXP-A1$/ }) }).locator('.tab-close').click({ force: true });
    await expect(tabs.getByRole('tab')).toHaveCount(1);
    await page.locator('.tab [role="tab"]').first().click({ button: 'middle' });
    // The last tab stays: there is always a tab.
    await expect(tabs.getByRole('tab')).toHaveCount(1);
  });

  test('LA-EXP-UC11-FL01-T read a domain and its aggregates as an ERD: the ERD view, an aggregate picked, an entity, the key', async ({ page }) => {
    await openPage(page, '/LA-EXP');
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Model' }).click();
    const model = page.getByRole('region', { name: 'Model', exact: true });
    await expect(model.getByRole('group', { name: /^Aggregate / }).first()).toBeVisible();
    expect(await model.getByRole('group', { name: /^Aggregate / }).count()).toBeGreaterThanOrEqual(2);
    await expect(model.getByRole('img', { name: /^Edge from / }).first()).toBeAttached();
    // An aggregate's box, by its head: its entities and fields.
    await model.getByRole('group', { name: 'Aggregate Tab group' }).locator('.erd-box-head').first().click();
    await page.waitForURL((u) => u.pathname === '/LA-EXP-A5');
    await expect(model.getByRole('list', { name: /^Fields of / }).first()).toBeVisible();
    // On an entity, the same ERD picks it out.
    await page.locator('.pane-erd .erd-flow .react-flow__node:not(:has(.is-focus))').filter({ has: page.getByRole('list', { name: /^Fields of / }) }).first().click();
    await page.waitForURL((u) => /^\/LA-EXP-EN\d+$/.test(u.pathname));
    await expect(page.locator('.pane-erd .react-flow__node .is-focus').first()).toBeVisible();
    // The key under the diagram.
    await expect(page.getByRole('region', { name: 'Model', exact: true }).getByRole('group', { name: 'Key' })).toBeVisible();
  });

  test('LA-EXP-UC12-FL01-T use the side bar: Details following the pointer, Outline, History with its uncommitted change, a commit\'s diff and Load more', async ({ page }) => {
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
      await openPage(page, '/LA-EXP?view=wiki,graph');
      await graphReady(page);
      const side = page.getByRole('complementary', { name: 'Side bar' });
      // In the Graph view Details is open and follows the pointer.
      await expect(sideBarViews(page).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'true');
      await page.locator(`${FLOW} .graph-box[data-id="LA-EXP/domain-model"]`).focus();
      await expect(side.getByRole('region', { name: 'Details' })).toContainText('Domain model');
      // In the Wiki view alone: Outline, and a jump to a section.
      await page.keyboard.press('Control+2');
      await expect(page.locator(GRAPH_PANE)).toHaveCount(0);
      await sideBarViews(page).getByRole('button', { name: 'Outline' }).click();
      const sections = side.getByRole('list', { name: 'Sections' });
      await expect(sections.getByRole('button').first()).toBeVisible();
      await sections.getByRole('button').first().click();
      // History: the uncommitted change first, then the commits; an older one's diff; Load more.
      await sideBarViews(page).getByRole('button', { name: 'History' }).click();
      const history = side.getByRole('region', { name: 'History' });
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

  test('LA-EXP-UC13-FL01-T read a domain\'s endpoints and integrations: the domain\'s Interaction design, a command\'s endpoint, an integration\'s steps', async ({ page }) => {
    await openPage(page, '/LA-AUT');
    const wiki = page.locator(WIKI);
    await expect(wiki.getByRole('list', { name: 'Endpoints' })).toContainText('POST · /api/write');
    await expect(wiki.getByRole('list', { name: 'Integrations' }).getByRole('listitem').first()).toBeVisible();
    // The command and its endpoint, method and route; the endpoint's API requirements.
    await page.goto('/LA-AUT-CMD07');
    await expect(wiki.getByRole('link', { name: 'LA-AUT-EP02 Write to the data' })).toBeVisible();
    await expect(wiki).toContainText('POST · /api/write');
    await wiki.getByRole('link', { name: 'LA-AUT-EP02 Write to the data' }).click();
    await page.waitForURL((u) => u.pathname === '/LA-AUT-EP02');
    await expect(wiki.getByRole('link', { name: /^LA-AUT-EP02-R\d+/ }).first()).toBeVisible();
    // An integration lists the steps that exchange with its system.
    await page.goto('/LA-INT04');
    await expect(wiki.getByRole('list', { name: 'Exchanged with by' }).getByRole('link').first()).toBeVisible();
  });
});
