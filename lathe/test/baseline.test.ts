// The Record changes read over HTTP (LA-EXP-QRY13, GET /api/record-changes/list-record-changes): what changed in a
// product's records since a baseline the server reads from git for the query's `since`, against a temporary git repo
// made here: since the last commit, since the branch left the default branch, and since a commit the app noted. The
// repo gets its author from the environment and ignores the machine's own git config, so the test reads and writes no
// git config.
import { spawnSync } from 'node:child_process';
import { renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configuredRoot } from './store/fixture.ts';
import type { ProductChanges } from '../src/exploring/record-changes/read-model.ts';
import { closeStores, handleApi } from '../src/server/api.ts';
import { openStore, type Store } from '../src/platform/data/index.ts';
import { run } from './helpers.ts';

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
  await run(s, 'product add-product', { id: 'EX', title: 'Example', description: 'A small product for writing notes.' });
  await run(s, 'domain add-domain', { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', position: 2, subdomain_type: 'core', description: 'Writing and keeping notes.' });
  await run(s, 'aggregate add-aggregate', { id: 'EX-NOTE-A1', title: 'Note', domain_id: 'EX-NOTE', identity: 'Note ID', description: 'One note a writer keeps.' });
  await run(s, 'aggregate add-entity', { id: 'EX-NOTE-EN01', title: 'Note', aggregate_id: 'EX-NOTE-A1', role: 'root', description: 'The note itself.' });
  await run(s, 'command add-command', { id: 'EX-NOTE-CMD01', title: 'Write a note', entity_id: 'EX-NOTE-EN01', description: 'Keeps a new note.' });
  await run(s, 'use-case add-use-case', { id: UC, title: 'Write a note', domain_id: 'EX-NOTE', goal: 'A writer keeps a note.', result_id: 'EX-NOTE-CMD01' });
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
  await run(store, 'use-case change-use-case', { id: UC, title: 'Write a short note' });
  git(repo, 'commit', '--quiet', '-am', 'Shorter');
  await run(store, 'use-case change-use-case', { id: UC, title: 'Write a very short note' });
}, 120_000);

afterAll(async () => {
  await store?.close();
  await closeStores();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

async function get(root: string, url: string) {
  let body = '';
  const res = { statusCode: 200, setHeader: () => {}, end: (chunk?: string) => { body = chunk ?? ''; } } as unknown as ServerResponse;
  const handled = await handleApi(root, { method: 'GET', url, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage, res, url.split('?')[0]);
  return { handled, status: res.statusCode, body: JSON.parse(body) as ProductChanges & { error?: string } };
}
const changes = async (root: string, since: string) => (await get(root, `/api/record-changes/list-record-changes?product_id=EX&since=${since}`)).body;
/** The use case's title change since the baseline: [before, after], or undefined when it did not change. */
const titleChange = (answer: ProductChanges) => {
  const fields = answer.changes.find((c) => c.id === UC)?.fields ?? [];
  const title = fields.find((f) => f.name === 'title');
  return title ? [title.before, title.after] : undefined;
};

describe.skipIf(!hasGit)('changes since a baseline', () => {
  it('LA-EXP-UC15-R01-T03 The Record changes read gives the records changed since the last commit, since the branch left main, or since a noted commit; says calmly when there is no git; refuses a bad request', async () => {
    const commit = await changes(repo, 'commit');
    expect(commit.baseline).toMatchObject({ state: 'ok', subject: 'Shorter', base: null });
    // Since the last commit: the change not committed yet.
    expect(commit.changes.filter((c) => c.kind === 'use_case')).toMatchObject([{ id: UC, change: 'changed', fields: [{ name: 'title', before: 'Write a short note', after: 'Write a very short note' }] }]);
    const branch = await changes(repo, 'branch');
    expect(branch.baseline).toMatchObject({ state: 'ok', commit: first, subject: 'Add the example product', base: 'main' });
    expect(titleChange(branch)).toEqual(['Write a note', 'Write a very short note']);
    expect(titleChange(await changes(repo, first))).toEqual(['Write a note', 'Write a very short note']);

    expect((await changes(plain, 'commit')).baseline).toMatchObject({ state: 'none' });
    expect((await changes(plain, 'commit')).changes).toEqual([]);
    expect((await changes(repo, '0'.repeat(40))).baseline).toMatchObject({ state: 'none' });
    expect((await get(repo, '/api/record-changes/list-record-changes?product_id=EX&since=yesterday')).status).toBe(400);
    expect((await get(repo, '/api/record-changes/list-record-changes?since=commit')).status).toBe(400);
    expect((await get(repo, '/api/record-changes/list-record-changes?product_id=NOPE&since=commit')).status).toBe(422);

    // A file git cannot give is no answer about the commit: nothing is compared with it, and nothing of it is kept.
    git(repo, 'commit', '--quiet', '-am', 'Very short');
    const blob = git(repo, 'rev-parse', 'HEAD:data/use_case.jsonl');
    const object = path.join(repo, '.git/objects', blob.slice(0, 2), blob.slice(2));
    renameSync(object, `${object}.away`);
    const failed = await changes(repo, 'commit');
    renameSync(`${object}.away`, object);
    expect(failed.baseline).toMatchObject({ state: 'none' });
    expect(failed.changes).toEqual([]);
    expect(await changes(repo, 'commit')).toMatchObject({ baseline: { state: 'ok', subject: 'Very short' }, changes: [] });
  });
});
