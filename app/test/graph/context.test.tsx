import './setup';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Workspace } from '../../../lathe/src/types';
import { focusPositions, graphSummary, keyboardOrder, shortTitle, stepTarget } from '../../src/graph/GraphPage';
import { panToward, pastEdges } from '../../src/graph/hints';
import { layoutNeighborhood, NODE_WIDTH } from '../../src/graph/layout';
import { CONTEXT_BUDGET, CONTEXT_PER_PARENT, groupLabel, groupMembers, isGraphNode, MORE_KIND, moreId, neighborhood, type Neighborhood } from '../../src/graph/model';
import { splitsByKind, treeChildren, treeParent } from '../../src/graph/tree';
import { frameFocus } from '../../src/graph/camera';
import { aggregateErd, domainErd } from '../../src/model/erd';
import { focusRects } from '../../src/model/ModelView';
import { indexWorkspace } from '../../src/specs/data';
import { domainFolders } from '../../src/specs/folders';
import { entityWorkspace } from '../fixtures/entities';
import { layerWorkspace } from '../fixtures/layers';
import { openApp, startAtDepth } from '../helpers';
import { manyOfOneKindWorkspace, testIndex, testWorkspace } from './workspace';

// The graph's tree is the nav's tree, depth counts its levels, and around the picture sits the
// context ring: the next level out, faded and out of focus (brief 56).

const focusOf = (n: Neighborhood) => n.nodes.filter((x) => !x.context).map((x) => x.id).sort();
const contextOf = (n: Neighborhood) => n.nodes.filter((x) => x.context).map((x) => x.id).sort();
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const isCenter = (id: string) => !!node(id)?.querySelector('.graph-node.is-focus');

/** A use case folder with eight use cases of seven requirements each: more context than one picture should hold. */
function crowdedWorkspace(): Workspace {
  const w = testWorkspace();
  const base = w.records.find((r) => r.id === 'P-D-UC01')!;
  const req = w.records.find((r) => r.id === 'P-D-UC01-R01')!;
  for (let u = 2; u <= 9; u++) {
    w.records.push({ ...base, id: `P-D-UC0${u}`, title: `Use case ${u}`, path: `specs/P-D-UC0${u}.md` });
    for (let r = 1; r <= 7; r++) w.records.push({ ...req, id: `P-D-UC0${u}-R0${r}`, title: `Rule ${u}.${r}`, parent: `P-D-UC0${u}`, path: `specs/P-D-UC0${u}-R0${r}.md` });
  }
  return w;
}

async function showGraph(path: string, workspace: Workspace = testWorkspace()) {
  startAtDepth(1);
  await openApp(`${path}?view=graph`, { workspace });
  await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
}

