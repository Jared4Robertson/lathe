// GET /api/baseline (LA-EXP-EP02): a product's rows at a baseline, read from git, against a temporary git repo made
// here: at the last commit, where the branch left the default branch, and at a commit the app noted. The repo gets its
// author from the environment and ignores the machine's own git config, so the test reads and writes no git config.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configuredRoot } from './store/fixture.ts';
import { recordChanges } from '../src/changes.ts';
import { closeStores, handleApi } from '../src/server/api.ts';
import type { BaselineAnswer } from '../src/server/contract.ts';
import { openStore, type Store } from '../src/store/index.ts';

const temps: string[] = [];
let repo = '';
let plain = '';
let store: Store;
let first = '';

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
  return result.stdout.trim();
}
const hasGit = spawnSync('git', ['--version']).status === 0;
const UC = 'EX-NOTE-UC01';

async function seed(root: string) {
  const s = await openStore(root);
  await s.apply([
    { op: 'add', table: 'product', row: { id: 'EX', title: 'Example', description: 'A small product for writing notes.' } },
    { op: 'add', table: 'domain', row: { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', subdomain_type: 'core', description: 'Writing and keeping notes.' } },
    { op: 'add', table: 'capability', row: { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1, description: 'Writing notes down.' } },
    { op: 'add', table: 'use_case', row: { id: UC, title: 'Write a note', capability_id: 'EX-NOTE-CAP01', goal: 'A writer keeps a note.' } },
  ]);
  return s;
}

beforeAll(async () => {
  if (!hasGit) return;
  repo = configuredRoot('lathe-baseline-');
  plain = configuredRoot('lathe-baseline-plain-');
  temps.push(repo, plain);
  await (await seed(plain)).close();
  store = await seed(repo);
  git(repo, 'init', '--quiet', '--initial-branch=main');
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'Add the example product');
  first = git(repo, 'rev-parse', 'HEAD');
  // A branch off main with a commit of its own, then a change not committed yet.
  git(repo, 'checkout', '--quiet', '-b', 'notes');
  await store.set('use_case', UC, { title: 'Write a short note' });
  git(repo, 'commit', '--quiet', '-am', 'Shorter');
  await store.set('use_case', UC, { title: 'Write a very short note' });
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
  return { handled, status: res.statusCode, body: JSON.parse(body) as BaselineAnswer & { error?: string } };
}
const title = (answer: BaselineAnswer) => (answer.state === 'ok' ? answer.tables.use_case.find((r) => r.id === UC)?.title : undefined);

describe.skipIf(!hasGit)('baselines', () => {
  it('LA-EXP-EP02-R01-T01 GET /api/baseline gives the product\'s rows at the last commit, where the branch left main, or a noted commit; says calmly when there is no git; refuses a bad request', async () => {
    const commit = (await get(repo, '/api/baseline?product=EX&since=commit')).body;
    expect(commit).toMatchObject({ state: 'ok', subject: 'Shorter', base: null });
    expect(title(commit)).toBe('Write a short note');
    const branch = (await get(repo, '/api/baseline?product=EX&since=branch')).body;
    expect(branch).toMatchObject({ state: 'ok', commit: first, subject: 'Add the example product', base: 'main' });
    expect(title(branch)).toBe('Write a note');
    expect(title((await get(repo, `/api/baseline?product=EX&since=${first}`)).body)).toBe('Write a note');

    // The diff against the last commit is the change not committed yet.
    const changes = recordChanges(store.schema, commit.state === 'ok' ? commit.tables : {}, { use_case: store.rows('use_case') });
    expect(changes.filter((c) => c.kind === 'use_case')).toMatchObject([{ id: UC, change: 'changed', fields: [{ name: 'title', before: 'Write a short note', after: 'Write a very short note' }] }]);

    expect((await get(plain, '/api/baseline?product=EX&since=commit')).body).toMatchObject({ state: 'no-repo' });
    expect((await get(repo, `/api/baseline?product=EX&since=${'0'.repeat(40)}`)).body).toMatchObject({ state: 'no-commit' });
    expect((await get(repo, '/api/baseline?product=EX&since=yesterday')).status).toBe(400);
    expect((await get(repo, '/api/baseline?since=commit')).status).toBe(400);
    expect((await get(repo, '/api/baseline?product=NOPE&since=commit')).status).toBe(404);
  });
});
