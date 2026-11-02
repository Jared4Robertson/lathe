// The stage domains' rules the store keeps: a specification the schema's keys, foreign keys and checks, and the store's own
// validation rules, refuse when the data loads. The invariants are their aggregates' own rules, tested in
// test/rules.test.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { type Row, type StoreProblem } from '../../src/index.ts';
import { refusals } from '../helpers.ts';
import { everyKind, removeData, type Data } from './fixture.ts';

afterAll(removeData);

/** The fixture with one row of a table changed; a change to undefined leaves the column out. */
function changingRow(table: string, at: number, changes: Record<string, Row[string] | undefined>, data: Data = everyKind()): Data {
  const row = Object.fromEntries(Object.entries({ ...data[table][at], ...changes }).filter(([, v]) => v !== undefined)) as Row;
  return { ...data, [table]: data[table].map((r, i) => (i === at ? row : r)) };
}

const one = (rule: string, extra: Partial<StoreProblem> = {}) => [expect.objectContaining({ rule, ...extra })];

describe("The stage domains' specifications", () => {
  it('LA-PRD-UC37-R03-T03 A missing, unknown or disallowed parent is refused, as is a second parent or a parent column on a kind with no owner', async () => {
    // Missing: the parent column is required.
    expect(await refusals(changingRow('aggregate', 1, { domain_id: undefined }))).toEqual(one('required', { table: 'aggregate', file: 'data/aggregate.jsonl', line: 2, message: 'aggregate.domain_id is required' }));
    // Unknown, or a record of a kind the aggregate may not sit under: the foreign key names no domain.
    for (const parent of ['TL-NOPE', 'TL-LEND-A1', 'TL']) {
      expect(await refusals(changingRow('aggregate', 1, { domain_id: parent })), parent).toEqual(
        one('foreign-key', { table: 'aggregate', file: 'data/aggregate.jsonl', line: 2, message: `aggregate TL-LEND-A2: domain_id "${parent}" names no domain` }),
      );
    }
    // A kind with two or three possible parents gives exactly one.
    expect(await refusals(changingRow('endpoint', 0, { query_id: 'TL-LEND-QRY01' }))).toEqual(one('check', { table: 'endpoint', file: 'data/endpoint.jsonl', line: 1 }));
    expect(await refusals(changingRow('endpoint', 0, { command_id: undefined }))).toEqual(one('check', { table: 'endpoint', file: 'data/endpoint.jsonl', line: 1 }));
    expect(await refusals(changingRow('table', 2, { entity_id: 'TL-LEND-EN02' }))).toEqual(one('check', { table: 'table', file: 'data/table.jsonl', line: 3 }));
    expect(await refusals(changingRow('question', 0, { product_id: 'TL' }))).toEqual(one('check', { table: 'question', file: 'data/question.jsonl', line: 1 }));
    expect(await refusals(changingRow('question', 0, { domain_id: undefined }))).toEqual(one('check', { table: 'question', file: 'data/question.jsonl', line: 1 }));
    // Each allowed parent loads: an endpoint under its query, a table under its domain, a question under its product.
    let allowed = changingRow('endpoint', 0, { command_id: undefined, query_id: 'TL-LEND-QRY01' });
    allowed = changingRow('question', 0, { domain_id: undefined, product_id: 'TL', id: 'TL-Q01' }, allowed);
    allowed = changingRow('about', 0, { source_id: 'TL-Q01' }, allowed);
    expect(await refusals(allowed)).toEqual([]);
    // A product and the kinds with no owner have no parent column.
    for (const [table, column] of [
      ['product', 'product_id'],
      ['value_object', 'domain_id'],
      ['specification', 'domain_id'],
      ['view', 'product_id'],
      ['integration', 'product_id'],
      ['ui_component', 'view_id'],
    ] as const) {
      const problems = await refusals(changingRow(table, 0, { [column]: 'TL-LEND' }));
      expect(problems, table).toEqual(one('column', { table, file: `data/${table}.jsonl`, line: 1, message: expect.stringContaining(`${table} has no column "${column}"`) }));
    }
  });
});

