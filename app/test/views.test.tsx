import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { addressOf, parseViews, viewsFromSearch, withView } from '../src/views/address';
import { main, openApp, openSideBar } from './helpers';
import { testWorkspace } from './graph/workspace';

// The focus page: one address per record or group, its Wiki, Graph and Model views panes you open
// and close side by side, with the side bar as the page's last column.

const served = () => ({ workspace: testWorkspace() });
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
/** A view toggle, in the rightmost pane's title bar. */
const viewToggle = (name: 'Wiki' | 'Graph' | 'Model') => within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name });
const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });
const graphShown = () => waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));

async function back() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  });
}

/** Pretends the screen is narrow (under 900 px) for the next render. */
export function narrowScreen() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
}

describe('one address, three views', () => {
  it('LA-BRW-T120 A record is at its bare ID and a group at /<parent-id>/<kind>, in every view', async () => {
    expect(parseSpecRoute('/P-D-UC01')).toEqual({ page: 'record', id: 'P-D-UC01' });
    expect(parseSpecRoute('/P-D/define/use-cases')).toEqual({ page: 'group', parent: 'P-D', kind: 'define/use-cases' });
    expect(addressOf('P-D-UC01')).toBe('/P-D-UC01');
    expect(addressOf('P-D/define/use-cases')).toBe('/P-D/define/use-cases');
    expect(addressOf('P-D')).toBe('/P-D');
    expect(viewsFromSearch('?view=split')).toBeNull();
    expect(viewsFromSearch('?view=model,wiki')).toEqual(['wiki', 'model']);
    expect(viewsFromSearch('?view=nonsense')).toBeNull();
    expect(parseViews('graph')).toEqual(['graph']);
    expect(withView('/X', ['model', 'wiki'])).toBe('/X?view=wiki,model');

    await openApp('/P-D-UC01?view=graph', served());
    expect(await screen.findByRole('region', { name: 'Graph pane' })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/P-D-UC01?view=graph');
    await openApp('/P-D/design/interaction-design/view', served());
    expect(await screen.findByRole('heading', { level: 1, name: 'Views (1)' })).toBeInTheDocument();
  });

  it('LA-BRW-T121 The view toggles open and close panes, at least one stays open, and the open set is remembered and named in the link', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(viewToggle('Wiki')).toHaveAttribute('aria-pressed', 'true');
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('region', { name: 'Wiki pane' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Graph pane' })).toBeNull();
    // No Split, no Open beside.
    expect(screen.queryByRole('button', { name: /beside|Split/ })).toBeNull();

    // The last open view stays open, and its tooltip says so.
    fireEvent.click(viewToggle('Wiki'));
    expect(screen.getByRole('region', { name: 'Wiki pane' })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });
    fireEvent.focus(viewToggle('Wiki'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Wiki view (stays open: it is the only one)');

    // Graph opens beside the wiki, in order.
    fireEvent.click(viewToggle('Graph'));
    expect(window.location.search).toBe('?view=wiki,graph');
    expect([...document.querySelectorAll('.pane')].map((p) => p.getAttribute('aria-label'))).toEqual(['Wiki pane', 'Graph pane']);
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'true');
    await graphShown();
    // Closing the wiki leaves the graph.
    fireEvent.click(screen.getByRole('button', { name: 'Close the wiki pane' }));
    expect(window.location.search).toBe('?view=graph');
    expect(screen.queryByRole('region', { name: 'Wiki pane' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close the graph pane' })).toBeNull();

    // Remembered: another record opens in the Graph view.
    await openApp('/P-D-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(viewToggle('Wiki')).toHaveAttribute('aria-pressed', 'false');

    // A link's views win, and become the remembered ones.
    await openApp('/P-D-V01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(screen.getByRole('button', { name: 'Close the wiki pane' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close the graph pane' })).toBeInTheDocument();
    expect(window.localStorage.getItem('lathe:view')).toBe('"wiki,graph"');
    // The View toggles appear once, in the page bar above the panes.
    expect(screen.getAllByRole('group', { name: 'View' })).toHaveLength(1);
    expect(within(document.querySelector<HTMLElement>('.page-bar')!).getByRole('group', { name: 'View' })).toBeInTheDocument();
  });

  it('LA-BRW-T122 Every gap between open panes is a handle moved by keys, remembered and reset evenly, and any pane goes full screen until Escape', async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const divider = screen.getByRole('separator', { name: 'Resize the wiki and graph panes' });
    expect(divider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '45');
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '80');
    const views = document.querySelector<HTMLElement>('.focus-views')!;
    // Each pane's weight as a fraction, with a least width per pane, or an even share when there is no room for it.
    expect(views.style.gridTemplateColumns).toBe('minmax(min(220px, calc((100% - 1 * var(--panel-gap)) / 2)), 160fr) var(--panel-gap) minmax(min(220px, calc((100% - 1 * var(--panel-gap)) / 2)), 40fr)');
    // The side bar gives way to the panes' least widths, down to its own (LA-PAT-APP-UX-R02).
    expect(document.querySelector<HTMLElement>('.focus-layout')!.style.getPropertyValue('--panes-min')).toBe('calc(2 * 220px + 1 * var(--panel-gap))');
    expect(window.localStorage.getItem('lathe:pane-size:wiki')).toBe('160');
    // Double-click shares the two panes' space evenly.
    fireEvent.doubleClick(divider);
    expect(divider).toHaveAttribute('aria-valuenow', '50');

    const full = screen.getByRole('button', { name: 'Full screen: Graph' });
    fireEvent.click(full);
    const pane = screen.getByRole('region', { name: 'Graph pane' });
    expect(pane.className).toContain('is-fullscreen');
    const leave = screen.getByRole('button', { name: 'Leave full screen (Graph)' });
    await waitFor(() => expect(leave).toHaveFocus());
    fireEvent.keyDown(leave, { key: 'Escape' });
    expect(screen.getByRole('region', { name: 'Graph pane' }).className).not.toContain('is-fullscreen');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Full screen: Graph' })).toHaveFocus());
  });

  it('LA-BRW-T123 Both panes show one focus: a node click moves the wiki, a wiki link moves the graph, Back moves both, and graph settings survive', async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(node('P-D-UC01')?.querySelector('.graph-node')?.className).toContain('is-focus'));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));

    // A link in the wiki moves the graph.
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    await userEvent.setup().click(wiki.getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    expect(window.location.pathname).toBe('/P-D-UC01-R01');
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    await waitFor(() => expect(node('P-D-UC01-R01')?.querySelector('.graph-node')?.className).toContain('is-focus'));
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getByText('The page MUST show the owner.')).toBeInTheDocument();

    // A node in the graph moves the wiki.
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    fireEvent.click(node('P-D-V01')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-V01?view=wiki,graph');
    await waitFor(() => expect(title()).toBe('Thing page'));
    await waitFor(() => expect(node('P-D-V01')!.querySelector('.graph-node')!.className).toContain('is-focus'));

    // Back moves both.
    await back();
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    await waitFor(() => expect(node('P-D-UC01-R01')!.querySelector('.graph-node')!.className).toContain('is-focus'));
    // The depth set earlier is kept, through page moves and a trip to the Wiki view.
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close the graph pane' }));
    fireEvent.click(viewToggle('Graph'));
    await graphShown();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-BRW-T124 A group page shows its parent, its kind, and its members with their coverage marks', async () => {
    // The aggregate holds an event too, so its rules are a group of their own in the tree.
    const w = testWorkspace();
    const a1 = w.records.find((r) => r.id === 'P-D-A1')!;
    w.records.push({ ...a1, id: 'P-D-EV01', kind: 'domain_event', title: 'Thing lent', parent: 'P-D-A1', fields: {}, path: 'specs/P-D-EV01.md' });
    await openApp('/P-D-A1/domain_rule', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'Domain rules (2)' });
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    expect(wiki.getByRole('link', { name: /P-D-A1\s*Thing/ })).toHaveAttribute('href', '/P-D-A1');
    expect(wiki.getByText(/A fact that must always hold/)).toBeInTheDocument();
    const members = within(wiki.getByRole('list', { name: 'Domain rules of P-D-A1/domain_rule' })).getAllByRole('listitem');
    expect(members.map((li) => li.querySelector('code')?.textContent)).toEqual(['P-D-DR01', 'P-D-DR02']);
    expect(within(members[0]).getByText('not proved')).toBeInTheDocument();
    expect(within(members[1]).getByText('not satisfied')).toBeInTheDocument();
    expect(within(members[1]).getByText('2 warnings')).toBeInTheDocument();
  });

  it('LA-BRW-T125 Product and domain pages have the same views, their graph centered on the product or domain', async () => {
    for (const [path, id, name] of [['/P', 'P', 'Product'], ['/P-D', 'P-D', 'Domain']]) {
      await openApp(`${path}?view=wiki,graph`, served());
      await screen.findByRole('heading', { level: 1, name });
      expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getAllByRole('heading').length).toBeGreaterThan(0);
      await waitFor(() => expect(node(id)?.querySelector('.graph-node')?.className).toContain('is-focus'));
    }
  });

  it('LA-BRW-T126 Lists in the side bar, the graph part of the side bar and group pages stay at 10 rows and can be searched', async () => {
    const w = testWorkspace();
    const base = w.records.find((r) => r.id === 'P-D-UC01-R01')!;
    for (let i = 2; i <= 13; i++) {
      const id = `P-D-UC01-R${String(i).padStart(2, '0')}`;
      w.records.push({ ...base, id, title: `Rule ${i}`, path: `specs/${id}.md` });
    }
    // A question too, so the requirements are a group of their own in the tree.
    w.records.push({ ...base, id: 'P-D-UC01-Q01', kind: 'question', title: 'Who may lend?', fields: { owner: 'Ana' }, path: 'specs/P-D-UC01-Q01.md' });
    await openApp('/P-D-UC01/requirement?view=wiki,graph', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'UC requirements (13)' });
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getByRole('searchbox', { name: 'Filter UC requirements of P-D-UC01/requirement' })).toBeInTheDocument();
    await waitFor(() => expect(within(sideBar()).getByRole('searchbox', { name: 'Filter connected records' })).toBeInTheDocument());
    // The side bar's Outline: the graph's records by level, each list searchable past 10 rows (brief 64).
    fireEvent.click(within(sideBar()).getByRole('button', { name: 'Outline' }));
    await waitFor(() => expect(within(sideBar()).getAllByRole('searchbox', { name: /^Filter level \d$/ }).length).toBeGreaterThan(0));
  });

  it('LA-BRW-T135 Switching views by keyboard keeps focus, and the toggles show a focus ring', async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // Focus inside the graph pane, then close the graph with the keyboard: focus moves to the Graph toggle, now on the wiki pane, not lost.
    const fullGraph = screen.getByRole('button', { name: 'Full screen: Graph' });
    fullGraph.focus();
    fireEvent.keyDown(fullGraph, { key: '2', code: 'Digit2', ctrlKey: true });
    expect(screen.queryByRole('region', { name: 'Graph pane' })).toBeNull();
    await waitFor(() => expect(viewToggle('Graph')).toHaveFocus());
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'false');
    // Each toggle names its shortcut (off a Mac, Alt+G first).
    fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' });
    fireEvent.focus(viewToggle('Graph'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Graph view Alt+G');
    expect(viewToggle('Graph')).toHaveAttribute('aria-keyshortcuts', 'Alt+G Control+2');
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/:is\([^)]*\.icon-button[^)]*\):focus-visible/);
    expect(css).toMatch(/\.icon-button\.is-on\s*\{/);
  });

  it('LA-BRW-T310 The page bar holds the tabs at its left and the view toggles, a divider and the side bar toggle at its right; each pane header names its view and holds its close and Full screen buttons; the pressed views and a shown side bar share one on look', async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const page = document.querySelector<HTMLElement>('.page-bar')!;
    expect(within(page.querySelector<HTMLElement>('.page-bar-start')!).getByRole('tab', { selected: true })).toHaveTextContent('P-D-UC01 Lend a thing');
    const order = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('button, .pane-divider')].map((b) => b.classList.contains('pane-divider') ? '|' : b.getAttribute('aria-label'));
    // A use case offers no Model view: its toggle keeps its slot, dimmed, and says where it works (UX-R08).
    expect(order(page.querySelector<HTMLElement>('.page-bar-actions')!)).toEqual(['Wiki', 'Graph', 'Model (on a domain, an aggregate or an entity)', '|', 'Hide the side bar']);
    expect(within(page).getByRole('button', { name: /^Model \(/ })).toHaveAttribute('aria-disabled', 'true');
    expect(viewToggle('Wiki')).toHaveClass('icon-button', 'is-on');
    expect(viewToggle('Graph')).not.toHaveClass('is-on');
    expect(within(page).getByRole('button', { name: 'Hide the side bar' })).toHaveClass('icon-button', 'is-on');
    // One pane: its header names its view and holds only Full screen.
    const wiki = () => screen.getByRole('region', { name: 'Wiki pane' });
    expect(wiki().querySelector('.pane-bar .pane-name')).toHaveTextContent(/^\s*Wiki$/);
    expect(order(wiki().querySelector<HTMLElement>('.pane-actions')!)).toEqual(['Full screen: Wiki']);

    // With two panes each header gains its close button; the page bar stays as it was.
    viewToggle('Graph')!.focus();
    fireEvent.click(viewToggle('Graph'));
    const graph = screen.getByRole('region', { name: 'Graph pane' });
    expect(graph.querySelector('.pane-name')).toHaveTextContent(/^\s*Graph$/);
    expect(order(wiki().querySelector<HTMLElement>('.pane-actions')!)).toEqual(['Close the wiki pane', 'Full screen: Wiki']);
    expect(order(graph.querySelector<HTMLElement>('.pane-actions')!)).toEqual(['Close the graph pane', 'Full screen: Graph']);
    expect(order(page.querySelector<HTMLElement>('.page-bar-actions')!)).toEqual(['Wiki', 'Graph', 'Model (on a domain, an aggregate or an entity)', '|', 'Hide the side bar']);
    expect(wiki().querySelector('[role="tablist"]')).toBeNull();
    // The toggle that was clicked keeps focus: it does not move.
    await waitFor(() => expect(viewToggle('Graph')).toHaveFocus());
    // The title sits at the top of the leftmost pane.
    expect(screen.getByRole('heading', { level: 1 }).closest('.pane')).toBe(wiki());
  });
});

