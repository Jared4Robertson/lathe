// Layers: ordered parts of a domain's technical specification that hold its components. The layer-order and
// component-outside-layer checks, and a component in a layer belonging to the layer's domain everywhere a domain
// matters.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

let twins: Workspace;
let broken: Workspace;
beforeAll(async () => {
  // layers-twins: domains LY-A and LY-B are alike, except that LY-A puts its components in a layer.
  twins = await load('layers-twins');
  broken = await load('layers-broken');
});
afterAll(removeData);

describe('the schema', () => {
  it('LA-AUT-T62 A layer sits in a domain or a layer with a position, and holds components, sub-layers and technical flows', () => {
    const kind = (name: string) => twins.kinds.find((k) => k.kind === name);
    expect(kind('layer')).toMatchObject({
      stage: 'design', section: 'technical-specification', parent_kinds: ['layer', 'domain'], required_fields: ['position'], obligation: false,
    });
    expect(kind('component')?.parent_kinds).toEqual(['layer', 'domain']);
    expect(twins.kinds.filter((k) => k.parent_kinds.includes('layer')).map((k) => k.kind)).toEqual(['layer', 'component', 'design_flow']);
    // Each product names its own layers, as records.
    expect(twins.records.filter((r) => r.kind === 'layer').map((r) => [r.id, r.title])).toEqual([['LY-A-LAY01', 'Services']]);
    expect(twins.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('layer checks', () => {
  it('LA-AUT-T63 A layer position that is not a whole number is refused by the store', async () => {
    const data = everyKind();
    for (const position of ['first', 2.5]) {
      const problems = await refusals(withTable(data, 'layer', [...data.layer, { id: 'TL-LEND-LAY03', title: 'Words', domain_id: 'TL-LEND', position }]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'column', file: 'data/layer.jsonl' })]);
      expect(problems[0].message).toContain('is not a whole number');
    }
  });

  it('LA-AUT-T64 Two layers in one domain with the same position are errors; another domain may reuse it', () => {
    const found = ofCheck(broken, 'layer-order');
    expect(found.map((p) => p.record)).toEqual(['LZ-D-LAY01', 'LZ-D-LAY02']);
    expect(found[0].message).toContain('LZ-D-LAY02');
    expect(found[1].message).toContain('LZ-D-LAY01');
    expect(found.every((p) => p.severity === 'error')).toBe(true);
    expect(found.some((p) => p.record === 'LZ-E-LAY01' || p.record === 'LZ-D-LAY05')).toBe(false);
  });

  it('LA-AUT-T65 A component directly in a domain that has layers is a warning; a domain without layers is fine', () => {
    expect(ofCheck(broken, 'component-outside-layer')).toEqual([
      { severity: 'warning', check: 'component-outside-layer', record: 'LZ-D-C01', message: expect.stringContaining('LZ-D') },
    ]);
    // LZ-F has no layers, so its component may sit in the domain; components in layers are not reported.
    expect(ofCheck(twins, 'component-outside-layer')).toEqual([]);
  });
});

describe('a component in a layer belongs to its domain', () => {
  it("LA-AUT-T66 A component in a layer belongs to the layer's domain and product", () => {
    const record = (id: string) => twins.records.find((r) => r.id === id);
    for (const id of ['LY-A-LAY01', 'LY-A-C01', 'LY-A-C02']) expect(record(id), id).toMatchObject({ product: 'LY', domain: 'LY-A' });
    expect(record('LY-A-C01')?.parent).toBe('LY-A-LAY01');
    expect(record('LY-B-C01')).toMatchObject({ parent: 'LY-B', domain: 'LY-B' });
  });

  it('LA-AUT-T67 Coverage counts a component in a layer exactly as one directly in the domain', () => {
    const of = (domain: string) => {
      const c = twins.coverage.find((x) => x.domain === domain);
      expect(c, domain).toBeDefined();
      return JSON.parse(JSON.stringify({ ...c, domain: 'X' }).replaceAll(`${domain}-`, 'X-'));
    };
    expect(of('LY-A')).toEqual(of('LY-B'));
    const a = twins.coverage.find((x) => x.domain === 'LY-A')!;
    // The layered component designs and builds what it satisfies: a requirement and a domain rule; the pattern rule
    // LY-A owes because its use case follows the pattern asks for proof only.
    expect(a.obligations.find((o) => o.kind === 'requirement')).toMatchObject({ total: 2, designed: 2, built: 1 });
    expect(a.obligations.find((o) => o.kind === 'domain_rule')).toMatchObject({ total: 1, designed: 1, built: 1 });
    expect(a.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
  });

  it('LA-AUT-T68 Every check reports a domain with layers exactly as the same domain without them', () => {
    const of = (domain: string) =>
      twins.problems
        .filter((p) => p.record?.startsWith(`${domain}-`))
        .map((p) => JSON.parse(JSON.stringify(p).replaceAll(`${domain}-`, 'X-')))
        .sort((x, y) => `${x.check} ${x.record}`.localeCompare(`${y.check} ${y.record}`));
    const a = of('LY-A');
    expect(a).toEqual(of('LY-B'));
    // The comparison covers coverage warnings, proof warnings and flow step checks, not an empty list.
    expect(a.length).toBeGreaterThan(0);
    expect(a.map((p) => p.check)).toContain('component-file-missing');
    for (const check of ['unsatisfied', 'flow-step-fulfills-outside-flow', 'flow-fulfills-differs-from-steps', 'obligation-outside-domain']) {
      expect(ofCheck(twins, check), check).toEqual([]);
    }
  });
});
