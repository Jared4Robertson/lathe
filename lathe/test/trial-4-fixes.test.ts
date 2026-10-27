// The narrow extensions S2 trial 4 asked for: the supports relation, a test's key_file, flow step paths,
// one name for the meaning of an entity's field, domain rules under an entity and layers under a layer.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const ofRecord = (ws: Workspace, record: string) => ws.problems.filter((p) => p.record === record);
const PROOF_FILE_CHECKS = ['test-file-missing-id', 'proof-not-in-file', 'proof-still-owed', 'manual-test-file-silent'];

let claims: Workspace;
let twins: Workspace;
beforeAll(async () => {
  claims = await load('claims-trial4');
  // levels-twins: domains LV-A and LV-B are alike, except that LV-A keeps its domain rule under an entity and a
  // component in a sub-layer. LV-C holds sub-layers whose orders are checked.
  twins = await load('levels-twins');
});
afterAll(removeData);

describe('supports', () => {
  it('LA-TRC-T76 A test supports any obligation kind, with no role, labeled Supports and Supported by', () => {
    const rules = claims.relations.filter((r) => r.relation === 'supports');
    expect(rules.map((r) => `${r.source_kind} ${r.target_kind}`).sort()).toEqual([
      'test domain_rule', 'test interaction_requirement', 'test pattern_rule', 'test requirement',
    ]);
    for (const r of rules) expect(r).toMatchObject({ role: '', forward_label: 'Supports', reverse_label: 'Supported by' });
    expect(ofCheck(claims, 'data-refused')).toEqual([]);
  });

  it('LA-TRC-T77 Support never counts as proof, automated or planned', () => {
    const req = claims.coverage[0].obligations.find((o) => o.kind === 'requirement')!;
    // R01 is only supported (by an automated check), R02 is proved by T03 and supported by planned T02.
    expect(req).toMatchObject({ total: 3, proved: 1, planned: 0, planned_any: 0 });
    expect(claims.coverage[0].gaps.filter((g) => g.missing === 'proves').map((g) => g.id)).toContain('TC-D-UC01-R01');
    expect(ofCheck(claims, 'unproved').map((p) => p.record)).toContain('TC-D-UC01-R01');
    expect(ofCheck(claims, 'proof-still-owed')).toEqual([]);
    expect(ofCheck(claims, 'proof-counts-nowhere')).toEqual([]);
  });

  it('LA-TRC-T78 A test that only supports owes no ID in its file, but its file must still exist', () => {
    // T01's file names no ID and the test has no key.
    expect(ofRecord(claims, 'TC-D-T01')).toEqual([]);
    expect(ofRecord(claims, 'TC-D-T02')).toEqual([]);
    expect(ofRecord(claims, 'TC-D-T10')).toEqual([
      { severity: 'error', check: 'test-file-missing', record: 'TC-D-T10', message: 'Test TC-D-T10 names the file code/gone.test.txt, which does not exist.' },
    ]);
  });
});

describe('key_file', () => {
  it('LA-TRC-T79 With a key_file, the key is looked for in that file, and a key it lacks is test-file-missing-id', () => {
    // T04's file never names SharedChecks; its key file does.
    expect(ofRecord(claims, 'TC-D-T04')).toEqual([]);
    const rules = claims.coverage[0].obligations.find((o) => o.kind === 'domain_rule')!;
    expect(claims.coverage[0].gaps.filter((g) => g.missing === 'proves').map((g) => g.id)).not.toContain('TC-D-DR01');
    expect(rules.proved).toBe(2);
    expect(ofRecord(claims, 'TC-D-T05')).toEqual([{
      severity: 'error', check: 'test-file-missing-id', record: 'TC-D-T05',
      message: 'Test TC-D-T05 names the key file code/shared/conformance.txt, but that file does not contain its key "OtherChecks".',
    }]);
  });

  it('LA-TRC-T80 A key file that is missing or outside the root is test-file-missing alone; for a planned test a missing one is a warning', () => {
    expect(ofRecord(claims, 'TC-D-T06')).toEqual([{
      severity: 'error', check: 'test-file-missing', record: 'TC-D-T06',
      message: 'Test TC-D-T06 names the key file code/shared/missing.txt, which does not exist.',
    }]);
    expect(ofRecord(claims, 'TC-D-T07')).toEqual([{
      severity: 'error', check: 'test-file-missing', record: 'TC-D-T07',
      message: 'Test TC-D-T07 names the key file ../outside.txt, which is outside the product root; name a file under it.',
    }]);
    expect(ofRecord(claims, 'TC-D-T09')).toEqual([{
      severity: 'warning', check: 'test-file-missing', record: 'TC-D-T09',
      message: 'Test TC-D-T09 names the key file code/shared/later.txt, which does not exist yet.',
    }]);
    // A missing key file backs no proof: DR03 stays unproved.
    expect(ofCheck(claims, 'unproved').map((p) => p.record)).toContain('TC-D-DR03');
  });

  it('LA-TRC-T81 With a key_file and no key, the proved IDs are looked for in the key file', () => {
    expect(ofRecord(claims, 'TC-D-T08')).toEqual([]);
    expect(claims.coverage[0].gaps.filter((g) => g.missing === 'proves').map((g) => g.id)).not.toContain('TC-D-DR02');
    for (const check of PROOF_FILE_CHECKS) expect(ofCheck(claims, check), check).toEqual(ofCheck(claims, check).filter((p) => p.record === 'TC-D-T05'));
  });
});

