// Authoring's rules the store keeps: a specification the schema's keys, foreign keys and checks, and the store's own
// validation rules, refuse when the data loads; and the Next ID domain service. The invariants are their aggregates'
// own rules, tested in test/authoring/rules.test.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { nextId } from '../../src/cli/operations.ts';
import { type Row, type StoreProblem } from '../../src/index.ts';
import { refusals } from '../helpers.ts';
import { everyKind, removeData, writeData, type Data } from './fixture.ts';

afterAll(removeData);

/** The fixture with rows added to some tables. */
function adding(rows: Data, data: Data = everyKind()): Data {
  for (const [table, added] of Object.entries(rows)) data[table] = [...(data[table] ?? []), ...added];
  return data;
}

/** The fixture with one row of a table changed; a change to undefined leaves the column out. */
function changingRow(table: string, at: number, changes: Record<string, Row[string] | undefined>, data: Data = everyKind()): Data {
  const row = Object.fromEntries(Object.entries({ ...data[table][at], ...changes }).filter(([, v]) => v !== undefined)) as Row;
  return { ...data, [table]: data[table].map((r, i) => (i === at ? row : r)) };
}

const one = (rule: string, extra: Partial<StoreProblem> = {}) => [expect.objectContaining({ rule, ...extra })];

describe("Authoring's specifications", () => {
  it('LA-PLT-UC01-R08-T03 A missing, unknown or disallowed parent is refused, as is a second parent or a parent column on a kind with no owner', async () => {
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

describe("Authoring's domain services", () => {
  it("LA-AUT-DS01-T01 The next ID puts the parent's, domain's or product's ID into the kind's pattern, numbered one past the highest number any record has", async () => {
    const root = writeData(
      adding({
        // A gap at A3 (never filled: IDs are not reused), a view numbered 7 and a value object with no constraint.
        aggregate: [{ id: 'TL-LEND-A4', title: 'Member', domain_id: 'TL-LEND', identity: 'Member ID', description: 'A member of the library.' }],
        view: [{ id: 'TL-V07', title: 'Desk', description: 'The desk where tools go out.' }],
        value_object: [{ id: 'TL-VO02', title: 'Phone number', description: 'Where a member takes calls.' }],
      }),
    );
    const next = async (kind: string, under: string) => {
      const outcome = await nextId(root, kind, under);
      if (!outcome.ok) throw new Error(outcome.problems.map((p) => p.message).join('; '));
      return outcome.value;
    };
    // The parent's ID.
    expect(await next('uc_requirement', 'TL-LEND-UC01')).toBe('TL-LEND-UC01-R02');
    expect(await next('flow_step', 'TL-LEND-UC01-FL01')).toBe('TL-LEND-UC01-FL01-S02');
    expect(await next('constraint', 'TL-VO01')).toBe('TL-VO01-C02');
    // The domain's ID, from the domain or from the parent inside it.
    expect(await next('aggregate', 'TL-LEND')).toBe('TL-LEND-A5');
    expect(await next('command', 'TL-LEND-EN01')).toBe('TL-LEND-CMD02');
    expect(await next('policy', 'TL-LEND-CMD01')).toBe('TL-LEND-PO02');
    // The product's ID, for a kind with no owner.
    expect(await next('view', 'TL')).toBe('TL-V08');
    expect(await next('integration', 'TL')).toBe('TL-INT02');
    // A domain-scoped kind counts the whole domain, not the parent; a parent-scoped kind's first record is number 1.
    expect(await next('entity', 'TL-LEND-A2')).toBe('TL-LEND-EN03');
    expect(await next('constraint', 'TL-VO02')).toBe('TL-VO02-C01');
    // A parent of a kind the record cannot sit under has no next ID.
    const wrong = await nextId(root, 'uc_requirement', 'TL-LEND');
    expect(wrong).toEqual({ ok: false, problems: [expect.objectContaining({ rule: 'parent', message: 'a uc_requirement sits under use_case, not under domain TL-LEND' })] });
  });
});
