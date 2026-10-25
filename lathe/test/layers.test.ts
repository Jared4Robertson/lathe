// Layers (FORMAT.md section 16): ordered parts of a domain's technical specification that hold its
// components. The layer-order and component-outside-layer checks, and a component in a layer belonging to
// the layer's domain everywhere a domain matters.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);

let twins: Workspace;
let broken: Workspace;
beforeAll(async () => {
  // layers-twins: domains LY-A and LY-B are alike, except that LY-A puts its components in a layer.
  twins = await loadWorkspace(fixture('layers-twins'));
  broken = await loadWorkspace(fixture('layers-broken'));
});

describe('the meta-model', () => {
  it('LA-CHK-T270 A layer sits in a domain or a layer with an order, and holds components and sub-layers', () => {
    const kind = (name: string) => twins.kinds.find((k) => k.kind === name);
    expect(kind('layer')).toMatchObject({
      stage: 'design', section: 'technical-specification', parent_kinds: ['domain', 'layer'], required_fields: ['order'], obligation: false,
    });
    expect(kind('component')?.parent_kinds).toEqual(['domain', 'layer']);
    expect(twins.kinds.filter((k) => k.parent_kinds.includes('layer')).map((k) => k.kind)).toEqual(['layer', 'component']);
    // Each product names its own layers, as records.
    expect(twins.records.filter((r) => r.kind === 'layer').map((r) => [r.id, r.title])).toEqual([
      ['LY-A-LAY01', 'Services'],
    ]);
    expect(twins.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('layer checks', () => {
  it('LA-CHK-T271 A layer order that is not a whole number is a layer-order error', () => {
    const found = ofCheck(broken, 'layer-order').filter((p) => p.message.includes('not a whole number'));
    expect(found.map((p) => p.record)).toEqual(['LZ-D-LAY03', 'LZ-D-LAY04']);
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    expect(found[0].message).toContain('"first"');
    expect(found[1].message).toContain('"2.5"');
  });

  it('LA-CHK-T272 Two layers in one domain with the same order are errors; another domain may reuse it', () => {
    const found = ofCheck(broken, 'layer-order').filter((p) => p.message.includes('the same as'));
    // 1 and 01 are the same number.
    expect(found.map((p) => p.record)).toEqual(['LZ-D-LAY01', 'LZ-D-LAY02']);
    expect(found[0].message).toContain('LZ-D-LAY02');
    expect(found[1].message).toContain('LZ-D-LAY01');
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    expect(ofCheck(broken, 'layer-order').some((p) => p.record === 'LZ-E-LAY01' || p.record === 'LZ-D-LAY05')).toBe(false);
  });

  it('LA-CHK-T273 A component directly in a domain that has layers is a warning; a domain without layers is fine', () => {
    expect(ofCheck(broken, 'component-outside-layer')).toEqual([
      { severity: 'warning', check: 'component-outside-layer', record: 'LZ-D-C01', message: expect.stringContaining('LZ-D') },
    ]);
    // LZ-F has no layers, so its component may sit in the domain; components in layers are not reported.
    expect(ofCheck(twins, 'component-outside-layer')).toEqual([]);
  });
});

describe('a component in a layer belongs to its domain', () => {
  it("LA-CHK-T274 A component in a layer belongs to the layer's domain and product", () => {
    const record = (id: string) => twins.records.find((r) => r.id === id);
    for (const id of ['LY-A-LAY01', 'LY-A-C01', 'LY-A-C02']) expect(record(id), id).toMatchObject({ product: 'LY', domain: 'LY-A' });
    expect(record('LY-A-C01')?.parent).toBe('LY-A-LAY01');
    expect(record('LY-B-C01')).toMatchObject({ parent: 'LY-B', domain: 'LY-B' });
  });

  it('LA-CHK-T275 Coverage counts a component in a layer exactly as one directly in the domain', () => {
    const of = (domain: string) => {
      const c = twins.coverage.find((x) => x.domain === domain);
      expect(c, domain).toBeDefined();
      return JSON.parse(JSON.stringify({ ...c, domain: 'X' }).replaceAll(`${domain}-`, 'X-'));
    };
    expect(of('LY-A')).toEqual(of('LY-B'));
    const a = twins.coverage.find((x) => x.domain === 'LY-A')!;
    // The layered component designs and builds what it satisfies: a requirement, a domain rule, and the pattern
    // rule LY-A owes because its use case follows the pattern (made a full obligation by the fixture's extension).
    expect(a.obligations.find((o) => o.kind === 'requirement')).toMatchObject({ total: 2, designed: 2, built: 1 });
    expect(a.obligations.find((o) => o.kind === 'domain_rule')).toMatchObject({ total: 1, designed: 1, built: 1 });
    expect(a.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
  });

  it('LA-CHK-T276 Every check reports a domain with layers exactly as the same domain without them', () => {
    const of = (domain: string) =>
      twins.problems
        .filter((p) => p.record?.startsWith(`${domain}-`))
        .map((p) => JSON.parse(JSON.stringify(p).replaceAll(`${domain}-`, 'X-')))
        .sort((x, y) => `${x.check} ${x.record}`.localeCompare(`${y.check} ${y.record}`));
    const a = of('LY-A');
    expect(a).toEqual(of('LY-B'));
    // The comparison covers coverage warnings, proof warnings and flow step checks, not an empty list.
    expect(a.map((p) => p.check).sort()).toEqual(['component-file-missing', 'proof-counts-nowhere', 'proof-still-owed', 'unproved']);
    for (const check of ['unsatisfied', 'flow-step-fulfills-outside-flow', 'flow-fulfills-differs-from-steps', 'obligation-outside-domain']) {
      expect(ofCheck(twins, check), check).toEqual([]);
    }
  });
});
