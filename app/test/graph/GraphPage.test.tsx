import { fireResize } from './setup';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Workspace } from '../../../lathe/src/types';
import { DEFAULT_GRAPH_SETTINGS, GraphView } from '../../src/graph/GraphPage';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';

// The graph as the focus page hosts it: in the Graph view of a record's, group's, product's or
// domain's own address, with the side bar beside it.

const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const sideBar = () => within(screen.getByRole('complementary', { name: 'Side bar' }));
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
/** The address of a record in the test workspace (the product and domain have overview pages). */
const addressOf = (id: string) => (id === 'P' ? '/P' : id === 'P-D' ? '/P-D' : `/${id}`);

async function back() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  });
}

/** Opens a graph page at a depth (1 unless asked). Most tests here are about links, so they turn Links on unless asked not to. */
async function showGraph(path: string, workspace: Workspace = testWorkspace(), depth = 1, links = true) {
  startAtDepth(depth);
  await openApp(path.includes('?') ? path : `${path}?view=graph`, { workspace });
  await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
  if (links) fireEvent.click(screen.getByRole('button', { name: 'Links' }));
}

describe('graph page', () => {
  it('LA-EXP-T18 Clicking a node re-centers the graph and changes the address, Back walks back, and the trail shows the path', async () => {
    await showGraph('/P-D-UC01-R01');
    expect(title()).toBe('The owner is shown');
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());

    fireEvent.click(node('P-D-V01')!);
    expect(window.location.pathname).toBe('/P-D-V01');
    expect(window.location.search).toBe('?view=graph');
    await waitFor(() => expect(title()).toBe('Thing page'));
    // The view's own neighbor, the endpoint, is now drawn.
    await waitFor(() => expect(node('P-D-E01')).not.toBeNull());
    const trail = within(screen.getByRole('navigation', { name: 'Records visited' }));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['The owner is shown (P-D-UC01-R01)', 'Thing page (P-D-V01)']);

    await back();
    expect(window.location.pathname).toBe('/P-D-UC01-R01');
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['The owner is shown (P-D-UC01-R01)']);

  });

  it('LA-PLT-T101 The trail is a Tab stop only while it overflows', async () => {
    await showGraph('/P-D-UC01-R01');
    const list = () => screen.getByRole('navigation', { name: 'Records visited' }).querySelector('ol')!;
    // It fits: its links are the stops, and the list itself is not one.
    expect(list()).not.toHaveAttribute('tabindex');
    // It overflows: the list takes focus, so the keyboard can scroll it.
    const widths = { scrollWidth: 900, clientWidth: 300 };
    for (const [key, value] of Object.entries(widths)) Object.defineProperty(list(), key, { configurable: true, value });
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    fireEvent.click(node('P-D-V01')!);
    await waitFor(() => expect(list()).toHaveAttribute('tabindex', '0'));
  });

  it('LA-EXP-T19 The side bar shows the kind, title, problems, coverage gaps and a link to the record page', async () => {
    await showGraph('/P-D-DR02');
    const side = sideBar();
    expect(side.getAllByText('Domain rule').length).toBeGreaterThan(0);
    expect(side.getByText('A thing is never deleted', { selector: '.side-bar-name' })).toBeTruthy();
    expect(side.getByText('No component satisfies P-D-DR02')).toBeTruthy();
    // The gaps in the words of the wiki's Traceability callouts, in the side bar's compact Traceability (brief 64).
    const gaps = side.getByRole('region', { name: /^Traceability/ });
    expect([...gaps.querySelectorAll('li[data-gap]')].map((li) => li.textContent)).toEqual(['Not designed yet', 'Not proved yet']);
    expect(side.getByRole('link', { name: 'P-D-DR02' }).getAttribute('href')).toBe('/P-D-DR02');
  });

  it('LA-EXP-T93 The graph opens at depth 1 with the parent and children only; depth 2 and 3 climb more levels, and Links brings in the links', async () => {
    await showGraph('/P-D-UC01-R01', testWorkspace(), 1, false);
    const depth = within(screen.getByRole('group', { name: 'Depth' }));
    expect(depth.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect(depth.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    expect(node('P-D-V01')).toBeNull();
    expect(node('P-D-T01')).toBeNull();
    expect(document.querySelector('.react-flow__edge-path.graph-edge:not(.rel-structure)')).toBeNull();
    // Depth 2 brings the Capabilities folder into focus, and Define faded beyond it; still no links.
    fireEvent.click(depth.getByRole('button', { name: '2' }));
    await waitFor(() => expect(node('P-D/define')).not.toBeNull());
    expect(node('P-D/define')!.className).toContain('is-context');
    expect(node('P-D/define/use-cases')!.className).not.toContain('is-context');
    expect(node('P-D-V01')).toBeNull();
    // Links brings in what the requirement links to, one step, dashed in their own color.
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    expect(node('P-D-T01')).not.toBeNull();
    expect(document.querySelector('.react-flow__edge-path.is-link')).not.toBeNull();
  });

  it('LA-EXP-T20 Nodes show their stage and kind, records with errors or gaps are marked, edges carry their relation, and there is a legend', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-T01')).not.toBeNull());
    expect(node('P-D-UC01-R01')!.querySelector('.graph-node')!.className).toContain('stage-define');
    expect(node('P-D-UC01-R01')!.querySelector('.graph-node')!.className).toContain('is-focus');
    expect(node('P-D-T01')!.querySelector('.graph-node')!.className).toContain('stage-design');
    expect(node('P-D-T01')!.querySelector('.graph-mark.error')).not.toBeNull();
    expect(node('P-D-V01')!.querySelector('.graph-mark')).toBeNull();
    expect(screen.getByRole('region', { name: 'Legend' })).toBeTruthy();

    const edges = [...document.querySelectorAll('.react-flow__edge-path')].map((p) => p.getAttribute('class'));
    expect(edges.some((c) => c?.includes('rel-trace'))).toBe(true);
    expect(edges.some((c) => c?.includes('rel-structure'))).toBe(true);

    // From the aggregate at depth 3: its rule P-D-DR01 has a coverage gap, and the domain is a structural record.
    await showGraph('/P-D-A1', testWorkspace(), 1, false);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    await waitFor(() => expect(node('P-D')).not.toBeNull());
    expect(node('P-D-DR01')!.querySelector('.graph-mark.gap')).not.toBeNull();
    expect(node('P-D')!.querySelector('.graph-node')!.className).toContain('stage-structural');
  });

  it('LA-EXP-T21 Arrow keys move between nodes, Enter re-centers on the focused node, and Escape clears the filters', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    const center = node('P-D-UC01-R01')!;
    center.focus();
    expect(document.activeElement).toBe(center);
    fireEvent.keyDown(center, { key: 'ArrowRight' });
    const moved = document.activeElement as HTMLElement;
    expect(moved).not.toBe(center);
    expect(moved.classList.contains('react-flow__node')).toBe(true);
    fireEvent.keyDown(moved, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(center);
    fireEvent.keyDown(center, { key: 'ArrowRight' });
    const target = (document.activeElement as HTMLElement).dataset.id!;
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(window.location.pathname).toBe(addressOf(target));
    await waitFor(() => expect(document.activeElement).toBe(node(target)));

    // Hide tests, then Escape brings them back.
    const tests = screen.getByRole('checkbox', { name: 'Test' }) as HTMLInputElement;
    fireEvent.click(tests);
    expect(tests.checked).toBe(false);
    fireEvent.keyDown(tests, { key: 'Escape' });
    expect((screen.getByRole('checkbox', { name: 'Test' }) as HTMLInputElement).checked).toBe(true);
  });

  it('LA-EXP-T22 Record, domain and product pages show the graph in their Graph view, and the nav has no Graph item', async () => {
    for (const path of ['/P-D-UC01-R01', '/P-D', '/P']) {
      // Each page starts with the wiki alone (no view remembered, no tab to take one from); the Graph toggle opens the graph beside it.
      window.localStorage.removeItem('lathe:view');
      window.sessionStorage.removeItem('lathe:tabs');
      await openApp(path, { workspace: testWorkspace() });
      await screen.findByRole('heading', { level: 1 });
      const graph = within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Graph' });
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Graph' })).toBeNull();
      fireEvent.click(graph);
      expect(window.location.pathname + window.location.search).toBe(`${path}?view=wiki,graph`);
      await waitFor(() => expect(document.querySelector('.react-flow__node.is-focus, .graph-node.is-focus')).not.toBeNull());
    }
  });

  it('LA-TRC-T88 Trace mode is offered for a requirement and shows only its chain and files, and not offered for a use case', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trace mode' }));
    await waitFor(() => expect(node('file:src/thing.ts')).not.toBeNull());
    expect(node('file:test/thing.test.ts')).not.toBeNull();
    // The use case leaves the picture: it fades out where it was, and is then dropped.
    await waitFor(() => expect(node('P-D-UC01')).toBeNull());
    expect(sideBar().getByText('src/thing.ts')).toBeTruthy();
    // Escape leaves trace mode.
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Trace mode' }), { key: 'Escape' });
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());

    fireEvent.click(node('P-D-UC01')!);
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(screen.queryByRole('checkbox', { name: 'Trace mode' })).toBeNull();
  });

  it('LA-EXP-T26 The page draws columns with a solid parent/child spine, and draws even a ring of links in columns, without a notice', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-T01')).not.toBeNull());
    const left = (id: string) => Number(/translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec(node(id)!.style.transform)![1]);
    expect(left('P-D-UC01')).toBeLessThan(left('P-D-UC01-R01'));
    expect(left('P-D-UC01-R01')).toBeLessThan(left('P-D-C01'));
    // What satisfies and proves the requirement sits in one column after it.
    expect(left('P-D-C01')).toBe(left('P-D-T01'));
    const spine = document.querySelector('.react-flow__edge-path.rel-structure');
    expect(spine).not.toBeNull();
    expect(spine!.getAttribute('class')).not.toContain('distant');

    const w = testWorkspace();
    w.records.push({ ...w.records.find((r) => r.id === 'P-D-A1')!, id: 'P-D-A2', title: 'Owner', path: 'specs/P-D-A2.md' });
    w.links.push({ source: 'P-D-A1', relation: 'relates_to', target: 'P-D-A2' }, { source: 'P-D-A2', relation: 'relates_to', target: 'P-D-A1' });
    await showGraph('/P-D-A1', w);
    // The aggregates' folder opened: the two aggregates are siblings, in one column, with both links drawn.
    fireEvent.click(node('P-D/define/domain-model')!.querySelector<HTMLElement>('button.graph-group-chevron')!);
    await waitFor(() => expect(node('P-D-A2')).not.toBeNull());
    await waitFor(() => expect(left('P-D-A2')).toBe(left('P-D-A1')));
  });
});

