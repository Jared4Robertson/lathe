// Standards (FORMAT.md section 19): the standard and standard_rule kinds in Shared, the meets relation, no
// coverage owed, and the standard-rule-unmet check.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record);

let ws: Workspace;
beforeAll(async () => {
  // standards: STX-STD-CODE has rules R01 to R06. C01 meets R01 (and the missing R09), T01 meets R02, C02 cites
  // R03 in prose, the requirement STX-D-UC01-R01 meets R04 (not allowed), R05 cites only itself, the standard
  // cites R04 to R06, and the product OTH cites R06.
  ws = await loadWorkspace(fixture('standards'));
});

describe('the meta-model', () => {
  it('LA-AUT-T122 A standard and its rules sit in Shared under the product, and components and tests meet a rule', () => {
    expect(ws.kinds.find((k) => k.kind === 'standard')).toMatchObject({
      stage: 'design', section: 'shared', parent_kinds: ['product'], required_fields: [], obligation: false,
    });
    expect(ws.kinds.find((k) => k.kind === 'standard_rule')).toMatchObject({
      stage: 'design', section: 'shared', parent_kinds: ['standard'], required_fields: [], obligation: false, proof_only: false,
    });
    // The standards sit right after the patterns, so Shared lists them beside the patterns.
    const order = ws.kinds.map((k) => k.kind);
    expect(order.indexOf('standard')).toBe(order.indexOf('pattern_rule') + 1);
    expect(ws.sections.find((s) => s.section === 'shared')?.description).toMatch(/patterns, standards/);
    const meets = ws.relations
      .filter((r) => r.relation === 'meets')
      .map((r) => [r.source_kind, r.target_kind, r.role, r.forward_label, r.reverse_label]);
    expect(meets).toEqual(expect.arrayContaining([
      ['component', 'standard_rule', '', 'Meets', 'Met by'],
      ['test', 'standard_rule', '', 'Meets', 'Met by'],
    ]));
    expect(meets.every(([, target, role]) => target === 'standard_rule' && role === '')).toBe(true);
    // A meets from a kind the meta-model does not allow is relation-not-allowed; one to no record is dangling-link.
    expect(recordsOf(ws, 'relation-not-allowed')).toEqual(['STX-D-UC01-R01']);
    expect(ofCheck(ws, 'dangling-link').map((p) => p.message)).toEqual(['STX-D-C01 meets STX-STD-CODE-R09, which does not exist.']);
  });
});

describe('coverage', () => {
  it('LA-AUT-T123 A standard rule is never owed, and a prose citation of one is a mention', () => {
    const coverage = ws.coverage.find((c) => c.domain === 'STX-D');
    expect(coverage?.obligations.map((o) => o.kind)).not.toContain('standard_rule');
    expect(coverage?.gaps.filter((g) => g.id.startsWith('STX-STD-'))).toEqual([]);
    expect(ws.coverage.map((c) => c.domain)).toEqual(['STX-D']);
    // C02's citation of R03 is a mention, not a link.
    const c02 = ws.records.find((r) => r.id === 'STX-D-C02');
    expect(c02?.mentions).toEqual(['STX-STD-CODE-R03']);
    expect(ws.links.filter((l) => l.source === 'STX-D-C02' && l.relation === 'meets')).toEqual([]);
    expect(recordsOf(ws, 'unknown-id-in-prose')).toEqual([]);
  });
});

describe('standard-rule-unmet', () => {
  it('LA-AUT-T124 A standard rule that nothing meets or cites is a warning; a citation from itself, its standard or another product does not count', () => {
    // R01 and R02 are met, R03 is cited, R04 has a meets link (from a kind not allowed, reported once there).
    expect(recordsOf(ws, 'standard-rule-unmet')).toEqual(['STX-STD-CODE-R05', 'STX-STD-CODE-R06']);
    for (const p of ofCheck(ws, 'standard-rule-unmet')) {
      expect(p.severity).toBe('warning');
      expect(p.message).toContain(`meets: [${p.record}]`);
    }
  });
});
