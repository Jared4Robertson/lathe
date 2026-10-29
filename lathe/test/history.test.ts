// GET /api/history (LA-EXP-EP01): a record's git history, read from the commits that changed its rows in the data
// files, against a temporary git repo made here. The repo gets its author from the environment and ignores the
// machine's own git config, so the test reads and writes no git config.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configuredRoot } from './store/fixture.ts';
import type { HistoryAnswer } from '../src/server/contract.ts';
import { closeStores, handleApi } from '../src/server/api.ts';
import { HISTORY_PAGE, changesInDiff, firstColumnPattern, parseLog, recordTables, runGit } from '../src/server/history.ts';
import { openStore, type Store } from '../src/store/index.ts';

const temps: string[] = [];
let repo = '';
let plain = '';
let store: Store;

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Owner',
  GIT_AUTHOR_EMAIL: 'owner@example.com',
  GIT_COMMITTER_NAME: 'Owner',
  GIT_COMMITTER_EMAIL: 'owner@example.com',
};
function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}
const hasGit = spawnSync('git', ['--version']).status === 0;
const UC = 'EX-NOTE-UC01';
/** Commits made after the first three that change UC01, so its history runs past one page. */
const EXTRA = HISTORY_PAGE - 2;

async function seed(root: string) {
  const s = await openStore(root);
  await s.apply([
    { op: 'add', table: 'product', row: { id: 'EX', title: 'Example', description: 'A small product for writing notes.' } },
    { op: 'add', table: 'role', row: { product_id: 'EX', name: 'Writer', description: 'Someone who writes notes.' } },
    { op: 'add', table: 'domain', row: { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', subdomain_type: 'core', description: 'Writing and keeping notes.' } },
    { op: 'add', table: 'capability', row: { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1, description: 'Writing notes down.' } },
    { op: 'add', table: 'pattern', row: { id: 'EX-PAT-NOTE', title: 'A note action', product_id: 'EX', description: 'An action on one note.' } },
    { op: 'add', table: 'pattern_setting', row: { pattern_id: 'EX-PAT-NOTE', position: 1, name: 'record', meaning: 'The record the action changes.' } },
    { op: 'add', table: 'use_case', row: { id: UC, title: 'Write a note', capability_id: 'EX-NOTE-CAP01', goal: 'A writer keeps a note.' } },
  ]);
  return s;
}

beforeAll(async () => {
  if (!hasGit) return;
  repo = configuredRoot('lathe-history-');
  plain = configuredRoot('lathe-no-git-');
  temps.push(repo, plain);
  await (await seed(plain)).close();
  store = await seed(repo);
  git(repo, 'init', '--quiet');
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Add the example product');
  await store.set('use_case', UC, { title: 'Write a short note', goal: 'A writer keeps a thought.' });
  git(repo, 'commit', '--quiet', '-am', 'Say more about UC01');
  await store.apply([
    { op: 'link', relation: 'follows', source: UC, target: 'EX-PAT-NOTE' },
    { op: 'add', table: 'setting_value', row: { follower_id: UC, pattern_id: 'EX-PAT-NOTE', setting: 'record', value: 'Note' } },
  ]);
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Give UC01 its pattern');
  // A commit that changes only another record's rows is not in UC01's history.
  await store.set('pattern', 'EX-PAT-NOTE', { description: 'What every note action does.' });
  git(repo, 'commit', '--quiet', '-am', 'Describe the pattern');
  for (let i = 1; i <= EXTRA; i++) {
    await store.set('use_case', UC, { goal: `A writer keeps thought ${i}.` });
    git(repo, 'commit', '--quiet', '-am', `Goal ${i}`);
  }
  // Not committed: a change in the working tree, and a data file git does not know yet.
  await store.set('use_case', UC, { goal: 'A writer keeps every thought.' });
  await store.add('use_case_actor', { use_case_id: UC, position: 1, role_name: 'Writer' });
}, 120_000);

afterAll(async () => {
  await store?.close();
  await closeStores();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

async function get(root: string, url: string) {
  let body = '';
  const res = { statusCode: 200, setHeader: () => {}, end: (chunk?: string) => { body = chunk ?? ''; } } as unknown as ServerResponse;
  const handled = await handleApi(root, { method: 'GET', url, headers: {} } as IncomingMessage, res, url.split('?')[0]);
  return { handled, status: res.statusCode, body: JSON.parse(body) };
}

describe.skipIf(!hasGit)('record history', () => {
  it("LA-EXP-EP01-R01-T01 GET /api/history lists the commits that changed a record's rows, newest first, with the columns each changed and the uncommitted changes", async () => {
    const { status, body } = await get(repo, `/api/history?id=${UC}`);
    expect(status).toBe(200);
    const answer = body as Extract<HistoryAnswer, { state: 'ok' }>;
    expect(answer.state).toBe('ok');
    expect(answer.files).toContain('data/use_case.jsonl');
    expect(answer.files).toContain('data/use_case_actor.jsonl');
    expect(answer.files).toContain('data/follows.jsonl');
    expect(answer.commits).toHaveLength(HISTORY_PAGE);
    expect(answer.more).toBe(true);
    expect(answer.commits[0].subject).toBe(`Goal ${EXTRA}`);
    expect(answer.commits[0].author).toBe('Owner');
    expect(answer.commits.map((c) => c.subject)).not.toContain('Describe the pattern');
    expect(answer.commits[0].changes).toEqual([
      { table: 'use_case', key: UC, change: 'changed', fields: [{ name: 'goal', before: `A writer keeps thought ${EXTRA - 1}.`, after: `A writer keeps thought ${EXTRA}.` }] },
    ]);

    const older = (await get(repo, `/api/history?id=${UC}&skip=${HISTORY_PAGE}`)).body as Extract<HistoryAnswer, { state: 'ok' }>;
    expect(older.more).toBe(false);
    expect(older.commits.map((c) => c.subject)).toEqual(['Add the example product']);
    expect(older.commits[0].changes).toEqual([
      { table: 'use_case', key: UC, change: 'added', fields: [{ name: 'id', after: UC }, { name: 'title', after: 'Write a note' }, { name: 'capability_id', after: 'EX-NOTE-CAP01' }, { name: 'goal', after: 'A writer keeps a note.' }] },
    ]);
    const parts = answer.commits.find((c) => c.subject === 'Give UC01 its pattern')!;
    expect(parts.changes).toEqual([
      { table: 'follows', key: `source_id ${UC}, target_id EX-PAT-NOTE`, change: 'added', fields: [{ name: 'source_id', after: UC }, { name: 'target_id', after: 'EX-PAT-NOTE' }] },
    ]);
    const titled = answer.commits.find((c) => c.subject === 'Say more about UC01')!;
    expect(titled.changes[0].fields).toEqual([
      { name: 'title', before: 'Write a note', after: 'Write a short note' },
      { name: 'goal', before: 'A writer keeps a note.', after: 'A writer keeps a thought.' },
    ]);

    expect(answer.uncommitted).toEqual([
      { table: 'use_case', key: UC, change: 'changed', fields: [{ name: 'goal', before: `A writer keeps thought ${EXTRA}.`, after: 'A writer keeps every thought.' }] },
      { table: 'use_case_actor', key: `use_case_id ${UC}, position 1`, change: 'added', fields: [{ name: 'use_case_id', after: UC }, { name: 'position', after: 1 }, { name: 'role_name', after: 'Writer' }] },
    ]);
  });

  it('LA-EXP-EP01-R01-T02 GET /api/history answers 404 for an unknown record, 400 without an ID, and says calmly when the folder is not a git repo', async () => {
    expect((await get(repo, '/api/history?id=EX-NOTE-UC99')).status).toBe(404);
    expect((await get(repo, '/api/history?id=')).status).toBe(400);
    expect((await get(repo, `/api/history?id=${UC}&skip=-1`)).status).toBe(400);
    const noRepo = await get(plain, `/api/history?id=${UC}`);
    expect(noRepo.status).toBe(200);
    expect(noRepo.body).toMatchObject({ state: 'no-repo', id: UC });
    expect(noRepo.body.message).toMatch(/not a git repository/);
  });

  it("LA-EXP-EP01-R02-T01 GET /api/history finds the record's data file from the data by its ID, never from a path the request names", async () => {
    expect((await get(plain, `/api/history?id=${UC}`)).body).toMatchObject({ files: ['data/use_case.jsonl'] });
    expect([400, 404]).toContain((await get(repo, '/api/history?id=../data/use_case.jsonl')).status);
  });

  describe('LA-STD-CODE-R02-T01 reading a record\'s history changes nothing in the repo', () => {
    it('LA-EXP-EP01-R02-T02 GET /api/history changes nothing in the repo', async () => {
      const status = git(repo, 'status', '--porcelain');
      const config = git(repo, 'config', '--local', '--list');
      expect((await get(repo, `/api/history?id=${UC}`)).status).toBe(200);
      expect((await get(repo, `/api/history?id=${UC}&skip=${HISTORY_PAGE}`)).status).toBe(200);
      expect(git(repo, 'status', '--porcelain')).toBe(status);
      expect(git(repo, 'config', '--local', '--list')).toBe(config);
    });
  });

  it('LA-INT04-T02 History runs git itself, inside the product root', async () => {
    const top = await runGit(repo, ['rev-parse', '--show-prefix'], {});
    expect(top.code).toBe(0);
    expect(top.stdout.trim()).toBe('');
  });

  it('LA-INT04-T03 git runs with an argument array, which no shell reads, and changes nothing', async () => {
    const before = git(repo, 'status', '--porcelain');
    const echoed = await runGit(repo, ['log', '--format=%s', '-1', '--grep=$(touch pwned)']);
    expect(echoed.code).toBe(0);
    expect(existsSync(path.join(repo, 'pwned'))).toBe(false);
    expect(git(repo, 'status', '--porcelain')).toBe(before);
  });

  it('LA-INT04-T04 git output is cut at the output cap and stopped at the time limit', async () => {
    const cut = await runGit(repo, ['log', '-p'], { cap: 64 });
    expect(cut.truncated).toBe(true);
    expect(cut.stdout.length).toBe(64);
    const slow = await runGit(repo, ['log', '-p'], { timeout: 0 });
    expect(slow.timedOut).toBe(true);
  });

  it("LA-EXP-EP01-R02-T03 git's -G finds a line by its first column's value only", async () => {
    const touched = await runGit(repo, ['log', '--format=%s', '-G', firstColumnPattern('EX-PAT-NOTE'), '--', 'data']);
    // The pattern's commits, and not the link from UC01 that names the pattern as its target.
    expect(touched.stdout.trim().split('\n')).toEqual(['Describe the pattern', 'Add the example product']);
  });
});

describe('LA-EXP-EP01-R02-T03 reading history', () => {
  it('parses git log records written with its field and record separators', () => {
    const hash = 'a'.repeat(40);
    expect(parseLog(`${hash}\x1faaaaaaa\x1f2026-10-25T10:00:00+00:00\x1fOwner\x1fA subject\x1e\n`)).toEqual([
      { hash, short: 'aaaaaaa', date: '2026-10-25T10:00:00+00:00', author: 'Owner', subject: 'A subject' },
    ]);
    expect(parseLog('not a record\x1e')).toEqual([]);
  });

  it("reads a diff into the record's changed rows, ignoring other records and lines that are not rows", async () => {
    const empty = configuredRoot('lathe-schema-');
    temps.push(empty);
    const s = await openStore(empty);
    const tables = new Map(recordTables(s.schema, 'use_case').map((t) => [t.name, t]));
    await s.close();
    const diff = [
      'diff --git a/data/use_case.jsonl b/data/use_case.jsonl',
      '--- a/data/use_case.jsonl',
      '+++ b/data/use_case.jsonl',
      '@@ -1 +1 @@',
      `-{"id":"${UC}","title":"Old","capability_id":"EX-NOTE-CAP01"}`,
      `+{"id":"${UC}","title":"New","capability_id":"EX-NOTE-CAP01"}`,
      '+{"id":"EX-NOTE-UC02","title":"Other","capability_id":"EX-NOTE-CAP01"}',
      '+not json',
      'diff --git a/data/requirement.jsonl b/data/requirement.jsonl',
      `+{"id":"${UC}","title":"Not a table of UC01's rows"}`,
    ].join('\n');
    expect(changesInDiff(diff, tables, UC)).toEqual([{ table: 'use_case', key: UC, change: 'changed', fields: [{ name: 'title', before: 'Old', after: 'New' }] }]);
  });
});
