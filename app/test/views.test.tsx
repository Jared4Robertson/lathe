import './graph/setup';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseSpecRoute } from '../src/specs/data';
import { indexWorkspace } from '../src/specs/data';
import { addressOf, graphRedirect, viewFromSearch } from '../src/views/address';
import { main, openApp } from './helpers';
import { testWorkspace } from './graph/workspace';

// The focus page: one address per record or group, in Wiki, Graph and Split views, with the
// inspector as the page's third column.

const served = () => ({ workspace: testWorkspace() });
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
const viewButton = (name: string) => within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: new RegExp(name) });
const inspector = () => screen.getByRole('complementary', { name: 'Inspector' });
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
  it('LA-BRW-T120 A record is at /records/<id> and a group at /records/<parent-id>/<kind>; old graph and domain-graph addresses lead there', async () => {
    const index = indexWorkspace(testWorkspace());
    expect(parseSpecRoute('/records/P-D-UC01')).toEqual({ page: 'record', id: 'P-D-UC01' });
    expect(parseSpecRoute('/records/P-D/use_case')).toEqual({ page: 'group', parent: 'P-D', kind: 'use_case' });
    expect(addressOf(index, 'P-D-UC01')).toBe('/records/P-D-UC01');
    expect(addressOf(index, 'P-D/use_case')).toBe('/records/P-D/use_case');
    expect(addressOf(index, 'P-D')).toBe('/specs/P/P-D');
    expect(graphRedirect(index, '/graph/P-D-UC01')).toBe('/records/P-D-UC01?view=graph');
    expect(graphRedirect(index, '/graph')).toBe('/specs/P?view=graph');
    expect(viewFromSearch('?view=split')).toBe('split');
    expect(viewFromSearch('?view=nonsense')).toBeNull();

    await openApp('/graph/P-D-UC01', served());
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/records/P-D-UC01?view=graph'));
    await openApp('/specs/P/P-D/graph', served());
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe('/specs/P/P-D?view=graph'));
    await openApp('/records/P-D/use_case', served());
    expect(await screen.findByRole('heading', { level: 1, name: 'Use cases (1)' })).toBeInTheDocument();
  });

  it('LA-BRW-T121 The header toggles Wiki, Graph and Split; the choice is remembered and a link with ?view opens as it was seen', async () => {
    await openApp('/records/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(viewButton('Wiki')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Wiki pane' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Graph pane' })).toBeNull();

    fireEvent.click(viewButton('Graph'));
    expect(window.location.search).toBe('?view=graph');
    expect(viewButton('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('region', { name: 'Wiki pane' })).toBeNull();
    await graphShown();

    // Remembered: another record opens in the Graph view.
    await openApp('/records/P-D-V01', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(viewButton('Graph')).toHaveAttribute('aria-pressed', 'true');

    // A link's view wins, and becomes the remembered one.
    await openApp('/records/P-D-V01?view=split', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(viewButton('Split')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Wiki pane' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Graph pane' })).toBeInTheDocument();
    expect(window.localStorage.getItem('lathe:view')).toBe('"split"');
  });

  it('LA-BRW-T122 Split shows both panes with a divider to drag or move by keys, and either pane goes full screen until Escape', async () => {
    await openApp('/records/P-D-UC01?view=split', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const divider = screen.getByRole('separator', { name: 'Resize the panes' });
    expect(divider).toHaveAttribute('aria-valuenow', '50');
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '45');
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '80');
    const views = document.querySelector<HTMLElement>('.focus-views')!;
    expect(views.style.gridTemplateColumns).toContain('80fr');

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
    await openApp('/records/P-D-UC01?view=split', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(node('P-D-UC01')?.querySelector('.graph-node')?.className).toContain('is-focus'));
    fireEvent.click(screen.getByRole('button', { name: '2' }));

    // A link in the wiki moves the graph.
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    await userEvent.setup().click(wiki.getByRole('link', { name: /P-D-UC01-R01/ }));
    expect(window.location.pathname).toBe('/records/P-D-UC01-R01');
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    await waitFor(() => expect(node('P-D-UC01-R01')?.querySelector('.graph-node')?.className).toContain('is-focus'));
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getByText('The page MUST show the owner.')).toBeInTheDocument();

    // A node in the graph moves the wiki.
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    fireEvent.click(node('P-D-V01')!);
    expect(window.location.pathname + window.location.search).toBe('/records/P-D-V01?view=split');
    await waitFor(() => expect(title()).toBe('Thing page'));
    await waitFor(() => expect(node('P-D-V01')!.querySelector('.graph-node')!.className).toContain('is-focus'));

    // Back moves both.
    await back();
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    await waitFor(() => expect(node('P-D-UC01-R01')!.querySelector('.graph-node')!.className).toContain('is-focus'));
    // The depth set earlier is kept, through page moves and a trip to the Wiki view.
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(viewButton('Wiki'));
    fireEvent.click(viewButton('Graph'));
    await graphShown();
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-BRW-T124 A group page shows its parent, its kind, and its members with their coverage marks', async () => {
    await openApp('/records/P-D-A1/domain_rule', served());
    await screen.findByRole('heading', { level: 1, name: 'Domain rules (2)' });
    const wiki = within(screen.getByRole('region', { name: 'Wiki pane' }));
    expect(wiki.getByRole('link', { name: /P-D-A1\s*Thing/ })).toHaveAttribute('href', '/records/P-D-A1');
    expect(wiki.getByText(/A fact that must always hold/)).toBeInTheDocument();
    const members = within(wiki.getByRole('list', { name: 'Members of P-D-A1/domain_rule' })).getAllByRole('listitem');
    expect(members.map((li) => li.querySelector('code')?.textContent)).toEqual(['P-D-DR01', 'P-D-DR02']);
    expect(within(members[0]).getByText('not proved')).toBeInTheDocument();
    expect(within(members[1]).getByText('not satisfied')).toBeInTheDocument();
    expect(within(members[1]).getByText('2 warnings')).toBeInTheDocument();
  });

  it('LA-BRW-T125 Product and domain pages have the same views, their graph centred on the product or domain', async () => {
    for (const [path, id, name] of [['/specs/P', 'P', 'Product'], ['/specs/P/P-D', 'P-D', 'Domain']]) {
      await openApp(`${path}?view=split`, served());
      await screen.findByRole('heading', { level: 1, name });
      expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getAllByRole('heading').length).toBeGreaterThan(0);
      await waitFor(() => expect(node(id)?.querySelector('.graph-node')?.className).toContain('is-focus'));
    }
  });

  it('LA-BRW-T126 Lists in the inspector, the graph part of the inspector and group pages stay at 10 rows and can be searched', async () => {
    const w = testWorkspace();
    const base = w.records.find((r) => r.id === 'P-D-UC01-R01')!;
    for (let i = 2; i <= 13; i++) {
      const id = `P-D-UC01-R${String(i).padStart(2, '0')}`;
      w.records.push({ ...base, id, title: `Rule ${i}`, path: `specs/${id}.md` });
    }
    await openApp('/records/P-D-UC01/requirement?view=split', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'Use-case requirements (13)' });
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).getByRole('searchbox', { name: 'Filter members of P-D-UC01/requirement' })).toBeInTheDocument();
    expect(within(inspector()).getByRole('searchbox', { name: 'Filter members' })).toBeInTheDocument();
    await waitFor(() => expect(within(inspector()).getByRole('searchbox', { name: 'Filter connected records' })).toBeInTheDocument());
    await openApp('/records/P-D-UC01', { workspace: w });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(within(inspector()).getByRole('searchbox', { name: 'Filter children' })).toBeInTheDocument();
  });

  it('LA-BRW-T135 Switching views by keyboard keeps focus, and the toggles show a focus ring', async () => {
    await openApp('/records/P-D-UC01?view=split', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // Focus inside the graph pane, then switch to Wiki with the keyboard: focus moves to the toggle, not lost.
    const fullGraph = screen.getByRole('button', { name: 'Full screen: Graph' });
    fullGraph.focus();
    fireEvent.keyDown(fullGraph, { key: '1', code: 'Digit1', ctrlKey: true });
    expect(screen.queryByRole('region', { name: 'Graph pane' })).toBeNull();
    await waitFor(() => expect(viewButton('Wiki')).toHaveFocus());
    // Each toggle names its shortcut.
    expect(viewButton('Graph')).toHaveAttribute('title', 'Graph view (Ctrl+2)');
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.view-toggle button[^{]*:focus-visible|:is\([^)]*\.view-toggle button[^)]*\):focus-visible/);
  });
});

