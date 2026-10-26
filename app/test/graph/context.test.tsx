import './setup';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Workspace } from '../../../lathe/src/types';
import { graphSummary, keyboardOrder, stepTarget, type Box } from '../../src/graph/GraphPage';
import { panToward, pastEdges } from '../../src/graph/hints';
import { groupLabel, groupMembers, neighborhood, type Neighborhood } from '../../src/graph/model';
import { splitsByKind, treeChildren, treeParent } from '../../src/graph/tree';
import { aggregateErd, domainErd } from '../../src/model/erd';
import { focusRects } from '../../src/model/ModelView';
import { indexWorkspace } from '../../src/specs/data';
import { domainFolders } from '../../src/specs/folders';
import { entityWorkspace } from '../fixtures/entities';
import { layerWorkspace } from '../fixtures/layers';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';

// The graph's tree is the nav's tree, depth counts its levels below the focus, and the picture is
// one map seen through a camera: what is too small to read is drawn plain and kept out of focus.

const ids = (n: Neighborhood) => n.nodes.map((x) => x.id).sort();
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const isCenter = (id: string) => !!node(id)?.querySelector('.graph-node.is-focus');

async function showGraph(path: string, workspace: Workspace = testWorkspace(), depth = 1) {
  startAtDepth(depth);
  await openApp(`${path}?view=graph`, { workspace });
  await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0));
}

