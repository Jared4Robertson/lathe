import { recordIndexOf } from '../read-view';
import type { ServedData } from '../read-view';
import './setup';
import { addRows } from '../fixtures/load';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { graphSummary, keyboardOrder, type Box } from '../../src/graph/GraphPage';
import { graphLevels, graphTarget } from '../../src/graph/steps';
import { groupLabel, groupMembers, isGraphNode, neighborhood, type Neighborhood } from '../../src/graph/model';
import { treeChildren, treeParent } from '../../src/graph/tree';
import { labelLines } from '../../src/graph/text';
import { domainFolders } from '../../src/exploring/folder-tree/folders';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElement, boxElements, drawnBox, graphHost, isCenter, scene } from './scene';

// The graph's tree is the nav's tree, depth counts its levels below the focus, and the picture is
// one map seen through a camera: what is too small to read is drawn plain and kept out of focus.

const ids = (n: Neighborhood) => n.nodes.map((x) => x.id).sort();
const node = (id: string) => boxElement(id);
const STAGES = ['P-D/domain-model', 'P-D/use-cases', 'P-D/interaction-design', 'P-D/technical-specification', 'P-D/test-plan'];

async function showGraph(path: string, workspace: ServedData = testWorkspace(), depth = 1) {
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
      'P-D/technical-specification/rule', 'P-D/technical-specification/command_handler', 'P-D/technical-specification/ui_component', 'P-D/technical-specification/endpoint_handler',
      'P-D/technical-specification/adapter',
    ]);
    // An aggregate's own stage folds under it, through a group per kind; an entity's commands under the entity, and a
    // command's policy under the command.
    expect(treeChildren(index, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/invariant', 'P-D-A3/domain_event']);
    expect(treeChildren(index, 'P-D-EN03')).toEqual(['P-D-CMD01', 'P-D-CMD02']);
    expect(treeParent(index, 'P-D-CMD01')).toBe('P-D-EN03');
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
    const n = neighborhood(recordIndexOf(w), 'P-D', 3);
    await waitFor(() => expect(document.querySelector('.header-strip-counts')!.textContent).toBe(graphSummary(n)));
    expect(graphSummary(n)).toBe('33 records · 27 groups · 59 links');
  });

  it('LA-V93-R20-T01 Filters have a Minimap switch, off by default and kept while walking, and the minimap is an overview of the whole map', async () => {
    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByText('Filters'));
    const minimap = screen.getByRole('switch', { name: 'Minimap' }) as HTMLInputElement;
    expect(minimap.checked).toBe(false);
    expect(screen.queryByRole('switch', { name: /context ring/i })).toBeNull();
    // The filters are the kinds' alone: no relation and no preset.
    expect(screen.queryByRole('group', { name: 'Relations' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Only / })).toBeNull();
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

  it('LA-V93-R19-T01 In the Tree view the plain arrow keys step through the tree from the page, and buttons step too, naming their keys', async () => {
    const index = testIndex();
    expect(graphTarget(index, 'P-D-UC01', 'tree', 'left')).toBe('P-D-CAP01');
    expect(graphTarget(index, 'P-D-UC01', 'tree', 'out')).toBe('P-D-CAP01');
    expect(graphTarget(index, 'P-D-UC01', 'tree', 'right')).toBe('P-D-UC01-R01');
    expect(graphTarget(index, 'P-D-UC01', 'tree', 'in')).toBe('P-D-UC01-R01');
    expect(graphTarget(index, 'P-D/domain-model/aggregate', 'tree', 'down')).toBe('P-D/domain-model/specification');
    expect(graphTarget(index, 'P', 'tree', 'out')).toBeNull();
    expect(graphTarget(index, 'P-D-UC01-R01', 'tree', 'in')).toBeNull();
    // An only child goes on, across the level, to the neighboring parents' children: never to itself.
    const levels = graphLevels(index, 'P');
    const depth = (id: string) => { let n = 0; for (let at = levels.parent(id); at !== null; at = levels.parent(at)) n++; return n; };
    for (const move of ['up', 'down'] as const) {
      const to = graphTarget(index, 'P-D-UC01', 'tree', move);
      if (to === null) continue;
      expect(to).not.toBe('P-D-UC01');
      expect(levels.parent(to)).not.toBe('P-D-CAP01');
      expect(depth(to)).toBe(depth('P-D-UC01'));
    }

    await showGraph('/P-D-UC01');
    const steps = within(screen.getByRole('group', { name: 'Walk the stage' }));
    expect(steps.getByRole('button', { name: 'Step out to the parent' })).toHaveAttribute('aria-keyshortcuts', 'ArrowLeft A');
    expect(steps.getByRole('button', { name: 'Step to the next sibling' })).toHaveAttribute('aria-keyshortcuts', 'ArrowDown S');
    expect(steps.getByRole('button', { name: 'Out to the parent' })).toHaveAttribute('aria-keyshortcuts', 'Shift+ArrowUp Shift+W');
    expect(steps.getByRole('button', { name: 'In to the first child' })).toHaveAttribute('aria-keyshortcuts', 'Shift+ArrowDown Shift+S');
    // With a modifier held, nothing steps.
    fireEvent.keyDown(document.body, { key: 'ArrowDown', code: 'ArrowDown', altKey: true });
    expect(window.location.pathname).toBe('/P-D-UC01');
    fireEvent.keyDown(graphHost()!, { key: 'ArrowRight', code: 'ArrowRight' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-R01'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    // From the page, without the graph having keyboard focus (LA-V61-R49).
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', code: 'ArrowLeft' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01'));
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    for (const to of ['/P-D-CAP01', '/P-D/use-cases']) {
      fireEvent.click(within(screen.getByRole('group', { name: 'Walk the stage' })).getByRole('button', { name: 'Step out to the parent' }));
      await waitFor(() => expect(window.location.pathname).toBe(to));
    }
    await waitFor(() => expect(isCenter('P-D/use-cases')).toBe(true));
    fireEvent.keyDown(graphHost()!, { key: 'ArrowUp', code: 'ArrowUp' });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/domain-model'));
  });

  // The mapping the Owner decided, written out here rather than read from the keymap: in the Tree view Left out, Right
  // in, Up and Down across; in the Nested view (children drawn inside their parent) Up out, Down in, Left and Right
  // across. From a stage, which has a parent, a first child and a sibling either side.
  const FROM = 'P-D/use-cases';
  const TARGETS = { out: 'P-D', in: 'P-D-CAP01', previous: 'P-D/domain-model', next: 'P-D/interaction-design' };
  const NESTED_KEYS = { ArrowUp: 'out', ArrowDown: 'in', ArrowLeft: 'previous', ArrowRight: 'next' } as const;
  const ARROWS = {
    tree: { ArrowLeft: 'out', ArrowRight: 'in', ArrowUp: 'previous', ArrowDown: 'next' },
    nested: NESTED_KEYS } as const;
  const STEP_BUTTONS = { out: 'Step out to the parent', in: 'Step in to the first child', previous: 'Step to the previous sibling', next: 'Step to the next sibling' };
  const MARKS: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
  const MOVE_OF = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const;
  // Each arrow's walking letter, which the step's keys name after it.
  const LETTERS: Record<string, string> = { ArrowLeft: 'A', ArrowRight: 'D', ArrowUp: 'W', ArrowDown: 'S' };

  const VIEWS = { tree: 'Tree', nested: 'Nested' } as const;
  for (const layout of ['tree', 'nested'] as const) {
    it(`LA-V93-R19-T02 In the ${VIEWS[layout]} view each arrow takes its view's step (in Tree, Left out, Right in, Up and Down across; in Nested, Up out, Down in, Left and Right across), across goes on past the first sibling, and the buttons, their tooltips and the shortcuts sheet say the same`, async () => {
      startAtDepth(1, layout);
      await openApp(`/${FROM}?stage=graph`, { data: testWorkspace() });
      await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
      expect(graphHost()).toHaveAttribute('data-layout', layout);
      // The step buttons keep their order in every view (Left, Right, Up, Down, Out, In), each named by the step its arrow
      // takes here and showing its arrow and letter.
      const buttons = within(screen.getByRole('group', { name: 'Walk the stage' })).getAllByRole('button');
      const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([...arrows.map((k) => STEP_BUTTONS[ARROWS[layout][k]]), 'Out to the parent', 'In to the first child']);
      arrows.forEach((key, i) => {
        expect(buttons[i], `${layout}: ${key}`).toHaveAttribute('aria-keyshortcuts', `${key} ${LETTERS[key]}`);
        expect(buttons[i], `${layout}: ${key}`).toHaveTextContent(`${MARKS[key]}${LETTERS[key]}`);
      });
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
      // Across never loops: from the first stage, previous goes on to the previous parent's last child at that level
      // (another domain's, or the product's own), and next from there comes back.
      const [previousKey, nextKey] = (['previous', 'next'] as const).map((step) => Object.entries(ARROWS[layout]).find(([, s]) => s === step)![0] as keyof typeof MOVE_OF);
      fireEvent.keyDown(graphHost()!, { key: previousKey, code: previousKey });
      await waitFor(() => expect(window.location.pathname).toBe(`/${TARGETS.previous}`));
      const before = graphTarget(testIndex(), TARGETS.previous, layout, MOVE_OF[previousKey]);
      if (before) {
        expect(treeParent(testIndex(), before), `${layout}: ${previousKey} from the first sibling`).not.toBe('P-D');
        fireEvent.keyDown(graphHost()!, { key: previousKey, code: previousKey });
        await waitFor(() => expect(window.location.pathname, `${layout}: ${previousKey} from the first sibling`).toBe(`/${before}`));
        fireEvent.keyDown(graphHost()!, { key: nextKey, code: nextKey });
        await waitFor(() => expect(window.location.pathname, `${layout}: ${nextKey} back`).toBe(`/${TARGETS.previous}`));
      }
      // The shortcuts sheet lists each move with its arrow and letter, whatever the view.
      fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
      const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
      const row = (title: string) => within(sheet).getByRole('rowheader', { name: title }).nextElementSibling;
      expect(row('Step left')).toHaveTextContent('← or a');
      expect(row('Step down')).toHaveTextContent('↓ or s');
      expect(row('Out to the container')).toHaveTextContent(/(Shift\+|⇧)↑ or (Shift\+|⇧)w/i);
      expect(row('In to the first node inside')).toHaveTextContent(/(Shift\+|⇧)↓ or (Shift\+|⇧)s/i);
    }, 30_000);
  }

  it('LA-V93-R17-T01 Hovering or focusing a box spotlights it, its lines and the boxes it joins, and leaving restores the picture', async () => {
    await showGraph('/P-D-UC01-FL01');
    await waitFor(() => expect(node('P-D-UC01-FL01-S02')).not.toBeNull());
    const flow = graphHost()!;
    node('P-D-UC01-FL01-S01')!.focus();
    await waitFor(() => expect(flow.className).toContain('has-spotlight'));
    expect(drawnBox('P-D-UC01-FL01-S01')!.lit).toBe(true);
    expect(drawnBox('P-D-UC01-FL01')!.lit).toBe(true);
    expect(drawnBox('P-D-UC01-FL01-S02')!.lit).toBe(false);
    expect(scene().lines.find((l) => l.source === 'P-D-UC01-FL01' && l.target === 'P-D-UC01-FL01-S01')!.lit).toBe(true);
    expect(scene().lines.find((l) => l.source === 'P-D-UC01-FL01' && l.target === 'P-D-UC01-FL01-S02')!.lit).toBe(false);
    fireEvent.blur(node('P-D-UC01-FL01-S01')!);
    expect(flow.className).not.toContain('has-spotlight');
    expect(scene().spotlight).toBe(false);
    expect(scene().boxes.every((b) => b.lit === null)).toBe(true);
  });
});
