import './setup';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { relationStyle } from '../../src/graph/GraphPage';
import { layeredGraph } from '../../src/graph/layout';
import { canTrace, HIERARCHY_TIERS, neighbourhood, tierOf, traceChain } from '../../src/graph/model';
import { indexWorkspace } from '../../src/specs/data';
import { patternWorkspace } from '../fixtures/patterns';
import { openApp } from '../helpers';

// Patterns in the graph: a pattern's rules sit under it, and a use case's `follows` link is a
// cross-link within the use cases' tier.

const index = () => indexWorkspace(patternWorkspace());
const edge = (e: { source: string; relation: string; target: string }) => `${e.source} ${e.relation} ${e.target}`;

describe('patterns in the graph', () => {
  it('LA-BRW-T175 A pattern\'s rules appear under it, a tier to its right, and a pattern sits with the use cases', () => {
    const ix = index();
    expect(tierOf(ix, 'pattern', 'hierarchy')).toBe(HIERARCHY_TIERS.use_case);
    expect(tierOf(ix, 'pattern_rule', 'hierarchy')).toBe(HIERARCHY_TIERS.requirement);
    const n = neighbourhood(ix, 'DM-PAT-CHECKOUT', 1);
    const edges = n.edges.map(edge);
    expect(edges).toEqual(expect.arrayContaining([
      'DM/pattern parent DM-PAT-CHECKOUT',
      'DM-PAT-CHECKOUT parent DM-PAT-CHECKOUT-R01',
      'DM-PAT-CHECKOUT parent DM-PAT-CHECKOUT-R02',
    ]));
    const rule = n.nodes.find((x) => x.id === 'DM-PAT-CHECKOUT-R01')!;
    expect(rule.tier).toBeGreaterThan(n.nodes.find((x) => x.id === 'DM-PAT-CHECKOUT')!.tier);
  });

  it('LA-BRW-T176 A use case\'s follows link is drawn as a cross-link: shown, styled as a pattern link, and not shaping the tiers', () => {
    const ix = index();
    const n = neighbourhood(ix, 'DM-PAT-CHECKOUT', 1);
    expect(n.edges.map(edge)).toEqual(expect.arrayContaining(['DM-PAY-UC01 follows DM-PAT-CHECKOUT', 'DM-SHOP-UC01 follows DM-PAT-CHECKOUT']));
    expect(relationStyle('follows')).toBe('pattern');
    expect(relationStyle('uses')).toBe('design');
    // Same tier at both ends, so ELK lays out the tiers without it.
    const elk = layeredGraph(n);
    const pairs = (elk.edges ?? []).map((e) => `${e.sources[0]}>${e.targets[0]}`);
    for (const uc of ['DM-SHOP-UC01', 'DM-PAY-UC01']) {
      expect(pairs).not.toContain(`${uc}>DM-PAT-CHECKOUT`);
      expect(pairs).not.toContain(`DM-PAT-CHECKOUT>${uc}`);
    }
    expect(pairs).toContain('DM-PAT-CHECKOUT>DM-PAT-CHECKOUT-R01');
    // From a use case, its pattern is one step away.
    expect(neighbourhood(ix, 'DM-PAY-UC01', 1).nodes.map((x) => x.id)).toContain('DM-PAT-CHECKOUT');
  });

  it('LA-BRW-T177 Trace mode is offered for a pattern rule and shows what satisfies and proves it in every domain', () => {
    const ix = index();
    expect(canTrace(ix, 'DM-PAT-CHECKOUT-R01')).toBe(true);
    expect(canTrace(ix, 'DM-PAT-CHECKOUT')).toBe(false);
    const ids = traceChain(ix, 'DM-PAT-CHECKOUT-R01').nodes.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['DM-SHOP-C01', 'DM-SHOP-T01', 'DM-PAY-C01', 'DM-PAY-T01']));
  });

  it('LA-BRW-T178 The graph view of a pattern draws its rules and the follows lines with their own style', async () => {
    await openApp('/records/DM-PAT-CHECKOUT?view=graph', { workspace: patternWorkspace() });
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="DM-PAT-CHECKOUT-R01"]')).not.toBeNull());
    await waitFor(() => expect(document.querySelector('.react-flow__edge-path.rel-pattern')).not.toBeNull());
    expect(screen.getByRole('region', { name: 'Legend' })).toHaveTextContent('follows');
  });
});
