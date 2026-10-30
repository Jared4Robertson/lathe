import './setup';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { groupLabel, neighborhood } from '../../src/graph/model';
import { shapeOf } from '../../src/graph/shapes';
import { treeChildren, treeParent } from '../../src/graph/tree';
import { SETTINGS_KEY, sessionSettingsRepository } from '../../src/exploring/session-settings/repository';
import { readView } from '../../src/views/place';
import { openApp } from '../helpers';
import { indexOf } from '../fixtures/load';
import { manyOfOneKindWorkspace, testIndex } from './workspace';

// The graph's tree for domain events, technical records and tests, and the
// rules its settings and its kind groups keep (LA-V93, LA-EXP-SP03, LA-VO92).

describe('domain events in the graph', () => {
  const index = testIndex();

  it('LA-V93-R04-T02 A domain event is a flag in its stage\'s colors', () => {
    expect(shapeOf('domain_event').shape).toBe('flag');
    expect(index.kinds.get('domain_event')?.stage).toBe('domain-model');
  });

  it('LA-V93-R28-T01 An aggregate\'s events sit under it in a "Domain events" group, and the graph draws no raises or hears link', () => {
    expect(treeChildren(index, 'P-D-A3')).toContain('P-D-A3/domain_event');
    expect(groupLabel(index, 'P-D-A3/domain_event')).toBe('Domain events (2)');
    expect(treeParent(index, 'P-D-EV01')).toBe('P-D-A3/domain_event');
    // Only the tree: the command that raises it and the policy that hears it are the Trace stage's and the wiki card's.
    expect(neighborhood(index, 'P-D-EV01', 1).edges.every((e) => e.relation === 'parent')).toBe(true);
  });
});

describe('components and tests in the graph', () => {
  const index = testIndex();

  it('LA-V93-R33-T01 A domain reaches its technical records through Technical specification, then a folder per kind, one column each', () => {
    expect(treeChildren(index, 'P-D')).toContain('P-D/technical-specification');
    expect(treeChildren(index, 'P-D/technical-specification')).toContain('P-D/technical-specification/repository');
    expect(treeParent(index, 'P-D-REPO01')).toBe('P-D/technical-specification/repository');
    expect(treeParent(index, 'P-D-CMD01-H')).toBe('P-D/technical-specification/command_handler');
  });

  it('LA-V93-R33-T02 A domain reaches its tests through Test plan, then a folder per test kind, as the nav does', () => {
    expect(treeChildren(index, 'P-D')).toContain('P-D/test-plan');
    expect(treeParent(index, 'P-D-UC01-FL01-T')).toBe('P-D/test-plan/flow_test');
    for (const folder of treeChildren(index, 'P-D/test-plan')) {
      expect(folder.startsWith('P-D/test-plan/')).toBe(true);
      for (const test of treeChildren(index, folder)) expect(index.byId.get(test)?.kind).toBe(folder.split('/').pop());
    }
  });
});

describe('the rules the graph keeps', () => {
  afterEach(() => window.sessionStorage.clear());

  it('LA-EXP-SP03-T A list splits by kind only when it holds more than one kind, whatever the focus, depth or filters', async () => {
    const index = testIndex();
    // An aggregate's children of three kinds: a group per kind.
    expect(treeChildren(index, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/invariant', 'P-D-A3/domain_event']);
    // A use case with seven UC requirements and nothing else: they hang straight under it, no group.
    const seven = indexOf(manyOfOneKindWorkspace());
    const kids = treeChildren(seven, 'P-D-UC02');
    expect(kids.length).toBe(7);
    for (const id of kids) expect(seven.byId.get(id)?.kind).toBe('uc_requirement');
    // The answer is the children's alone: the focus, depth and filters frame it, never change it.
    neighborhood(index, 'P-D-A3', 3, { hiddenKinds: new Set(['domain_event']) });
    expect(treeChildren(index, 'P-D-A3')).toEqual(['P-D-A3/entity', 'P-D-A3/invariant', 'P-D-A3/domain_event']);
    // The record page titles a list of one kind by that kind.
    await openApp('/DM-SHOP-EP01');
    expect(await screen.findByRole('heading', { name: /^API requirements/ })).toBeInTheDocument();
  });

  it('LA-VO92-C01-T A graph\'s depth is a whole number from 1 to 3, and its layout one of tree and nested', () => {
    // The layout is the window's (exploring/session-settings); the depth is the place's (views/place.ts).
    const stored = (layout: string) => window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout, minimap: false, cardWidth: null, chat: false, chatWidth: null, lens: false, since: 'commit', follow: false, looked: {} }));
    for (const layout of ['tree', 'nested'] as const) {
      stored(layout);
      expect(sessionSettingsRepository.load().graph).toEqual({ layout, minimap: false });
    }
    for (const depth of [1, 2, 3]) expect(readView({ depth }).depth).toBe(depth);
    // Any other depth falls back to 1; any other layout, one the graph no longer has included, reads as Tree and keeps the rest.
    for (const depth of [0, 4, 2.5, -1, '2']) expect(readView({ depth }).depth).toBe(1);
    for (const layout of ['grid', 'voronoi']) {
      stored(layout);
      expect(sessionSettingsRepository.load().graph).toEqual({ layout: 'tree', minimap: false });
    }
  });

});
