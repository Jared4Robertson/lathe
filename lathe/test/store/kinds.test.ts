// Each kind's keys and checks: a good row loads; a bad parent, a duplicate ID, a bad enum value or a missing required
// field fails to load, naming the file, the line and the rule. The refusals across tables are in refusals.test.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, SCHEMA_VERSION, StoreError, type Row, type StoreProblem } from '../../src/index.ts';
import { everyKind, removeData, withTable, writeData, type Data } from './fixture.ts';

afterAll(removeData);

const data = everyKind();
const store = await openStore(writeData(data));
const schema = store.schema;
await store.close();
const kinds = Object.keys(schema.kinds).sort();

// Loads the data and returns the problems it is refused with.
async function refusal(changed: Data): Promise<StoreProblem[]> {
  try {
    const opened = await openStore(writeData(changed));
    await opened.close();
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
  throw new Error('The data loaded, but it should have been refused.');
}

describe('LA-AUT-UC01-R01-T05 the fixture', () => {
  it('has a record of every kind, and a row of every stored table', () => {
    const stored = schema.loadOrder;
    expect(stored.filter((table) => !data[table]?.length)).toEqual([]);
  });

  it('loads, with every row in its table', async () => {
    const opened = await openStore(writeData(data), { latheDataDir: null });
    for (const table of schema.loadOrder) expect(opened.rows(table)).toHaveLength(data[table].length);
    const [count] = await opened.query<{ n: number }>('SELECT count(*)::INTEGER AS n FROM record_id');
    expect(count.n).toBe(kinds.reduce((n, k) => n + data[k].length, 0));
    await opened.close();
  });
});

describe.each(kinds)('the %s table', (kind) => {
  const table = schema.tables[kind];
  const row = data[kind][0];
  const file = `data/${kind}.jsonl`;

  // A product and the kinds with no owner sit under nothing; every other kind has one parent.
  if (schema.kinds[kind].parents.length) it('LA-CHK-UC04-R08-T02 refuses a parent that does not exist', async () => {
    const column = schema.kinds[kind].parents.map((p) => p.column).find((c) => row[c] !== undefined)!;
    const problems = await refusal(withTable(data, kind, [{ ...row, [column]: 'TL-NOPE' }, ...data[kind].slice(1)]));
    expect(problems).toContainEqual(expect.objectContaining({ rule: 'foreign-key', file, line: 1, table: kind }));
    expect(problems.find((p) => p.file === file)!.message).toContain('TL-NOPE');
  });

  it('LA-AUT-SP04-T refuses an ID another record has, of any kind', async () => {
    const other = kind === 'domain' ? 'TL' : 'TL-LEND';
    const problems = await refusal(withTable(data, kind, [...data[kind], { ...row, id: other }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique-id', key: other })]);
    // One of the two rows is named, with the other's file and line in the message.
    expect(`${problems[0].file}:${problems[0].line} ${problems[0].message}`).toContain(`${file}:${data[kind].length + 1}`);
  });

  it('LA-AUT-SP04-T refuses the same ID twice in its file', async () => {
    const problems = await refusal(withTable(data, kind, [...data[kind], row]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'primary-key', file, line: data[kind].length + 1 })]);
  });

  const enums = table.columns.filter((c) => c.kind === 'enum');
  if (enums.length) it('LA-AUT-INV04-T refuses a value its enum does not have', async () => {
    for (const column of enums) {
      const problems = await refusal(withTable(data, kind, [{ ...row, [column.name]: 'bogus' }, ...data[kind].slice(1)]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'column', file, line: 1 })]);
      expect(problems[0].message).toContain(`is not one of ${column.values!.join(', ')}`);
    }
  });

  it('LA-AUT-INV04-T refuses a row without a required field', async () => {
    const parents = new Set(schema.kinds[kind].parents.map((p) => p.column));
    const required = table.columns.filter((c) => c.required && c.name !== 'id' && !parents.has(c.name));
    for (const column of required) {
      const without: Row = { ...row };
      delete without[column.name];
      const problems = await refusal(withTable(data, kind, [without, ...data[kind].slice(1)]));
      expect(problems).toEqual([expect.objectContaining({ rule: 'required', file, line: 1, message: `${kind}.${column.name} is required` })]);
    }
  });
});

describe('loading files', () => {
  it('LA-AUT-UC01-R01-T04 names the file and line of a line that is not JSON, a column the table lacks, and a file for no table', async () => {
    const root = writeData(data);
    const { writeFileSync, appendFileSync } = await import('node:fs');
    appendFileSync(`${root}/data/uc_requirement.jsonl`, '{"id": "TL-LEND-UC01-R02",\n');
    appendFileSync(`${root}/data/view.jsonl`, `${JSON.stringify({ ...data.view[0], id: 'TL-V02', colour: 'red' })}\n`);
    writeFileSync(`${root}/data/widgets.jsonl`, '{}\n');
    try {
      await openStore(root);
      expect.unreachable();
    } catch (error) {
      expect((error as StoreError).problems).toEqual([
        expect.objectContaining({ rule: 'json', file: 'data/uc_requirement.jsonl', line: 2 }),
        expect.objectContaining({ rule: 'column', file: 'data/view.jsonl', line: 2, message: expect.stringContaining('view has no column "colour"') }),
        expect.objectContaining({ rule: 'unknown-table', file: 'data/widgets.jsonl' }),
      ]);
      expect((error as StoreError).message).toContain('data/view.jsonl:2: view has no column "colour"');
    }
  });

  it('LA-PLT-UC02-R02-T03 reads the data folder lathe.config.json names', async () => {
    const root = writeData({});
    const { renameSync, writeFileSync } = await import('node:fs');
    const elsewhere = writeData(data);
    renameSync(`${elsewhere}/data`, `${root}/records`);
    writeFileSync(`${root}/lathe.config.json`, JSON.stringify({ schema: SCHEMA_VERSION, data: 'records' }));
    const opened = await openStore(root);
    expect(opened.dataDir).toBe(`${root}/records`);
    expect(opened.record('TL-LEND-UC01')?.kind).toBe('use_case');
    await opened.close();
  });
});
