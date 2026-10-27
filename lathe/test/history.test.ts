// GET /api/history (LA-EXP-E01): the git history of a record's row, against a temporary git repo made here.
// The repo gets its author from the environment and ignores the machine's own git config, so the
// test reads and writes no git config.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleApi } from '../src/server/api.ts';
import { HISTORY_PAGE, parseLog, recordDiff, recordFile, recordHistory, runGit } from '../src/server/history.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const temps: string[] = [];
let repo = '';
let plain = '';

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

const UC_FILE = 'data/use_case.jsonl';
const AGGREGATES = 'data/aggregate.jsonl';
/** Rewrites one row of a data file, as the store would. */
function setRow(root: string, file: string, id: string, change: (row: Record<string, unknown>) => Record<string, unknown>) {
  const full = path.join(root, file);
  const lines = readFileSync(full, 'utf8').split('\n').map((line) => {
    if (!line.startsWith(`{"id":"${id}",`)) return line;
    return JSON.stringify(change(JSON.parse(line)));
  });
  writeFileSync(full, lines.join('\n'));
}

beforeAll(() => {
  if (!hasGit) return;
  repo = mkdtempSync(path.join(tmpdir(), 'lathe-history-'));
  plain = mkdtempSync(path.join(tmpdir(), 'lathe-no-git-'));
  temps.push(repo, plain);
  cpSync(path.join(here, 'fixtures', 'good'), repo, { recursive: true });
  cpSync(path.join(here, 'fixtures', 'good'), plain, { recursive: true });
  git(repo, 'init', '--quiet');
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Add the example product');
  setRow(repo, UC_FILE, 'EX-NOTE-UC01', (row) => ({ ...row, goal: 'A person writes a short note.' }));
  git(repo, 'commit', '--quiet', '-am', 'Say more about UC01');
  // A commit that changes another row of another file: not in UC01's history.
  setRow(repo, AGGREGATES, 'EX-NOTE-A1', (row) => ({ ...row, description: 'A short text, kept.' }));
  git(repo, 'commit', '--quiet', '-am', 'Change A1');
  // Not committed: a change in the working tree.
  setRow(repo, UC_FILE, 'EX-NOTE-UC01', (row) => ({ ...row, goal: 'A person writes a changed note.' }));
});

afterAll(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }); });

/** Calls the API as the servers do, and reads its JSON answer. */
async function get(root: string, url: string) {
  let body = '';
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { headers[name] = value; },
    end: (chunk?: string) => { body = chunk ?? ''; },
  } as unknown as ServerResponse;
  const handled = await handleApi(root, { method: 'GET', url } as IncomingMessage, res, url.split('?')[0]);
  return { handled, status: res.statusCode, json: JSON.parse(body || 'null'), headers };
}