describe('graph groups on the page', () => {
  const groupNode = (id: string) => node(id)?.querySelector<HTMLElement>('.graph-node') ?? null;

  const chevron = (id: string) => node(id)!.querySelector<HTMLElement>('button.graph-group-chevron')!;

  it('LA-EXP-T33 A group\'s chevron opens it in place and closes it again, open groups are remembered while walking, and clicking the group goes to it', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/question')).not.toBeNull());
    expect(groupNode('P-D/question')!.className).toContain('stage-group');
    expect(groupNode('P-D/question')!.className).toContain('is-folded');
    expect(groupNode('P-D/question')!.textContent).toContain('Open questions (1)');
    // Folded at the edge, its question is only the faded ring.
    expect(node('P-D-Q01')!.className).toContain('is-context');

    expect(chevron('P-D/question').getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(chevron('P-D/question'));
    await waitFor(() => expect(node('P-D-Q01')!.className).not.toContain('is-context'));
    expect(window.location.pathname).toBe('/P-D');
    expect(groupNode('P-D/question')!.className).toContain('is-open');
    expect(chevron('P-D/question').getAttribute('aria-label')).toBe('Fold Open questions (1) in place');

    // Walk to the question and back: the group is still open.
    fireEvent.click(node('P-D-Q01')!);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-Q01'));
    await back();
    await waitFor(() => expect(title()).toBe('Domain'));
    await waitFor(() => expect(node('P-D-Q01')!.className).not.toContain('is-context'));

    fireEvent.click(chevron('P-D/question'));
    await waitFor(() => expect(node('P-D-Q01')!.className).toContain('is-context'));
    expect(groupNode('P-D/question')!.className).toContain('is-folded');

    // Clicking the group itself goes to its address, where it is the center and has no chevron.
    fireEvent.click(node('P-D/question')!);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/question'));
    await waitFor(() => expect(groupNode('P-D/question')!.className).toContain('is-focus'));
    expect(node('P-D/question')!.querySelector('button.graph-group-chevron')).toBeNull();
  });

  it('LA-EXP-T34 o on a group opens or closes it and keeps keyboard focus on it; Enter goes to it', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/design')).not.toBeNull());
    const folderInFocus = () => !node('P-D/design/technical-specification')!.className.includes('is-context');
    expect(folderInFocus()).toBe(false);
    const group = node('P-D/design')!;
    group.focus();
    fireEvent.keyDown(group, { key: 'o' });
    await waitFor(() => expect(folderInFocus()).toBe(true));
    expect(window.location.pathname).toBe('/P-D');
    await waitFor(() => expect(document.activeElement).toBe(node('P-D/design')));
    fireEvent.keyDown(document.activeElement!, { key: 'o' });
    await waitFor(() => expect(folderInFocus()).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(node('P-D/design')));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/design'));
  });

  it('LA-EXP-T35 A group has its own address showing its parent to the left and its members to the right, and Back works', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    // The domain's side bar lists its stages, linking to their addresses.
    const link = sideBar().getByRole('link', { name: 'Define (2)' });
    expect(link.getAttribute('href')).toBe('/P-D/define?view=graph');
    fireEvent.click(link);
    expect(window.location.pathname).toBe('/P-D/define');
    await waitFor(() => expect(title()).toBe('Define (2)'));
    await waitFor(() => expect(groupNode('P-D/define')?.className).toContain('is-focus'));
    const left = (id: string) => Number(/translate\(([-\d.]+)px/.exec(node(id)!.style.transform)![1]);
    expect(left('P-D')).toBeLessThan(left('P-D/define'));
    expect(left('P-D/define')).toBeLessThan(left('P-D/define/use-cases'));
    expect(groupNode('P-D/define')!.className).toContain('is-focus');
    const trail = within(screen.getByRole('navigation', { name: 'Records visited' }));
    // A record by its title and ID; a group by its name alone, its parent named in its tooltip.
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Domain (P-D)', 'Define']);
    expect(trail.getByText('Define').closest('[aria-current]')).toHaveAttribute('title', 'Define of P-D');

    fireEvent.click(sideBar().getByRole('link', { name: /Capabilities/ }));
    expect(window.location.pathname).toBe('/P-D/define/use-cases');
    await back();
    expect(window.location.pathname).toBe('/P-D/define');
    await waitFor(() => expect(title()).toBe('Define (2)'));

    // An address for a group that does not exist says so.
    await openApp('/P-D/flow', { workspace: testWorkspace() });
    await screen.findByText(/There's no record or group/);
  });

  it('LA-EXP-T36 Groups are drawn as folders and carry a mark when a member or anything beneath it has errors or gaps; the legend explains them', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/design')).not.toBeNull());
    expect(groupNode('P-D/design')!.querySelector('.graph-mark.error')).not.toBeNull();
    expect(groupNode('P-D/define')!.querySelector('.graph-mark.gap')).not.toBeNull();
    expect(groupNode('P-D/question')!.querySelector('.graph-mark')).toBeNull();
    expect(node('P-D/question')!.getAttribute('aria-label')).toBe('Group Open questions (1) in P-D, folded');
    const legend = within(screen.getByRole('region', { name: 'Legend' }));
    expect(legend.getByText(/Stage, folder or group/)).toBeTruthy();
  });

  it('LA-EXP-T37 The graph is a component that takes its focus and reports moves through onNavigate, without reading or changing the address', async () => {
    window.history.replaceState(null, '', '/somewhere-else');
    const moves: string[] = [];
    const index = testIndex();
    const props = { index, onNavigate: (id: string) => moves.push(id), hrefFor: (id: string) => `/${id}` };
    const { rerender } = render(<GraphView {...props} settings={{ ...DEFAULT_GRAPH_SETTINGS, links: true }} focus="P-D-UC01-R01" />);
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    fireEvent.click(node('P-D-V01')!);
    expect(moves).toEqual(['P-D-V01']);
    expect(window.location.pathname).toBe('/somewhere-else');

    // Its links carry the host's addresses; a plain click goes through onNavigate.
    rerender(<GraphView {...props} settings={{ ...DEFAULT_GRAPH_SETTINGS, links: true }} focus="P-D-V01" />);
    const link = within(screen.getByRole('navigation', { name: 'Records visited' })).getByRole('link', { name: 'The owner is shown (P-D-UC01-R01)' });
    expect(link.getAttribute('href')).toBe('/P-D-UC01-R01');
    fireEvent.click(link);
    expect(moves).toEqual(['P-D-V01', 'P-D-UC01-R01']);
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

describe('the icicle on the page', () => {
  it('LA-EXP-T168 Tall parents carry their height and content scale, and every parent line is level', async () => {
    await showGraph('/P-D', testWorkspace(), 2, false);
    await waitFor(() => expect(node('P-D/define')).not.toBeNull());
    const height = (id: string) => parseFloat(node(id)!.style.height);
    const scale = (id: string) => node(id)!.querySelector<HTMLElement>('.graph-node')!.style.getPropertyValue('--node-scale');
    // The domain spans its stages, and its content grows with it.
    expect(height('P-D')).toBeGreaterThan(height('P-D/define') + height('P-D/design'));
    expect(Number(scale('P-D'))).toBeGreaterThan(1);
    // A leaf sets no scale.
    const leaf = [...document.querySelectorAll<HTMLElement>('.react-flow__node')].find((el) => parseFloat(el.style.height) === 56)!;
    expect(leaf.querySelector<HTMLElement>('.graph-node')!.style.getPropertyValue('--node-scale')).toBe('');
    // Every parent line is level.
    const lines = [...document.querySelectorAll<SVGPathElement>('.react-flow__edge-path.rel-structure')];
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      const [, , y1, , y2] = /M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)/.exec(line.getAttribute('d')!)!.map(Number);
      expect(y1).toBe(y2);
    }
  });
});

