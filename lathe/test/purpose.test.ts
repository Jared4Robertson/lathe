// Components and tests with no purpose: component-satisfies-nothing and test-proves-nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Workspace } from '../src/index.ts';
import { everyKind, load, refusals, removeData, withTable } from './helpers.ts';

const recordsOf = (ws: Workspace, check: string) =>
  ws.problems.filter((p) => p.check === check).map((p) => p.record).sort();
const PURPOSE = ['component-satisfies-nothing', 'test-proves-nothing'];

let purpose: Workspace;
let good: Workspace;
beforeAll(async () => {
  purpose = await load('purpose');
  good = await load('good');
});
afterAll(removeData);

describe('records with no purpose', () => {
  it('LA-CHK-T49 A component that satisfies nothing is a warning', () => {
    // C01 satisfies a requirement; C02 only implements a view and depends on C01; C03 links nothing it designs.
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

  it('LA-CHK-T51 A component or test with no purpose is a warning that breaks nothing', async () => {
    const found = purpose.problems.filter((p) => PURPOSE.includes(p.check));
    expect(new Set(found.map((p) => p.check))).toEqual(new Set(PURPOSE));
    for (const p of found) expect(p.severity).toBe('warning');
    expect(purpose.problems.filter((p) => p.severity === 'error')).toEqual([]);
    // A satisfies link to a record that is gone never loads, so it cannot give a component a purpose.
    const data = everyKind();
    const refused = await refusals(withTable(data, 'satisfies', [...data.satisfies, { source_id: 'TL-LEND-C02', target_id: 'TL-LEND-UC01-R09' }]));
    expect(refused).toEqual([expect.objectContaining({ rule: 'foreign-key', table: 'satisfies' })]);
    expect(good.problems.filter((p) => PURPOSE.includes(p.check))).toEqual([]);
  });
});
