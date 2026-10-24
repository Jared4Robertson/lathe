import { fireResize } from './setup';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import GraphPage, { GraphView } from '../../src/graph/GraphPage';
import { GraphMenu, parseGraphPath } from '../../src/graph/route';
import { usePath } from '../../src/router';
import { SpecView } from '../../src/specs/SpecPages';
import { indexWorkspace, type SpecIndex, type SpecState } from '../../src/specs/data';
import { testIndex, testWorkspace } from './workspace';

const state = (index: SpecIndex): SpecState => ({ index, source: 'engine', sourceReason: null, error: null });

// The graph page as App mounts it: the focus comes from the address, and the page (lazy in App)
// mounts after App has started listening for address changes.
function Harness({ index }: { index: SpecIndex }) {
  const path = usePath();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const focus = parseGraphPath(path);
  if (!ready) return null;
  return focus === undefined ? <p>left the graph</p> : <GraphPage spec={state(index)} focus={focus} />;
}

const open = (path: string) => window.history.replaceState(null, '', path);
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const panel = () => within(screen.getByRole('complementary', { name: 'Focused record' }));

async function showGraph(path: string, index = testIndex()) {
  open(path);
  render(<Harness index={index} />);
  await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
}

beforeEach(() => { window.sessionStorage.clear(); });
afterEach(() => { cleanup(); });

