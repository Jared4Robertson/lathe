import './setup';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { relationStyle } from '../../src/graph/GraphPage';
import { canTrace, neighborhood, traceChain } from '../../src/graph/model';
import { indexWorkspace } from '../../src/specs/data';
import { patternWorkspace } from '../fixtures/patterns';
import { openApp, startAtDepth } from '../helpers';

// Patterns in the graph: a pattern's rules sit under it, one column to its right, and a use
// case's `follows` link is a cross-link.

const index = () => indexWorkspace(patternWorkspace());
const edge = (e: { source: string; relation: string; target: string }) => `${e.source} ${e.relation} ${e.target}`;

describe('patterns in the graph', () => {
  it('LA-BRW-T175 A pattern\'s rules appear under it, one column to its right', () => {
    const ix = index();
    const n = neighborhood(ix, 'DM-PAT-CHECKOUT', 1);
    const edges = n.edges.map(edge);
    // The pattern sits in its product's Shared folder, as the nav lists it.
    expect(edges).toEqual(expect.arrayContaining([
      'DM/shared parent DM-PAT-CHECKOUT',
      'DM-PAT-CHECKOUT parent DM-PAT-CHECKOUT-R01',
      'DM-PAT-CHECKOUT parent DM-PAT-CHECKOUT-R02',
    ]));
    const column = (id: string) => n.nodes.find((x) => x.id === id)!.column;
    for (const rule of ['DM-PAT-CHECKOUT-R01', 'DM-PAT-CHECKOUT-R02']) expect(column(rule)).toBe(column('DM-PAT-CHECKOUT') + 1);
  });

  it('LA-BRW-T176 A use case\'s follows link is drawn as a cross-link: shown, styled as a pattern link, the use case one column after the pattern', () => {
    const ix = index();
    const n = neighborhood(ix, 'DM-PAT-CHECKOUT', 1, undefined, { links: true });
    expect(n.edges.map(edge)).toEqual(expect.arrayContaining(['DM-PAY-UC01 follows DM-PAT-CHECKOUT', 'DM-SHOP-UC01 follows DM-PAT-CHECKOUT']));
    expect(relationStyle('follows')).toBe('pattern');
    expect(relationStyle('uses')).toBe('design');
    // Reached from the pattern by the cross-link, each use case sits one column after it, as its own child does.
    const column = (id: string) => n.nodes.find((x) => x.id === id)!.column;
    for (const uc of ['DM-SHOP-UC01', 'DM-PAY-UC01', 'DM-PAT-CHECKOUT-R01']) expect(column(uc)).toBe(column('DM-PAT-CHECKOUT') + 1);
    // From a use case, its pattern is one step away.
    expect(neighborhood(ix, 'DM-PAY-UC01', 1, undefined, { links: true }).nodes.map((x) => x.id)).toContain('DM-PAT-CHECKOUT');
  });

  it('LA-BRW-T177 Trace mode is offered for a pattern rule and shows what satisfies and proves it in every domain', () => {
    const ix = index();
    expect(canTrace(ix, 'DM-PAT-CHECKOUT-R01')).toBe(true);
    expect(canTrace(ix, 'DM-PAT-CHECKOUT')).toBe(false);
    const ids = traceChain(ix, 'DM-PAT-CHECKOUT-R01').nodes.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['DM-SHOP-C01', 'DM-SHOP-T01', 'DM-PAY-C01', 'DM-PAY-T01']));
  });

  it('LA-BRW-T178 The graph view of a pattern draws its rules and the follows lines with their own style', async () => {
    startAtDepth(1);
    await openApp('/DM-PAT-CHECKOUT?view=graph', { workspace: patternWorkspace() });
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="DM-PAT-CHECKOUT-R01"]')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(document.querySelector('.react-flow__edge-path.rel-pattern')).not.toBeNull());
    expect(screen.getByRole('region', { name: 'Legend' })).toHaveTextContent('follows');
  });
});