describe('the graph tree and its context ring', () => {
  it('LA-BRW-T540 The model draws the context ring at each depth: the tree\'s next level out each way, marked as context, the same every time', () => {
    const index = testIndex();
    for (const [depth, focus, context] of [
      [1, ['P-D-UC01', 'P-D-UC01-R01', 'P-D/define/use-cases'], ['P-D/define']],
      [2, ['P-D-UC01', 'P-D-UC01-R01', 'P-D/define', 'P-D/define/use-cases'], ['P-D']],
      [3, ['P-D', 'P-D-UC01', 'P-D-UC01-R01', 'P-D/define', 'P-D/define/use-cases'], ['P']],
    ] as const) {
      const n = neighborhood(index, 'P-D-UC01', depth);
      expect(focusOf(n)).toEqual([...focus]);
      expect(contextOf(n)).toEqual([...context]);
      // The ring sits at depth + 1, and every edge to it is marked as context too.
      for (const x of n.nodes.filter((y) => y.context)) expect(x.distance).toBe(depth + 1);
      for (const e of n.edges) expect(e.context === true).toBe(n.nodes.some((x) => x.context && (x.id === e.source || x.id === e.target)));
      expect(n).toEqual(neighborhood(index, 'P-D-UC01', depth));
    }
    // Below as well as above: from the domain at depth 1, its stages' folders and its question are the ring.
    expect(contextOf(neighborhood(index, 'P-D', 1))).toEqual(['P-D-Q01', 'P-D/define/domain-model', 'P-D/define/use-cases', 'P-D/design/interaction-design', 'P-D/design/technical-specification', 'P-D/design/test-plan']);
    // With Links on, the linked records join the focus but bring no ring of their own.
    const links = neighborhood(index, 'P-D-UC01-R01', 1, undefined, undefined, { links: true });
    expect(contextOf(links)).toEqual(['P-D/define/use-cases']);
    // Switched off, the picture is the tree alone.
    expect(contextOf(neighborhood(index, 'P-D-UC01', 2, undefined, undefined, { context: false }))).toEqual([]);
  });

  it('LA-BRW-T541 A group at the center has its ring too: one level out above its parent and below its members', () => {
    const index = testIndex();
    const one = neighborhood(index, 'P-D/design', 1);
    expect(focusOf(one)).toEqual(['P-D', 'P-D/design', 'P-D/design/interaction-design', 'P-D/design/technical-specification', 'P-D/design/test-plan']);
    expect(contextOf(one)).toEqual(['P', 'P-D-C01', 'P-D-C02', 'P-D/design/interaction-design/endpoint', 'P-D/design/interaction-design/view', 'P-D/design/test-plan/acceptance/P-D-UC01']);
    const two = neighborhood(index, 'P-D/design', 2);
    expect(focusOf(two)).toEqual(expect.arrayContaining(['P', 'P-D-C01', 'P-D/design/interaction-design/view']));
    expect(contextOf(two)).toEqual(['P-D-E01', 'P-D-T01', 'P-D-V01']);
  });

  it('LA-BRW-T542 A light ring: a parent shows at most six context children and a chip for the rest that leads to their group or parent, and the ring holds at most forty', () => {
    const index = indexWorkspace(manyOfOneKindWorkspace());
    const n = neighborhood(index, 'P-D/define/use-cases', 1);
    const shown = n.nodes.filter((x) => x.context && x.id.startsWith('P-D-UC02-'));
    expect(shown.map((x) => x.id)).toEqual(['P-D-UC02-R01', 'P-D-UC02-R02', 'P-D-UC02-R03', 'P-D-UC02-R04', 'P-D-UC02-R05', 'P-D-UC02-R06']);
    expect(CONTEXT_PER_PARENT).toBe(6);
    const chip = n.nodes.find((x) => x.id === moreId('P-D-UC02'))!;
    expect(chip).toMatchObject({ kind: MORE_KIND, title: '+1 more UC requirement', context: true, more: { parent: 'P-D-UC02', count: 1, target: 'P-D-UC02' } });
    expect(isGraphNode(index, chip.more!.target)).toBe(true);
    // The chip sits after the shown children, joined to their parent.
    const rows = new Map(n.nodes.map((x) => [x.id, x.row]));
    expect(rows.get(chip.id)!).toBeGreaterThan(rows.get('P-D-UC02-R06')!);
    expect(n.edges.map((e) => e.id)).toContain(`P-D-UC02|parent|${chip.id}`);
    // A crowded folder: at most forty context nodes in all, chips included; each parent that does not fit keeps one place for its chip.
    const crowded = neighborhood(indexWorkspace(crowdedWorkspace()), 'P-D/define/use-cases', 1);
    expect(crowded.nodes.filter((x) => x.context)).toHaveLength(CONTEXT_BUDGET);
    const chips = crowded.nodes.filter((x) => x.more);
    expect(chips.at(-1)).toMatchObject({ id: moreId('P-D-UC07'), title: '+5 more UC requirements' });
    // Past the budget nothing more is drawn: the use cases' folded state and the edge hints say there is more.
    expect(crowded.nodes.some((x) => x.id.startsWith('P-D-UC08-') || x.id === moreId('P-D-UC09'))).toBe(false);
  });

  it('LA-BRW-T543 Depth counts levels from a domain and from a use case, as a file explorer does', () => {
    const index = indexWorkspace(layerWorkspace());
    // From the domain: depth 1 its stages, depth 2 their folders, depth 3 what is in them.
    expect(focusOf(neighborhood(index, 'DM-SHOP', 1))).toEqual(expect.arrayContaining(['DM-SHOP/define', 'DM-SHOP/design']));
    expect(focusOf(neighborhood(index, 'DM-SHOP', 1)).some((id) => id.split('/').length > 2)).toBe(false);
    const two = neighborhood(index, 'DM-SHOP', 2);
    expect(focusOf(two)).toEqual(expect.arrayContaining(['DM-SHOP/define/domain-model', 'DM-SHOP/define/use-cases', 'DM-SHOP/design/technical-specification', 'DM-SHOP/design/test-plan']));
    expect(contextOf(two)).toEqual(expect.arrayContaining(['DM-SHOP-A1', 'DM-SHOP-CAP02', 'DM-SHOP-LAY02']));
    const three = neighborhood(index, 'DM-SHOP', 3);
    expect(focusOf(three)).toEqual(expect.arrayContaining(['DM-SHOP-A1', 'DM-SHOP-CAP01', 'DM-SHOP-CAP02', 'DM-SHOP-UC01', 'DM-SHOP-LAY01', 'DM-SHOP-LAY02', 'DM-SHOP-LAY03', 'DM-SHOP-C01']));
    expect(contextOf(three)).toEqual(expect.arrayContaining(['DM-SHOP-UC02', 'DM-SHOP-C02', 'DM-SHOP-F01']));
    // From a use case in a capability: depth 1 its capability, depth 2 the Capabilities folder, depth 3 Define.
    const up = (depth: number) => focusOf(neighborhood(index, 'DM-SHOP-UC02', depth)).filter((id) => !id.startsWith('DM-SHOP-UC02'));
    expect(up(1)).toEqual(['DM-SHOP-CAP01']);
    expect(up(2)).toEqual(['DM-SHOP-CAP01', 'DM-SHOP/define/use-cases']);
    expect(up(3)).toEqual(['DM-SHOP-CAP01', 'DM-SHOP/define', 'DM-SHOP/define/use-cases']);
    expect(contextOf(neighborhood(index, 'DM-SHOP-UC02', 3))).toEqual(['DM-SHOP']);
  });

  it('LA-BRW-T544 The graph\'s tree is the nav\'s: a domain\'s stages, their folders and records, the one-kind rule, and a product\'s Shared folder and domains', () => {
    const index = indexWorkspace(layerWorkspace());
    const { stages } = domainFolders(index, 'DM-SHOP');
    expect(treeChildren(index, 'DM-SHOP').slice(0, 2)).toEqual(['DM-SHOP/define', 'DM-SHOP/design']);
    expect(groupLabel(index, 'DM-SHOP/design')).toBe(`Design (${stages.find((s) => s.stage === 'design')!.count})`);
    expect(treeChildren(index, 'DM-SHOP/define')).toEqual(['DM-SHOP/define/domain-model', 'DM-SHOP/define/use-cases']);
    // Capabilities: the capabilities in their order, then the use cases outside any, one list (no split).
    expect(treeChildren(index, 'DM-SHOP/define/use-cases')).toEqual(['DM-SHOP-CAP02', 'DM-SHOP-CAP01', 'DM-SHOP-UC01']);
    expect(groupLabel(index, 'DM-SHOP/define/use-cases')).toBe('Capabilities (3)');
    // A capability's children are its use cases; its test is listed in the Test plan.
    expect(treeChildren(index, 'DM-SHOP-CAP01')).toEqual(['DM-SHOP-UC02']);
    expect(treeParent(index, 'DM-SHOP-T09')).toBe('DM-SHOP/design/test-plan/acceptance/DM-SHOP-CAP01');
    // Interaction design mixes kinds, so it splits into one group per kind; Technical specification lists layers, then components outside any.
    expect(treeChildren(index, 'DM-SHOP/design/interaction-design')).toEqual(['DM-SHOP/design/interaction-design/flow', 'DM-SHOP/design/interaction-design/view', 'DM-SHOP/design/interaction-design/endpoint']);
    expect(groupLabel(index, 'DM-SHOP/design/interaction-design/flow')).toBe('Flows (1)');
    expect(groupMembers(index, 'DM-SHOP/design/interaction-design/view').map((r) => r.id)).toEqual(['DM-SHOP-V01']);
    expect(treeChildren(index, 'DM-SHOP/design/technical-specification')).toEqual(['DM-SHOP-LAY02', 'DM-SHOP-LAY03', 'DM-SHOP-LAY01', 'DM-SHOP-C01']);
    expect(splitsByKind(index, ['flow', 'view', 'endpoint'])).toBe(true);
    expect(splitsByKind(index, ['capability', 'use_case'])).toBe(false);
    expect(splitsByKind(index, ['layer', 'component'])).toBe(false);
    expect(splitsByKind(index, ['test'])).toBe(false);
    // The product: its Shared folder, then its domains.
    const product = treeChildren(index, 'DM');
    expect(product[0]).toBe('DM/shared');
    expect(product.indexOf('DM-SHOP')).toBeGreaterThan(0);
    expect(treeChildren(index, 'DM/shared')).toEqual(['DM-PAT-SAVE']);
    // Every child's parent is the node that lists it.
    for (const id of ['DM', 'DM-SHOP', 'DM-SHOP/define', 'DM-SHOP/design', 'DM-SHOP/design/test-plan', 'DM-SHOP/design/interaction-design']) {
      for (const c of treeChildren(index, id)) expect(treeParent(index, c)).toBe(id);
    }
  });

  it('LA-BRW-T545 The Links switch beside Depth is off by default, has a tooltip and the shortcut l, draws the center\'s links dashed, and is kept while walking', async () => {
    await showGraph('/P-D-UC01-R01');
    const links = screen.getByRole('button', { name: 'Links' });
    expect(links).toHaveAttribute('aria-pressed', 'false');
    expect(links).toHaveAttribute('aria-keyshortcuts', 'L');
    expect(node('P-D-V01')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'l', code: 'KeyL' });
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelectorAll('.react-flow__edge-path.is-link')).toHaveLength(3);
    // The tree's own lines are not links.
    expect(document.querySelector('.react-flow__edge-path.rel-structure.is-link')).toBeNull();
    // Walking on keeps it on: the view's own link to its endpoint is drawn.
    fireEvent.click(node('P-D-V01')!);
    await waitFor(() => expect(isCenter('P-D-V01')).toBe(true));
    await waitFor(() => expect(node('P-D-E01')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-BRW-T546 Context nodes are out of focus: faded, hidden from assistive technology, skipped by the keyboard, left out of the summary and the side bar', async () => {
    await showGraph('/P-D-UC01-R01');
    await waitFor(() => expect(node('P-D/define/use-cases')).not.toBeNull());
    const ring = node('P-D/define/use-cases')!;
    expect(ring.className).toContain('is-context');
    expect(ring.getAttribute('aria-hidden')).toBe('true');
    expect(ring.hasAttribute('aria-label')).toBe(false);
    expect(ring.getAttribute('tabindex')).not.toBe('0');
    // Its label is quiet: the kind and a short title; the full name and ID are in its tooltip.
    expect(ring.querySelector('.graph-node')!.getAttribute('title')).toContain('Capabilities');
    expect(shortTitle('A short one')).toBe('A short one');
    expect(shortTitle('Depth 1 shows a record\'s parent and children; depth 2 and 3 add its neighbors')).toBe('Depth 1 shows a record\'s…');
    // The arrow keys visit the focus nodes only.
    const center = node('P-D-UC01-R01')!;
    center.focus();
    const visited = new Set<string>();
    for (let i = 0; i < 4; i++) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      visited.add((document.activeElement as HTMLElement).dataset.id!);
    }
    expect([...visited].sort()).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    // The summary counts the focus picture, then how many more are faded; the side bar lists the focus only.
    expect(document.querySelector('.graph-count')!.textContent).toBe('2 records · 1 link · 1 more faded');
    const near = within(screen.getByRole('complementary', { name: 'Side bar' })).getByRole('heading', { name: /Connected in the graph/ });
    expect(near.textContent).toMatch(/^Connected in the graph ?1$/);
  });

  it('LA-BRW-T547 The camera frames the focus nodes only, so the context ring may run past the canvas, and Fit does too', async () => {
    const index = indexWorkspace(crowdedWorkspace());
    const n = neighborhood(index, 'P-D/define/use-cases', 1);
    const { positions, heights } = layoutNeighborhood(n);
    const inFocus = focusPositions(n, positions);
    expect([...inFocus.keys()].sort()).toEqual(focusOf(n));
    // Framing the focus picture never zooms out further than framing everything would.
    const framed = frameFocus(inFocus, n.focus, 1000, 800, 40, 0.1, heights);
    const all = frameFocus(positions, n.focus, 1000, 800, 40, 0.1, heights);
    expect(framed.zoom).toBeGreaterThanOrEqual(all.zoom);
    // Some of the ring lies past the canvas's edges in the framed view of a tall, narrow canvas: the
    // icicle's parents span the ring above and below, so it runs past to the right.
    const centers = n.nodes.filter((x) => x.context).map((x) => ({ x: positions.get(x.id)!.x + NODE_WIDTH / 2, y: positions.get(x.id)!.y + heights.get(x.id)! / 2 }));
    const past = pastEdges(centers, frameFocus(inFocus, n.focus, 600, 4000, 40, 0.1, heights), 600, 4000);
    expect(past.up + past.down + past.left + past.right).toBeGreaterThan(0);
    // Keyboard order is the focus picture.
    expect(keyboardOrder(n, { positions }).sort()).toEqual(focusOf(n));
    expect(graphSummary(n)).toMatch(/^9 records · 2 groups · \d+ links · \d+ more faded$/);
  });

  it('LA-BRW-T548 Filters have a Show context ring switch, on by default, and a Minimap switch, off by default; both are kept while walking', async () => {
    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByText('Filters'));
    const ring = screen.getByRole('switch', { name: 'Show context ring' }) as HTMLInputElement;
    const minimap = screen.getByRole('switch', { name: 'Minimap' }) as HTMLInputElement;
    expect(ring.checked).toBe(true);
    expect(minimap.checked).toBe(false);
    // The trace preset is worded with the relations' labels, never their codes (LA-BRW-DR243).
    expect(screen.getByRole('button', { name: 'Only satisfies, proves and carries out links' })).toBeInTheDocument();
    expect(document.querySelector('.react-flow__minimap')).toBeNull();
    await waitFor(() => expect(document.querySelector('.react-flow__node.is-context')).not.toBeNull());
    fireEvent.click(ring);
    await waitFor(() => expect(document.querySelector('.react-flow__node.is-context:not(.is-leaving)')).toBeNull());
    expect(document.querySelector('.graph-count')!.textContent).toBe('2 records · 1 link');
    fireEvent.click(minimap);
    await waitFor(() => expect(document.querySelector('.react-flow__minimap')).not.toBeNull());
    // Walking on keeps both.
    fireEvent.click(node('P-D-UC01')!);
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    expect(document.querySelector('.react-flow__minimap')).not.toBeNull();
    await waitFor(() => expect(document.querySelector('.react-flow__node.is-context:not(.is-leaving)')).toBeNull());
  });

  it('LA-BRW-T549 Alt+Up steps out to the parent, Alt+Down in to the first child, Alt+Shift+Left and Right to a sibling, from the keyboard and from buttons with their keys', async () => {
    const index = testIndex();
    expect(stepTarget(index, 'P-D-UC01', 'out')).toBe('P-D/define/use-cases');
    expect(stepTarget(index, 'P-D-UC01', 'in')).toBe('P-D-UC01-R01');
    expect(stepTarget(index, 'P-D/define/domain-model', 'next')).toBe('P-D/define/use-cases');
    expect(stepTarget(index, 'P-D/define/domain-model', 'previous')).toBeNull();
    expect(stepTarget(index, 'P', 'out')).toBeNull();
    expect(stepTarget(index, 'P-D-UC01-R01', 'in')).toBeNull();

    await showGraph('/P-D-UC01');
    const steps = within(screen.getByRole('group', { name: 'Step through the tree' }));
    expect(steps.getByRole('button', { name: 'Step out to the parent' })).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowUp');
    expect(steps.getByRole('button', { name: 'Step to the next sibling' })).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+ArrowRight');
    expect(steps.getByRole('button', { name: 'Step to the previous sibling' })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: 'ArrowDown', code: 'ArrowDown', altKey: true });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01-R01'));
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    fireEvent.keyDown(document.body, { key: 'ArrowUp', code: 'ArrowUp', altKey: true });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC01'));
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    fireEvent.click(within(screen.getByRole('group', { name: 'Step through the tree' })).getByRole('button', { name: 'Step out to the parent' }));
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/define/use-cases'));
    await waitFor(() => expect(node('P-D/define/use-cases')?.querySelector('.is-focus')).toBeTruthy());
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true, shiftKey: true });
    await waitFor(() => expect(window.location.pathname).toBe('/P-D/define/domain-model'));
  });

  it('LA-BRW-T550 A chip of the light ring leads to the group or parent of the children it counts, and the edge hints count the ring past each edge and pan that way', async () => {
    // The hints' arithmetic: a box's center past an edge counts for that edge, and a pan moves half the canvas.
    const view = { x: 0, y: 0, zoom: 1 };
    expect(pastEdges([{ x: -10, y: 50 }, { x: 1200, y: -5 }, { x: 500, y: 900 }, { x: 500, y: 400 }], view, 1000, 800)).toEqual({ up: 1, down: 1, left: 1, right: 1 });
    expect(panToward(view, 'right', 1000, 800)).toEqual({ x: -500, y: 0, zoom: 1 });
    expect(panToward(view, 'up', 1000, 800)).toEqual({ x: 0, y: 400, zoom: 1 });

    await showGraph('/P-D/define/use-cases', manyOfOneKindWorkspace());
    await waitFor(() => expect(node(moreId('P-D-UC02'))).not.toBeNull());
    const chip = node(moreId('P-D-UC02'))!;
    expect(chip.textContent).toBe('+1 more UC requirement');
    expect(chip.className).toContain('is-context');
    expect(chip.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(chip);
    await waitFor(() => expect(window.location.pathname).toBe('/P-D-UC02'));
  });

  it('LA-BRW-T551 Hovering or focusing a focus node spotlights it, its lines and the nodes it joins, and leaving restores the picture', async () => {
    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    const flow = document.querySelector<HTMLElement>('.graph-flow')!;
    node('P-D-V01')!.focus();
    await waitFor(() => expect(flow.className).toContain('has-spotlight'));
    expect(node('P-D-V01')!.className).toContain('is-lit');
    expect(node('P-D-UC01-R01')!.className).toContain('is-lit');
    expect(node('P-D-UC01')!.className).not.toContain('is-lit');
    expect(document.querySelector('.graph-edge-motion.is-lit[data-source="P-D-V01"][data-target="P-D-UC01-R01"]')).not.toBeNull();
    fireEvent.blur(node('P-D-V01')!);
    expect(flow.className).not.toContain('has-spotlight');
    expect(document.querySelector('.is-lit')).toBeNull();
    // A context node gives no spotlight.
    fireEvent.mouseEnter(node('P-D/define/use-cases')!);
    expect(flow.className).not.toContain('has-spotlight');
  });
});