describe('flow paths', () => {
  it('LA-AUT-T94 Steps are numbered within their path, main by default, and path names match trimmed in any case', () => {
    expect(claims.records.find((r) => r.id === 'TC-D-F01-S01')?.fields.path).toBe('main');
    expect(claims.records.find((r) => r.id === 'TC-D-F01-S04')?.fields.path).toBe(' Refused ');
    for (const s of ['S01', 'S02', 'S03', 'S04']) expect(ofRecord(claims, `TC-D-F01-${s}`)).toEqual([]);
  });

  it('LA-AUT-T95 A repeated position on a path is refused by the store, and a path whose numbering skips is a step-order error', async () => {
    const found = ofCheck(claims, 'step-order');
    expect(found.map((p) => [p.record, p.message])).toEqual([
      ['TC-D-F02-S02', 'Flow step TC-D-F02-S02 has position 4 in flow TC-D-F02, but no step has position 2, 3; number the steps of a flow 1, 2, 3 and so on, with no gaps.'],
      // Reported once, on the first step after the first gap, naming every missing number.
      ['TC-D-F04-S01', 'Flow step TC-D-F04-S01 has position 2 on path refused in flow TC-D-F04, but no step of that path has position 1, 4, 5; number the steps of a path 1, 2, 3 and so on, with no gaps.'],
    ]);
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    // Two steps with one flow, path and position: the second is refused.
    const data = everyKind();
    const twin = { ...data.flow_step[0], id: 'TL-LEND-F01-S02', title: 'Pick again' };
    expect(await refusals(withTable(data, 'flow_step', [data.flow_step[0], twin]))).toEqual([
      expect.objectContaining({ rule: 'unique', file: 'data/flow_step.jsonl', line: 2, key: 'TL-LEND-F01-S02' }),
    ]);
  });

  it('LA-AUT-T96 A position that is not a whole number, or a step with none, is refused, so a gap is only ever between whole numbers', async () => {
    const data = everyKind();
    const { position: _position, ...unnumbered } = data.flow_step[0];
    expect(await refusals(withTable(data, 'flow_step', [unnumbered]))).toEqual([expect.objectContaining({ rule: 'required', file: 'data/flow_step.jsonl' })]);
    expect(await refusals(withTable(data, 'flow_step', [{ ...data.flow_step[0], position: 'x' }]))).toEqual([expect.objectContaining({ rule: 'column', file: 'data/flow_step.jsonl' })]);
    // F03 is numbered 1, 2, 3 on main and 1, 2, 3 on api: nothing to report.
    expect(claims.problems.filter((p) => p.record?.startsWith('TC-D-F03'))).toEqual([]);
  });
});

