// Capabilities (ordered slices of a domain) and patterns (shared behavior with settings).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record).sort();

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await load('cap-good');
  broken = await load('cap-broken');
});
afterAll(removeData);

const data = everyKind();

describe('the schema', () => {
  it('LA-AUT-T25 Capabilities, patterns and the follows relation are in the schema', () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('capability')).toMatchObject({ stage: 'define', parent_kinds: ['domain'], required_fields: ['position'], obligation: false });
    expect(kind('pattern')).toMatchObject({ stage: 'define', parent_kinds: ['product'], required_fields: [], obligation: false });
    for (const name of ['use_case', 'flow', 'test']) expect(kind(name)?.parent_kinds).toEqual(['capability', 'domain']);
    expect(good.relations.filter((r) => r.relation === 'follows')).toEqual([
      expect.objectContaining({ source_kind: 'domain', target_kind: 'pattern', role: '' }),
      expect.objectContaining({ source_kind: 'use_case', target_kind: 'pattern', role: '' }),
    ]);
  });

  it('LA-AUT-T26 Use cases, flows and tests may sit under a capability, and use cases follow patterns', () => {
    expect(good.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(good.problems.filter((p) => ['use-case-outside-capability', 'pattern-setting-missing'].includes(p.check))).toEqual([]);
    expect(good.links).toContainEqual({ source: 'CX-D-UC01', relation: 'follows', target: 'CX-PAT-ACTION' });
    expect(good.records.find((r) => r.id === 'CX-D-UC01')?.parent).toBe('CX-D-CAP01');
  });

  it("LA-AUT-T27 A record under a capability belongs to the capability's domain and counts in its coverage", () => {
    const record = (id: string) => good.records.find((r) => r.id === id);
    for (const id of ['CX-D-CAP01', 'CX-D-UC01', 'CX-D-UC02-R01', 'CX-D-F01', 'CX-D-T01']) {
      expect(record(id), id).toMatchObject({ product: 'CX', domain: 'CX-D' });
    }
    // A pattern belongs to the product, not to a domain.
    expect(record('CX-PAT-ACTION')).toMatchObject({ product: 'CX', domain: null });
    const requirements = good.coverage.find((c) => c.domain === 'CX-D')?.obligations.find((o) => o.kind === 'requirement');
    expect(requirements).toMatchObject({ total: 2, proved: 1 });
  });
});

describe('capability positions', () => {
  it('LA-AUT-T28 A position that is not a whole number is refused by the store', async () => {
    for (const position of ['first', 2.5]) {
      const problems = await refusals(withTable(data, 'capability', [...data.capability, { id: 'TL-LEND-CAP02', title: 'Words', domain_id: 'TL-LEND', position }]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'column', file: 'data/capability.jsonl', line: 2 })]);
      expect(problems[0].message).toContain('is not a whole number');
    }
  });

  it('LA-AUT-T29 Two capabilities in one domain with the same position are refused; other domains may reuse it', async () => {
    const problems = await refusals(withTable(data, 'capability', [...data.capability, { id: 'TL-LEND-CAP02', title: 'Twin', domain_id: 'TL-LEND', position: 1 }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', table: 'capability', key: 'TL-LEND-CAP02' })]);
    expect(problems[0].message).toContain('TL-LEND-CAP01');
    // YX-E-CAP01 has position 1, as YX-D-CAP01 has: another domain, so both load and neither is reported.
    expect(broken.records.filter((r) => r.kind === 'capability' && r.fields.position === 1).map((r) => r.id).sort()).toEqual(['YX-D-CAP01', 'YX-E-CAP01']);
    expect(broken.problems.some((p) => p.record === 'YX-E-CAP01')).toBe(false);
  });

  it('LA-AUT-T30 A use case directly under a domain that has capabilities is a warning', () => {
    const found = ofCheck(broken, 'use-case-outside-capability');
    expect(found).toEqual([
      { severity: 'warning', check: 'use-case-outside-capability', record: 'YX-D-UC01', message: expect.stringContaining('YX-D') },
    ]);
    // YX-F has no capabilities, so its use case may sit under the domain.
    expect(recordsOf(broken, 'use-case-outside-capability')).not.toContain('YX-F-UC01');
  });
});

describe('pattern settings', () => {
  it("LA-TRC-T17 A use case that gives no value for one of its pattern's settings is an error", () => {
    const found = ofCheck(broken, 'pattern-setting-missing').filter((p) => p.record === 'YX-D-UC02');
    expect(found).toEqual([
      { severity: 'error', check: 'pattern-setting-missing', record: 'YX-D-UC02', message: expect.stringContaining('its setting "audit"') },
    ]);
  });

  it('LA-TRC-T18 A not-applicable setting value counts as given only with a reason: an empty reason is refused', async () => {
    // YX-D-UC03 marks permission not applicable with a reason, and gives nothing for audit.
    const found = ofCheck(broken, 'pattern-setting-missing').filter((p) => p.record === 'YX-D-UC03');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('"audit"');
    // CX-D-UC01 gives audit as not applicable, with a reason.
    expect(ofCheck(good, 'pattern-setting-missing')).toEqual([]);
    const [value] = data.setting_value;
    const empty = await refusals(withTable(data, 'setting_value', [{ follower_id: value.follower_id, pattern_id: value.pattern_id, setting: value.setting, not_applicable: '' }]));
    expect(empty).toEqual([expect.objectContaining({ rule: 'column', file: 'data/setting_value.jsonl' })]);
    const neither = await refusals(withTable(data, 'setting_value', [{ follower_id: value.follower_id, pattern_id: value.pattern_id, setting: value.setting }]));
    expect(neither).toEqual([expect.objectContaining({ rule: 'check', table: 'setting_value' })]);
  });

  it("LA-TRC-T19 Two patterns' settings of one name are separate values: a use case gives each pattern its own", () => {
    // YX-D-UC04 follows YX-PAT-A and YX-PAT-B, which both have "audit"; it gives A's, so B's is still missing.
    const found = ofCheck(broken, 'pattern-setting-missing').filter((p) => p.record === 'YX-D-UC04');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('YX-PAT-B');
    expect(found[0].message).toContain('"audit"');
    const uc04 = broken.records.find((r) => r.id === 'YX-D-UC04')!;
    expect(uc04.parts.setting_value.filter((v) => v.setting === 'audit').map((v) => v.pattern_id)).toEqual(['YX-PAT-A']);
  });

  it("LA-AUT-T31 A pattern's setting that is not a valid field name is refused by the store", async () => {
    for (const name of ['Bad-Name', 'has space']) {
      const problems = await refusals(withTable(data, 'pattern_setting', [...data.pattern_setting, { pattern_id: 'TL-PAT-ACT', position: 2, name }]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'check', table: 'pattern_setting' })]);
    }
    // A setting is its own row, never a record's field, so "title" is a setting like any other: YX-D-UC05 owes it.
    expect(ofCheck(broken, 'pattern-setting-missing').filter((p) => p.record === 'YX-D-UC05').map((p) => p.message)).toEqual([expect.stringContaining('"title"')]);
    // Every error in the fixture is a missing setting value.
    const errors = broken.problems.filter((p) => p.severity === 'error');
    expect([...new Set(errors.map((p) => p.check))]).toEqual(['pattern-setting-missing']);
  });
});
