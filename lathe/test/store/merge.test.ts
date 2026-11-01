// The merge driver for data files: keeps both sides' lines against the base, sorts them again and checks the table's
// own rules; a real clash fails with a clear message and conflict markers.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const v = (n: number, title = `View ${n}`) => line({ id: `TL-V0${n}`, title, description: 'A page of the desk app.' });

describe('mergeData', () => {
  it('LA-AUT-UC19-R01-T01 keeps the rows both sides added, sorted', async () => {
    const result = await mergeData(v(1), v(1) + v(3), v(1) + v(2), view);
    expect(result).toEqual({ text: v(1) + v(2) + v(3), clashes: [], problems: [] });
  });

  it('LA-AUT-UC19-R01-T02 takes a change or a removal made on one side only', async () => {
    const result = await mergeData(v(1) + v(2) + v(3), v(1, 'Catalog') + v(2) + v(3), v(1) + v(3), view);
    expect(result).toEqual({ text: v(1, 'Catalog') + v(3), clashes: [], problems: [] });
  });

  it('LA-AUT-UC19-R01-T03 keeps one copy of a row both sides added alike, and of a link both sides made', async () => {
    const link = line({ source_id: 'TL-LEND-SP01', target_id: 'TL-LEND-A1' });
    expect(await mergeData('', link, link, reads)).toEqual({ text: link, clashes: [], problems: [] });
    expect((await mergeData(v(1), v(1) + v(2), v(1) + v(2), view)).clashes).toEqual([]);
  });

  it("LA-AUT-UC19-R01-T04 keeps a field this side's schema does not know, added on the other side, and leaves its check to the next load", async () => {
    const withNew = (n: number) => line({ id: `TL-V0${n}`, title: `View ${n}`, description: 'A page of the desk app.', added_column: 'kept' });
    const result = await mergeData(v(1), v(1) + v(2), withNew(1), view);
    expect(result).toEqual({ text: withNew(1) + v(2), clashes: [], problems: [] });
  });

  it('LA-AUT-UC19-R01-T05 keeps one side\'s removals and change while another row clashes', async () => {
    // Ours removed V02 and V03 and changed V01; theirs left them alone, added V05, and added V04 as ours did, unlike it.
    const base = v(1) + v(2) + v(3);
    const ours = v(1, 'Catalog') + v(4, 'Desk');
    const theirs = v(1) + v(2) + v(3) + v(4, 'Return desk') + v(5);
    const result = await mergeData(base, ours, theirs, view);
    expect(result.clashes).toEqual(['TL-V04 was added on both sides with different content']);
    expect(result.text).toBe(`${v(1, 'Catalog')}<<<<<<< ours\n${v(4, 'Desk')}=======\n${v(4, 'Return desk')}>>>>>>> theirs\n${v(5)}`);
    // The same, sides swapped: the removals and the change come from theirs.
    const swapped = await mergeData(base, theirs, ours, view);
    expect(swapped.clashes).toEqual(['TL-V04 was added on both sides with different content']);
    expect(swapped.text).toBe(`${v(1, 'Catalog')}<<<<<<< ours\n${v(4, 'Return desk')}=======\n${v(4, 'Desk')}>>>>>>> theirs\n${v(5)}`);
  });

  it('LA-INT64-T01 fails when one ID is added on both sides with different content', async () => {
    const result = await mergeData(v(1), v(1) + v(2, 'Desk'), v(1) + v(2, 'Return desk'), view);
    expect(result.clashes).toEqual(['TL-V02 was added on both sides with different content']);
    expect(result.text).toBe(`${v(1)}<<<<<<< ours\n${v(2, 'Desk')}=======\n${v(2, 'Return desk')}>>>>>>> theirs\n`);
  });

  it('LA-INT64-T01 fails when one row is changed on both sides, or removed on one and changed on the other', async () => {
    expect((await mergeData(v(1), v(1, 'Ours'), v(1, 'Theirs'), view)).clashes).toEqual(['TL-V01 was changed on both sides']);
    expect((await mergeData(v(1), '', v(1, 'Theirs'), view)).clashes).toEqual(['TL-V01 was removed on one side and changed on the other']);
    const removedByTheirs = await mergeData(v(1), v(1, 'Ours'), '', view);
    expect(removedByTheirs.clashes).toEqual(['TL-V01 was removed on one side and changed on the other']);
    expect(removedByTheirs.text).toBe(`<<<<<<< ours\n${v(1, 'Ours')}=======\n>>>>>>> theirs\n`);
  });

  it("LA-AUT-UC19-R03-T01 checks the merged table's own rules", async () => {
    const step = (id: string, position: number) => line({ id, title: 'Step', flow_id: 'TL-LEND-UC01-FL', path: 'main', position });
    // Each side adds a step 2 to the same path: no line clashes, but the table's unique key does.
    const result = await mergeData(step('TL-LEND-UC01-FL-S01', 1), step('TL-LEND-UC01-FL-S01', 1) + step('TL-LEND-UC01-FL-S03', 2), step('TL-LEND-UC01-FL-S01', 1) + step('TL-LEND-UC01-FL-S02', 2), schema.tables.flow_step);
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

  it('LA-AUT-UC19-R04-T01 writes the merge over ours, as git expects', async () => {
    const [base, ours, theirs] = [write('base', v(1)), write('ours', v(1) + v(3)), write('theirs', v(1) + v(2))];
    const result = await mergeDataFiles(base, ours, theirs, 'data/view.jsonl');
    expect(result.clashes).toEqual([]);
    expect(readFileSync(ours, 'utf8')).toBe(v(1) + v(2) + v(3));
  });

  it('LA-AUT-UC19-R02-T01 exits 1 with the clash on a real clash, and 0 on a clean merge', () => {
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

  it("LA-PLT-UC02-R05-T01 the README says how each clone sets up the driver, and .gitattributes names the data files for it", () => {
    const readme = readFileSync(path.join(import.meta.dirname, '..', '..', 'README.md'), 'utf8');
    expect(readme).toContain('git config merge.lathe-data.name "Lathe data files"');
    expect(readme).toContain('git config merge.lathe-data.driver "npx lathe merge-data %O %A %B %P"');
    expect(readme).toContain('**/data/*.jsonl merge=lathe-data');
  });

  // A git repo with the driver set up as the README says, its data/view.jsonl at base, then ours on main and theirs on
  // other, merged; returns the merge's exit, the file and its git status.
  const mergeThroughGit = (base: string, ours: string, theirs: string, bin = path.join(import.meta.dirname, '..', '..', 'bin', 'lathe.ts')) => {
    const repo = mkdtempSync(path.join(tmpdir(), 'lathe-merge-repo-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }).toString();
    const file = path.join(repo, 'data', 'view.jsonl');
    try {
      git('init', '-q', '-b', 'main');
      git('config', 'user.name', 'Agent');
      git('config', 'user.email', 'agent@example.com');
      git('config', 'merge.lathe-data.name', 'Lathe data files');
      git('config', 'merge.lathe-data.driver', `"${process.execPath}" "${bin}" merge-data %O %A %B %P`);
      writeFileSync(path.join(repo, '.gitattributes'), 'data/*.jsonl merge=lathe-data\n');
      execFileSync('mkdir', ['data'], { cwd: repo });
      writeFileSync(file, base);
      git('add', '.');
      git('commit', '-q', '-m', 'base');
      git('checkout', '-q', '-b', 'other');
      writeFileSync(file, theirs);
      git('commit', '-q', '-am', 'theirs');
      git('checkout', '-q', 'main');
      writeFileSync(file, ours);
      git('commit', '-q', '-am', 'ours');
      let merged = true;
      let output = '';
      try {
        git('merge', '-q', '--no-edit', 'other');
      } catch (error) {
        merged = false;
        output = (error as { stderr: Buffer }).stderr.toString();
      }
      return { merged, output, text: readFileSync(file, 'utf8'), status: git('status', '--short', 'data').trim() };
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  };

  it('LA-INT04-T01 merges two branches that each added a row, through git with the driver set up as the README says', () => {
    expect(mergeThroughGit(v(1) + v(5), v(1) + v(4) + v(5), v(1) + v(2) + v(5))).toMatchObject({ merged: true, text: v(1) + v(2) + v(4) + v(5) });
  });

  it("LA-AUT-UC19-R01-T05 keeps one side's removals and change through git while another row clashes", () => {
    const result = mergeThroughGit(v(1) + v(2) + v(3), v(1, 'Catalog') + v(4, 'Desk'), v(1) + v(2) + v(3) + v(4, 'Return desk') + v(5));
    expect(result).toMatchObject({ merged: false, status: 'UU data/view.jsonl' });
    expect(result.output).toContain('TL-V04 was added on both sides with different content');
    expect(result.text).toBe(`${v(1, 'Catalog')}<<<<<<< ours\n${v(4, 'Desk')}=======\n${v(4, 'Return desk')}>>>>>>> theirs\n${v(5)}`);
  });

  it('LA-AUT-UC19-R05-T01 a driver whose lathe is not installed fails the merge loudly, saying the file was not merged', () => {
    // A copy of the command line with no node_modules anywhere above it.
    const copy = mkdtempSync(path.join(tmpdir(), 'lathe-uninstalled-'));
    try {
      cpSync(path.join(import.meta.dirname, '..', '..', 'bin'), path.join(copy, 'bin'), { recursive: true });
      cpSync(path.join(import.meta.dirname, '..', '..', 'src'), path.join(copy, 'src'), { recursive: true });
      const result = mergeThroughGit(v(1) + v(2), v(1), v(1) + v(2) + v(3), path.join(copy, 'bin', 'lathe.ts'));
      expect(result).toMatchObject({ merged: false, status: 'UU data/view.jsonl', text: v(1) });
      expect(result.output).toContain("@duckdb/node-api not found: this checkout's lathe is not installed. Run `npm ci --prefix lathe`.");
      expect(result.output).toContain('data/view.jsonl was NOT merged: it holds only our side, with no conflict markers.');
      expect(result.output).toContain('run `git checkout -m data/view.jsonl` to merge it row by row again');
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });
});
