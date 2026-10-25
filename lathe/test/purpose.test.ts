// Components and tests with no purpose: component-satisfies-nothing and test-proves-nothing.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const recordsOf = (ws: Workspace, check: string) =>
  ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const PURPOSE = ['component-satisfies-nothing', 'test-proves-nothing'];

let purpose: Workspace;
let good: Workspace;
beforeAll(async () => {
  purpose = await loadWorkspace(fixture('purpose'));
  good = await loadWorkspace(fixture('good'));
});

describe('records with no purpose', () => {
  it('LA-CHK-T49 A component that satisfies nothing is a warning', () => {
    // C01 satisfies a requirement; C02 only implements a view and depends on C01; C03 satisfies a record that is gone.
    expect(recordsOf(purpose, 'component-satisfies-nothing')).toEqual(['PP-D-C02', 'PP-D-C03']);
    const message = purpose.problems.find((p) => p.check === 'component-satisfies-nothing')?.message;
    expect(message).toContain('"satisfies"');
    expect(message).toContain('shared infrastructure');
  });

  it('LA-CHK-T50 A test that proves and supports nothing is a warning', () => {
    // T01 proves, T02 only supports, T03 is planned but proves; T04 only runs a flow and covers a component; T05 has no links.
    expect(recordsOf(purpose, 'test-proves-nothing')).toEqual(['PP-D-T04', 'PP-D-T05']);
    const message = purpose.problems.find((p) => p.check === 'test-proves-nothing')?.message;
    expect(message).toContain('"proves"');
    expect(message).toContain('"supports"');
  });

  it('LA-CHK-T51 A component or test with no purpose is a warning that breaks nothing', () => {
    const found = purpose.problems.filter((p) => PURPOSE.includes(p.check));
    expect(new Set(found.map((p) => p.check))).toEqual(new Set(PURPOSE));
    for (const p of found) expect(p.severity).toBe('warning');
    // The only error is the dangling link the fixture means to have.
    expect(purpose.problems.filter((p) => p.severity === 'error').map((p) => p.check)).toEqual(['dangling-link']);
    expect(good.problems.filter((p) => PURPOSE.includes(p.check))).toEqual([]);
  });
});