describe('graph page', () => {
  it('LA-BRW-T57 Clicking a node re-centres the graph and changes the address, Back walks back, and the trail shows the path', async () => {
    await showGraph('/graph/P-D-UC01-R01');
    expect(panel().getByRole('heading', { level: 1 }).textContent).toBe('The owner is shown');
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());

    fireEvent.click(node('P-D-V01')!);
    expect(window.location.pathname).toBe('/graph/P-D-V01');
    await waitFor(() => expect(panel().getByRole('heading', { level: 1 }).textContent).toBe('Thing page'));
    // The view's own neighbour, the endpoint, is now drawn.
    await waitFor(() => expect(node('P-D-E01')).not.toBeNull());
    const trail = within(screen.getByRole('navigation', { name: 'Records visited' }));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['P-D-UC01-R01', 'P-D-V01']);

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(window.location.pathname).toBe('/graph/P-D-UC01-R01');
    await waitFor(() => expect(panel().getByRole('heading', { level: 1 }).textContent).toBe('The owner is shown'));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['P-D-UC01-R01']);

    // /graph on its own opens the first product.
    cleanup();
    await showGraph('/graph');
    expect(window.location.pathname).toBe('/graph/P');
  });

  it('LA-BRW-T58 The side panel shows the kind, title, opening text, problems, coverage gaps and a link to the record page', async () => {
    await showGraph('/graph/P-D-DR02');
    const side = panel();
    expect(side.getByText('Domain rule')).toBeTruthy();
    expect(side.getByRole('heading', { level: 1 }).textContent).toBe('A thing is never deleted');
    expect(side.getByText('A thing MUST NOT be deleted, only archived.')).toBeTruthy();
    expect(side.getByText('No component satisfies P-D-DR02')).toBeTruthy();
    expect(side.getByText('No component satisfies it.')).toBeTruthy();
    expect(side.getByText('No test proves it.')).toBeTruthy();
    expect(side.getByRole('link', { name: 'Open page' }).getAttribute('href')).toBe('/records/P-D-DR02');
  });

  it('LA-BRW-T59 Nodes show their stage and kind, records with errors or gaps are marked, edges carry their relation, and there is a legend', async () => {
    await showGraph('/graph/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-T01')).not.toBeNull());
    expect(node('P-D-UC01-R01')!.querySelector('.graph-node')!.className).toContain('stage-define');
    expect(node('P-D-UC01-R01')!.querySelector('.graph-node')!.className).toContain('is-focus');
    expect(node('P-D-T01')!.querySelector('.graph-node')!.className).toContain('stage-design');
    expect(node('P-D-T01')!.querySelector('.graph-mark.error')).not.toBeNull();
    expect(node('P-D-V01')!.querySelector('.graph-mark')).toBeNull();
    expect(screen.getByRole('region', { name: 'Legend' })).toBeTruthy();

    // A depth-2 graph reaches P-D-DR01, which has a coverage gap, and the domain, a structural record.
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(node('P-D-DR01')).not.toBeNull());
    expect(node('P-D-DR01')!.querySelector('.graph-mark.gap')).not.toBeNull();
    expect(node('P-D')!.querySelector('.graph-node')!.className).toContain('stage-structural');
    const edges = [...document.querySelectorAll('.react-flow__edge-path')].map((p) => p.getAttribute('class'));
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.some((c) => c?.includes('rel-trace'))).toBe(true);
    expect(edges.some((c) => c?.includes('rel-structure'))).toBe(true);
  });

  it('LA-BRW-T60 Arrow keys move between nodes, Enter re-centres on the focused node, and Escape clears the filters', async () => {
    await showGraph('/graph/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    const centre = node('P-D-UC01-R01')!;
    centre.focus();
    expect(document.activeElement).toBe(centre);
    fireEvent.keyDown(centre, { key: 'ArrowRight' });
    const moved = document.activeElement as HTMLElement;
    expect(moved).not.toBe(centre);
    expect(moved.classList.contains('react-flow__node')).toBe(true);
    fireEvent.keyDown(moved, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(centre);
    fireEvent.keyDown(centre, { key: 'ArrowRight' });
    const target = (document.activeElement as HTMLElement).dataset.id!;
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(window.location.pathname).toBe(`/graph/${target}`);
    await waitFor(() => expect(document.activeElement).toBe(node(target)));

    // Hide tests, then Escape brings them back.
    const tests = screen.getByRole('checkbox', { name: 'Test' }) as HTMLInputElement;
    fireEvent.click(tests);
    expect(tests.checked).toBe(false);
    fireEvent.keyDown(tests, { key: 'Escape' });
    expect((screen.getByRole('checkbox', { name: 'Test' }) as HTMLInputElement).checked).toBe(true);
  });

  it('LA-BRW-T61 Record and domain pages link to the graph, and the menu has a Graph item', () => {
    const index = testIndex();
    open('/records/P-D-UC01-R01');
    render(<SpecView spec={state(index)} route={{ page: 'record', id: 'P-D-UC01-R01' }} />);
    expect(screen.getByRole('link', { name: 'Open in graph' }).getAttribute('href')).toBe('/graph/P-D-UC01-R01');
    cleanup();
    render(<SpecView spec={state(index)} route={{ page: 'domain', product: 'P', domain: 'P-D', tab: 'list' }} />);
    expect(screen.getByRole('link', { name: 'Open in graph' }).getAttribute('href')).toBe('/graph/P-D');
    cleanup();
    render(<GraphMenu path="/graph/P-D" />);
    const item = screen.getByRole('link', { name: 'Graph' });
    expect(item.getAttribute('href')).toBe('/graph');
    expect(item.getAttribute('aria-current')).toBe('page');
  });

  it('LA-BRW-T62 Trace mode is offered for a requirement and shows only its chain and files, and not offered for a use case', async () => {
    await showGraph('/graph/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trace mode' }));
    await waitFor(() => expect(node('file:src/thing.ts')).not.toBeNull());
    expect(node('file:test/thing.test.ts')).not.toBeNull();
    expect(node('P-D-UC01')).toBeNull();
    expect(panel().getByText('src/thing.ts')).toBeTruthy();
    // Escape leaves trace mode.
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Trace mode' }), { key: 'Escape' });
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());

    fireEvent.click(node('P-D-UC01')!);
    await waitFor(() => expect(panel().getByRole('heading', { level: 1 }).textContent).toBe('Lend a thing'));
    expect(screen.queryByRole('checkbox', { name: 'Trace mode' })).toBeNull();
  });

  it('LA-BRW-T66 The page draws tiers with a solid parent/child spine, and says when a cycle forces the radial fallback', async () => {
    await showGraph('/graph/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-T01')).not.toBeNull());
    expect(screen.queryByRole('status')).toBeNull();
    const left = (id: string) => Number(/translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec(node(id)!.style.transform)![1]);
    expect(left('P-D-UC01')).toBeLessThan(left('P-D-UC01-R01'));
    expect(left('P-D-UC01-R01')).toBeLessThan(left('P-D-C01'));
    expect(left('P-D-C01')).toBeLessThan(left('P-D-T01'));
    const spine = document.querySelector('.react-flow__edge-path.rel-structure');
    expect(spine).not.toBeNull();
    expect(spine!.getAttribute('class')).not.toContain('distant');
    cleanup();

    const w = testWorkspace();
    w.records.push({ ...w.records.find((r) => r.id === 'P-D-A1')!, id: 'P-D-A2', title: 'Owner', path: 'specs/P-D-A2.md' });
    w.links.push({ source: 'P-D-A1', relation: 'relates_to', target: 'P-D-A2' }, { source: 'P-D-A2', relation: 'relates_to', target: 'P-D-A1' });
    await showGraph('/graph/P-D-A1', indexWorkspace(w));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('P-D-A1 → P-D-A2 → P-D-A1'));
  });
});

