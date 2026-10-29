import { fireResize } from './setup';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GraphView } from '../../src/graph/GraphPage';
import { DEFAULT_GRAPH_SETTINGS } from '../../src/graph/settings';
import type { SpecData } from '../../../lathe/src/server/contract';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { marksOf } from '../../src/graph/text';
import { createOpenSpaceStore } from '../../src/views/openSpace';
import { boxElement, boxElements, cameraOf, drawnBox, graphHost, isCenter, scene } from './scene';

// The graph as the focus page hosts it: on the Graph stage of a record's, group's, product's or
// domain's own address, with the wiki card over it.

const node = (id: string) => boxElement(id);
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
/** The address of a record in the test workspace (the product and domain have overview pages). */
const addressOf = (id: string) => `/${id}`;
const STEP = 'P-D-UC01-FL01-S01';

async function back() {
  await act(async () => {
    window.history.back();
    await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  });
}

/** Opens a graph page at a depth (1 unless asked). */
async function showGraph(path: string, workspace: SpecData = testWorkspace(), depth = 1) {
  startAtDepth(depth);
  await openApp(path.includes('?') ? path : `${path}?stage=graph`, { data: workspace });
  await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
}

describe('graph page', () => {
  it('LA-V93-R10-T03 LA-V93-R11-T02 Clicking a node re-centers the graph and changes the address, Back walks back, and no visited trail is drawn', async () => {
    await showGraph(`/${STEP}`);
    expect(title()).toBe('Librarian lends the thing');
    await waitFor(() => expect(node('P-D-UC01-FL01')).not.toBeNull());

    fireEvent.click(node('P-D-UC01-FL01')!);
    expect(window.location.pathname).toBe('/P-D-UC01-FL01');
    expect(window.location.search).toBe('?stage=graph');
    await waitFor(() => expect(title()).toBe('Lend a thing in the web app'));
    await waitFor(() => expect(isCenter('P-D-UC01-FL01')).toBe(true));
    // The flow's own parent, its use case, is now drawn.
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    // The graph keeps no trail of its own: the header strip's breadcrumb names where the focus sits, Back walks the path.
    expect(screen.queryByRole('navigation', { name: 'Records visited' })).toBeNull();

    await back();
    expect(window.location.pathname).toBe(`/${STEP}`);
    await waitFor(() => expect(title()).toBe('Librarian lends the thing'));
    await waitFor(() => expect(isCenter(STEP)).toBe(true));
  });

  it('LA-V93-R21-T02 Depth shows only in the Tree layout: in Nested and Voronoi its slot stays but is neither shown nor reachable', async () => {
    await showGraph('/P-D/use-cases');
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

  it('LA-V93-R10-T05 The graph opens at depth 1, framing the parent and the children, and depth 2 and 3 frame more levels below; only parent lines are drawn', async () => {
    await showGraph('/P-D/use-cases');
    const depth = within(screen.getByRole('group', { name: 'Depth' }));
    expect(depth.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect(depth.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(node('P-D-CAP01')).not.toBeNull());
    expect(scene().lines.filter((l) => l.style !== 'structure')).toEqual([]);
    const count = () => document.querySelector('.header-strip-counts')!.textContent;
    const viewport = () => scene().camera;
    const one = count();
    // Depth 2 frames the capability's use cases too: more in the picture, and the camera takes them in.
    fireEvent.click(depth.getByRole('button', { name: '2' }));
    await waitFor(() => expect(count()).not.toBe(one));
    expect(count()).toBe('3 records · 1 group · 3 links');
    expect(viewport().zoom).toBeGreaterThan(0);
    // A record that links to others draws no line to them: what the step fulfills, invokes and happens in are the Trace
    // stage's and the wiki card's, and there is no switch to draw them.
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-D-UC01-FL01')).not.toBeNull());
    expect(scene().lines.length).toBeGreaterThan(0);
    expect(scene().lines.every((l) => l.style === 'structure' && !l.link)).toBe(true);
    expect(screen.queryByRole('button', { name: /^Links/ })).toBeNull();
  });

  it('LA-V93-R12-T01 Nodes show their stage and kind, records with errors or gaps are marked, parent lines join them, and there is a key', async () => {
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-D-UC01-FL01')).not.toBeNull());
    expect(drawnBox(STEP)!.stage).toBe('interaction-design');
    expect(drawnBox(STEP)!.focus).toBe(true);
    expect(drawnBox('P-D-UC01-FL01')!.stage).toBe('interaction-design');
    expect(screen.getByRole('region', { name: 'Key' })).toBeTruthy();
    expect(scene().lines.map((l) => l.style)).toContain('structure');
    // A capability in the use cases' colors, its use case beside it.
    await showGraph('/P-D-CAP01');
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    expect(drawnBox('P-D-UC01')!.stage).toBe('use-cases');
    // An aggregate in the domain model's.
    await showGraph('/P-D-A4');
    await waitFor(() => expect(node('P-D-A4')).not.toBeNull());
    expect(drawnBox('P-D-A4')!.stage).toBe('domain-model');

    // A test with an error is marked, in the test plan's colors.
    await showGraph('/P-D/test-plan/use_case_test');
    await waitFor(() => expect(node('P-D-UC01-R01-T01')).not.toBeNull());
    expect(drawnBox('P-D-UC01-R01-T01')!.stage).toBe('test-plan');
    expect(drawnBox('P-D-UC01-R01-T01')!.badges.map((b) => [b.label, b.tone])).toContainEqual(['!', 'error']);
    // An invariant with a coverage gap is marked.
    await showGraph('/P-D-A3/invariant');
    await waitFor(() => expect(node('P-D-INV02')).not.toBeNull());
    expect(drawnBox('P-D-INV02')!.badges.map((b) => b.label)).toContain('gap');
    // The product is a structural record.
    await showGraph('/P-D');
    await waitFor(() => expect(node('P')).not.toBeNull());
    expect(drawnBox('P')!.stage).toBe('structural');
    expect(drawnBox('P-D')!.stage).toBe('domain-model');
  });

  it('LA-V93-R14-T01 The plain arrows step through the tree from a focused box, Enter re-centers on the focused box, and Escape clears the filters', async () => {
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    const center = node(STEP)!;
    center.focus();
    expect(document.activeElement).toBe(center);
    // Left steps out to the parent, and the keyboard follows to its box.
    fireEvent.keyDown(center, { key: 'ArrowLeft' });
    expect(window.location.pathname).toBe('/P-D-UC01-FL01');
    await waitFor(() => expect(document.activeElement).toBe(node('P-D-UC01-FL01')));
    // Right steps in to the first child; Down and Up walk the siblings in the tree's order.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(window.location.pathname).toBe(`/${STEP}`);
    await waitFor(() => expect(document.activeElement).toBe(node(STEP)));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    const sibling = window.location.pathname;
    expect(sibling).toMatch(/^\/P-D-UC01-FL01-S0[23]$/);
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

  it('LA-V96-R01-T01 Record, domain and product pages show their graph on the Graph stage, the stage a page opens on, and the nav has no Graph item', async () => {
    for (const path of ['/P-D-UC01-R01', '/P-D', '/P']) {
      // Each page starts on the Graph stage (no stage remembered, no tab to take one from); the switch comes back to it.
      window.localStorage.removeItem('lathe:stage');
      window.sessionStorage.removeItem('lathe:tabs');
      await openApp(path, { data: testWorkspace() });
      await screen.findByRole('heading', { level: 1 });
      const stage = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
      expect(stage('Graph')).toHaveAttribute('aria-pressed', 'true');
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Graph' })).toBeNull();
      await waitFor(() => expect(document.querySelector('.graph-box.is-focus')).not.toBeNull());
      fireEvent.click(stage('Trace'));
      fireEvent.click(stage('Graph'));
      expect(window.location.pathname + window.location.search).toBe(`${path}?stage=graph`);
      await waitFor(() => expect(document.querySelector('.graph-box.is-focus')).not.toBeNull());
      expect(scene().boxes.some((b) => b.focus)).toBe(true);
    }
  });

  it('LA-EXP-DS05-T02 LA-V93-R15-T04 The page draws the map in columns with a solid parent/child spine, and draws no link between siblings', async () => {
    await showGraph(`/${STEP}`);
    await waitFor(() => expect(node('P-D-UC01-FL01')).not.toBeNull());
    const left = (id: string) => drawnBox(id)!.map.x;
    expect(left('P-D-UC01-FL01')).toBeLessThan(left(STEP));
    expect(scene().lines.some((l) => l.style === 'structure' && !l.link)).toBe(true);

    // The Loan and its return and reminder are siblings among the aggregate's entities, in one column; the Loan's links
    // to them are not drawn.
    await showGraph('/P-D-A3/entity');
    await waitFor(() => expect(node('P-D-EN04')).not.toBeNull());
    expect(left('P-D-EN04')).toBe(left('P-D-EN03'));
    expect(left('P-D-EN05')).toBe(left('P-D-EN03'));
    expect(scene().lines.every((l) => !l.link)).toBe(true);
  });
});

describe('graph groups on the page', () => {
  const groupNode = (id: string) => drawnBox(id) ?? null;

  it('LA-V93-R23-T04 LA-V93-R24-T01 A group shows its name and count, with no chevron; clicking the group, or Enter on it, goes to it', async () => {
    await showGraph('/P-D');
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
    await showGraph('/P-D');
    // The domain's stage, drawn as a group: clicking it goes to its address.
    await waitFor(() => expect(node('P-D/domain-model')).not.toBeNull());
    fireEvent.click(node('P-D/domain-model')!);
    expect(window.location.pathname).toBe('/P-D/domain-model');
    expect(window.location.search).toBe('?stage=graph');
    await waitFor(() => expect(title()).toMatch(/^Domain model \(\d+\)$/));
    const stageTitle = title();
    await waitFor(() => expect(groupNode('P-D/domain-model')?.focus).toBe(true));
    const left = (id: string) => drawnBox(id)!.map.x;
    expect(left('P-D')).toBeLessThan(left('P-D/domain-model'));
    expect(left('P-D/domain-model')).toBeLessThan(left('P-D/domain-model/aggregate'));
    expect(groupNode('P-D/domain-model')!.focus).toBe(true);
    // The header strip's breadcrumb names where the group sits: its domain, by its title, the ID in its tooltip.
    const crumbs = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(crumbs.getByRole('link', { name: 'Domain (P-D)' })).toHaveAttribute('title', 'Domain (P-D)');

    await waitFor(() => expect(node('P-D/domain-model/aggregate')).not.toBeNull());
    fireEvent.click(node('P-D/domain-model/aggregate')!);
    expect(window.location.pathname).toBe('/P-D/domain-model/aggregate');
    await back();
    expect(window.location.pathname).toBe('/P-D/domain-model');
    await waitFor(() => expect(title()).toBe(stageTitle));

    // A stage with one folder (Use cases) holds its records itself; its folder has no address.
    await openApp('/P-D/use-cases/capability', { data: testWorkspace() });
    await screen.findByText(/There's no record or group/);

    // An address for a group that does not exist says so.
    await openApp('/P-D/flow', { data: testWorkspace() });
    await screen.findByText(/There's no record or group/);
  });

  it('LA-V93-R23-T05 LA-V93-R26-T02 Groups are drawn as folders and carry a mark when a member or anything beneath it has errors or gaps; the key explains them', async () => {
    await showGraph('/P-D');
    await waitFor(() => expect(node('P-D/test-plan')).not.toBeNull());
    expect(groupNode('P-D/test-plan')!.badges.map((b) => [b.label, b.tone])).toContainEqual(['!', 'error']);
    expect(groupNode('P-D/domain-model')!.badges.map((b) => b.label)).toContain('gap');
    // Each group carries its stage's color: a stage its own, a folder its kind's.
    expect(groupNode('P-D/test-plan')!.stage).toBe('test-plan');
    expect(groupNode('P-D/domain-model')!.stage).toBe('domain-model');
    const key = within(screen.getByRole('region', { name: 'Key' }));
    expect(key.getByText('Folder').closest('li')).toHaveAttribute('title', expect.stringMatching(/Stage, folder or group/));
    // A labeled group is named for assistive technology by its name, count and owner; one with nothing wrong beneath it carries no mark.
    expect(node('P-D/test-plan')!.getAttribute('aria-label')).toMatch(/^Stage Test plan \(\d+\) in P-D$/);
    expect(marksOf(testIndex(), 'P-D/question')).toEqual({ errors: 0, warnings: 0, gaps: [] });
  });

  it('LA-V96-R02-T01 The graph is a component that takes its focus and reports moves through onNavigate and what it draws through onCounts, without reading or changing the address', async () => {
    window.history.replaceState(null, '', '/somewhere-else');
    const moves: string[] = [];
    const counts: string[] = [];
    const index = testIndex();
    const props = { index, onNavigate: (id: string) => moves.push(id), onCounts: (c: string) => counts.push(c) };
    const { rerender } = render(<GraphView {...props} settings={DEFAULT_GRAPH_SETTINGS} focus={STEP} />);
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    expect(counts.at(-1)).toMatch(/^\d+ records? · .*\d+ links?$/);
    fireEvent.click(node('P-V01')!);
    expect(moves).toEqual(['P-V01']);
    expect(window.location.pathname).toBe('/somewhere-else');
    rerender(<GraphView {...props} settings={DEFAULT_GRAPH_SETTINGS} focus="P-V01" />);
    await waitFor(() => expect(isCenter('P-V01')).toBe(true));
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

  it('LA-V96-R05-T02 The graph frames its focus in the open space its host\'s panels leave, and moves when that space changes', async () => {
    const space = createOpenSpaceStore();
    render(<GraphView index={testIndex()} onNavigate={() => {}} settings={DEFAULT_GRAPH_SETTINGS} focus={STEP} space={space} />);
    await waitFor(() => expect(node(STEP)).not.toBeNull());
    const flow = graphHost()!;
    flow.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, width: 1200, height: 800, right: 1200, bottom: 800, toJSON: () => ({}) }) as DOMRect;
    act(() => fireResize(flow));
    await waitFor(() => expect(drawnBox(STEP)).toBeDefined());
    // A panel over the left 500 px and one over the right 300: the focus sits between them.
    const none = { left: 0, top: 0, right: 0, bottom: 0 };
    const frame = { left: 500, top: 60, right: 300, bottom: 0 };
    act(() => space.set({ open: none, frame }));
    await waitFor(() => {
      const r = drawnBox(STEP)!.rect;
      expect(r.left).toBeGreaterThanOrEqual(frame.left - 1);
      expect(r.left + r.width).toBeLessThanOrEqual(1200 - frame.right + 1);
      expect(r.top).toBeGreaterThanOrEqual(frame.top - 1);
    });
    // The panels gone, the camera moves back over the whole stage.
    const framed = cameraOf();
    act(() => space.set({ open: none, frame: none }));
    await waitFor(() => expect(cameraOf()).not.toBe(framed));
  });
});

describe('the map on the page', () => {
  it('LA-EXP-DS06-T03 LA-V93-R29-T02 Tall parents carry their height and text scale, every box its text scale as its box scale, and every parent line is level', async () => {
    await showGraph('/P-D', testWorkspace(), 2);
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