describe('the graph tree, its depth and its camera', () => {
  it('LA-EXP-T142 Depth counts levels below a domain and a use case, as a file explorer does', () => {
    const index = indexWorkspace(layerWorkspace());
    // From the domain: depth 1 its stages, depth 2 their folders, depth 3 what is in them.
    expect(ids(neighborhood(index, 'DM-SHOP', 1))).toEqual(expect.arrayContaining(['DM-SHOP/define', 'DM-SHOP/design']));
    expect(ids(neighborhood(index, 'DM-SHOP', 1)).some((id) => id.split('/').length > 2)).toBe(false);
    const two = ids(neighborhood(index, 'DM-SHOP', 2));
    expect(two).toEqual(expect.arrayContaining(['DM-SHOP/define/domain-model', 'DM-SHOP/define/use-cases', 'DM-SHOP/design/technical-specification', 'DM-SHOP/design/test-plan']));
    expect(two).not.toContain('DM-SHOP-A1');
    const three = ids(neighborhood(index, 'DM-SHOP', 3));
    expect(three).toEqual(expect.arrayContaining(['DM-SHOP-A1', 'DM-SHOP-CAP01', 'DM-SHOP-CAP02', 'DM-SHOP-UC01', 'DM-SHOP-LAY01', 'DM-SHOP-LAY02', 'DM-SHOP-LAY03', 'DM-SHOP-C01']));
    expect(three).not.toContain('DM-SHOP-UC02');
    // From a use case in a capability: its capability is the parent at every depth; nothing further up.
    for (const depth of [1, 2, 3]) {
      expect(ids(neighborhood(index, 'DM-SHOP-UC02', depth)).filter((id) => !id.startsWith('DM-SHOP-UC02'))).toEqual(['DM-SHOP-CAP01']);
    }
  });

  it('LA-EXP-T143 The graph\'s tree is the nav\'s: a domain\'s stages, their folders and records, the one-kind rule, and a product\'s Shared folder and domains', () => {
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

  it('LA-EXP-T144 The Links switch beside Depth is off by default, has a tooltip and the shortcut l, draws the center\'s links dashed, and is kept while walking', async () => {
    await showGraph('/P-D-UC01-R01');
    const links = screen.getByRole('button', { name: 'Links' });
    expect(links).toHaveAttribute('aria-pressed', 'false');
    expect(links).toHaveAttribute('aria-keyshortcuts', 'L');
    expect(document.querySelector('.react-flow__edge-path.is-link')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'l', code: 'KeyL' });
    await waitFor(() => expect(document.querySelectorAll('.react-flow__edge-path.is-link')).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-pressed', 'true');
    // The tree's own lines are not links.
    expect(document.querySelector('.react-flow__edge-path.rel-structure.is-link')).toBeNull();
    // Walking on keeps it on: the view's own link to its endpoint is drawn.
    fireEvent.click(node('P-D-V01')!);
    await waitFor(() => expect(isCenter('P-D-V01')).toBe(true));
    await waitFor(() => expect(document.querySelector('.react-flow__edge[data-id="P-D-V01|uses|P-D-E01"], .graph-edge-group[data-source="P-D-V01"][data-target="P-D-E01"]')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Links' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('LA-EXP-T171 Every drawn box shows its label, however small on screen, and is a keyboard stop; the summary counts the framed picture', async () => {
    // A use case with sixty requirements: framed from its domain, they are a few pixels tall each.
    const w = testWorkspace();
    const req = w.records.find((r) => r.id === 'P-D-UC01-R01')!;
    for (let i = 2; i <= 60; i++) w.records.push({ ...req, id: `P-D-UC01-R${String(i).padStart(2, '0')}`, title: `Rule ${i}`, path: `specs/P-D-UC01-R${i}.md` });
    await showGraph('/P-D', w, 3);
    await waitFor(() => expect(document.querySelectorAll('.react-flow__node[data-id]').length).toBeGreaterThan(5));
    // Each box draws its kind and ID line and its title, has its name and is a keyboard stop.
    for (const node of document.querySelectorAll<HTMLElement>('.react-flow__node[data-id]:not(.is-bar)')) {
      expect(node.querySelector('small'), node.dataset.id).not.toBeNull();
      expect(node.querySelector('strong')?.textContent, node.dataset.id).toBeTruthy();
      expect(node.hasAttribute('aria-label'), node.dataset.id).toBe(true);
      expect(node.getAttribute('aria-hidden'), node.dataset.id).toBeNull();
    }
    // The keyboard visits every drawn box, column by column.
    const boxes: Omit<Box, 'text' | 'parent'>[] = [
      { id: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'b', x: 20, y: 30, w: 10, h: 10 },
      { id: 'c', x: 20, y: 0, w: 10, h: 10 },
    ];
    expect(keyboardOrder(boxes)).toEqual(['a', 'c', 'b']);
    // The summary counts the framed picture: the domain, its parent and three levels below it.
    const n = neighborhood(indexWorkspace(w), 'P-D', 3);
    expect(document.querySelector('.graph-count')!.textContent).toBe(graphSummary(n));
    expect(graphSummary(n)).toBe('7 records · 11 groups · 17 links');
  });

  it('LA-EXP-T147 Filters have a Minimap switch, off by default and kept while walking, and the minimap is an overview of the whole map', async () => {
    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByText('Filters'));
    const minimap = screen.getByRole('switch', { name: 'Minimap' }) as HTMLInputElement;
    expect(minimap.checked).toBe(false);
    expect(screen.queryByRole('switch', { name: /context ring/i })).toBeNull();
    // The trace preset is worded with the relations' labels, never their codes (LA-EXP-V03-R07).
    expect(screen.getByRole('button', { name: 'Only satisfies, proves and carries out links' })).toBeInTheDocument();
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

  it('LA-EXP-T148 Alt+Up steps out to the parent, Alt+Down in to the first child, Alt+Shift+Left and Right to a sibling, from the keyboard and from buttons with their keys', async () => {
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

  it('LA-EXP-T172 With Links on, links draw as curves between their boxes, and the edge hints count the linked records past each edge', async () => {
    // The hints' arithmetic: a box's center past an edge counts for that edge; the plain pan moves half the canvas.
    const view = { x: 0, y: 0, zoom: 1 };
    expect(pastEdges([{ x: -10, y: 50 }, { x: 1200, y: -5 }, { x: 500, y: 900 }, { x: 500, y: 400 }], view, 1000, 800)).toEqual({ up: 1, down: 1, left: 1, right: 1 });
    expect(panToward(view, 'right', 1000, 800)).toEqual({ x: -500, y: 0, zoom: 1 });
    expect(panToward(view, 'up', 1000, 800)).toEqual({ x: 0, y: 400, zoom: 1 });

    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    // Every linked record is drawn, wherever it is in the map, and each link is a curve to it.
    await waitFor(() => expect(document.querySelectorAll('.react-flow__edge-path.is-link')).toHaveLength(3));
    for (const id of ['P-D-V01', 'P-D-C01', 'P-D-T01']) expect(node(id)).not.toBeNull();
    for (const path of document.querySelectorAll('.react-flow__edge-path.is-link')) expect(path.getAttribute('d')).toMatch(/^M [-\d.]+ [-\d.]+ C /);
    // The tree's parent lines stay straight and level.
    for (const path of document.querySelectorAll('.react-flow__edge-path.rel-structure')) {
      const [, y1, , y2] = path.getAttribute('d')!.match(/^M [-\d.]+ ([-\d.]+) L ([-\d.]+) ([-\d.]+)$/)!;
      expect(y1).toBe(y2);
    }
  });

  it('LA-EXP-T150 Hovering or focusing a box spotlights it, its lines and the boxes it joins, and leaving restores the picture', async () => {
    await showGraph('/P-D-UC01-R01');
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-D-V01')).not.toBeNull());
    const flow = document.querySelector<HTMLElement>('.graph-flow')!;
    node('P-D-V01')!.focus();
    await waitFor(() => expect(flow.className).toContain('has-spotlight'));
    expect(node('P-D-V01')!.className).toContain('is-lit');
    expect(node('P-D-UC01-R01')!.className).toContain('is-lit');
    expect(node('P-D-UC01')!.className).not.toContain('is-lit');
    expect(document.querySelector('.graph-edge-group.is-lit[data-source="P-D-V01"][data-target="P-D-UC01-R01"]')).not.toBeNull();
    fireEvent.blur(node('P-D-V01')!);
    expect(flow.className).not.toContain('has-spotlight');
    expect(document.querySelector('.is-lit')).toBeNull();
  });
});

describe('the context ring in the Model view', () => {
  const index = () => indexWorkspace(entityWorkspace());

  it('LA-EXP-T151 An aggregate\'s ERD shows what its referenced entities refer to one ring out, faded; a domain\'s ERD fades the aggregates of other domains', () => {
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

  it('LA-EXP-T152 The ERD frames its boxes in focus only, its context boxes are out of focus, and its edge hints count them', async () => {
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