describe('graph groups on the page', () => {
  const groupNode = (id: string) => node(id)?.querySelector<HTMLElement>('.graph-node') ?? null;

  it('LA-BRW-T110 Clicking a folded group opens it in place, clicking again closes it, and open groups are remembered while walking', async () => {
    await showGraph('/graph/P-D');
    await waitFor(() => expect(node('P-D/use_case')).not.toBeNull());
    expect(groupNode('P-D/use_case')!.className).toContain('stage-group');
    expect(groupNode('P-D/use_case')!.className).toContain('is-folded');
    expect(groupNode('P-D/use_case')!.textContent).toContain('Use cases (1)');
    expect(node('P-D-UC01')).toBeNull();

    fireEvent.click(node('P-D/use_case')!);
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    expect(window.location.pathname).toBe('/graph/P-D');
    expect(groupNode('P-D/use_case')!.className).toContain('is-open');

    // Walk to the use case and back: the group is still open.
    fireEvent.click(node('P-D-UC01')!);
    await waitFor(() => expect(window.location.pathname).toBe('/graph/P-D-UC01'));
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    await waitFor(() => expect(panel().getByRole('heading', { level: 1 }).textContent).toBe('Domain'));
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());

    fireEvent.click(node('P-D/use_case')!);
    await waitFor(() => expect(node('P-D-UC01')).toBeNull());
    expect(groupNode('P-D/use_case')!.className).toContain('is-folded');
  });

  it('LA-BRW-T111 Enter on a group opens or closes it and keeps keyboard focus on it', async () => {
    await showGraph('/graph/P-D');
    await waitFor(() => expect(node('P-D/component')).not.toBeNull());
    const group = node('P-D/component')!;
    group.focus();
    fireEvent.keyDown(group, { key: 'Enter' });
    await waitFor(() => expect(node('P-D-C01')).not.toBeNull());
    expect(window.location.pathname).toBe('/graph/P-D');
    await waitFor(() => expect(document.activeElement).toBe(node('P-D/component')));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    await waitFor(() => expect(node('P-D-C01')).toBeNull());
  });

  it('LA-BRW-T112 A group has its own address showing its parent to the left and its members to the right, and Back works', async () => {
    await showGraph('/graph/P-D');
    // The domain's side panel lists its groups, linking to their addresses.
    const link = panel().getByRole('link', { name: 'Use cases (1)' });
    expect(link.getAttribute('href')).toBe('/graph/P-D/use_case');
    fireEvent.click(link);
    expect(window.location.pathname).toBe('/graph/P-D/use_case');
    const side = within(await screen.findByRole('complementary', { name: 'Focused group' }));
    expect(side.getByRole('heading', { level: 1 }).textContent).toBe('Use cases (1)');
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    const left = (id: string) => Number(/translate\(([-\d.]+)px/.exec(node(id)!.style.transform)![1]);
    expect(left('P-D')).toBeLessThan(left('P-D/use_case'));
    expect(left('P-D/use_case')).toBeLessThan(left('P-D-UC01'));
    expect(groupNode('P-D/use_case')!.className).toContain('is-focus');
    const trail = within(screen.getByRole('navigation', { name: 'Records visited' }));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['P-D', 'P-D / Use cases']);

    fireEvent.click(side.getByRole('link', { name: /P-D-UC01/ }));
    expect(window.location.pathname).toBe('/graph/P-D-UC01');
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(window.location.pathname).toBe('/graph/P-D/use_case');
    await screen.findByRole('complementary', { name: 'Focused group' });

    // An address for a group that does not exist says so.
    cleanup();
    open('/graph/P-D/flow');
    render(<Harness index={testIndex()} />);
    await screen.findByText(/There's no record or group/);
  });

  it('LA-BRW-T113 Groups are drawn as folders and carry a mark when a member or anything beneath it has errors or gaps; the legend explains them', async () => {
    await showGraph('/graph/P-D');
    await waitFor(() => expect(node('P-D/test')).not.toBeNull());
    expect(groupNode('P-D/test')!.querySelector('.graph-mark.error')).not.toBeNull();
    expect(groupNode('P-D/aggregate')!.querySelector('.graph-mark.gap')).not.toBeNull();
    expect(groupNode('P-D/view')!.querySelector('.graph-mark')).toBeNull();
    expect(node('P-D/use_case')!.getAttribute('aria-label')).toBe('Group Use cases (1) in P-D, folded');
    const legend = within(screen.getByRole('region', { name: 'Legend' }));
    expect(legend.getByText(/Group of one kind of child/)).toBeTruthy();
  });

  it('LA-BRW-T114 The graph is a component that takes its focus and reports moves through onNavigate, without reading or changing the address', async () => {
    open('/somewhere-else');
    const moves: string[] = [];
    render(<GraphView index={testIndex()} focus="P-D-UC01-R01" onNavigate={(id) => moves.push(id)} hrefFor={(id) => `/records/${id}`} />);
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    fireEvent.click(node('P-D-V01')!);
    expect(moves).toEqual(['P-D-V01']);
    expect(window.location.pathname).toBe('/somewhere-else');
    const link = panel().getByRole('link', { name: /P-D-UC01 Lend a thing/ });
    expect(link.getAttribute('href')).toBe('/records/P-D-UC01');
    fireEvent.click(link);
    expect(moves).toEqual(['P-D-V01', 'P-D-UC01']);
    expect(window.location.pathname).toBe('/somewhere-else');

    // When its container changes size, it fits the picture to the new size.
    const flow = document.querySelector<HTMLElement>('.graph-flow')!;
    const viewport = () => document.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform;
    const sized = (width: number, height: number) => () => ({ x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect;
    flow.getBoundingClientRect = sized(1000, 800);
    act(() => fireResize(flow));
    await waitFor(() => expect(viewport()).toMatch(/translate\(/));
    const wide = viewport();
    flow.getBoundingClientRect = sized(300, 800);
    act(() => fireResize(flow));
    await waitFor(() => expect(viewport()).not.toBe(wide));
  });
});
