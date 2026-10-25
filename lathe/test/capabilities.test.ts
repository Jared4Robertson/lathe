// Capabilities (ordered slices of a domain) and patterns (shared behavior with settings).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record).sort();

const NEW_CHECKS = [
  'capability-order',
  'use-case-outside-capability',
  'pattern-setting-missing',
  'pattern-setting-clash',
  'bad-pattern-settings',
];

let good: Workspace;
let broken: Workspace;
beforeAll(async () => {
  good = await loadWorkspace(fixture('cap-good'));
  broken = await loadWorkspace(fixture('cap-broken'));
});

describe('the meta-model', () => {
  it('LA-CHK-T70 Capabilities, patterns and the follows relation are in the meta-model', () => {
    const kind = (name: string) => good.kinds.find((k) => k.kind === name);
    expect(kind('capability')).toMatchObject({ stage: 'define', parent_kinds: ['domain'], required_fields: ['order'], obligation: false });
    expect(kind('pattern')).toMatchObject({ stage: 'define', parent_kinds: ['product'], required_fields: [], obligation: false });
    for (const name of ['use_case', 'flow', 'test']) expect(kind(name)?.parent_kinds).toEqual(['domain', 'capability']);
    expect(good.relations.filter((r) => r.relation === 'follows')).toEqual([
      expect.objectContaining({ source_kind: 'use_case', target_kind: 'pattern', role: '' }),
      expect.objectContaining({ source_kind: 'domain', target_kind: 'pattern', role: '' }),
    ]);
  });

  it('LA-CHK-T71 Use cases, flows and tests may sit under a capability, and use cases follow patterns', () => {
    expect(good.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(good.problems.filter((p) => NEW_CHECKS.includes(p.check))).toEqual([]);
    expect(good.links).toContainEqual({ source: 'CX-D-UC01', relation: 'follows', target: 'CX-PAT-ACTION' });
  });

  it("LA-CHK-T72 A record under a capability belongs to the capability's domain and counts in its coverage", () => {
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

describe('capability checks', () => {
  it('LA-CHK-T73 An order that is not a whole number is an error', () => {
    const found = ofCheck(broken, 'capability-order').filter((p) => p.message.includes('not a whole number'));
    expect(found.map((p) => p.record)).toEqual(['YX-D-CAP03', 'YX-D-CAP05']);
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    expect(found[0].message).toContain('"first"');
    expect(found[1].message).toContain('"2.5"');
  });

  it('LA-CHK-T74 Two capabilities in one domain with the same order are errors; other domains may reuse it', () => {
    const found = ofCheck(broken, 'capability-order').filter((p) => p.message.includes('the same as'));
    // 1 and 01 are the same number.
    expect(found.map((p) => p.record)).toEqual(['YX-D-CAP01', 'YX-D-CAP02']);
    expect(found[0].message).toContain('YX-D-CAP02');
    expect(found[1].message).toContain('YX-D-CAP01');
    expect(broken.problems.some((p) => p.record === 'YX-E-CAP01')).toBe(false);
  });

  it('LA-CHK-T75 A use case directly under a domain that has capabilities is a warning', () => {
    const found = ofCheck(broken, 'use-case-outside-capability');
    expect(found).toEqual([
      { severity: 'warning', check: 'use-case-outside-capability', record: 'YX-D-UC01', message: expect.stringContaining('YX-D') },
    ]);
    // YX-F has no capabilities, so its use case may sit under the domain.
    expect(recordsOf(broken, 'use-case-outside-capability')).not.toContain('YX-F-UC01');
  });
});

describe('pattern checks', () => {
  it("LA-CHK-T76 A use case that lacks a field for one of its pattern's settings is an error", () => {
    const found = ofCheck(broken, 'pattern-setting-missing').filter((p) => p.record === 'YX-D-UC02');
    expect(found).toEqual([
      { severity: 'error', check: 'pattern-setting-missing', record: 'YX-D-UC02', message: expect.stringContaining('no "audit" field') },
    ]);
  });

  it('LA-CHK-T77 "Not applicable:" with a reason, in any letter case, counts as given; without a reason it does not', () => {
    // YX-D-UC03: permission is "NOT APPLICABLE: it only reads"; audit is "not applicable:" alone.
    const found = ofCheck(broken, 'pattern-setting-missing').filter((p) => p.record === 'YX-D-UC03');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('"audit"');
    expect(found[0].message).toContain('gives no reason');
    // CX-D-UC01 gives audit as "Not applicable:" with a reason.
    expect(ofCheck(good, 'pattern-setting-missing')).toEqual([]);
  });

  it('LA-CHK-T78 A use case following two patterns that share a setting is a warning', () => {
    const found = ofCheck(broken, 'pattern-setting-clash');
    expect(found).toEqual([
      { severity: 'warning', check: 'pattern-setting-clash', record: 'YX-D-UC04', message: expect.stringContaining('"audit"') },
    ]);
    expect(found[0].message).toContain('YX-PAT-A and YX-PAT-B');
    // UC04 gives every setting of both patterns, so nothing is missing.
    expect(recordsOf(broken, 'pattern-setting-missing')).not.toContain('YX-D-UC04');
  });

  it("LA-CHK-T79 A pattern's settings that are not valid field names are errors", () => {
    const found = ofCheck(broken, 'bad-pattern-settings');
    expect(found.map((p) => [p.severity, p.record])).toEqual([
      ['error', 'YX-PAT-BAD'],
      ['error', 'YX-PAT-BAD'],
    ]);
    expect(found.map((p) => p.message).join(' ')).toContain('"Bad-Name"');
    expect(found.map((p) => p.message).join(' ')).toContain('"title", which is not a valid field name: every record already has it');
    // Invalid names are reported once, against the pattern, not as missing from the use cases that follow it.
    expect(recordsOf(broken, 'pattern-setting-missing')).not.toContain('YX-D-UC05');
    // Every error in the fixture comes from one of the new checks.
    const errors = broken.problems.filter((p) => p.severity === 'error');
    expect([...new Set(errors.map((p) => p.check))].sort()).toEqual(['bad-pattern-settings', 'capability-order', 'pattern-setting-missing']);
  });
});
