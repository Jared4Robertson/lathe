import './setup';
import type { SpecData } from '../../../lathe/src/server/contract';
import { addRows, indexOf } from '../fixtures/load';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { graphSummary, keyboardOrder, stepTarget, type Box } from '../../src/graph/GraphPage';
import { panToward, pastEdges } from '../../src/graph/hints';
import { groupLabel, groupMembers, isGraphNode, neighborhood, type Neighborhood } from '../../src/graph/model';
import { treeChildren, treeParent } from '../../src/graph/tree';
import { labelLines } from '../../src/graph/text';
import { domainFolders } from '../../src/specs/folders';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElement, boxElements, drawnBox, graphHost, isCenter, scene } from './scene';

// The graph's tree is the nav's tree, depth counts its levels below the focus, and the picture is
// one map seen through a camera: what is too small to read is drawn plain and kept out of focus.

const ids = (n: Neighborhood) => n.nodes.map((x) => x.id).sort();
const node = (id: string) => boxElement(id);
/** The links drawn now (the Links switch), and the tree's parent lines. */
const drawnLinks = () => scene().lines.filter((l) => l.link);
const parentLines = () => scene().lines.filter((l) => !l.link);
const STAGES = ['P-D/domain-model', 'P-D/use-cases', 'P-D/interaction-design', 'P-D/technical-specification', 'P-D/test-plan'];

async function showGraph(path: string, workspace: SpecData = testWorkspace(), depth = 1) {
  startAtDepth(depth);
  await openApp(`${path}?stage=graph`, { data: workspace });
  await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
}

