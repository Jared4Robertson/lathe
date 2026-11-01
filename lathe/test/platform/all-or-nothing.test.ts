// The spec data store (LA-PLT-STORE01) saves each change whole or not at all, even through a crash in the middle of a
// write (journal.ts): every new file is written beside the data, then the journal, then the renames. Each row runs one
// aggregate's commands on a copy of the Tool Library's data and stops the write at each point a crash can stop it: while
// a new file is half written, while the journal is half written, and after the first data file is renamed into place.
// The next load holds the data as it was (the journal was not there) or as the change meant (it was), never a mix.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_COMMANDS } from '../../src/commands.ts';
import { runCommands } from '../../src/platform/commands/run.ts';
import { WRITE_FOLDER } from '../../src/platform/data/journal.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { PACKAGE_DIR } from '../../src/index.ts';

/** Where a write is stopped, as a crash would stop it. */
type Crash = 'new file half written' | 'journal half written' | 'after the first rename';

const crash = vi.hoisted(() => ({ at: null as Crash | null }));

// The file system as the write sees it, with the crash put in where the test asks: the call writes half its text and
// throws, or the first rename of a data file into place is done and then throws; nothing after it runs.
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  const inWrite = (file: unknown) => String(file).includes(`${path.sep}.lathe-write${path.sep}`);
  const stopped = () => new Error(`crashed: ${crash.at}`);
  const writeFile: typeof real.writeFile = async (file, data, options) => {
    const name = String(file);
    const half = (text: string) => real.writeFile(file, text.slice(0, Math.floor(text.length / 2))).then(() => { throw stopped(); });
    if (crash.at === 'new file half written' && inWrite(name) && name.endsWith('.jsonl')) return half(String(data));
    if (crash.at === 'journal half written' && inWrite(name) && name.endsWith('journal.json.tmp')) return half(String(data));
    return real.writeFile(file, data, options);
  };
  // A write of several files stops before its second rename; a write of one, before its folder is deleted.
  const rename: typeof real.rename = async (from, to) => {
    await real.rename(from, to);
    if (crash.at === 'after the first rename' && inWrite(from) && !inWrite(to)) throw stopped();
  };
  return { ...real, default: { ...real, writeFile, rename }, writeFile, rename };
});

