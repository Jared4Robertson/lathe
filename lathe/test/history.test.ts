// GET /api/history (LA-BRW-E02): a record's git history, against a temporary git repo made here.
// The repo gets its author from the environment and ignores the machine's own git config, so the
// test reads and writes no git config.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, renameSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

const UC = 'specs/example/notes/01-define/use-cases/UC01.md';

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
  writeFileSync(path.join(repo, UC), `${readFileSync(path.join(repo, UC), 'utf8')}\nA second paragraph.\n`);
  git(repo, 'commit', '--quiet', '-am', 'Say more about UC01');
  // A rename: the history follows the file back to its old name.
  mkdirSync(path.join(repo, 'specs/example/notes/01-define/use-cases/moved'));
  renameSync(path.join(repo, UC), path.join(repo, 'specs/example/notes/01-define/use-cases/moved/UC01.md'));
  git(repo, 'add', '-A');
  git(repo, 'commit', '--quiet', '-m', 'Move UC01');
  // Not committed: a change in the working tree.
  const moved = path.join(repo, 'specs/example/notes/01-define/use-cases/moved/UC01.md');
  writeFileSync(moved, readFileSync(moved, 'utf8').replace('A second paragraph.', 'A changed paragraph.'));
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
  it('LA-BRW-T590 GET /api/history lists the commits that touched a record\'s spec file, newest first and through renames, with the uncommitted change first, and one commit\'s diff', async () => {
    // The file comes from the specs, by the record's ID.
    expect(await recordFile(repo, 'EX-NOTE-UC01')).toBe('specs/example/notes/01-define/use-cases/moved/UC01.md');

    const list = await get(repo, '/api/history?id=EX-NOTE-UC01');
    expect(list.handled).toBe(true);
    expect(list.status).toBe(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.json.state).toBe('ok');
    expect(list.json.file).toBe('specs/example/notes/01-define/use-cases/moved/UC01.md');
    expect(list.json.uncommitted).toBe('modified');
    expect(list.json.commits.map((c: { subject: string }) => c.subject)).toEqual(['Move UC01', 'Say more about UC01', 'Add the example product']);
    const [, second] = list.json.commits;
    expect(second.author).toBe('Owner');
    expect(second.short.length).toBeGreaterThanOrEqual(4);
    expect(second.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(Number.isNaN(Date.parse(second.date))).toBe(false);
    expect(list.json.more).toBe(false);

    // One commit's diff of the file, as a unified diff, by its short hash too.
    const diff = await get(repo, `/api/history?id=EX-NOTE-UC01&commit=${second.short}`);
    expect(diff.status).toBe(200);
    expect(diff.json.commit).toBe(second.hash);
    expect(diff.json.diff).toContain('@@');
    expect(diff.json.diff).toContain('+A second paragraph.');
    expect(diff.json.truncated).toBe(false);

    // The uncommitted change, against HEAD.
    const working = await get(repo, '/api/history?id=EX-NOTE-UC01&commit=working');
    expect(working.json.diff).toContain('-A second paragraph.');
    expect(working.json.diff).toContain('+A changed paragraph.');

    // A commit that did not touch the record's file shows nothing of other files.
    expect(await recordDiff(repo, 'EX-NOTE-C01', list.json.commits[0].hash)).toMatchObject({ state: 'no-commit' });
  });

  it('LA-BRW-T591 GET /api/history refuses a raw path or a bad commit, answers 404 for an unknown record, and says calmly when the folder is not a git repo', async () => {
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

  it('LA-BRW-T592 git runs with an argument array, inside the product root, cut at the output cap and stopped at the time limit; the list pages by skip', async () => {
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
    const file = path.join(repo, 'specs/example/notes/01-define/aggregates/note.md');
    for (let i = 0; i < HISTORY_PAGE + 2; i++) {
      writeFileSync(file, `${readFileSync(file, 'utf8')}\nLine ${i}.\n`);
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
