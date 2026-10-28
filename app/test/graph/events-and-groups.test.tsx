import './setup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { relationStyle } from '../../src/graph/GraphPage';
import { edgesOf, graphEdgeLabel, groupLabel, neighborhood, NO_FILTERS } from '../../src/graph/model';
import { PLAIN_LOOK as DEFAULT_LOOK } from '../../src/graph/look';
import { lineStroke } from '../../src/graph/paint';
import { shapeOf } from '../../src/graph/shapes';
import { treeChildren, treeParent } from '../../src/graph/tree';
import { navigate } from '../../src/router';
import { GRAPH_KEY, lastSettings } from '../../src/views/useTabs';
import { openApp, startAtDepth } from '../helpers';
import { indexOf } from '../fixtures/load';
import { manyOfOneKindWorkspace, testIndex } from './workspace';
import { boxElements } from './scene';

// The graph's tree and links for domain events, technical records and tests, the trail, and the
// rules its settings and its kind groups keep (LA-V93, LA-EXP-SP03, LA-VO92).

const CSS = readFileSync(join(__dirname, '..', '..', 'src', 'styles.css'), 'utf8');

describe('domain events in the graph', () => {
  const index = testIndex();

  it('LA-V93-R04-T02 A domain event is a flag in its stage\'s colors, and its raises and hears lines are dashed in the spark color, with a dash of their own', () => {
    expect(shapeOf('domain_event').shape).toBe('flag');
    expect(index.kinds.get('domain_event')?.stage).toBe('domain-model');
    const event = edgesOf(index, 'P-D-EV01');
    const raises = event.find((e) => e.relation === 'raises')!;
    const hears = event.find((e) => e.relation === 'hears')!;
    expect([raises.source, hears.source]).toEqual(['P-D-CMD01', 'P-D-PO02']);
    for (const e of [raises, hears]) {
      expect(relationStyle(e.relation)).toBe('event');
      const stroke = lineStroke(DEFAULT_LOOK, { link: true, style: 'event' });
      expect(stroke.color).toBe(DEFAULT_LOOK.spark);
      expect(stroke.dash.length).toBeGreaterThan(0);
    }
    // A dash of their own, apart from the other links'.
    expect(lineStroke(DEFAULT_LOOK, { link: true, style: 'event' }).dash).not.toEqual(lineStroke(DEFAULT_LOOK, { link: true, style: relationStyle('invokes') }).dash);
  });

  it('LA-V93-R28-T01 An aggregate\'s events sit under it in a "Domain events" group, and with Links on their raises and hears links are drawn, labeled from the meta-model', () => {
    expect(treeChildren(index, 'P-D-A3')).toContain('P-D-A3/domain_event');
    expect(groupLabel(index, 'P-D-A3/domain_event')).toBe('Domain events (2)');
    expect(treeParent(index, 'P-D-EV01')).toBe('P-D-A3/domain_event');
    const relations = (links: boolean) => neighborhood(index, 'P-D-EV01', 1, NO_FILTERS, { links }).edges.map((e) => e.relation).filter((r) => r === 'raises' || r === 'hears').sort();
    expect(relations(false)).toEqual([]);
    expect(relations(true)).toEqual(['hears', 'raises']);
    const at = (relation: string) => edgesOf(index, 'P-D-EV01').find((e) => e.relation === relation)!;
    expect(graphEdgeLabel(index, at('raises'), 'target')).toBe('Raised by');
    expect(graphEdgeLabel(index, at('hears'), 'target')).toBe('Heard by');
  });
});

describe('components and tests in the graph', () => {
  const index = testIndex();

  it('LA-V93-R33-T01 A domain reaches its technical records through Technical specification, then a folder per kind, one column each', () => {
    expect(treeChildren(index, 'P-D')).toContain('P-D/technical-specification');
    expect(treeChildren(index, 'P-D/technical-specification')).toContain('P-D/technical-specification/repository');
    expect(treeParent(index, 'P-D-A3-REPO')).toBe('P-D/technical-specification/repository');
    expect(treeParent(index, 'P-D-CMD01-H')).toBe('P-D/technical-specification/command_handler');
  });

  it('LA-V93-R33-T02 A domain reaches its tests through Test plan, then a folder per test kind, as the nav does', () => {
    expect(treeChildren(index, 'P-D')).toContain('P-D/test-plan');
    expect(treeParent(index, 'P-D-UC01-FL-T')).toBe('P-D/test-plan/flow_test');
    for (const folder of treeChildren(index, 'P-D/test-plan')) {
      expect(folder.startsWith('P-D/test-plan/')).toBe(true);
      for (const test of treeChildren(index, folder)) expect(index.byId.get(test)?.kind).toBe(folder.split('/').pop());
    }
  });
});