describe('the side bar', () => {
  it('LA-BRW-T131 The side bar shows the focused record in every view, hides and shows from its edge, is remembered, and gives its space to the main view', async () => {
    // Open in the Graph view (brief 64), with the record's facts and what the graph connects.
    await openApp('/P-D-UC01?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const facts = within(sideBar());
    expect(facts.getByText('Lend a thing', { selector: '.side-bar-name' })).toBeInTheDocument();
    await waitFor(() => expect(facts.getByRole('heading', { name: /Connected in the graph/ })).toBeInTheDocument());
    expect(document.querySelector('.focus-layout')!.className).toContain('with-side-bar');

    // Hide it: the main view takes the space, and the toggle in the page's top-right corner brings it back.
    fireEvent.click(facts.getByRole('button', { name: 'Hide the side bar' }));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    expect(document.querySelector('.focus-layout')!.className).not.toContain('with-side-bar');
    expect(JSON.parse(window.localStorage.getItem('lathe:side-bar')!)).toMatchObject({ graph: { open: false } });
    // Remembered in the Graph view of another record, in a new session's first tab too.
    window.sessionStorage.clear();
    await openApp('/P-D-V01?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    expect(within(sideBar()).getByText('Thing page', { selector: '.side-bar-name' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Side bar' })).toHaveLength(1);

    // The Wiki view keeps its own choice: closed until opened there.
    await openApp('/P-D-V01?view=wiki', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
  });

  it('LA-BRW-T132 On a narrow screen the side bar is a bottom sheet: focus moves in, and Escape closes it and gives focus back', async () => {
    narrowScreen();
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show the side bar' });
    fireEvent.click(toggle);
    const drawer = sideBar();
    expect(drawer.className).toContain('is-drawer');
    await waitFor(() => expect(drawer).toHaveFocus());
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    await waitFor(() => expect(toggle).toHaveFocus());
    expect(main()).toBeInTheDocument();
  });
});