const TOOL_LIBRARY = path.join(PACKAGE_DIR, '..', 'examples', 'tool-library');
const roots: string[] = [];
afterAll(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
afterEach(() => {
  crash.at = null;
});

/** A copy of the Tool Library's data and config in a fresh folder: the files a test changes. */
function copy(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-all-or-nothing-'));
  roots.push(root);
  cpSync(path.join(TOOL_LIBRARY, 'data'), path.join(root, 'data'), { recursive: true });
  cpSync(path.join(TOOL_LIBRARY, 'lathe.config.json'), path.join(root, 'lathe.config.json'));
  return root;
}

/** Every data file's text, by name; a write's folder left behind shows as one too. */
const files = (root: string) => Object.fromEntries(readdirSync(path.join(root, 'data')).sort().map((f) => [f, f === WRITE_FOLDER ? 'a write left behind' : readFileSync(path.join(root, 'data', f), 'utf8')]));

/** One command of an aggregate's, by its slice and name, with its input. */
type Step = [slice: string, command: string, input: Record<string, unknown>];

const definitionOf = ([slice, command]: Step) => {
  const definition = ALL_COMMANDS.find((d) => d.slice.name === slice && d.name === command);
  expect(definition, `${slice} ${command}`).toBeDefined();
  return definition!;
};
const write = (store: Store, steps: Step[]) => runCommands(store, steps.map((step) => [definitionOf(step), step[2]] as const));

/** One aggregate's change: what is written first so the change can name it, and the change, as one write. */
interface Change {
  setup?: Step[];
  steps: Step[];
  /** Every change of its aggregate writes one data file: the crash after its rename comes before the write's folder is deleted. */
  oneFile?: true;
}

const product = (id: string) => ({ id, title: 'Kept whole', product_id: 'TL' });


/** Opens the store on the folder, runs the steps as one write, and closes it; returns the files the write changed. */
async function apply(root: string, steps: Step[]): Promise<string[]> {
  const store = await openStore(root, { latheDataDir: null });
  try {
    return (await write(store, steps)).files;
  } finally {
    await store.close();
  }
}

/** Runs the steps with the write stopped at the crash, then opens the store again: what its load settled, and the files. */
async function crashAt(root: string, at: Crash, steps: Step[]) {
  const store = await openStore(root, { latheDataDir: null });
  try {
    crash.at = at;
    await expect(write(store, steps)).rejects.toThrow(`crashed: ${at}`);
  } finally {
    crash.at = null;
    await store.close();
  }
  const again = await openStore(root, { latheDataDir: null });
  try {
    return { settled: again.settled.map((s) => s.outcome), files: files(root) };
  } finally {
    await again.close();
  }
}

describe('the spec data store saves each change whole or not at all, through a crash at any point of its write', () => {
  it.each<[string, Change]>([
  ['LA-AUT-A1-SR01-T02', { steps: [['product', 'change-product', { id: 'TL', title: 'Kept whole' }], ['product', 'add-interface', { ...product('TL-IF90'), kind: 'CLI', description: 'A command line kept whole.' }]] }],
  ['LA-AUT-A2-SR01-T02', { steps: [['pattern', 'remove-pattern-rule', { id: 'TL-PAT-LIBRARIAN-ACTION-R01' }]] }],
  ['LA-AUT-A3-SR01-T02', { steps: [['standard', 'add-standard', { ...product('TL-STD-KEPT'), type: 'engineering', description: 'A standard kept whole.' }], ['standard', 'add-standard-rule', { id: 'TL-STD-KEPT-R01', title: 'Kept whole', standard_id: 'TL-STD-KEPT', statement: 'Code MUST be kept whole.' }]] }],
  ['LA-AUT-A4-SR01-T02', { steps: [['domain', 'remove-term', { id: 'TL-LEND-TM02' }]] }],
  ['LA-AUT-A5-SR01-T02', { steps: [['specification', 'remove-specification-test', { id: 'TL-LEND-SP01-T' }]] }],
  ['LA-AUT-A6-SR01-T02', { steps: [['aggregate', 'remove-invariant', { id: 'TL-LEND-INV02' }]] }],
  ['LA-AUT-A7-SR01-T02', { steps: [['domain-event', 'add-domain-event', { id: 'TL-LEND-EV90', title: 'Member kept', aggregate_id: 'TL-LEND-A1', published: false, description: 'A member was kept whole.', fields: [{ name: 'Member ID', meaning: 'The member kept.', type_aggregate_id: 'TL-LEND-A1', required: true, example: '12' }] }]] }],
  ['LA-AUT-A8-SR01-T02', { steps: [['command', 'remove-policy', { id: 'TL-LEND-PO01' }]] }],
  ['LA-AUT-A9-SR01-T02', { steps: [['value-object', 'remove-constraint', { id: 'TL-VO01-C01' }]] }],
  ['LA-AUT-A10-SR01-T02', { steps: [['read-model', 'remove-query', { id: 'TL-LEND-QRY02' }]] }],
  ['LA-AUT-A11-SR01-T02', { steps: [['use-case', 'remove-flow', { id: 'TL-LEND-UC01-FL01' }]] }],
  ['LA-AUT-A12-SR01-T02', { steps: [['view', 'add-view', { id: 'TL-V90', title: 'Kept whole', description: 'A view kept whole.' }], ['view', 'add-view-requirement', { id: 'TL-V90-R01', title: 'Kept whole', view_id: 'TL-V90', statement: 'The view MUST be kept whole.' }]] }],
  ['LA-AUT-A13-SR01-T02', { steps: [['endpoint', 'remove-endpoint', { id: 'TL-LEND-EP01' }]] }],
  ['LA-AUT-A14-SR01-T02', { steps: [['integration', 'add-integration', { id: 'TL-INT90', title: 'Kept whole', description: 'An integration kept whole.' }], ['integration', 'add-integration-test', { id: 'TL-INT90-T01', title: 'Kept whole', integration_id: 'TL-INT90', level: 'integration', state: 'not automated yet', when: 'It runs.', then: 'It is kept whole.' }]] }],
  ['LA-AUT-A15-SR01-T02', { setup: [['view', 'add-view', { id: 'TL-V90', title: 'Kept whole', description: 'A view kept whole.' }]], steps: [['ui-component', 'add-ui-component', { id: 'TL-UI90', title: 'KeptPage', description: 'A component kept whole.', renders: ['TL-V90'] }]] }],
  ['LA-AUT-A16-SR01-T02', { steps: [['business-outcome', 'add-business-outcome', { ...product('TL-BO90'), statement: 'Members keep coming back.', measure: 'Members who borrow twice a month.', target: 'Half of them within a year.', measured_by: ['TL-LEND-RP01'] }]] }],
  ['LA-AUT-A17-SR01-T02', { oneFile: true, steps: [['test-data-set', 'change-test-data-set', { id: 'TL-LEND-TD01', title: 'Kept whole' }]] }],
  ['LA-AUT-A18-SR01-T02', { steps: [['table', 'remove-table', { id: 'TL-LEND-EN04-TB' }]] }],
  ['LA-AUT-A19-SR01-T02', { steps: [['extension-record', 'add-extension-record', { kind: 'report', id: 'TL-LEND-RP90', parent_id: 'TL-LEND', values: { title: 'keptReport', file: 'src/kept.ts', usage: 'npm run kept', description: 'A report kept whole.' }, packages: ['typescript'] }]] }],
  ['LA-AUT-A20-SR01-T02', { steps: [['entry-point', 'add-entry-point', { id: 'TL-LEND-ENTRY90', title: 'kept', domain_id: 'TL-LEND', description: 'An entry point kept whole.', packages: ['typescript'] }]] }],
  ['LA-AUT-A21-SR01-T02', { steps: [['tooling', 'remove-tooling', { id: 'TL-LEND-TOOL01' }]] }],
  ['LA-AUT-A22-SR01-T02', { steps: [['storage-requirement', 'remove-storage-requirement', { id: 'TL-LEND-A3-SR01' }]] }],
  ['LA-AUT-A23-SR01-T02', { oneFile: true, steps: [['data-store', 'add-data-store', { id: 'TL-LEND-STORE90', title: 'KEPT_URL', domain_id: 'TL-LEND', kind: 'database', description: 'A database kept whole.' }]] }],
  ['LA-CHK-A1-SR01-T02', { oneFile: true, steps: [['check', 'add-check', { name: 'kept-check', product_id: 'TL', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'Kept whole.', explanation: 'A check kept whole.', query: "SELECT NULL AS record, 'kept' AS message WHERE false" }]] }],
  ['LA-CHK-A2-SR01-T02', { oneFile: true, steps: [['product-setting', 'set-limits', { product_id: 'TL', max_children: 21, max_entities_per_aggregate: 8 }]] }],
  ['LA-TRC-A3-SR01-T02', { steps: [['pattern-following', 'follow-pattern', { follower_id: 'TL-LEND-UC03', pattern_id: 'TL-PAT-LIBRARIAN-ACTION', setting_values: [{ setting: 'record', value: 'Loan' }, { setting: 'required_input', value: 'The loan to close.' }, { setting: 'result', value: 'The closed loan.' }] }]] }],
])('%s a crash in the write leaves the data as it was or as the change meant, never a mix', async (_id, change) => {
    // As the change means it: the same write, uninterrupted, on another copy.
    const meant = copy();
    if (change.setup) await apply(meant, change.setup);
    const written = await apply(meant, change.steps);
    expect(written.length, written.join(', ')).toBeGreaterThanOrEqual(change.oneFile ? 1 : 2);
    const after = files(meant);

    const root = copy();
    if (change.setup) await apply(root, change.setup);
    const before = files(root);
    expect(after).not.toEqual(before);
    // Before the journal is whole, the write is rolled back; after it, the next load finishes it.
    expect(await crashAt(root, 'new file half written', change.steps)).toEqual({ settled: ['rolled back'], files: before });
    expect(await crashAt(root, 'journal half written', change.steps)).toEqual({ settled: ['rolled back'], files: before });
    expect(await crashAt(root, 'after the first rename', change.steps)).toEqual({ settled: ['finished'], files: after });
  });
});

describe('a write a crash left is settled before anything reads the data, and says what it did', () => {
  it('LA-AUT-A22-SR01-T02 a reload in the same process finishes the write, and its rows are the store\'s', async () => {
    const root = copy();
    const store = await openStore(root, { latheDataDir: null });
    try {
      crash.at = 'after the first rename';
      await expect(write(store, [['storage-requirement', 'remove-storage-requirement', { id: 'TL-LEND-A3-SR01' }]])).rejects.toThrow('crashed');
      crash.at = null;
      // The store refused the write as a whole: it still holds the requirement, until the reload finds the journal.
      expect(store.record('TL-LEND-A3-SR01')).toBeDefined();
      expect(existsSync(path.join(root, 'data', WRITE_FOLDER, 'journal.json'))).toBe(true);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await store.reload();
      expect(store.record('TL-LEND-A3-SR01')).toBeUndefined();
      expect(store.settled.map((s) => s.files)).toEqual([['storage_requirement.jsonl', 'storage_requirement_test.jsonl']]);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^lathe: Finished a write a crash interrupted in data\/: storage_requirement\.jsonl, storage_requirement_test\.jsonl/));
      warn.mockRestore();
      expect(existsSync(path.join(root, 'data', WRITE_FOLDER))).toBe(false);
    } finally {
      await store.close();
    }
  });

  it('LA-AUT-A1-SR01-T02 a write in progress is ignored by git', async () => {
    const root = copy();
    execFileSync('git', ['init', '-q'], { cwd: root });
    const store = await openStore(root, { latheDataDir: null });
    try {
      crash.at = 'journal half written';
      await expect(write(store, [['product', 'change-product', { id: 'TL', title: 'Kept whole' }], ['product', 'add-interface', { ...product('TL-IF90'), kind: 'CLI', description: 'A command line kept whole.' }]])).rejects.toThrow('crashed');
    } finally {
      crash.at = null;
      await store.close();
    }
    expect(existsSync(path.join(root, 'data', WRITE_FOLDER))).toBe(true);
    expect(execFileSync('git', ['status', '--porcelain', '--untracked-files=all', 'data/.lathe-write'], { cwd: root, encoding: 'utf8' })).toBe('');
  });
});

