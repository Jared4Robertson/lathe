import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { linkKey, linkTarget, traceTop, UNTRACED } from '../../src/trace/top';

// The top of the Trace stage's tree (app/src/trace/top.ts): what sits under the product, each outcome and each domain,
// kept in one small children rule apart from the layout, the chains, the walk and the painting.

/** The model product with two business outcomes its capability serves, and a product pattern with a rule. */
function withTop() {
  const data = modelWorkspace();
  addRows(data, 'business_outcome',
    { id: 'P-BO02', title: 'Fewer lost things', product_id: 'P', statement: 'Fewer things go missing.', measure: 'Things lost a year', target: 'Down a half' },
    { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' }, { source_id: 'P-D-CAP01', target_id: 'P-BO02' });
  addRows(data, 'pattern', { id: 'P-PAT-CALM', title: 'Calm', product_id: 'P' });
  addRows(data, 'pattern_rule', { id: 'P-PAT-CALM-R01', title: 'No shouting', pattern_id: 'P-PAT-CALM', statement: 'A message MUST NOT shout.' });
  return indexOf(data);
}

describe('the top of the Trace stage\'s tree', () => {
  it('LA-V98-R03-T04 The top of the tree is one small children rule: the product\'s outcomes with their links, its domains, its own obligations\' parents, Untraced last', () => {
    const index = withTop();
    const top = traceTop(index, 'P', true);
    // The product: its outcomes in ID order, its domains in the record tree's order, its own obligations' parents, then Untraced.
    const product = top.get('P')!;
    expect(product.slice(0, 4)).toEqual(['P-BO01', 'P-BO02', 'P-D', 'P-E']);
    expect(product).toContain('P-PAT-CALM');
    expect(product).toContain('P-VO01');
    expect(product.at(-1)).toBe(UNTRACED);
    // Each outcome: a link to each capability serving it, which leads to the capability.
    expect(top.get('P-BO01')).toEqual([linkKey('P-BO01', 'P-D-CAP01')]);
    expect(linkTarget(top.get('P-BO02')![0])).toBe('P-D-CAP01');
    expect(linkTarget('P-D-CAP01')).toBeNull();
    // A domain: the parents of its obligations side by side (capabilities, aggregates, views, then other parents), then
    // the obligations standing right under it; a domain with none holds nothing.
    expect(top.get('P-D')).toEqual(['P-D-CAP01', 'P-D-A1', 'P-D-A2', 'P-D-A3', 'P-V01', 'P-D-SP01', 'P-D-DS01']);
    expect(top.get('P-E')).toEqual([]);
    // No untraced records, no mark.
    expect(traceTop(index, 'P', false).get('P')).not.toContain(UNTRACED);
  });
});
