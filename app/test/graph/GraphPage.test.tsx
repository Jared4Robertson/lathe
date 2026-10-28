import { fireResize } from './setup';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GraphView } from '../../src/graph/GraphPage';
import { DEFAULT_GRAPH_SETTINGS } from '../../src/graph/settings';
import type { SpecData } from '../../../lathe/src/server/contract';
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
const addressOf = (id: string) => `/${id}`;
const STEP = 'P-D-UC01-FL-S01';

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
  it.each(['LA-V93-R10-T03', 'LA-V93-R11-T02'])('%s Clicking a node re-centers the graph and changes the address, Back walks back, and the trail shows the path', async () => {
    await showGraph(`/${STEP}`);
    expect(title()).toBe('Librarian lends the thing');
    await waitFor(() => expect(node('P-V01')).not.toBeNull());

    fireEvent.click(node('P-V01')!);
    expect(window.location.pathname).toBe('/P-V01');
    expect(window.location.search).toBe('?view=graph');
    await waitFor(() => expect(title()).toBe('Loan desk'));
    // The view's own neighbor, the UI component that renders it, is now drawn.
    await waitFor(() => expect(node('P-UI01')).not.toBeNull());
    const trail = within(screen.getByRole('navigation', { name: 'Records visited' }));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual([`Librarian lends the thing (${STEP})`, 'Loan desk (P-V01)']);

    await back();
    expect(window.location.pathname).toBe(`/${STEP}`);
    await waitFor(() => expect(title()).toBe('Librarian lends the thing'));
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual([`Librarian lends the thing (${STEP})`]);
  });

  it('LA-V61-R41-T03 The trail is a Tab stop only while it overflows', async () => {
    await showGraph(`/${STEP}`);
    const list = () => screen.getByRole('navigation', { name: 'Records visited' }).querySelector('ol')!;
    // It fits: its links are the stops, and the list itself is not one.
    expect(list()).not.toHaveAttribute('tabindex');
    // It overflows: the list takes focus, so the keyboard can scroll it.
    const widths = { scrollWidth: 900, clientWidth: 300 };
    for (const [key, value] of Object.entries(widths)) Object.defineProperty(list(), key, { configurable: true, value });
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    fireEvent.click(node('P-V01')!);
    await waitFor(() => expect(list()).toHaveAttribute('tabindex', '0'));
  });

  it('LA-V95-R02-T01 The side bar shows the kind, title, problems, coverage gaps and a link to the record page', async () => {
    await showGraph('/P-D-INV02');
    const side = sideBar();
    expect(side.getAllByText('Invariant').length).toBeGreaterThan(0);
    expect(side.getByText('A loan is returned once', { selector: '.side-bar-name' })).toBeTruthy();
    expect(side.getByText('No test proves invariant P-D-INV02.')).toBeTruthy();
    // The gaps in the words of the wiki's Traceability callouts, in the side bar's compact Traceability.
    const gaps = side.getByRole('region', { name: /^Traceability/ });
    expect([...gaps.querySelectorAll('li[data-gap]')].map((li) => li.textContent)).toContain('Not proved yet');
    expect(side.getByRole('link', { name: 'P-D-INV02' }).getAttribute('href')).toBe('/P-D-INV02');
  });

  it('LA-V93-R21-T02 Depth shows only in the Tree layout: in Nested and Voronoi its slot stays but is neither shown nor reachable', async () => {
    await showGraph('/P-D/use-cases', testWorkspace(), 1, false);
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

  it('LA-V93-R10-T05 The graph opens at depth 1, framing the parent and the children; depth 2 and 3 frame more levels below, and Links brings in the links', async () => {
    await showGraph('/P-D/use-cases', testWorkspace(), 1, false);
    const depth = within(screen.getByRole('group', { name: 'Depth' }));
    expect(depth.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect(depth.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(node('P-D/use-cases/capability')).not.toBeNull());
    expect(scene().lines.filter((l) => l.style !== 'structure')).toEqual([]);
    const count = () => document.querySelector('.graph-count')!.textContent;
    const viewport = () => scene().camera;
    const one = count();
    // Depth 2 frames the folder's records too: more in the picture, and the camera takes them in.
    fireEvent.click(depth.getByRole('button', { name: '2' }));
    await waitFor(() => expect(count()).not.toBe(one));
    expect(count()).toBe('2 records · 2 groups · 3 links');
    expect(viewport().zoom).toBeGreaterThan(0);
    // Links brings in what the focus links to, dashed in their own color; a stage links to nothing.
    await showGraph(`/${STEP}`, testWorkspace(), 1, false);
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    expect(node('P-D-CMD01')).not.toBeNull();
    await waitFor(() => expect(scene().lines.some((l) => l.link)).toBe(true));
  });

  it('LA-V93-R12-T01 Nodes show their stage and kind, records with errors or gaps are marked, edges carry their relation, and there is a legend', async () => {
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-D-UC01-R01')).not.toBeNull());
    expect(drawnBox(STEP)!.stage).toBe('interaction-design');
    expect(drawnBox(STEP)!.focus).toBe(true);
    expect(drawnBox('P-D-UC01-R01')!.stage).toBe('use-cases');
    expect(drawnBox('P-D-CMD01')!.stage).toBe('domain-model');
    expect(drawnBox('P-V01')!.badges).toEqual([]);
    expect(screen.getByRole('region', { name: 'Legend' })).toBeTruthy();

    const edges = scene().lines.map((l) => l.style);
    expect(edges).toContain('trace');
    expect(edges).toContain('design');
    expect(edges).toContain('structure');

    // A test with an error is marked, in the test plan's colors.
    await showGraph('/P-D/test-plan/use_case_test', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D-UC01-R01-T01')).not.toBeNull());
    expect(drawnBox('P-D-UC01-R01-T01')!.stage).toBe('test-plan');
    expect(drawnBox('P-D-UC01-R01-T01')!.badges.map((b) => [b.label, b.tone])).toContainEqual(['!', 'error']);
    // An invariant with a coverage gap is marked.
    await showGraph('/P-D-A3/invariant', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D-INV02')).not.toBeNull());
    expect(drawnBox('P-D-INV02')!.badges.map((b) => b.label)).toContain('gap');
    // The product is a structural record.
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P')).not.toBeNull());
    expect(drawnBox('P')!.stage).toBe('structural');
    expect(drawnBox('P-D')!.stage).toBe('domain-model');
  });

  it('LA-V93-R14-T01 The plain arrows step through the tree while the graph has focus, Enter re-centers on the focused box, and Escape clears the filters', async () => {
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    const center = node(STEP)!;
    center.focus();
    expect(document.activeElement).toBe(center);
    // Left steps out to the parent, and the keyboard follows to its box.
    fireEvent.keyDown(center, { key: 'ArrowLeft' });
    expect(window.location.pathname).toBe('/P-D-UC01-FL');
    await waitFor(() => expect(document.activeElement).toBe(node('P-D-UC01-FL')));
    // Right steps in to the first child; Down and Up walk the siblings in the tree's order.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(window.location.pathname).toBe(`/${STEP}`);
    await waitFor(() => expect(document.activeElement).toBe(node(STEP)));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    const sibling = window.location.pathname;
    expect(sibling).toMatch(/^\/P-D-UC01-FL-S0[23]$/);
    // From the canvas itself (a click there gives the graph focus) the arrows step too, and focus stays on the canvas.
    const canvas = graphHost()!;
    canvas.focus();
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    expect(window.location.pathname).toBe(`/${STEP}`);
    expect(document.activeElement).toBe(canvas);
    // With a modifier, or in a text field, the arrows do nothing here.
    fireEvent.keyDown(canvas, { key: 'ArrowLeft', altKey: true });
    expect(window.location.pathname).toBe(`/${STEP}`);
    // Enter on a box with keyboard focus re-centers on it (Tab, the browser's, steps through the boxes).
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    node('P-V01')!.focus();
    fireEvent.keyDown(node('P-V01')!, { key: 'Enter' });
    expect(window.location.pathname).toBe(addressOf('P-V01'));
    await waitFor(() => expect(document.activeElement).toBe(node('P-V01')));

    // Hide views, then Escape brings them back.
    const views = screen.getByRole('checkbox', { name: 'View' }) as HTMLInputElement;
    fireEvent.click(views);
    expect(views.checked).toBe(false);
    fireEvent.keyDown(views, { key: 'Escape' });
    expect((screen.getByRole('checkbox', { name: 'View' }) as HTMLInputElement).checked).toBe(true);
  });

  it('LA-V96-R01-T01 Record, domain and product pages show the graph in their Graph view, and the nav has no Graph item', async () => {
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

  it('LA-V93-R51-T02 Trace mode is offered for an obligation and shows only its chain and files, and not offered for a use case', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trace mode' }));
    await waitFor(() => expect(node('file:src/loans.ts')).not.toBeNull());
    expect(node('file:test/lend.test.ts')).not.toBeNull();
    // On the trace's left, why the requirement is there: its use case and the use case's capability.
    expect(node('P-D-UC01')).not.toBeNull();
    expect(node('P-D-CAP01')).not.toBeNull();
    expect(sideBar().getByText('src/loans.ts')).toBeTruthy();
    // Escape leaves trace mode: the files leave the picture, fading out where they were, and are then dropped.
    fireEvent.keyDown(screen.getByRole('checkbox', { name: 'Trace mode' }), { key: 'Escape' });
    await waitFor(() => expect(node('file:src/loans.ts')).toBeNull());
    expect(node('P-D-UC01')).not.toBeNull();

    fireEvent.click(node('P-D-UC01')!);
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(screen.queryByRole('checkbox', { name: 'Trace mode' })).toBeNull();
  });

  it.each(['LA-EXP-DS05-T02', 'LA-V93-R15-T04'])('%s The page draws the map in columns with a solid parent/child spine, and links between siblings never move anything', async () => {
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    const left = (id: string) => drawnBox(id)!.map.x;
    expect(left('P-D-UC01-FL')).toBeLessThan(left(STEP));
    // What the step links to keeps its own place in the map: the view in its domain's Interaction design, left of the deeper requirement.
    expect(left('P-V01')).toBeLessThan(left('P-D-UC01-R01'));
    expect(scene().lines.some((l) => l.style === 'structure' && !l.link)).toBe(true);

    await showGraph('/P-D-EN03', testWorkspace(), 1, false);
    const links = screen.getByRole('button', { name: 'Links' });
    if (links.getAttribute('aria-pressed') !== 'true') fireEvent.click(links);
    // The Loan and its return are siblings among the aggregate's entities, in one column, with the link drawn between them.
    await waitFor(() => expect(node('P-D-EN04')).not.toBeNull());
    expect(left('P-D-EN04')).toBe(left('P-D-EN03'));
    const link = (source: string, target: string) => scene().lines.some((l) => l.link && l.source === source && l.target === target);
    await waitFor(() => expect(link('P-D-EN03', 'P-D-EN04')).toBe(true));
    expect(link('P-D-EN03', 'P-D-EN05')).toBe(true);
  });
});

describe('graph groups on the page', () => {
  const groupNode = (id: string) => drawnBox(id) ?? null;

  it.each(['LA-V93-R23-T04', 'LA-V93-R24-T01'])('%s A group shows its name and count, with no chevron; clicking the group, or Enter on it, goes to it', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/question')).not.toBeNull());
    expect(groupNode('P-D/question')!.group).toBe(true);
    expect(groupNode('P-D/question')!.stage).toBe('structural');
    // Nothing to open or fold in place: every member is in the map, so a group has no chevron and no button.
    expect(node('P-D/question')!.querySelector('button')).toBeNull();
    expect(document.querySelector('.graph-group-chevron')).toBeNull();

    // Clicking the group itself goes to its address, where it is the center, framed and labeled with its name and count.
    fireEvent.click(node('P-D/question')!);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/question'));
    await waitFor(() => expect(groupNode('P-D/question')!.focus).toBe(true));
    // Its name and count: in its label (LA-EXP-DS10), and in its tooltip.
    expect(groupNode('P-D/question')!.lines.map((l) => l.text)).toContain('Open questions (1)');
    expect(groupNode('P-D/question')!.lines.map((l) => l.text).join(' ')).toMatch(/^Open question folder · P-D/);
    expect(groupNode('P-D/question')!.tip).toBe('Open questions (1) (in P-D)');
    expect(document.querySelector('.graph-group-chevron')).toBeNull();

    // Enter on a group goes to it too.
    await back();
    await waitFor(() => expect(node('P-D/test-plan')).not.toBeNull());
    const group = node('P-D/test-plan')!;
    group.focus();
    fireEvent.keyDown(group, { key: 'Enter' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/test-plan'));
  });

  it('LA-V93-R25-T02 A group has its own address showing its parent to the left and its members to the right, and Back works', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    // The domain's side bar lists its stages, linking to their addresses.
    const link = sideBar().getByRole('link', { name: 'Use cases (1)' });
    expect(link.getAttribute('href')).toBe('/P-D/use-cases?view=graph');
    fireEvent.click(link);
    expect(window.location.pathname).toBe('/P-D/use-cases');
    await waitFor(() => expect(title()).toBe('Use cases (1)'));
    await waitFor(() => expect(groupNode('P-D/use-cases')?.focus).toBe(true));
    const left = (id: string) => drawnBox(id)!.map.x;
    expect(left('P-D')).toBeLessThan(left('P-D/use-cases'));
    expect(left('P-D/use-cases')).toBeLessThan(left('P-D/use-cases/capability'));
    expect(groupNode('P-D/use-cases')!.focus).toBe(true);
    const trail = within(screen.getByRole('navigation', { name: 'Records visited' }));
    // A record by its title and ID; a group by its name alone, its parent named in its tooltip.
    expect(trail.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Domain (P-D)', 'Use cases']);
    expect(trail.getByText('Use cases').closest('[aria-current]')).toHaveAttribute('title', 'Use cases of P-D');

    fireEvent.click(sideBar().getByRole('link', { name: /Capabilities/ }));
    expect(window.location.pathname).toBe('/P-D/use-cases/capability');
    await back();
    expect(window.location.pathname).toBe('/P-D/use-cases');
    await waitFor(() => expect(title()).toBe('Use cases (1)'));

    // An address for a group that does not exist says so.
    await openApp('/P-D/flow', { data: testWorkspace() });
    await screen.findByText(/There's no record or group/);
  });

  it.each(['LA-V93-R23-T05', 'LA-V93-R26-T02'])('%s Groups are drawn as folders and carry a mark when a member or anything beneath it has errors or gaps; the legend explains them', async () => {
    await showGraph('/P-D', testWorkspace(), 1, false);
    await waitFor(() => expect(node('P-D/test-plan')).not.toBeNull());
    expect(groupNode('P-D/test-plan')!.badges.map((b) => [b.label, b.tone])).toContainEqual(['!', 'error']);
    expect(groupNode('P-D/domain-model')!.badges.map((b) => b.label)).toContain('gap');
    // Each group carries its stage's color: a stage its own, a folder its kind's.
    expect(groupNode('P-D/test-plan')!.stage).toBe('test-plan');
    expect(groupNode('P-D/domain-model')!.stage).toBe('domain-model');
    const legend = within(screen.getByRole('region', { name: 'Legend' }));
    expect(legend.getByText(/Stage, folder or group/)).toBeTruthy();
    // A labeled group is named for assistive technology by its name, count and owner; one with nothing wrong beneath it carries no mark.
    expect(node('P-D/test-plan')!.getAttribute('aria-label')).toMatch(/^Stage Test plan \(\d+\) in P-D$/);
    expect(marksOf(testIndex(), 'P-D/question')).toEqual({ errors: 0, warnings: 0, gaps: [] });
  });

  it('LA-V96-R02-T01 The graph is a component that takes its focus and reports moves through onNavigate, without reading or changing the address', async () => {
    window.history.replaceState(null, '', '/somewhere-else');
    const moves: string[] = [];
    const index = testIndex();
    const props = { index, onNavigate: (id: string) => moves.push(id), hrefFor: (id: string) => `/${id}` };
    const { rerender } = render(<GraphView {...props} settings={{ ...DEFAULT_GRAPH_SETTINGS, links: true }} focus={STEP} />);
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    fireEvent.click(node('P-V01')!);
    expect(moves).toEqual(['P-V01']);
    expect(window.location.pathname).toBe('/somewhere-else');

    // Its links carry the host's addresses; a plain click goes through onNavigate.
    rerender(<GraphView {...props} settings={{ ...DEFAULT_GRAPH_SETTINGS, links: true }} focus="P-V01" />);
    const link = within(screen.getByRole('navigation', { name: 'Records visited' })).getByRole('link', { name: `Librarian lends the thing (${STEP})` });
    expect(link.getAttribute('href')).toBe(`/${STEP}`);
    fireEvent.click(link);
    expect(moves).toEqual(['P-V01', STEP]);
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
  it.each(['LA-EXP-DS06-T03', 'LA-V93-R29-T02'])('%s Tall parents carry their height and text scale, every box its text scale as its box scale, and every parent line is level', async () => {
    await showGraph('/P-D', testWorkspace(), 2, false);
    await waitFor(() => expect(node('P-D/domain-model')).not.toBeNull());
    const height = (id: string) => drawnBox(id)!.map.h;
    const scale = (id: string) => drawnBox(id)!.textScale;
    // The domain spans its stages, and its content grows with it.
    expect(height('P-D')).toBeGreaterThan(height('P-D/domain-model') + height('P-D/test-plan'));
    expect(Number(scale('P-D'))).toBeGreaterThan(1);
    // Every box's border grows with its text, however small: its box scale is its text scale.
    for (const b of scene().boxes) expect(b.boxScale, b.id).toBe(b.textScale);
    // Every parent line is level.
    const lines = scene().lines.filter((l) => l.style === 'structure');
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) expect(line.points[0][1]).toBe(line.points[1][1]);
  });
});