describe.skipIf(!hasGit)('the history API', () => {
  it("LA-EXP-T158 GET /api/history lists the commits that changed a record's row, newest first, with the uncommitted change first, and one commit's change", async () => {
    // The file comes from the data, by the record's ID.
    expect(await recordFile(repo, 'EX-NOTE-UC01')).toBe(UC_FILE);

    const list = await get(repo, '/api/history?id=EX-NOTE-UC01');
    expect(list.handled).toBe(true);
    expect(list.status).toBe(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.json.state).toBe('ok');
    expect(list.json.file).toBe(UC_FILE);
    expect(list.json.uncommitted).toBe('modified');
    expect(list.json.commits.map((c: { subject: string }) => c.subject)).toEqual(['Say more about UC01', 'Add the example product']);
    const [first] = list.json.commits;
    expect(first.author).toBe('Owner');
    expect(first.short.length).toBeGreaterThanOrEqual(4);
    expect(first.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(Number.isNaN(Date.parse(first.date))).toBe(false);
    expect(list.json.more).toBe(false);

    // One commit's change of the row, as the row's lines of a unified diff, by its short hash too.
    const diff = await get(repo, `/api/history?id=EX-NOTE-UC01&commit=${first.short}`);
    expect(diff.status).toBe(200);
    expect(diff.json.commit).toBe(first.hash);
    expect(diff.json.diff).toContain('-{"id":"EX-NOTE-UC01"');
    expect(diff.json.diff).toContain('A person writes a short note.');
    expect(diff.json.truncated).toBe(false);

    // The uncommitted change, against HEAD.
    const working = await get(repo, '/api/history?id=EX-NOTE-UC01&commit=working');
    expect(working.json.diff).toContain('A person writes a changed note.');

    // A commit that did not change the record's row shows nothing of other rows.
    const other = (await recordHistory(repo, 'EX-NOTE-A1'));
    expect(other.state === 'ok' && other.commits.map((c) => c.subject)).toEqual(['Change A1', 'Add the example product']);
    expect(await recordDiff(repo, 'EX-NOTE-UC01', other.state === 'ok' ? other.commits[0].hash : '')).toMatchObject({ state: 'no-commit' });
  });

  it('LA-EXP-T159 GET /api/history refuses a raw path or a bad commit, answers 404 for an unknown record, and says calmly when the folder is not a git repo', async () => {
    expect((await get(repo, '/api/history')).status).toBe(400);
    expect((await get(repo, '/api/history?id=EX-NOTE-UC01&commit=--output=/tmp/x')).status).toBe(400);
    expect((await get(repo, '/api/history?id=EX-NOTE-UC01&commit=HEAD;rm')).status).toBe(400);
    expect((await get(repo, '/api/history?id=EX-NOTE-UC01&skip=-1')).status).toBe(400);
    // A path is not an ID: nothing is read from it.
    const byPath = await get(repo, `/api/history?id=${encodeURIComponent('../../etc/passwd')}`);
    expect(byPath.status).toBe(404);
    expect(byPath.json.state).toBe('no-record');
    expect((await get(repo, '/api/history?id=EX-NOTE-UC99')).status).toBe(404);

    const none = await recordHistory(plain, 'EX-NOTE-UC01');
    expect(none.state).toBe('no-repo');
    expect(none.state === 'no-repo' && none.message).toMatch(/not a git repository/);
    // A folder inside some other repo would still be a repo; the temp folder is in none.
    expect((await get(plain, '/api/history?id=EX-NOTE-UC01&commit=working')).json.state).toBe('no-repo');
  });

  it('LA-EXP-T160 git runs with an argument array, inside the product root, cut at the output cap and stopped at the time limit; the list pages by skip', async () => {
    // Arguments are passed as they are, never read by a shell.
    const echoed = await runGit(repo, ['log', '--format=%s', '-1', '--grep=$(touch pwned)']);
    expect(echoed.code).toBe(0);
    expect(() => readFileSync(path.join(repo, 'pwned'))).toThrow();
    const top = await runGit(repo, ['rev-parse', '--show-prefix'], {});
    expect(top.stdout.trim()).toBe('');
    const cut = await runGit(repo, ['log', '-p'], { cap: 64 });
    expect(cut.truncated).toBe(true);
    expect(cut.stdout.length).toBeLessThanOrEqual(64);
    const slow = await runGit(repo, ['log', '-p'], { timeout: 0 });
    expect(slow.timedOut || slow.code === 0).toBe(true);

    // Paging: more than one page of commits on one file.
    for (let i = 0; i < HISTORY_PAGE + 2; i++) {
      setRow(repo, AGGREGATES, 'EX-NOTE-A1', (row) => ({ ...row, description: `A short text, version ${i}.` }));
      git(repo, 'commit', '--quiet', '-am', `Note ${i}`);
    }
    const first = await recordHistory(repo, 'EX-NOTE-A1');
    const rest = await recordHistory(repo, 'EX-NOTE-A1', HISTORY_PAGE);
    expect(first.state === 'ok' && [first.commits.length, first.more]).toEqual([HISTORY_PAGE, true]);
    expect(rest.state === 'ok' && rest.commits[0].subject).toBe('Note 1');
    expect(rest.state === 'ok' && rest.more).toBe(false);
  });

  it('parses git log records written with its field and record separators', () => {
    const hash = 'a'.repeat(40);
    expect(parseLog(`${hash}\x1faaaa\x1f2026-10-25T10:00:00+00:00\x1fOwner\x1fA subject\x1e\n`)).toEqual([
      { hash, short: 'aaaa', date: '2026-10-25T10:00:00+00:00', author: 'Owner', subject: 'A subject' },
    ]);
    expect(parseLog('')).toEqual([]);
  });
});