describe('the trail', () => {
  it('LA-V93-R34-T01 The trail names a record by its title and ID, a group by its name alone, the full text in its tooltip, the current item bold', async () => {
    startAtDepth(1);
    await openApp('/P-D-UC01?view=graph', { data: (await import('./workspace')).testWorkspace() });
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    act(() => navigate('/P-D/use-cases?view=graph'));
    const trail = () => within(screen.getByRole('navigation', { name: 'Records visited' }));
    await waitFor(() => expect(trail().getAllByRole('listitem')).toHaveLength(2));
    expect(trail().getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Lend a thing (P-D-UC01)', 'Use cases']);
    const record = trail().getByRole('link', { name: 'Lend a thing (P-D-UC01)' });
    expect(record).toHaveAttribute('title', 'Lend a thing (P-D-UC01)');
    expect(record.querySelector('code.trail-id')).toHaveTextContent('(P-D-UC01)');
    const current = trail().getByText('Use cases').closest('[aria-current="page"]')!;
    expect(current).toHaveAttribute('title', 'Use cases of P-D');
    expect(current).toHaveAttribute('aria-label', 'Use cases of P-D');
    // A long name is cut short with an ellipsis; the current item stays bold.
    expect(CSS).toMatch(/\.graph-trail \.trail-name \{[^}]*text-overflow: ellipsis/);
    expect(CSS).toMatch(/\.graph-trail \[aria-current="page"\] \.trail-name \{[^}]*font-weight: 700/);
  });
});

describe('the rules the graph keeps', () => {
  afterEach(() => window.sessionStorage.clear());

  it('LA-EXP-SP03-T A list splits by kind only when it holds more than one kind, whatever the focus, depth or filters', async () => {
    const index = testIndex();
    // An aggregate's children of four kinds: a group per kind.
    expect(treeChildren(index, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/invariant', 'P-D-A3/domain_event', 'P-D-A3/command']);
    // A use case with seven UC requirements and nothing else: they hang straight under it, no group.
    const seven = indexOf(manyOfOneKindWorkspace());
    const kids = treeChildren(seven, 'P-D-UC02');
    expect(kids.length).toBe(7);
    for (const id of kids) expect(seven.byId.get(id)?.kind).toBe('uc_requirement');
    // The answer is the children's alone: the focus, depth and filters frame it, never change it.
    neighborhood(index, 'P-D-A3', 3, { hiddenKinds: new Set(['command']), hiddenRelations: new Set() });
    expect(treeChildren(index, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/invariant', 'P-D-A3/domain_event', 'P-D-A3/command']);
    // The record page titles a list of one kind by that kind, and a mixed one "Children".
    await openApp('/DM-SHOP-EP01');
    expect(await screen.findByRole('heading', { name: /^API requirements/ })).toBeInTheDocument();
    await openApp('/DM-SHOP-CMD01');
    expect(await screen.findByRole('heading', { name: /^Children/ })).toBeInTheDocument();
  });

  it('LA-VO92-C01-T A graph\'s depth is a whole number from 1 to 3, and its layout one of tree, nested and voronoi', () => {
    const stored = (layout: string, depth: number) => window.sessionStorage.setItem(GRAPH_KEY, JSON.stringify({ layout, depth, trace: false, hiddenKinds: [], hiddenRelations: [], links: false, minimap: false }));
    for (const layout of ['tree', 'nested', 'voronoi'] as const) {
      for (const depth of [1, 2, 3]) {
        stored(layout, depth);
        expect(lastSettings()).toMatchObject({ layout, depth });
      }
    }
    // Any other depth falls back to 1; any other layout drops the settings for the defaults.
    for (const depth of [0, 4, 2.5, -1]) {
      stored('nested', depth);
      expect(lastSettings()).toMatchObject({ layout: 'nested', depth: 1 });
    }
    stored('grid', 2);
    expect(lastSettings()).toMatchObject({ layout: 'tree', depth: 1 });
  });
});
