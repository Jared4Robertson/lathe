// Helper files (LA-STD-TRACEABILITY-R02): a technical record names the other files its code is split across beside its file
// (helper_file). A helper file traces to its record, the record builds only while every one of its files exists, and
// the trace and the reach of a change list each helper file with its record. Each starts from the complete product,
// which names no helper file and gives no problem and no gap.
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { loadWorkspace, openStore, type Store, type Workspace } from '../../src/index.ts';
import { runQuery } from '../../src/platform/commands/run.ts';
import type { ReadView } from '../../src/platform/data/rules.ts';
import { GET_REACH } from '../../src/traceability/change-reach/queries.ts';
import type { ChangeReach } from '../../src/traceability/change-reach/read-model.ts';
import { GET_RECORD_TRACE } from '../../src/traceability/record-trace/queries.ts';
import type { RecordTrace } from '../../src/traceability/record-trace/read-model.ts';
import { adding, build, changing, complete, gaps, loadData, obligation, ofCheck, refusals, removeData } from '../helpers.ts';

afterAll(removeData);

const open: Store[] = [];
afterEach(async () => { for (const s of open.splice(0)) await s.close(); });

/** The complete product with these helper files on one record. */
const naming = (record: string, ...files: string[]) => adding(complete(), { helper_file: files.map((file) => ({ record_id: record, file })) });

const untraced = (ws: Workspace) => ws.coverage.flatMap((c) => c.gaps).filter((g) => g.missing === 'code-file-untraced').map((g) => g.id).sort();

/** The product's rows with the checks' run, as the server gives a checked query. */
async function checkedView(root: string): Promise<ReadView> {
  const { problems, coverage, chains } = await loadWorkspace(root);
  const store = await openStore(root);
  open.push(store);
  return { schema: store.schema, rows: (t) => store.rows(t), record: (id) => store.record(id), checked: { problems, coverage, chains } };
}

