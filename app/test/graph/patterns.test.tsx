import './setup';
import { indexOf } from '../fixtures/load';
import { describe, expect, it } from 'vitest';
import { neighborhood } from '../../src/graph/model';
import { patternWorkspace } from '../fixtures/patterns';

// Patterns in the graph: a pattern's rules sit under it, one column to its right. A domain's or use
// case's `follows` link is the Trace stage's and the wiki card's, never drawn in the graph.

const index = () => indexOf(patternWorkspace());
const edge = (e: { source: string; relation: string; target: string }) => `${e.source} ${e.relation} ${e.target}`;

describe('patterns in the graph', () => {
  it('LA-V93-R30-T01 A pattern\'s rules appear under it, one column to its right', () => {
    const ix = index();
    const n = neighborhood(ix, 'DM-PAT-AUDIT', 1);
    const edges = n.edges.map(edge);
    // The pattern sits in its product's Use cases stage, which holds only patterns and so lists them itself, as the nav does.
    expect(edges).toEqual(expect.arrayContaining([
      'DM/use-cases parent DM-PAT-AUDIT',
      'DM-PAT-AUDIT parent DM-PAT-AUDIT-R01',
      'DM-PAT-AUDIT parent DM-PAT-AUDIT-R02',
      'DM-PAT-AUDIT parent DM-PAT-AUDIT-R03',
    ]));
    const column = (id: string) => n.nodes.find((x) => x.id === id)!.column;
    for (const rule of ['DM-PAT-AUDIT-R01', 'DM-PAT-AUDIT-R02', 'DM-PAT-AUDIT-R03']) expect(column(rule)).toBe(column('DM-PAT-AUDIT') + 1);
  });
});
