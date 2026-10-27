// The merge driver for data files: keeps both sides' lines against the base, sorts them again and checks the table's
// own rules; a real clash fails with a clear message and conflict markers.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { mergeData, mergeDataFiles, openStore } from '../../src/index.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

afterAll(removeData);

const store = await openStore(writeData(everyKind()));
const schema = store.schema;
await store.close();
const view = schema.tables.view;
const reads = schema.tables.reads;

const line = (row: object) => `${JSON.stringify(row)}\n`;
const v = (n: number, title = `View ${n}`) => line({ id: `TL-V0${n}`, title });

describe('mergeData', () => {
  it('keeps the rows both sides added, sorted', async () => {
    const result = await mergeData(v(1), v(1) + v(3), v(1) + v(2), view);
    expect(result).toEqual({ text: v(1) + v(2) + v(3), clashes: [], problems: [] });
  });

  it('takes a change or a removal made on one side only', async () => {
    const result = await mergeData(v(1) + v(2) + v(3), v(1, 'Catalog') + v(2) + v(3), v(1) + v(3), view);
    expect(result).toEqual({ text: v(1, 'Catalog') + v(3), clashes: [], problems: [] });
  });

  it('keeps one copy of a row both sides added alike, and of a link both sides made', async () => {
    const link = line({ source_id: 'TL-LEND-SP01', target_id: 'TL-LEND-A1' });
    expect(await mergeData('', link, link, reads)).toEqual({ text: link, clashes: [], problems: [] });
    expect((await mergeData(v(1), v(1) + v(2), v(1) + v(2), view)).clashes).toEqual([]);
  });

  it('fails when one ID is added on both sides with different content', async () => {
    const result = await mergeData(v(1), v(1) + v(2, 'Desk'), v(1) + v(2, 'Return desk'), view);
    expect(result.clashes).toEqual(['TL-V02 was added on both sides with different content']);
    expect(result.text).toBe(`${v(1)}<<<<<<< ours\n${v(2, 'Desk')}=======\n${v(2, 'Return desk')}>>>>>>> theirs\n`);
  });

  it('fails when one row is changed on both sides, or removed on one and changed on the other', async () => {
    expect((await mergeData(v(1), v(1, 'Ours'), v(1, 'Theirs'), view)).clashes).toEqual(['TL-V01 was changed on both sides']);
    expect((await mergeData(v(1), '', v(1, 'Theirs'), view)).clashes).toEqual(['TL-V01 was removed on one side and changed on the other']);
  });

  it("checks the merged table's own rules", async () => {
    const step = (id: string, position: number) => line({ id, title: 'Step', flow_id: 'TL-LEND-UC01-FL', path: 'main', position });
    // Each side adds a step 2 to the same path: no line clashes, but the table's unique key does.
    const result = await mergeData(step('TL-LEND-UC01-FL-S01', 1), step('TL-LEND-UC01-FL-S01', 1) + step('TL-LEND-UC01-FL-S02', 2), step('TL-LEND-UC01-FL-S01', 1) + step('TL-LEND-UC01-FL-S03', 2), schema.tables.flow_step);
    expect(result.clashes).toEqual([]);
    expect(result.problems).toEqual([expect.stringContaining('the merged flow_step breaks a rule of its table')]);
    expect((await mergeData('', line({ id: 'TL-LEND-INV02-T', title: 't', invariant_id: 'TL-LEND-INV02', level: 'unit', state: 'done' }), '', schema.tables.invariant_test)).problems).toEqual([
      'invariant_test.state "done" is not one of automated, manual, not automated yet',
    ]);
    // The new tables merge by their keys too: a table's keys by table and position.
    const key = (position: number, type: string) => line({ table_id: 'TL-LEND-EN01-TB', position, type, columns: ['id'] });
    expect(await mergeData(key(1, 'primary'), key(1, 'primary') + key(2, 'index'), key(1, 'primary') + key(3, 'index'), schema.tables.table_key)).toEqual({
      text: key(1, 'primary') + key(2, 'index') + key(3, 'index'),
      clashes: [],
      problems: [],
    });
  });
});

describe('lathe merge-data', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-merge-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const write = (name: string, text: string) => {
    writeFileSync(path.join(dir, name), text);
    return path.join(dir, name);
  };

  it('writes the merge over ours, as git expects', async () => {
    const [base, ours, theirs] = [write('base', v(1)), write('ours', v(1) + v(3)), write('theirs', v(1) + v(2))];
    const result = await mergeDataFiles(base, ours, theirs, 'data/view.jsonl');
    expect(result.clashes).toEqual([]);
    expect(readFileSync(ours, 'utf8')).toBe(v(1) + v(2) + v(3));
  });

  it('exits 1 with the clash on a real clash, and 0 on a clean merge', () => {
    const bin = path.join(import.meta.dirname, '..', '..', 'bin', 'lathe.ts');
    const run = (b: string, o: string, t: string) => {
      const args = [bin, 'merge-data', write('b', b), write('o', o), write('t', t), 'data/view.jsonl'];
      try {
        execFileSync(process.execPath, args, { stdio: 'pipe' });
        return { status: 0, stderr: '' };
      } catch (error) {
        const e = error as { status: number; stderr: Buffer };
        return { status: e.status, stderr: e.stderr.toString() };
      }
    };
    expect(run(v(1), v(1, 'Ours'), v(1, 'Theirs'))).toEqual({ status: 1, stderr: 'data/view.jsonl: TL-V01 was changed on both sides\n' });
    expect(run(v(1), v(1) + v(2), v(1))).toEqual({ status: 0, stderr: '' });
    expect(readFileSync(path.join(dir, 'o'), 'utf8')).toBe(v(1) + v(2));
  });

  it('merges two branches that each added a row, through git with the driver set up as the README says', () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'lathe-merge-repo-'));
    const bin = path.join(import.meta.dirname, '..', '..', 'bin', 'lathe.ts');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).toString();
    try {
      git('init', '-q', '-b', 'main');
      git('config', 'user.name', 'Agent');
      git('config', 'user.email', 'agent@example.com');
      git('config', 'merge.lathe-data.name', 'Lathe data files');
      git('config', 'merge.lathe-data.driver', `"${process.execPath}" "${bin}" merge-data %O %A %B %P`);
      writeFileSync(path.join(repo, '.gitattributes'), 'data/*.jsonl merge=lathe-data\n');
      execFileSync('mkdir', ['data'], { cwd: repo });
      writeFileSync(path.join(repo, 'data', 'view.jsonl'), v(1) + v(5));
      git('add', '.');
      git('commit', '-q', '-m', 'base');
      git('checkout', '-q', '-b', 'other');
      writeFileSync(path.join(repo, 'data', 'view.jsonl'), v(1) + v(2) + v(5));
      git('commit', '-q', '-am', 'theirs');
      git('checkout', '-q', 'main');
      writeFileSync(path.join(repo, 'data', 'view.jsonl'), v(1) + v(4) + v(5));
      git('commit', '-q', '-am', 'ours');
      git('merge', '-q', '--no-edit', 'other');
      expect(readFileSync(path.join(repo, 'data', 'view.jsonl'), 'utf8')).toBe(v(1) + v(2) + v(4) + v(5));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
