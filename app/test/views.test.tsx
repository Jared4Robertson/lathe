import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { addressOf, parseViews, viewsFromSearch, withView } from '../src/views/address';
import { main, openApp, openSideBar } from './helpers';
import { addRows } from './fixtures/load';
import { testWorkspace } from './graph/workspace';
import { boxElement, boxElements, isCenter } from './graph/scene';

// The focus page: one address per record or group, its Wiki, Graph and ERD views panes you open
// and close side by side, with the side bar as the page's last column.

const served = () => ({ data: testWorkspace() });
const node = (id: string) => boxElement(id);
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
/** A view toggle, in the rightmost pane's title bar. */
const viewToggle = (name: 'Wiki' | 'Graph' | 'ERD' | 'Trace') => within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name });
const sideBar = () => screen.getByRole('complementary', { name: 'Side bar' });
const graphShown = () => waitFor(() => expect(boxElements().length).toBeGreaterThan(0));

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
  it('LA-VO90-C01-T A record is at its bare ID and a group at /<parent-id>/<kind>', () => {
    expect(parseSpecRoute('/P-D-UC01')).toEqual({ page: 'record', id: 'P-D-UC01' });
    expect(parseSpecRoute('/P-D/define/use-cases')).toEqual({ page: 'group', parent: 'P-D', kind: 'define/use-cases' });
    expect(addressOf('P-D-UC01')).toBe('/P-D-UC01');
    expect(addressOf('P-D/define/use-cases')).toBe('/P-D/define/use-cases');
    expect(addressOf('P-D')).toBe('/P-D');
  });

  it('LA-VO91-C01-T A view set holds Wiki, Graph, ERD and Trace, each once, in that order', () => {
    expect(viewsFromSearch('?view=split')).toBeNull();
    expect(viewsFromSearch('?view=trace,erd,wiki')).toEqual(['wiki', 'erd', 'trace']);
    expect(viewsFromSearch('?view=model')).toBeNull();
    expect(viewsFromSearch('?view=nonsense')).toBeNull();
    expect(parseViews('graph')).toEqual(['graph']);
  });

  it('LA-VO90-C02-T An address names views only in its view query, never in its path', async () => {
    expect(withView('/X', ['trace', 'erd', 'wiki'])).toBe('/X?view=wiki,erd,trace');
    await openApp('/P-D-UC01?view=graph', served());
    expect(await screen.findByRole('region', { name: 'Graph pane' })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/P-D-UC01?view=graph');
  });

  it('LA-V96-R03-T01 A record and a group each have one address, in every view', async () => {
    await openApp('/P-D-UC01?view=graph', served());
    expect(await screen.findByRole('region', { name: 'Graph pane' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/P-D-UC01');
    await openApp('/P-D/domain-model/term', served());
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms (1)' })).toBeInTheDocument();
  });

  it('LA-EXP-INV03-T The views a link names open and become the remembered ones; an address without views opens the last ones', async () => {
    await openApp('/P-D-UC01?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await openApp('/P-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(viewToggle('Wiki')).toHaveAttribute('aria-pressed', 'false');
    await openApp('/P-V01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(screen.getByRole('button', { name: 'Close the wiki pane' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close the graph pane' })).toBeInTheDocument();
    expect(window.localStorage.getItem('lathe:view')).toBe('"wiki,graph"');
  });

  it('LA-V96-R04-T01 The view toggles open and close panes, at least one stays open, and the open set is remembered and named in the link', async () => {
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
    await openApp('/P-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(viewToggle('Wiki')).toHaveAttribute('aria-pressed', 'false');

    // A link's views win, and become the remembered ones.
    await openApp('/P-V01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(screen.getByRole('button', { name: 'Close the wiki pane' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close the graph pane' })).toBeInTheDocument();
    expect(window.localStorage.getItem('lathe:view')).toBe('"wiki,graph"');
    // The View toggles appear once, in the page bar above the panes.
    expect(screen.getAllByRole('group', { name: 'View' })).toHaveLength(1);
    expect(within(document.querySelector<HTMLElement>('.page-bar')!).getByRole('group', { name: 'View' })).toBeInTheDocument();
  });

  /** Two panes, wiki and graph, with the gap between them. */
  const twoPanes = async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    return screen.getByRole('separator', { name: 'Resize the wiki and graph panes' });
  };

  it('LA-V61-R02-T01 Every gap between open panes is a handle moved by keys, within its limits', async () => {
    const divider = await twoPanes();
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
  });

  it('LA-V61-R03-T01 A pane size is remembered, and double-clicking the gap shares the space evenly', async () => {
    const divider = await twoPanes();
    fireEvent.keyDown(divider, { key: 'End' });
    expect(window.localStorage.getItem('lathe:pane-size:wiki')).toBe('160');
    fireEvent.doubleClick(divider);
    expect(divider).toHaveAttribute('aria-valuenow', '50');
  });

  it('LA-V96-R05-T01 Any pane goes full screen until Escape, with focus back on its button', async () => {
    await twoPanes();
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

  it('LA-EXP-INV02-T Both panes show one focus: a node click moves the wiki, a wiki link moves the graph, Back moves both, and graph settings survive', async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));

    // A link in the wiki moves the graph.
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    await userEvent.setup().click(wiki.getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    expect(window.location.pathname).toBe('/P-D-UC01-R01');
    await waitFor(() => expect(title()).toBe('The loan is recorded'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getByText('The loan MUST be recorded.')).toBeInTheDocument();

    // A node in the graph moves the wiki: the flow step that fulfills it, reached by the Links switch.
    await waitFor(() => expect(node('P-D-UC01-FL01-S01')).not.toBeNull());
    fireEvent.click(node('P-D-UC01-FL01-S01')!);
    expect(window.location.pathname + window.location.search).toBe('/P-D-UC01-FL01-S01?view=wiki,graph');
    await waitFor(() => expect(title()).toBe('Librarian lends the thing'));
    await waitFor(() => expect(isCenter('P-D-UC01-FL01-S01')).toBe(true));
  });

  it('LA-V96-R06-T01 Both panes follow one focus, Back moves both, and graph settings survive', async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    await userEvent.setup().click(wiki.getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(node('P-D-UC01-FL01-S01')).not.toBeNull());
    fireEvent.click(node('P-D-UC01-FL01-S01')!);
    await waitFor(() => expect(title()).toBe('Librarian lends the thing'));

    // Back moves both.
    await back();
    await waitFor(() => expect(title()).toBe('The loan is recorded'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    // The depth set earlier is kept, through page moves and a trip to the Wiki view.
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Close the graph pane' }));
    fireEvent.click(viewToggle('Graph'));
    await graphShown();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-V96-R07-T01 A group page shows its parent, its kind, and its members with their coverage marks', async () => {
    // The aggregate holds entities, events and commands too, so its invariants are a group of their own in the tree.
    await openApp('/P-D-A3/invariant', served());
    await screen.findByRole('heading', { level: 1, name: 'Invariants (2)' });
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    expect(wiki.getByRole('link', { name: /P-D-A3\s*Loan/ })).toHaveAttribute('href', '/P-D-A3');
    expect(wiki.getByText(/A rule that holds for one aggregate on every change/)).toBeInTheDocument();
    const members = within(wiki.getByRole('list', { name: 'Invariants of P-D-A3/invariant' })).getAllByRole('listitem');
    expect(members.map((li) => li.querySelector('code')?.textContent)).toEqual(['P-D-INV01', 'P-D-INV02']);
    expect(within(members[0]).queryByText('not proved')).toBeNull();
    expect(within(members[1]).getByText('not proved')).toBeInTheDocument();
    expect(within(members[1]).getByText('1 warning')).toBeInTheDocument();
  });

  it('LA-V96-R08-T01 Product and domain pages have the same views, their graph centered on the product or domain', async () => {
    for (const [path, id, name] of [['/P', 'P', 'Product'], ['/P-D', 'P-D', 'Domain']]) {
      await openApp(`${path}?view=wiki,graph`, served());
      await screen.findByRole('heading', { level: 1, name });
      expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getAllByRole('heading').length).toBeGreaterThan(0);
      await waitFor(() => expect(isCenter(id)).toBe(true));
    }
  });

  it('LA-V92-R20-T01 Lists in the side bar, the graph part of the side bar and group pages stay at 10 rows and can be searched', async () => {
    const w = testWorkspace();
    for (let i = 3; i <= 13; i++) {
      const id = `P-D-INV${String(i).padStart(2, '0')}`;
      addRows(w, 'invariant', { id, title: `Rule ${i}`, aggregate_id: 'P-D-A3', statement: `Rule ${i} MUST hold.` });
    }
    // The aggregate holds entities, events and commands too, so its invariants are a group of their own in the tree.
    await openApp('/P-D-A3/invariant?view=wiki,graph', { data: w });
    await screen.findByRole('heading', { level: 1, name: 'Invariants (13)' });
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getByRole('searchbox', { name: 'Filter invariants of P-D-A3/invariant' })).toBeInTheDocument();
    await waitFor(() => expect(within(sideBar()).getByRole('searchbox', { name: 'Filter connected records' })).toBeInTheDocument());
    // The side bar's Outline: the graph's records by level, each list searchable past 10 rows.
    fireEvent.click(within(sideBar()).getByRole('button', { name: 'Outline' }));
    await waitFor(() => expect(within(sideBar()).getAllByRole('searchbox', { name: /^Filter level \d$/ }).length).toBeGreaterThan(0));
  });

  it('LA-V96-R04-T02 Switching views by keyboard keeps focus, and the toggles show a focus ring', async () => {
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

  it('LA-V96-R04-T01 The page bar holds the tabs at its left and the view toggles, a divider and the side bar toggle at its right; each pane header names its view and holds its close and Full screen buttons; the pressed views and a shown side bar share one on look', async () => {
    // The side bar starts closed in the Wiki view; this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'erd', 'trace']);
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const page = document.querySelector<HTMLElement>('.page-bar')!;
    expect(within(page.querySelector<HTMLElement>('.page-bar-start')!).getByRole('tab', { selected: true })).toHaveTextContent('P-D-UC01 Lend a thing');
    const order = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('button, .pane-divider')].map((b) => b.classList.contains('pane-divider') ? '|' : b.getAttribute('aria-label'));
    // A use case offers no ERD view: its toggle keeps its slot, dimmed, and says where it works (UX-R08).
    expect(order(page.querySelector<HTMLElement>('.page-bar-actions')!)).toEqual(['Wiki', 'Graph', 'ERD (on a domain, an aggregate or an entity)', 'Trace', '|', 'Hide the side bar']);
    expect(within(page).getByRole('button', { name: /^ERD \(/ })).toHaveAttribute('aria-disabled', 'true');
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
    expect(order(page.querySelector<HTMLElement>('.page-bar-actions')!)).toEqual(['Wiki', 'Graph', 'ERD (on a domain, an aggregate or an entity)', 'Trace', '|', 'Hide the side bar']);
    expect(wiki().querySelector('[role="tablist"]')).toBeNull();
    // The toggle that was clicked keeps focus: it does not move.
    await waitFor(() => expect(viewToggle('Graph')).toHaveFocus());
    // The title sits at the top of the leftmost pane.
    expect(screen.getByRole('heading', { level: 1 }).closest('.pane')).toBe(wiki());
  });
});

describe('the side bar', () => {
  /** A use case in the Graph view, where the side bar starts open. */
  const inGraph = async () => {
    await openApp('/P-D-UC01?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    return within(sideBar());
  };

  it('LA-V61-R05-T01 The side bar shows the focused record, its facts and what the graph connects', async () => {
    const facts = await inGraph();
    expect(facts.getByText('Lend a thing', { selector: '.side-bar-name' })).toBeInTheDocument();
    await waitFor(() => expect(facts.getByRole('heading', { name: /Connected in the graph/ })).toBeInTheDocument());
  });

  it('LA-V95-R03-T01 The side bar folds away with its toggle, giving its space to the main view, and comes back', async () => {
    const facts = await inGraph();
    expect(document.querySelector('.focus-layout')!.className).toContain('with-side-bar');
    fireEvent.click(facts.getByRole('button', { name: 'Hide the side bar' }));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    expect(document.querySelector('.focus-layout')!.className).not.toContain('with-side-bar');
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    expect(screen.getAllByRole('complementary', { name: 'Side bar' })).toHaveLength(1);
  });

  it('LA-V95-R05-T01 The side bar keeps its open state per view mode, in a new session too', async () => {
    const facts = await inGraph();
    fireEvent.click(facts.getByRole('button', { name: 'Hide the side bar' }));
    expect(JSON.parse(window.localStorage.getItem('lathe:side-bar')!)).toMatchObject({ graph: { open: false } });
    // Remembered in the Graph view of another record, in a new session's first tab too.
    window.sessionStorage.clear();
    await openApp('/P-V01?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the side bar' }));
    expect(within(sideBar()).getByText('Loan desk', { selector: '.side-bar-name' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Side bar' })).toHaveLength(1);

    // The Wiki view keeps its own choice: closed until opened there.
    await openApp('/P-V01?view=wiki', served());
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
  });

  it('LA-V95-R03-T02 On a narrow screen the side bar is a bottom sheet: focus moves in, and Escape closes it and gives focus back', async () => {
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
