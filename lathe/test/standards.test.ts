// Standards: the standard and standard_rule kinds in Shared, the meets relation, no coverage owed, and the
// standard-rule-unmet check.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record);

let ws: Workspace;
beforeAll(async () => {
  // standards: STX-STD-CODE has rules R01 to R06. C01 meets R01 and T01 meets R02; C02's description names R03 and
  // product OTH's names R06, as plain text.
  ws = await load('standards');
});
afterAll(removeData);

describe('the schema', () => {
  it('LA-AUT-T122 A standard and its rules sit in Shared under the product, and components and tests meet a rule', async () => {
    expect(ws.kinds.find((k) => k.kind === 'standard')).toMatchObject({
      stage: 'design', section: 'shared', parent_kinds: ['product'], required_fields: [], obligation: false,
    });
    expect(ws.kinds.find((k) => k.kind === 'standard_rule')).toMatchObject({
      stage: 'design', section: 'shared', parent_kinds: ['standard'], required_fields: ['statement'], obligation: false, proof_only: false,
    });
    // The standards sit right after the patterns, so Shared lists them beside the patterns.
    const order = ws.kinds.map((k) => k.kind);
    expect(order.indexOf('standard')).toBe(order.indexOf('pattern_rule') + 1);
    expect(ws.sections.find((s) => s.section === 'shared')?.description).toMatch(/patterns, standards/);
    const meets = ws.relations
      .filter((r) => r.relation === 'meets')
      .map((r) => [r.source_kind, r.target_kind, r.role, r.forward_label, r.reverse_label]);
    expect(meets).toEqual([
      ['component', 'standard_rule', '', 'Meets', 'Met by'],
      ['design_step', 'standard_rule', '', 'Meets', 'Met by'],
      ['test', 'standard_rule', '', 'Meets', 'Met by'],
    ]);
    // A meets from a kind that may not meet a rule, or to no rule, is refused by the store.
    const data = everyKind();
    const from = await refusals(withTable(data, 'meets', [...data.meets, { source_id: 'TL-LEND-UC01-R01', target_id: 'TL-STD-CODE-R01' }]));
    expect(from).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'meets' })]);
    expect(from[0].message).toContain('names no meets_source (component, design_step, test)');
    const to = await refusals(withTable(data, 'meets', [...data.meets, { source_id: 'TL-LEND-T01', target_id: 'TL-STD-CODE-R09' }]));
    expect(to).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'meets' })]);
    expect(to[0].message).toContain('"TL-STD-CODE-R09" names no standard_rule');
  });
});

describe('coverage', () => {
  it('LA-AUT-T123 A standard rule is never owed, and an ID named in a description is plain text, not a link', () => {
    const coverage = ws.coverage.find((c) => c.domain === 'STX-D');
    expect(coverage?.obligations.map((o) => o.kind)).not.toContain('standard_rule');
    expect(coverage?.gaps.filter((g) => g.id.startsWith('STX-STD-'))).toEqual([]);
    expect(ws.coverage.map((c) => c.domain)).toEqual(['STX-D']);
    // C02's description names R03: no link, and no problem about the text.
    const c02 = ws.records.find((r) => r.id === 'STX-D-C02');
    expect(c02?.fields.description).toContain('STX-STD-CODE-R03');
    expect(ws.links.filter((l) => l.source === 'STX-D-C02' && l.relation === 'meets')).toEqual([]);
    expect(ws.problems.filter((p) => p.message.includes('STX-STD-CODE-R03') && p.record !== 'STX-STD-CODE-R03')).toEqual([]);
  });
});

describe('standard-rule-unmet', () => {
  it('LA-AUT-T124 A standard rule that nothing meets is a warning; naming it in text does not meet it', () => {
    // R01 and R02 are met; R03 and R06 are only named in text, R04 and R05 not at all.
    expect(recordsOf(ws, 'standard-rule-unmet')).toEqual(['STX-STD-CODE-R03', 'STX-STD-CODE-R04', 'STX-STD-CODE-R05', 'STX-STD-CODE-R06']);
    for (const p of ofCheck(ws, 'standard-rule-unmet')) {
      expect(p.severity).toBe('warning');
      expect(p.message).toContain(`Nothing meets standard rule ${p.record}`);
      expect(p.message).toContain('with meets, or remove it');
    }
  });
});
