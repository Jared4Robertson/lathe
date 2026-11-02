import { describe, expect, it } from 'vitest';
import { modelWorkspace } from './fixtures/model';
import { recordIndexOf } from './read-view';
import { groundMap } from './graph/maps';

// The domains are listed by the position the Owner gives them, never by ID: the nav, the product page and the Graph
// all read the index's domains and the folder tree's, which the engine orders (LA-MOD-INV186).

/** The model fixture's product P with its two domains swapped: P-E first, then P-D (ID order says the opposite). */
const swapped = () => {
  const data = modelWorkspace();
  for (const row of data.sources.flatMap((s) => s.tables.domain ?? [])) row.position = row.id === 'P-E' ? 1 : 2;
  return recordIndexOf(data);
};

describe('LA-MOD-UC02-R10-T02 the space lists its domains by position', () => {
  it('orders the index\'s domains, the folder tree\'s and the Map\'s districts by position', () => {
    const inOrder = recordIndexOf(modelWorkspace());
    expect(inOrder.domains.map((d) => d.id)).toEqual(['P-D', 'P-E']);
    const index = swapped();
    expect(index.domains.map((d) => d.id)).toEqual(['P-E', 'P-D']);
    expect(index.folders.domains.map((d) => d.owner)).toEqual(['P-E', 'P-D']);
    const map = groundMap(index);
    const districts = map.nodes.get('P')!.children.filter((id) => id === 'P-D' || id === 'P-E');
    expect(districts).toEqual(['P-E', 'P-D']);
  });
});
