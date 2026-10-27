import './setup';
import { indexOf } from '../fixtures/load';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { relationStyle } from '../../src/graph/GraphPage';
import { canTrace, neighborhood, traceChain } from '../../src/graph/model';
import { patternWorkspace } from '../fixtures/patterns';
import { openApp, startAtDepth } from '../helpers';
import { boxElement, scene } from './scene';

// Patterns in the graph: a pattern's rules sit under it, one column to its right, and a domain's or use
// case's `follows` link is a cross-link.

const index = () => indexOf(patternWorkspace());
const edge = (e: { source: string; relation: string; target: string }) => `${e.source} ${e.relation} ${e.target}`;

describe('patterns in the graph', () => {
  it('LA-V93-R30-T01 A pattern\'s rules appear under it, one column to its right', () => {
    const ix = index();
    const n = neighborhood(ix, 'DM-PAT-AUDIT', 1);
    const edges = n.edges.map(edge);
    // The pattern sits in its product's Use cases stage, in the Patterns folder, as the nav lists it.
    expect(edges).toEqual(expect.arrayContaining([
      'DM/use-cases/pattern parent DM-PAT-AUDIT',
      'DM-PAT-AUDIT parent DM-PAT-AUDIT-R01',
      'DM-PAT-AUDIT parent DM-PAT-AUDIT-R02',
      'DM-PAT-AUDIT parent DM-PAT-AUDIT-R03',
    ]));
    const column = (id: string) => n.nodes.find((x) => x.id === id)!.column;
    for (const rule of ['DM-PAT-AUDIT-R01', 'DM-PAT-AUDIT-R02', 'DM-PAT-AUDIT-R03']) expect(column(rule)).toBe(column('DM-PAT-AUDIT') + 1);
  });

  it('LA-V93-R30-T02 A domain\'s and a use case\'s follows links are drawn as cross-links: shown, styled as pattern links, each follower one column after the pattern', () => {
    const ix = index();
    const n = neighborhood(ix, 'DM-PAT-AUDIT', 1, undefined, { links: true });
    expect(n.edges.map(edge)).toEqual(expect.arrayContaining(['DM-SHOP follows DM-PAT-AUDIT', 'DM-SHOP-UC01 follows DM-PAT-AUDIT']));
    expect(relationStyle('follows')).toBe('pattern');
    expect(relationStyle('invokes')).toBe('design');
    // Reached from the pattern by the cross-link, each follower sits one column after it, as its own child does.
    const column = (id: string) => n.nodes.find((x) => x.id === id)!.column;
    for (const uc of ['DM-SHOP', 'DM-SHOP-UC01', 'DM-PAT-AUDIT-R01']) expect(column(uc)).toBe(column('DM-PAT-AUDIT') + 1);
    // From a use case, its pattern is one step away.
    expect(neighborhood(ix, 'DM-SHOP-UC01', 1, undefined, { links: true }).nodes.map((x) => x.id)).toContain('DM-PAT-AUDIT');
  });

  it('LA-V93-R30-T03 Trace mode is offered for a pattern rule and shows the tests that prove it, in each domain', () => {
    const ix = index();
    expect(canTrace(ix, 'DM-PAT-AUDIT-R01')).toBe(true);
    expect(canTrace(ix, 'DM-PAT-AUDIT')).toBe(false);
    const ids = traceChain(ix, 'DM-PAT-AUDIT-R01').nodes.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['DM-PAT-AUDIT-R01-T01', 'file:test/audit.test.ts']));
  });

  it('LA-V93-R30-T04 The graph view of a pattern draws its rules and the follows lines with their own style', async () => {
    startAtDepth(1);
    await openApp('/DM-PAT-AUDIT?view=graph', { data: patternWorkspace() });
    await waitFor(() => expect(boxElement('DM-PAT-AUDIT-R01')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(scene().lines.some((l) => l.link && l.style === 'pattern')).toBe(true));
    expect(screen.getByRole('region', { name: 'Legend' })).toHaveTextContent('follows');
  });
});