describe('the graph tree, its depth and its camera', () => {
  it('LA-EXP-DS09-T06 LA-V93-R10-T06 Depth counts levels below a domain and a use case, as a file explorer does', () => {
    const index = testIndex();
    // From the domain: depth 1 its stages, depth 2 their folders (or, in a stage with one folder, its records), depth 3
    // what is in them.
    const one = ids(neighborhood(index, 'P-D', 1));
    expect(one).toEqual(expect.arrayContaining(STAGES));
    expect(one.some((id) => id.split('/').length > 2)).toBe(false);
    const two = ids(neighborhood(index, 'P-D', 2));
    expect(two).toEqual(expect.arrayContaining(['P-D/domain-model/aggregate', 'P-D-CAP01', 'P-D/technical-specification/table', 'P-D/test-plan/use_case_test']));
    expect(two).not.toContain('P-D-A1');
    const three = ids(neighborhood(index, 'P-D', 3));
    expect(three).toEqual(expect.arrayContaining(['P-D-A1', 'P-D-UC01', 'P-D-UC01-FL01', 'P-D-EP01', 'P-D-EN03-TB', 'P-D-INV01-T']));
    expect(three).not.toContain('P-D-UC01-R01');
    // From a use case in a capability: its capability is the parent at every depth; nothing further up.
    for (const depth of [1, 2, 3]) {
      expect(ids(neighborhood(index, 'P-D-UC01', depth)).filter((id) => !id.startsWith('P-D-UC01'))).toEqual(['P-D-CAP01']);
    }
  });

  it('LA-EXP-DS04-T03 LA-V93-R23-T06 The graph\'s tree is the nav\'s: a domain\'s five stages, a folder per kind, the records that start a branch of each stage, and a product\'s own stages and domains', () => {
    const index = testIndex();
    const { stages } = domainFolders(index, 'P-D');
    expect(treeChildren(index, 'P-D')).toEqual([...STAGES, 'P-D/question']);
    expect(groupLabel(index, 'P-D/technical-specification')).toBe(`Technical specification (${stages.find((s) => s.stage === 'technical-specification')!.count})`);
    expect(treeChildren(index, 'P-D/domain-model')).toEqual(stages.find((s) => s.stage === 'domain-model')!.folders.filter((f) => f.count > 0).map((f) => f.key));
    // Use cases holds only capabilities, so it holds them itself: its folder is no level of the tree.
    expect(treeChildren(index, 'P-D/use-cases')).toEqual(['P-D-CAP01']);
    expect(treeParent(index, 'P-D-CAP01')).toBe('P-D/use-cases');
    expect(isGraphNode(index, 'P-D/use-cases/capability')).toBe(false);
    // A capability's children are its use cases; a use case's are its UC requirements, while its flow is listed in
    // Interaction design and its tests in the Test plan.
    expect(treeChildren(index, 'P-D-CAP01')).toEqual(['P-D-UC01']);
    expect(treeChildren(index, 'P-D-UC01')).toEqual(['P-D-UC01-R01', 'P-D-UC01-R02']);
    expect(treeParent(index, 'P-D-UC01-FL01')).toBe('P-D/interaction-design/flow');
    expect(treeParent(index, 'P-D-UC01-FL01-T')).toBe('P-D/test-plan/flow_test');
    // One folder per kind, in the schema's kind order; an endpoint sits in Interaction design, under neither its command nor its query.
    // The view and the integration have no owner, but P-D is the one domain whose steps use them, so they sit in it.
    expect(treeChildren(index, 'P-D/interaction-design')).toEqual(['P-D/interaction-design/flow', 'P-D/interaction-design/view', 'P-D/interaction-design/endpoint', 'P-D/interaction-design/integration']);
    expect(groupLabel(index, 'P-D/interaction-design/flow')).toBe('Flows (1)');
    expect(groupMembers(index, 'P-D/interaction-design/endpoint').map((r) => r.id)).toEqual(['P-D-EP01', 'P-D-EP02']);
    expect(treeChildren(index, 'P-D/technical-specification')).toEqual([
      'P-D/technical-specification/repository', 'P-D/technical-specification/data_model', 'P-D/technical-specification/table',
      'P-D/technical-specification/command_handler', 'P-D/technical-specification/ui_component', 'P-D/technical-specification/endpoint_handler',
      'P-D/technical-specification/adapter',
    ]);
    // An aggregate's own stage folds under it, through a group per kind; a command's policy under the command.
    expect(treeChildren(index, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/invariant', 'P-D-A3/domain_event', 'P-D-A3/command']);
    expect(treeChildren(index, 'P-D-CMD04')).toEqual(['P-D-PO01']);
    // The product: its Shared folder (its own stages: the value object both domains use, the product's interface), then its domains.
    expect(treeChildren(index, 'P')).toEqual(['P/shared', 'P-D', 'P-E']);
    expect(treeChildren(index, 'P/shared')).toEqual(['P/domain-model', 'P/interaction-design', 'P/technical-specification', 'P/test-plan']);
    expect(groupLabel(index, 'P/shared')).toBe('Shared (4)');
    expect(labelLines(index, 'P/shared').meta).toBe('Folder · P');
    expect(labelLines(index, 'P/domain-model').meta).toBe('Stage · P');
    // Shared's Domain model holds only value objects, so it holds them itself.
    expect(treeChildren(index, 'P/domain-model')).toEqual(['P-VO01']);
    expect(treeChildren(index, 'P-VO01')).toEqual(['P-VO01-C01']);
    // Every child's parent is the node that lists it.
    for (const id of ['P', 'P/shared', 'P/domain-model', 'P-D', 'P-D/domain-model', 'P-D/use-cases', 'P-D/test-plan', 'P-D/interaction-design', 'P-D-A3', 'P/technical-specification']) {
      for (const c of treeChildren(index, id)) expect(treeParent(index, c)).toBe(id);
    }
  });

  it('LA-V93-R10-T07 LA-V93-R08-T02 The Links switch beside Depth is off by default, has a tooltip and the shortcut l, draws the center\'s links dashed, and is kept while walking', async () => {
    await showGraph('/P-D-UC01-FL01-S01');
    const links = screen.getByRole('button', { name: 'Links' });
    expect(links).toHaveAttribute('aria-pressed', 'false');
    expect(links).toHaveAttribute('aria-keyshortcuts', 'L');
    expect(drawnLinks()).toEqual([]);
    fireEvent.keyDown(document.body, { key: 'l', code: 'KeyL' });
    await waitFor(() => expect(drawnLinks()).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-pressed', 'true');
    // The tree's own lines are not links.
    expect(drawnLinks().filter((l) => l.style === 'structure')).toEqual([]);
    // Walking on keeps it on: the view's own link from the UI component that renders it is drawn.
    fireEvent.click(node('P-V01')!);
    await waitFor(() => expect(isCenter('P-V01')).toBe(true));
    await waitFor(() => expect(drawnLinks().some((l) => l.source === 'P-UI01' && l.target === 'P-V01')).toBe(true));
    expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-EXP-DS09-T09 LA-EXP-DS10-T03 Every drawn box shows its label, however small on screen, and is a keyboard stop; the summary counts the framed picture', async () => {
    // A use case with sixty requirements: framed from its domain, they are a few pixels tall each.
    const w = testWorkspace();
    for (let i = 3; i <= 60; i++) addRows(w, 'uc_requirement', { id: `P-D-UC01-R${String(i).padStart(2, '0')}`, title: `Rule ${i}`, use_case_id: 'P-D-UC01', statement: `Rule ${i} MUST hold.` });
    await showGraph('/P-D', w, 3);
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(5));
    // Each drawn box draws its kind and ID line and its title, and is a keyboard stop with its name.
    for (const box of scene().boxes) {
      expect(box.lines.some((l) => l.face === 'meta' && l.text !== ''), box.id).toBe(true);
      expect(box.lines.filter((l) => l.face === 'title').map((l) => l.text).join(''), box.id).toBeTruthy();
    }
    for (const el of boxElements()) {
      expect(el.hasAttribute('aria-label'), el.dataset.id).toBe(true);
      expect(el.tabIndex, el.dataset.id).toBe(0);
      expect(el.getAttribute('aria-hidden'), el.dataset.id).toBeNull();
      expect(drawnBox(el.dataset.id!), `${el.dataset.id} is drawn`).toBeDefined();
    }
    // The keyboard visits every drawn box, column by column.
    const boxes: Omit<Box, 'text' | 'parent'>[] = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 20, y: 30, w: 10, h: 10 },
      { id: 'c', x: 20, y: 0, w: 10, h: 10 },
    ];
    expect(keyboardOrder(boxes)).toEqual(['a', 'c', 'b']);
    // The summary counts the framed picture: the domain, its parent and three levels below it.
    const n = neighborhood(indexOf(w), 'P-D', 3);
    await waitFor(() => expect(document.querySelector('.header-strip-counts')!.textContent).toBe(graphSummary(n)));
    expect(graphSummary(n)).toBe('32 records · 26 groups · 57 links');
  });

  it('LA-V93-R20-T01 Filters have a Minimap switch, off by default and kept while walking, and the minimap is an overview of the whole map', async () => {
    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByText('Filters'));
    const minimap = screen.getByRole('switch', { name: 'Minimap' }) as HTMLInputElement;
    expect(minimap.checked).toBe(false);
    expect(screen.queryByRole('switch', { name: /context ring/i })).toBeNull();
    // The trace preset is worded with the relations' labels, never their codes (LA-V92-R07).
    expect(screen.getByRole('button', { name: 'Only fulfills, invokes and happens in links' })).toBeInTheDocument();
    expect(document.querySelector('.graph-minimap')).toBeNull();
    fireEvent.click(minimap);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Minimap' })).toBeInTheDocument());
    // The whole map's upper levels, the focus solid, and the camera's view outlined.
    const overview = screen.getByRole('img', { name: 'Minimap' });
    expect(overview.querySelectorAll('.graph-minimap-node').length).toBeGreaterThan(5);
    expect(overview.querySelector('.graph-minimap-node.is-focus')).not.toBeNull();
    expect(overview.querySelector('.graph-minimap-view')).not.toBeNull();
    // Walking on keeps it.
    fireEvent.click(node('P-D-UC01')!);
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    expect(screen.getByRole('img', { name: 'Minimap' })).toBeInTheDocument();
  });

  it('LA-V93-R19-T01 In the Tree view the plain arrows step through the tree on the canvas: Left out to the parent, Right in to the first child, Up and Down to a sibling, and buttons step too, naming their keys; no page-wide shortcut steps', async () => {
    const index = testIndex();
    expect(stepTarget(index, 'P-D-UC01', 'out')).toBe('P-D-CAP01');
    expect(stepTarget(index, 'P-D-UC01', 'in')).toBe('P-D-UC01-R01');
    expect(stepTarget(index, 'P-D/domain-model/aggregate', 'next')).toBe('P-D/domain-model/specification');
    expect(stepTarget(index, 'P-D-UC01', 'previous')).toBeNull();
    expect(stepTarget(index, 'P-D-UC01', 'next')).toBeNull();
    expect(stepTarget(index, 'P', 'out')).toBeNull();
    expect(stepTarget(index, 'P-D-UC01-R01', 'in')).toBeNull();

    await showGraph('/P-D-UC01');
    const steps = within(screen.getByRole('group', { name: 'Step through the tree' }));
    expect(steps.getByRole('button', { name: 'Step out to the parent' })).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft');
    expect(steps.getByRole('button', { name: 'Step to the next sibling' })).toHaveAttribute('aria-keyshortcuts', 'ArrowDown');
    expect(steps.getByRole('button', { name: 'Step to the previous sibling' })).toBeDisabled();
    // The page-wide Alt shortcuts are gone: from the page, nothing steps.
    fireEvent.keyDown(document.body, { key: 'ArrowDown', code: 'ArrowDown', altKey: true });
    expect(window.location.pathname).toBe('/P-D-UC01');
    fireEvent.keyDown(graphHost()!, { key: 'ArrowRight', code: 'ArrowRight' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-R01'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    fireEvent.keyDown(graphHost()!, { key: 'ArrowLeft', code: 'ArrowLeft' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01'));
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    for (const to of ['/P-D-CAP01', '/P-D/use-cases']) {
      fireEvent.click(within(screen.getByRole('group', { name: 'Step through the tree' })).getByRole('button', { name: 'Step out to the parent' }));
      await waitFor(() => expect(window.location.pathname).toBe(to));
    }
    await waitFor(() => expect(isCenter('P-D/use-cases')).toBe(true));
    fireEvent.keyDown(graphHost()!, { key: 'ArrowUp', code: 'ArrowUp' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/domain-model'));
  });

  // The mapping the Owner decided, written out here rather than read from the keymap: in the Tree view Left out, Right
  // in, Up and Down across; in the Nested and Voronoi views (children drawn inside their parent) Up out, Down in, Left
  // and Right across. From a stage, which has a parent, a first child and a sibling either side.
  const FROM = 'P-D/use-cases';
  const TARGETS = { out: 'P-D', in: 'P-D-CAP01', previous: 'P-D/domain-model', next: 'P-D/interaction-design' };
  const NESTED_KEYS = { ArrowUp: 'out', ArrowDown: 'in', ArrowLeft: 'previous', ArrowRight: 'next' } as const;
  const ARROWS = {
    tree: { ArrowLeft: 'out', ArrowRight: 'in', ArrowUp: 'previous', ArrowDown: 'next' },
    nested: NESTED_KEYS,
    voronoi: NESTED_KEYS,
  } as const;
  /** The domain's last child, where previous from its first stage loops to. */
  const LAST = 'P-D/question';
  const STEP_BUTTONS = { out: 'Step out to the parent', in: 'Step in to the first child', previous: 'Step to the previous sibling', next: 'Step to the next sibling' };
  const MARKS: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };

  const VIEWS = { tree: 'Tree', nested: 'Nested', voronoi: 'Voronoi' } as const;
  for (const layout of ['tree', 'nested', 'voronoi'] as const) {
    it(`LA-V93-R19-T02 In the ${VIEWS[layout]} view each arrow takes its view's step (in Tree, Left out, Right in, Up and Down across; in Nested and Voronoi, Up out, Down in, Left and Right across), the siblings loop, and the buttons, their tooltips and the shortcuts sheet say the same`, async () => {
      startAtDepth(1, layout);
      await openApp(`/${FROM}?stage=graph`, { data: testWorkspace() });
      await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
      expect(graphHost()).toHaveAttribute('data-layout', layout);
      // The step buttons keep their order in every view, each naming the arrow that takes its step here.
      const buttons = within(screen.getByRole('group', { name: 'Step through the tree' })).getAllByRole('button');
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(Object.values(STEP_BUTTONS));
      for (const [key, step] of Object.entries(ARROWS[layout])) {
        const button = screen.getByRole('button', { name: STEP_BUTTONS[step] });
        expect(button, `${layout}: ${step}`).toHaveAttribute('aria-keyshortcuts', key);
        expect(button, `${layout}: ${step}`).toHaveTextContent(MARKS[key]);
      }
      // Each arrow on the canvas steps where the mapping says, then Back returns to the stage.
      for (const [key, step] of Object.entries(ARROWS[layout])) {
        fireEvent.keyDown(graphHost()!, { key, code: key });
        await waitFor(() => expect(window.location.pathname, `${layout}: ${key}`).toBe(`/${TARGETS[step]}`));
        await act(async () => {
          window.history.back();
          await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
        });
        await waitFor(() => expect(window.location.pathname).toBe(`/${FROM}`));
      }
      // The siblings loop: from the first stage, previous goes to the domain's last child, and from there next comes
      // back to the first.
      const [previousKey, nextKey] = (['previous', 'next'] as const).map((step) => Object.entries(ARROWS[layout]).find(([, s]) => s === step)![0]);
      fireEvent.keyDown(graphHost()!, { key: previousKey, code: previousKey });
      await waitFor(() => expect(window.location.pathname).toBe(`/${TARGETS.previous}`));
      fireEvent.keyDown(graphHost()!, { key: previousKey, code: previousKey });
      await waitFor(() => expect(window.location.pathname, `${layout}: ${previousKey} from the first sibling`).toBe(`/${LAST}`));
      fireEvent.keyDown(graphHost()!, { key: nextKey, code: nextKey });
      await waitFor(() => expect(window.location.pathname, `${layout}: ${nextKey} from the last sibling`).toBe(`/${TARGETS.previous}`));
      // The shortcuts sheet lists both mappings on each step's row, whatever the view.
      fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
      const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
      const row = (title: string) => within(sheet).getByRole('rowheader', { name: title }).nextElementSibling;
      expect(row('Step out to the parent')).toHaveTextContent('← in Tree, ↑ in Nested and Voronoi');
      expect(row('Step in to the first child')).toHaveTextContent('→ in Tree, ↓ in Nested and Voronoi');
      expect(row('Step to the previous sibling')).toHaveTextContent('↑ in Tree, ← in Nested and Voronoi');
      expect(row('Step to the next sibling')).toHaveTextContent('↓ in Tree, → in Nested and Voronoi');
    }, 30_000);
  }

  it('LA-V93-R18-T01 LA-V93-R08-T03 With Links on, links draw as curves between their boxes, and the edge hints count the linked records past each edge', async () => {
    // The hints' arithmetic: a box's center past an edge counts for that edge; the plain pan moves half the canvas.
    const view = { x: 0, y: 0, zoom: 1 };
    expect(pastEdges([{ x: -10, y: 50 }, { x: 1200, y: -5 }, { x: 500, y: 900 }, { x: 500, y: 400 }], view, 1000, 800)).toEqual({ up: 1, down: 1, left: 1, right: 1 });
    expect(panToward(view, 'right', 1000, 800)).toEqual({ x: -500, y: 0, zoom: 1 });
    expect(panToward(view, 'up', 1000, 800)).toEqual({ x: 0, y: 400, zoom: 1 });

    await showGraph('/P-D-UC01-FL01-S01');
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    // Every linked record is drawn, wherever it is in the map, and each link is a curve to it.
    await waitFor(() => expect(drawnLinks()).toHaveLength(3));
    for (const id of ['P-V01', 'P-D-CMD01', 'P-D-UC01-R01']) expect(node(id)).not.toBeNull();
    // Each link joins the focus's box to a linked record's, drawn as a curve (paint.ts); the tree's parent lines stay straight and level.
    for (const l of drawnLinks()) expect([l.source, l.target]).toContain('P-D-UC01-FL01-S01');
    expect(parentLines().length).toBeGreaterThan(0);
    for (const l of parentLines()) expect(l.points[0][1]).toBe(l.points[1][1]);
  });

  it('LA-V93-R17-T01 Hovering or focusing a box spotlights it, its lines and the boxes it joins, and leaving restores the picture', async () => {
    await showGraph('/P-D-UC01-FL01-S01');
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-V01')).not.toBeNull());
    const flow = graphHost()!;
    node('P-V01')!.focus();
    await waitFor(() => expect(flow.className).toContain('has-spotlight'));
    expect(drawnBox('P-V01')!.lit).toBe(true);
    expect(drawnBox('P-D-UC01-FL01-S01')!.lit).toBe(true);
    expect(drawnBox('P-D-UC01-FL01')!.lit).toBe(false);
    expect(scene().lines.find((l) => l.source === 'P-D-UC01-FL01-S01' && l.target === 'P-V01')!.lit).toBe(true);
    fireEvent.blur(node('P-V01')!);
    expect(flow.className).not.toContain('has-spotlight');
    expect(scene().spotlight).toBe(false);
    expect(scene().boxes.every((b) => b.lit === null)).toBe(true);
  });
});
