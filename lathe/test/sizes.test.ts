// Structure sizes (FORMAT.md section 5): too-many-children, a record with more children of one kind than the
// product's structure.maxChildren setting (default 15), and lone-child, a capability or layer with one child.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MAX_CHILDREN, loadConfig, loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const recordsOf = (ws: Workspace, check: string) => ofCheck(ws, check).map((p) => p.record).sort();

let sizes: Workspace;
let defaults: Workspace;
beforeAll(async () => {
  // structure-sizes sets maxChildren to 3.
  sizes = await loadWorkspace(fixture('structure-sizes'));
  defaults = await loadWorkspace(fixture('structure-default'));
});

describe('too-many-children', () => {
  it('LA-CHK-T333 A flow\'s steps are counted per path, and the message names a path other than main', () => {
    // SZ-D-F01 has 3 steps on main and 3 on refused: 6 steps, but no path has more than 3.
    expect(recordsOf(sizes, 'too-many-children')).not.toContain('SZ-D-F01');
    const f02 = ofCheck(sizes, 'too-many-children').filter((p) => p.record === 'SZ-D-F02');
    expect(f02.map((p) => p.message)).toEqual([expect.stringContaining('has 4 children of kind flow_step on path refused, more than the 3')]);
  });

  it('LA-CHK-T277 A record with more children of one kind than maxChildren is a warning naming the parent, kind and count', () => {
    const found = ofCheck(sizes, 'too-many-children').find((p) => p.record === 'SZ-D-A1');
    expect(found).toEqual({
      severity: 'warning',
      check: 'too-many-children',
      record: 'SZ-D-A1',
      message: expect.stringContaining('Aggregate SZ-D-A1 has 4 children of kind domain_rule, more than the 3'),
    });
    expect(found?.message).toContain('add a level between them, such as a capability, a layer or another aggregate');
  });

  it('LA-CHK-T278 A record with exactly maxChildren children of a kind is not reported', () => {
    expect(recordsOf(sizes, 'too-many-children')).not.toContain('SZ-D-A2');
  });

  it('LA-CHK-T279 Children are counted per kind', () => {
    // SZ-D has 4 capabilities, 2 aggregates and 2 layers: 8 children, but only the capabilities are too many.
    expect(ofCheck(sizes, 'too-many-children').filter((p) => p.record === 'SZ-D').map((p) => p.message)).toEqual([
      expect.stringContaining('has 4 children of kind capability'),
    ]);
  });

  it('LA-CHK-T280 Tests are never counted, however many a record holds', () => {
    // SZ-D holds 5 tests directly.
    expect(sizes.records.filter((r) => r.kind === 'test' && r.parent === 'SZ-D')).toHaveLength(5);
    expect(ofCheck(sizes, 'too-many-children').some((p) => p.message.includes('kind test'))).toBe(false);
  });

  it('LA-CHK-T281 Without the setting, maxChildren is 15', () => {
    expect(DEFAULT_MAX_CHILDREN).toBe(15);
    expect(loadConfig(fixture('structure-default')).maxChildren).toBe(15);
    // SD-D has 16 components, SD-E has 15.
    expect(ofCheck(defaults, 'too-many-children')).toEqual([
      expect.objectContaining({ record: 'SD-D', message: expect.stringContaining('16 children of kind component, more than the 15') }),
    ]);
  });

  it('LA-CHK-T282 maxChildren is read from structure.maxChildren in lathe.config.json', () => {
    expect(loadConfig(fixture('structure-sizes')).maxChildren).toBe(3);
  });

  it('LA-CHK-T283 A maxChildren that is not a whole number of at least 1 is refused', async () => {
    expect(() => loadConfig(fixture('structure-bad-config'))).toThrow(/structure.maxChildren must be a whole number of at least 1/);
    await expect(loadWorkspace(fixture('structure-bad-config'))).rejects.toThrow(/maxChildren/);
  });
});

describe('lone-child', () => {
  it('LA-CHK-T284 A capability with exactly one child is a warning naming the child', () => {
    expect(ofCheck(sizes, 'lone-child').find((p) => p.record === 'SZ-D-CAP01')).toEqual({
      severity: 'warning',
      check: 'lone-child',
      record: 'SZ-D-CAP01',
      message: 'Capability SZ-D-CAP01 has only one child, SZ-D-UC01; merge it into a neighboring capability, or give it more.',
    });
  });

  it('LA-CHK-T285 A layer with exactly one child is a warning', () => {
    expect(ofCheck(sizes, 'lone-child').find((p) => p.record === 'SZ-D-LAY01')?.message).toBe(
      'Layer SZ-D-LAY01 has only one child, SZ-D-C01; merge it into a neighboring layer, or give it more.',
    );
  });

  it("LA-CHK-T286 A lone child counts every kind of child, and only the record's own children", () => {
    // SZ-D-CAP04 holds a use case and a flow: two children of different kinds, so it is not lone.
    // SZ-D-CAP01's use case has two requirements, which are not CAP01's children, so CAP01 is still lone.
    expect(recordsOf(sizes, 'lone-child')).not.toContain('SZ-D-CAP04');
    expect(recordsOf(sizes, 'lone-child')).toContain('SZ-D-CAP01');
  });

  it('LA-CHK-T287 A capability or layer with no children, or with two, is not reported', () => {
    expect(recordsOf(sizes, 'lone-child')).toEqual(['SZ-D-CAP01', 'SZ-D-LAY01']);
  });
});

describe('the structure checks', () => {
  it('LA-CHK-T288 Too many children and a lone child are warnings, never errors', () => {
    const found = [...ofCheck(sizes, 'too-many-children'), ...ofCheck(sizes, 'lone-child'), ...ofCheck(defaults, 'too-many-children')];
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.severity === 'warning')).toBe(true);
    expect(sizes.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(defaults.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('LA-CHK-T289 A check reads the maxChildren setting from the settings table', () => {
    // The fixture's own check reports the structure.maxChildren row it reads.
    expect(ofCheck(sizes, 'max-children-setting').map((p) => p.message)).toEqual(['structure.maxChildren is 3.']);
  });
});