describe('the context ring in the Model view', () => {
  const index = () => indexWorkspace(entityWorkspace());

  it('LA-BRW-T552 An aggregate\'s ERD shows what its referenced entities refer to one ring out, faded; a domain\'s ERD fades the aggregates of other domains', () => {
    const loan = aggregateErd(index(), 'P-D-A3');
    const box = (id: string) => loan.boxes.find((b) => b.id === id);
    // Its own entities and those they refer to are in focus; Member's Account, in another domain, is the ring.
    for (const id of ['P-D-EN03', 'P-D-EN04', 'P-D-EN05', 'P-D-EN01', 'P-D-EN02']) expect(box(id)?.context).toBe(false);
    expect(box('P-E-EN01')).toMatchObject({ context: true, foreign: true, tone: 'other' });
    expect(loan.lines.filter((l) => l.context).map((l) => l.id)).toEqual(['P-D-EN02|refers_to|P-E-EN01']);
    // One ring only: what the ring refers to is not drawn.
    expect(loan.boxes).toHaveLength(6);
    // The domain's ERD: its own aggregates in focus, another domain's faded.
    const domain = domainErd(index(), 'P-D');
    expect(domain.boxes.filter((b) => b.context).map((b) => b.id)).toEqual(['P-E-A1']);
    expect(domain.lines.filter((l) => l.context).map((l) => l.target)).toEqual(['P-E-A1']);
  });

  it('LA-BRW-T553 The ERD frames its boxes in focus only, its context boxes are out of focus, and its edge hints count them', async () => {
    const erd = aggregateErd(index(), 'P-D-A3');
    const rects = new Map(erd.boxes.map((b, i) => [b.id, { x: i * 300, y: 0, width: 240, height: 80 }]));
    expect([...focusRects(erd, rects).keys()]).not.toContain('P-E-EN01');
    expect(focusRects(erd, rects).size).toBe(5);
    await openApp('/P-D-A3?view=model', { workspace: entityWorkspace() });
    await waitFor(() => expect(document.querySelector('.model-flow .react-flow__node[data-id="P-E-EN01"]')).not.toBeNull());
    const ring = document.querySelector<HTMLElement>('.model-flow .react-flow__node[data-id="P-E-EN01"]')!;
    expect(ring.className).toContain('is-context');
    expect(ring.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.model-flow .erd-line.is-context')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Key' })).toHaveTextContent('Faded: one ring out');
  });
});