// A write in progress is another process's (the CLI while the app serves the folder): a load in the middle of it must
// not take it for a crash and roll it back under that process, which would then fail to finish it.
describe('LA-AUT-A22-SR01-T03 a load leaves a write another running process owns, and settles one whose process is gone', () => {
  it('leaves a running process\'s write alone, and rolls back an ended one\'s', async () => {
    const root = copy();
    const folder = path.join(root, 'data', WRITE_FOLDER);
    mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(folder, 'product.jsonl'), 'half a new file');
    // The parent of this test process is running for as long as the test is.
    writeFileSync(path.join(folder, 'owner'), String(process.ppid));
    const before = readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8');
    const store = await openStore(root, { latheDataDir: null });
    try {
      expect(store.settled).toEqual([]);
      expect(existsSync(folder)).toBe(true);
      expect(readFileSync(path.join(root, 'data', 'product.jsonl'), 'utf8')).toBe(before);
      // A process that has ended owns it now: the next load settles it.
      const ended = spawnSync('node', ['-e', '0']).pid!;
      writeFileSync(path.join(folder, 'owner'), String(ended));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await store.reload();
      warn.mockRestore();
      expect(store.settled.map((s) => s.outcome)).toEqual(['rolled back']);
      expect(existsSync(folder)).toBe(false);
    } finally {
      await store.close();
    }
  });
});