describe('helper files', () => {
  it('LA-STD-TRACEABILITY-R02-T01 a technical record names helper files; the store refuses one on another record, twice, as a record\'s file or not normalized', async () => {
    const ws = await loadData(naming('EX-LEND-CMD01-H', 'src/loans_unix.ts', 'src/loans_other.ts'), { files: { 'src/loans_unix.ts': 'export {};\n', 'src/loans_other.ts': 'export {};\n' } });
    expect(ws.problems).toEqual([]);
    expect(ws.records.find((r) => r.id === 'EX-LEND-CMD01-H')?.parts.helper_file).toEqual([
      { record_id: 'EX-LEND-CMD01-H', file: 'src/loans_other.ts' },
      { record_id: 'EX-LEND-CMD01-H', file: 'src/loans_unix.ts' },
    ]);
    // Only a technical record names a helper file.
    expect(await refusals(naming('EX-LEND-UC01', 'src/loans_unix.ts'))).toEqual([
      expect.objectContaining({ rule: 'foreign-key', table: 'helper_file', message: expect.stringContaining('names no technical_record') }),
    ]);
    // One record names each helper file.
    expect(await refusals(adding(naming('EX-LEND-CMD01-H', 'src/loans_unix.ts'), { helper_file: [{ record_id: 'EX-LEND-CMD02-H', file: 'src/loans_unix.ts' }] }))).toEqual([
      expect.objectContaining({ table: 'helper_file' }),
    ]);
    // A helper file is never the file of a technical record, another's or its own.
    expect(await refusals(naming('EX-LEND-CMD02-H', 'src/loans.ts'))).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'helper-file-is-a-file', message: expect.stringContaining('EX-LEND-CMD02-H cannot name src/loans.ts as a helper file: it is the file of command handler EX-LEND-CMD01-H') }),
    ]));
    // A path is written from the product root, with forward slashes, and names a file.
    for (const bad of ['./src/loans_unix.ts', '/src/loans_unix.ts', 'src/lending/', 'src\\loans_unix.ts']) {
      expect(await refusals(naming('EX-LEND-CMD01-H', bad))).toEqual([expect.objectContaining({ table: 'helper_file' })]);
    }
  });

  it('LA-STD-TRACEABILITY-R02-T02 a source file a record names as a helper file is not a code-file-untraced gap', async () => {
    const files = { 'src/loans_unix.ts': 'export {};\n', 'src/loans_other.ts': 'export {};\n' };
    expect(untraced(await loadData(complete(), { files }))).toEqual(['src/loans_other.ts', 'src/loans_unix.ts']);
    const named = await loadData(naming('EX-LEND-CMD01-H', 'src/loans_unix.ts', 'src/loans_other.ts'), { files });
    expect(untraced(named)).toEqual([]);
    expect(gaps(named)).toEqual([]);
  });

  it('LA-STD-TRACEABILITY-R02-T03 a record whose helper file does not exist leaves its obligation unbuilt and is a technical-file-missing warning', async () => {
    const data = naming('EX-LEND-INV01-RL', 'src/loans_lock.ts');
    const written = await loadData(data, { files: { 'src/loans_lock.ts': 'export {};\n' } });
    expect(obligation(written, 'EX-LEND', 'invariant')?.built).toBe(1);
    expect(ofCheck(written, 'technical-file-missing')).toEqual([]);
    const missing = await loadData(data);
    expect(obligation(missing, 'EX-LEND', 'invariant')?.built).toBe(0);
    expect(ofCheck(missing, 'technical-file-missing')).toEqual([
      { severity: 'warning', check: 'technical-file-missing', record: 'EX-LEND-INV01-RL', message: 'Rule EX-LEND-INV01-RL names src/loans_lock.ts, which does not exist yet.' },
    ]);
    // A record that names no file is not built by its helper files alone.
    const fileless = await loadData(changing(data, 'rule', (r) => r.id === 'EX-LEND-INV01-RL', { file: undefined }), { files: { 'src/loans_lock.ts': 'export {};\n' } });
    expect(obligation(fileless, 'EX-LEND', 'invariant')?.built).toBe(0);
  });

  it("LA-STD-TRACEABILITY-R02-T04 an obligation's trace and a change's reach list each helper file with its record", async () => {
    const root = await build(naming('EX-LEND-INV01-RL', 'src/loans_lock.ts', 'src/loans_wait.ts'), { files: { 'src/loans_lock.ts': 'export {};\n', 'src/loans_wait.ts': 'export {};\n' } });
    const ws = await loadWorkspace(root);
    expect(ws.chains.find((c) => c.obligation === 'EX-LEND-INV01')?.files).toEqual(expect.arrayContaining([
      { path: 'src/loans.ts', named_by: expect.arrayContaining(['EX-LEND-INV01-RL']) },
      { path: 'src/loans_lock.ts', named_by: ['EX-LEND-INV01-RL'] },
      { path: 'src/loans_wait.ts', named_by: ['EX-LEND-INV01-RL'] },
    ]));
    const view = await checkedView(root);
    const reach = runQuery(view, GET_REACH, { ids: ['EX-LEND-INV01'] }) as ChangeReach;
    expect(reach.files.filter((f) => f.path.startsWith('src/loans'))).toEqual(expect.arrayContaining([
      { path: 'src/loans.ts', records: expect.arrayContaining(['EX-LEND-INV01-RL']) },
      { path: 'src/loans_lock.ts', records: ['EX-LEND-INV01-RL'] },
      { path: 'src/loans_wait.ts', records: ['EX-LEND-INV01-RL'] },
    ]));
    // The record's own page lists its file, then its helper files.
    expect((runQuery(view, GET_RECORD_TRACE, { id: 'EX-LEND-INV01-RL' }) as RecordTrace).files).toEqual([
      { path: 'src/loans.ts', helper: false },
      { path: 'src/loans_lock.ts', helper: true },
      { path: 'src/loans_wait.ts', helper: true },
    ]);
  });
});