describe('grouping levels', () => {
  it('LA-AUT-T97 A domain rule may sit under an entity, and a layer under a layer', () => {
    const kind = (name: string) => twins.kinds.find((k) => k.kind === name);
    // Nearest first: a record's parent is the first of these that it names.
    expect(kind('domain_rule')?.parent_kinds).toEqual(['entity', 'aggregate', 'domain']);
    expect(kind('layer')?.parent_kinds).toEqual(['layer', 'domain']);
    expect(ofCheck(twins, 'data-refused')).toEqual([]);
  });

  it("LA-AUT-T98 A rule under an entity, and a component in a sub-layer, belong to their ancestors' domain and product", () => {
    const record = (id: string) => twins.records.find((r) => r.id === id);
    for (const id of ['LV-A-DR01', 'LV-A-LAY02', 'LV-A-C01']) expect(record(id), id).toMatchObject({ product: 'LV', domain: 'LV-A' });
    expect(record('LV-A-DR01')?.parent).toBe('LV-A-EN01');
    expect(record('LV-A-C01')?.parent).toBe('LV-A-LAY02');
  });

  it("LA-AUT-T99 An entity's fields are entity_field rows, each with a name, a meaning and a type", async () => {
    const fields = (id: string) => twins.records.find((r) => r.id === id)?.parts.entity_field?.map(({ entity_id: _e, ...f }) => f);
    expect(fields('LV-A-EN01')).toHaveLength(2);
    expect(fields('LV-A-EN01')).toEqual(fields('LV-B-EN01'));
    expect(fields('LV-A-EN01')?.[0]).toEqual({ position: 1, name: 'Tool', meaning: 'The tool lent.', type: 'Reference', example: 'T-1' });
    expect(ofCheck(twins, 'entity-fields')).toEqual([]);
    // The meaning is one column, required: a field without it is refused.
    const data = everyKind();
    const { meaning: _meaning, ...bare } = data.entity_field[0];
    expect(await refusals(withTable(data, 'entity_field', [bare]))).toEqual([expect.objectContaining({ rule: 'required', file: 'data/entity_field.jsonl' })]);
  });

  it('LA-AUT-T100 Coverage counts a rule under an entity and a component in a sub-layer as one level up', () => {
    const of = (domain: string) => {
      const c = twins.coverage.find((x) => x.domain === domain);
      expect(c, domain).toBeDefined();
      return JSON.parse(JSON.stringify({ ...c, domain: 'X' }).replaceAll(`${domain}-`, 'X-'));
    };
    expect(of('LV-A')).toEqual(of('LV-B'));
    const a = twins.coverage.find((x) => x.domain === 'LV-A')!;
    expect(a.obligations.find((o) => o.kind === 'domain_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
    expect(a.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
  });

  it('LA-AUT-T101 Every check reports the deeper domain exactly as the flatter one, apart from its extra layer', () => {
    const layers = new Set(twins.records.filter((r) => r.kind === 'layer').map((r) => r.id));
    const of = (domain: string) =>
      twins.problems
        .filter((p) => p.record?.startsWith(`${domain}-`) && !layers.has(p.record))
        .map((p) => JSON.parse(JSON.stringify(p).replaceAll(`${domain}-`, 'X-')))
        .sort((x, y) => `${x.check} ${x.record} ${x.message}`.localeCompare(`${y.check} ${y.record} ${y.message}`));
    const a = of('LV-A');
    expect(a).toEqual(of('LV-B'));
    // The comparison covers coverage, proof and file warnings, not an empty list.
    expect([...new Set(a.map((p) => p.check))].sort()).toEqual(['component-file-missing', 'proof-still-owed', 'unproved']);
    for (const check of ['rule-not-applied', 'obligation-outside-domain', 'component-outside-layer', 'unsatisfied']) {
      expect(ofCheck(twins, check), check).toEqual([]);
    }
  });

  it('LA-AUT-T102 Sub-layers of one layer need their own positions; they may reuse the positions of layers elsewhere', () => {
    expect(ofCheck(twins, 'layer-order').map((p) => [p.record, p.message])).toEqual([
      ['LV-C-LAY02', 'Layer LV-C-LAY02 has position 1 in layer LV-C-LAY01, the same as LV-C-LAY03; each sub-layer of a layer needs its own position.'],
      ['LV-C-LAY03', 'Layer LV-C-LAY03 has position 1 in layer LV-C-LAY01, the same as LV-C-LAY02; each sub-layer of a layer needs its own position.'],
    ]);
  });
});
