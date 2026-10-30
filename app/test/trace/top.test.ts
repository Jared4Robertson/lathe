import { describe, expect, it } from 'vitest';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { OUTSIDE, traceTop, UNTRACED } from '../../src/trace/top';

// The top of the Trace stage's tree (app/src/trace/top.ts): from the product down to each obligation, each outcome
// holding the use cases of the capabilities serving it, Not under an outcome holding the rest by domain, kept in one
// small children rule apart from the layout, the chains, the walk and the painting.

/** The model product with two business outcomes its capability serves, a third nothing serves, and a product pattern with a rule. */
function withTop() {
  const data = modelWorkspace();
  addRows(data, 'business_outcome',
    { id: 'P-BO02', title: 'Fewer lost things', product_id: 'P', statement: 'Fewer things go missing.', measure: 'Things lost a year', target: 'Down a half' },
    { id: 'P-BO01', title: 'More things lent', product_id: 'P', statement: 'Members borrow more.', measure: 'Loans a month', target: 'Up a tenth' },
    { id: 'P-BO03', title: 'Happier members', product_id: 'P', statement: 'Members like it.', measure: 'Survey score', target: 'Up a point' });
  addRows(data, 'serves', { source_id: 'P-D-CAP01', target_id: 'P-BO01' }, { source_id: 'P-D-CAP01', target_id: 'P-BO02' });
  addRows(data, 'pattern', { id: 'P-PAT-CALM', title: 'Calm', product_id: 'P' });
  addRows(data, 'pattern_rule', { id: 'P-PAT-CALM-R01', title: 'No shouting', pattern_id: 'P-PAT-CALM', statement: 'A message MUST NOT shout.' });
  return recordIndexOf(data);
}

describe('the top of the Trace stage\'s tree', () => {
  it('LA-V98-R03-T04 The top of the tree reads from each outcome to its use cases and requirements; what no outcome reaches sits under Not under an outcome by domain; Untraced last', () => {
    const index = withTop();
    const top = traceTop(index, 'P', true);
    // The product: its outcomes in ID order, then Not under an outcome, then Untraced.
    expect(top.children.get('P')).toEqual(['P-BO01', 'P-BO02', 'P-BO03', OUTSIDE, UNTRACED]);
    // An outcome: the use cases of the capabilities serving it, no capability drawn, and below them their requirements.
    expect(top.children.get('P-BO01')).toEqual(['P-BO01|P-D-UC01']);
    expect(top.ids.get('P-BO01|P-D-UC01')).toBe('P-D-UC01');
    expect(top.children.get('P-BO01|P-D-UC01')).toEqual(['P-BO01|P-D-UC01-R01', 'P-BO01|P-D-UC01-R02']);
    // A use case whose capability serves two outcomes sits under each, everything under it too.
    expect(top.children.get('P-BO02')).toEqual(['P-BO02|P-D-UC01']);
    expect(top.obligations.filter((p) => p.id === 'P-D-UC01-R01').map((p) => p.key)).toEqual(['P-BO01|P-D-UC01-R01', 'P-BO02|P-D-UC01-R01']);
    // An outcome nothing serves holds nothing; no capability is a key anywhere.
    expect(top.children.get('P-BO03')).toEqual([]);
    expect([...top.ids.values()]).not.toContain('P-D-CAP01');
    // Not under an outcome: the domains with an obligation no outcome reaches, then the product's own obligations' parents.
    expect(top.children.get(OUTSIDE)).toEqual(['P-D', 'P-PAT-CALM', 'P-VO01']);
    // A domain: the parents of its obligations side by side (aggregates, views, then other parents), then the obligations
    // standing right under it; an invariant under its aggregate there.
    expect(top.children.get('P-D')).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-V01', 'P-D-SP01', 'P-D-DS01']);
    expect(top.children.get('P-D-A3')).toContain('P-D-INV01');
    // Every obligation once outside, twice for the two outcomes' requirements; in the tree's order.
    expect(top.obligations.map((p) => p.key).slice(0, 2)).toEqual(['P-BO01|P-D-UC01-R01', 'P-BO01|P-D-UC01-R02']);
    expect(top.outside).toBe(top.obligations.filter((p) => p.key === p.id).length);
    // No untraced records, no mark.
    expect(traceTop(index, 'P', false).children.get('P')).not.toContain(UNTRACED);
  });

  it('LA-V98-R03-T06 A use case whose capability serves nothing sits under Not under an outcome, in its domain', () => {
    const top = traceTop(recordIndexOf(modelWorkspace()), 'P', false);
    expect(top.children.get('P')).toEqual([OUTSIDE]);
    expect(top.children.get('P-D')![0]).toBe('P-D-UC01');
    expect(top.children.get('P-D-UC01')).toEqual(['P-D-UC01-R01', 'P-D-UC01-R02']);
  });
});
