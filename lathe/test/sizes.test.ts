// Structure sizes: too-many-children, a record with more children of one kind than its product's max_children
// setting (a product_setting row, default 15), and lone-child, a capability or layer with one child.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MAX_CHILDREN, type Workspace } from '../src/index.ts';
import { everyKind, load, ofCheck, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record).sort();
afterAll(removeData);

let sizes: Workspace;
let defaults: Workspace;
beforeAll(async () => {
  // structure-sizes sets max_children to 3.
  sizes = await load('structure-sizes');
  defaults = await load('structure-default');
});

describe('too-many-children', () => {
  it('LA-CHK-T47 A flow\'s steps are counted per path, and the message names a path other than main', () => {
    // SZ-D-F01 has 3 steps on main and 3 on refused: 6 steps, but no path has more than 3.
    expect(recordsOf(sizes, 'too-many-children')).not.toContain('SZ-D-F01');
    const f02 = ofCheck(sizes, 'too-many-children').filter((p) => p.record === 'SZ-D-F02');
    expect(f02.map((p) => p.message)).toEqual([expect.stringContaining('has 4 children of kind flow_step on path refused, more than the 3')]);
  });

  it('LA-CHK-T32 A record with more children of one kind than maxChildren is a warning naming the parent, kind and count', () => {
    const found = ofCheck(sizes, 'too-many-children').find((p) => p.record === 'SZ-D-A1');
    expect(found).toEqual({
      severity: 'warning',
      check: 'too-many-children',
      record: 'SZ-D-A1',
      message: expect.stringContaining('Aggregate SZ-D-A1 has 4 children of kind domain_rule, more than the 3'),
    });
    expect(found?.message).toContain('add a level between them, such as a capability, a layer or another aggregate');
  });

  it('LA-CHK-T33 A record with exactly maxChildren children of a kind is not reported', () => {
    expect(recordsOf(sizes, 'too-many-children')).not.toContain('SZ-D-A2');
  });

  it('LA-CHK-T34 Children are counted per kind', () => {
    // SZ-D has 4 capabilities, 2 aggregates and 2 layers: 8 children, but only the capabilities are too many.
    expect(ofCheck(sizes, 'too-many-children').filter((p) => p.record === 'SZ-D').map((p) => p.message)).toEqual([
      expect.stringContaining('has 4 children of kind capability'),
    ]);
  });

  it('LA-CHK-T35 Tests are never counted, however many a record holds', () => {
    // SZ-D holds 5 tests directly.
    expect(sizes.records.filter((r) => r.kind === 'test' && r.parent === 'SZ-D')).toHaveLength(5);
    expect(ofCheck(sizes, 'too-many-children').some((p) => p.message.includes('kind test'))).toBe(false);
  });

  it('LA-CHK-T36 Without the setting, maxChildren is 15', () => {
    expect(DEFAULT_MAX_CHILDREN).toBe(15);
    // SD-D has 16 components, SD-E has 15.
    expect(ofCheck(defaults, 'too-many-children')).toEqual([
      expect.objectContaining({ record: 'SD-D', message: expect.stringContaining('16 children of kind component, more than the 15') }),
    ]);
  });

  it("LA-CHK-T37 maxChildren is read from the product's product_setting row, max_children", () => {
    // structure-sizes has the row { product_id: SZ, max_children: 3 }; structure-default has none.
    expect(recordsOf(sizes, 'too-many-children')).toEqual(['SZ-D', 'SZ-D-A1', 'SZ-D-F02']);
    expect(ofCheck(sizes, 'too-many-children').every((p) => p.message.includes("more than the 3 that the product's max_children setting allows"))).toBe(true);
  });

  it('LA-CHK-T38 A maxChildren that is not a whole number of at least 1 is refused', async () => {
    const setting = (value: unknown) => withTable(everyKind(), 'product_setting', [{ product_id: 'TL', max_children: value as number }]);
    expect(await refusals(setting(0))).toEqual([expect.objectContaining({ rule: 'check', table: 'product_setting' })]);
    expect(await refusals(setting('lots'))).toEqual([expect.objectContaining({ rule: 'column', table: 'product_setting' })]);
    expect(await refusals(setting(2.5))).toEqual([expect.objectContaining({ rule: 'column', table: 'product_setting' })]);
  });
});

describe('lone-child', () => {
  it('LA-CHK-T39 A capability with exactly one child is a warning naming the child', () => {
    expect(ofCheck(sizes, 'lone-child').find((p) => p.record === 'SZ-D-CAP01')).toEqual({
      severity: 'warning',
      check: 'lone-child',
      record: 'SZ-D-CAP01',
      message: 'Capability SZ-D-CAP01 has only one child, SZ-D-UC01; merge it into a neighboring capability, or give it more.',
    });
  });

  it('LA-CHK-T40 A layer with exactly one child is a warning', () => {
    expect(ofCheck(sizes, 'lone-child').find((p) => p.record === 'SZ-D-LAY01')?.message).toBe(
      'Layer SZ-D-LAY01 has only one child, SZ-D-C01; merge it into a neighboring layer, or give it more.',
    );
  });

  it("LA-CHK-T41 A lone child counts every kind of child, and only the record's own children", () => {
    // SZ-D-CAP04 holds a use case and a flow: two children of different kinds, so it is not lone.
    // SZ-D-CAP01's use case has two requirements, which are not CAP01's children, so CAP01 is still lone.
    expect(recordsOf(sizes, 'lone-child')).not.toContain('SZ-D-CAP04');
    expect(recordsOf(sizes, 'lone-child')).toContain('SZ-D-CAP01');
  });

  it('LA-CHK-T42 A capability or layer with no children, or with two, is not reported', () => {
    expect(recordsOf(sizes, 'lone-child')).toEqual(['SZ-D-CAP01', 'SZ-D-LAY01']);
  });
});

describe('the structure checks', () => {
  it('LA-CHK-T43 Too many children and a lone child are warnings, never errors', () => {
    const found = [...ofCheck(sizes, 'too-many-children'), ...ofCheck(sizes, 'lone-child'), ...ofCheck(defaults, 'too-many-children')];
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(sizes.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(defaults.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('LA-CHK-T44 A check reads the maxChildren setting from the product_setting table', () => {
    // The fixture's own check reports the product_setting row it reads.
    expect(ofCheck(sizes, 'max-children-setting')).toEqual([{ severity: 'warning', check: 'max-children-setting', record: 'SZ', message: 'max_children for SZ is 3.' }]);
  });
});