describe('the inspector', () => {
  it('LA-BRW-T131 The inspector shows the focused record in every view, hides and shows from its edge, is remembered, and gives its space to the main view', async () => {
    await openApp('/records/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const facts = within(inspector());
    expect(facts.getByText('Lend a thing', { selector: '.inspector-name' })).toBeInTheDocument();
    expect(facts.getByRole('heading', { name: 'Links out' })).toBeInTheDocument();
    expect(document.querySelector('.focus-layout')!.className).toContain('with-inspector');

    // Hide it from its edge: the main view takes the space, and a button on the edge brings it back.
    fireEvent.click(facts.getByRole('button', { name: 'Hide the inspector' }));
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    expect(document.querySelector('.focus-layout')!.className).not.toContain('with-inspector');
    expect(window.localStorage.getItem('lathe:inspector-open')).toBe('false');
    await openApp('/records/P-D-V01?view=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Thing page' });
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the inspector' }));
    // In the Graph view the one inspector shows the same record, and what the graph connects.
    expect(within(inspector()).getByText('Thing page', { selector: '.inspector-name' })).toBeInTheDocument();
    await waitFor(() => expect(within(inspector()).getByRole('heading', { name: /Connected in the graph/ })).toBeInTheDocument());
    expect(screen.getAllByRole('complementary', { name: 'Inspector' })).toHaveLength(1);
  });

  it('LA-BRW-T132 On a narrow screen the inspector is a drawer: focus moves in, and Escape closes it and gives focus back', async () => {
    narrowScreen();
    await openApp('/records/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    const toggle = screen.getByRole('button', { name: /^Inspector$/ });
    fireEvent.click(toggle);
    const drawer = inspector();
    expect(drawer.className).toContain('is-drawer');
    await waitFor(() => expect(drawer).toHaveFocus());
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    await waitFor(() => expect(toggle).toHaveFocus());
    expect(main()).toBeInTheDocument();
  });
});
