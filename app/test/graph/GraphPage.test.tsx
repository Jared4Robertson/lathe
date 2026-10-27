import { fireResize } from './setup';
import { addRows } from '../fixtures/load';
import type { SpecData } from '../../../lathe/src/server/contract';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_GRAPH_SETTINGS, GraphView } from '../../src/graph/GraphPage';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { marksOf } from '../../src/graph/text';
import { boxElement, boxElements, cameraOf, drawnBox, graphHost, scene } from './scene';

// The graph as the focus page hosts it: in the Graph view of a record's, group's, product's or
// domain's own address, with the side bar beside it.

const node = (id: string) => boxElement(id);
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
async function showGraph(path: string, workspace: SpecData = testWorkspace(), depth = 1, links = true) {
  startAtDepth(depth);
  await openApp(path.includes('?') ? path : `${path}?view=graph`, { data: workspace });
  await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
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

  it('LA-EXP-T194 Depth shows only in the Tree layout: in Nested and Voronoi its slot stays but is neither shown nor reachable', async () => {
    await showGraph('/P-D/define', testWorkspace(), 1, false);
    const group = () => document.querySelector<HTMLElement>('[aria-label="Depth"]')!;
    expect(screen.getByRole('group', { name: 'Depth' })).toBeVisible();
    for (const layout of ['Nested', 'Voronoi']) {
      fireEvent.click(within(screen.getByRole('group', { name: 'Layout' })).getByRole('button', { name: layout }));
      await waitFor(() => expect(group()).toHaveClass('is-idle'));
      // The slot keeps its place, so nothing beside it moves (LA-PAT-APP-UX-R08), but it has no purpose here (LA-PAT-APP-CODE-R21).
      expect(group()).toHaveAttribute('aria-hidden', 'true');
      expect(group()).toHaveAttribute('inert');
      expect(screen.queryByRole('group', { name: 'Depth' })).toBeNull();
    }
    fireEvent.click(within(screen.getByRole('group', { name: 'Layout' })).getByRole('button', { name: 'Tree' }));
    await waitFor(() => expect(group()).not.toHaveClass('is-idle'));
    expect(screen.getByRole('group', { name: 'Depth' })).toBeInTheDocument();
  });

  it('LA-EXP-T93 The graph opens at depth 1, framing the parent and the children; depth 2 and 3 frame more levels below, and Links brings in the links', async () => {
    await showGraph('/P-D/define', testWorkspace(), 1, false);
    const depth = within(screen.getByRole('group', { name: 'Depth' }));
    expect(depth.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect(depth.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(node('P-D/define/use-cases')).not.toBeNull());
    expect(scene().lines.filter((l) => l.style !== 'structure')).toEqual([]);
    const count = () => document.querySelector('.graph-count')!.textContent;
    const viewport = () => scene().camera;
    const one = count();
    // Depth 2 frames the folders' records too: more in the picture, and the camera takes them in.
    fireEvent.click(depth.getByRole('button', { name: '2' }));
    await waitFor(() => expect(count()).not.toBe(one));
    expect(count()).toBe('3 records · 3 groups · 5 links');
    expect(viewport().zoom).toBeGreaterThan(0);
    // Links brings in what the focus links to, dashed in their own color; a stage links to nothing.
    await showGraph('/P-D-UC01-R01', testWorkspace(), 1, false);
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    expect(node('P-D-T01')).not.toBeNull();
    await waitFor(() => expect(scene().lines.some((l) => l.link)).toBe(true));
  });

  it('LA-EXP-T20 Nodes show their stage and kind, records with errors or gaps are marked, edges carry their relation, and there is a legend', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-T01')).not.toBeNull());
    expect(drawnBox('P-D-UC01-R01')!.stage).toBe('define');
    expect(drawnBox('P-D-UC01-R01')!.focus).toBe(true);
    expect(drawnBox('P-D-T01')!.stage).toBe('design');
    expect(drawnBox('P-D-T01')!.badges.map((b) => [b.label, b.tone])).toContainEqual(['!', 'error']);
    expect(drawnBox('P-D-V01')!.badges).toEqual([]);
    expect(screen.getByRole('region', { name: 'Legend' })).toBeTruthy();

    const edges = scene().lines.map((l) => l.style);
    expect(edges).toContain('trace');
    expect(edges).toContain('structure');

    // From the aggregate: its rule P-D-DR01 has a coverage gap; from the domain, the domain is a structural record.
    await showGraph('/P-D-A1', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D-DR01')).not.toBeNull());
    expect(drawnBox('P-D-DR01')!.badges.map((b) => b.label)).toContain('gap');
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D')).not.toBeNull());
    expect(drawnBox('P-D')!.stage).toBe('structural');
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
    expect(moved.classList.contains('graph-box')).toBe(true);
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
      await openApp(path, { data: testWorkspace() });
      await screen.findByRole('heading', { level: 1 });
      const graph = within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Graph' });
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Graph' })).toBeNull();
      fireEvent.click(graph);
      expect(window.location.pathname + window.location.search).toBe(`${path}?view=wiki,graph`);
      await waitFor(() => expect(document.querySelector('.graph-box.is-focus')).not.toBeNull());
      expect(scene().boxes.some((b) => b.focus)).toBe(true);
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

  it('LA-EXP-T26 The page draws the map in columns with a solid parent/child spine, and links between siblings never move anything', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-T01')).not.toBeNull());
    const left = (id: string) => drawnBox(id)!.map.x;
    expect(left('P-D-UC01')).toBeLessThan(left('P-D-UC01-R01'));
    // What satisfies and proves the requirement keeps its own place in the map: a component and a test, one level apart.
    expect(left('P-D-C01')).toBeLessThan(left('P-D-T01'));
    expect(scene().lines.some((l) => l.style === 'structure' && !l.link)).toBe(true);

    const w = testWorkspace();
    addRows(w, 'aggregate', { id: 'P-D-A2', title: 'Owner', domain_id: 'P-D' });
    addRows(w, 'relates_to', { source_id: 'P-D-A1', target_id: 'P-D-A2' }, { source_id: 'P-D-A2', target_id: 'P-D-A1' });
    await showGraph('/P-D-A1', w, 1, false);
    const links = screen.getByRole('button', { name: 'Links' });
    if (links.getAttribute('aria-pressed') !== 'true') fireEvent.click(links);
    // The two aggregates are siblings, in one column, with both links drawn between them.
    await waitFor(() => expect(node('P-D-A2')).not.toBeNull());
    expect(left('P-D-A2')).toBe(left('P-D-A1'));
    const link = (source: string, target: string) => scene().lines.some((l) => l.link && l.source === source && l.target === target);
    await waitFor(() => expect(link('P-D-A1', 'P-D-A2')).toBe(true));
    expect(link('P-D-A2', 'P-D-A1')).toBe(true);
  });
});

describe('graph groups on the page', () => {
  const groupNode = (id: string) => drawnBox(id) ?? null;

  it('LA-EXP-T33 A group shows its name and count, with no chevron; clicking the group, or Enter on it, goes to it', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/question')).not.toBeNull());
    expect(groupNode('P-D/question')!.stage).toBe('group');
    // Nothing to open or fold in place: every member is in the map, so a group has no chevron and no button.
    expect(node('P-D/question')!.querySelector('button')).toBeNull();
    expect(document.querySelector('.graph-group-chevron')).toBeNull();

    // Clicking the group itself goes to its address, where it is the center, framed and labeled with its name and count.
    fireEvent.click(node('P-D/question')!);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/question'));
    await waitFor(() => expect(groupNode('P-D/question')!.focus).toBe(true));
    // Its name and count: in its label (LA-EXP-DR60), and in its tooltip.
    expect(groupNode('P-D/question')!.lines.map((l) => l.text)).toContain('Open questions (1)');
    expect(groupNode('P-D/question')!.tip).toBe('Open questions (1) (in P-D)');
    expect(document.querySelector('.graph-group-chevron')).toBeNull();

    // Enter on a group goes to it too.
    await back();
    await waitFor(() => expect(node('P-D/design')).not.toBeNull());
    const group = node('P-D/design')!;
    group.focus();
    fireEvent.keyDown(group, { key: 'Enter' });
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
    await waitFor(() => expect(groupNode('P-D/define')?.focus).toBe(true));
    const left = (id: string) => drawnBox(id)!.map.x;
    expect(left('P-D')).toBeLessThan(left('P-D/define'));
    expect(left('P-D/define')).toBeLessThan(left('P-D/define/use-cases'));
    expect(groupNode('P-D/define')!.focus).toBe(true);
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
    await openApp('/P-D/flow', { data: testWorkspace() });
    await screen.findByText(/There's no record or group/);
  });

  it('LA-EXP-T36 Groups are drawn as folders and carry a mark when a member or anything beneath it has errors or gaps; the legend explains them', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/design')).not.toBeNull());
    expect(groupNode('P-D/design')!.badges.map((b) => [b.label, b.tone])).toContainEqual(['!', 'error']);
    expect(groupNode('P-D/define')!.badges.map((b) => b.label)).toContain('gap');
    const legend = within(screen.getByRole('region', { name: 'Legend' }));
    expect(legend.getByText(/Stage, folder or group/)).toBeTruthy();
    // A labeled group is named for assistive technology by its name, count and owner; one with nothing wrong beneath it carries no mark.
    expect(node('P-D/design')!.getAttribute('aria-label')).toMatch(/^Group Design \(\d+\) in P-D$/);
    expect(marksOf(testIndex(), 'P-D/question')).toEqual({ errors: 0, warnings: 0, gaps: [] });
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
    const flow = graphHost()!;
    const viewport = () => cameraOf();
    const sized = (width: number, height: number) => () => ({ x: 0, y: 0, top: 0, left: 0, width, height, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect;
    flow.getBoundingClientRect = sized(1000, 800);
    act(() => fireResize(flow));
    await waitFor(() => expect(scene().camera.zoom).toBeGreaterThan(0));
    const wide = viewport();
    flow.getBoundingClientRect = sized(300, 800);
    act(() => fireResize(flow));
    await waitFor(() => expect(viewport()).not.toBe(wide));
  });
});

describe('the map on the page', () => {
  it('LA-EXP-T168 Tall parents carry their height and text scale, every box its text scale as its box scale, and every parent line is level', async () => {
    await showGraph('/P-D', testWorkspace(), 2, false);
    await waitFor(() => expect(node('P-D/define')).not.toBeNull());
    const height = (id: string) => drawnBox(id)!.map.h;
    const scale = (id: string) => drawnBox(id)!.textScale;
    // The domain spans its stages, and its content grows with it.
    expect(height('P-D')).toBeGreaterThan(height('P-D/define') + height('P-D/design'));
    expect(Number(scale('P-D'))).toBeGreaterThan(1);
    // Every box's border grows with its text, however small: its box scale is its text scale.
    for (const b of scene().boxes) expect(b.boxScale, b.id).toBe(b.textScale);
    // Every parent line is level.
    const lines = scene().lines.filter((l) => l.style === 'structure');
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) expect(line.points[0][1]).toBe(line.points[1][1]);
  });
});

