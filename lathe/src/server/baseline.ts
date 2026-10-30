// A product's data at a baseline, from git: the rows its data files held at a commit, which the Record changes read
// (LA-EXP-QRY13, exploring/record-changes) compares the data now with. api.ts `runRead` reads it for the query's
// `since` and gives it with the data (`ReadView.baseline`):
//
//   since=commit    the last commit (HEAD)
//   since=branch    where the branch left the default branch (their merge base)
//   since=<hash>    a commit the app noted, for "since I last looked"
//
// git runs as for a record's history (history.ts runGit): an argument array, no shell, nothing that writes, with a
// time limit. A commit's rows never change, so each is read once and kept. A product folder that is not a git repo,
// or a repo with no commits yet, is an answer, not an error.
import path from 'node:path';
import type { Row } from '../platform/data/rows.ts';
import type { SchemaDescription } from '../platform/data/schema.ts';
import type { BaselineAnswer, BaselineSince } from './contract.ts';
import { runGit } from './history.ts';

/** The most one data file at a commit may hold. */
const FILE_CAP = 64 * 1024 * 1024;
const HASH = /^[0-9a-f]{40,64}$/;

/** Reads `since` from a request's query: commit, branch, or a full commit hash; null for anything else. */
export function parseSince(text: string | null): BaselineSince | null {
  if (text === 'commit' || text === 'branch') return text;
  if (text && HASH.test(text)) return { commit: text };
  return null;
}

const cache = new Map<string, Record<string, Row[]>>();

/** The default branch the repo's remote names (origin/HEAD), else a local main or master. */
async function defaultBranch(root: string): Promise<string | null> {
  const remote = await runGit(root, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  if (remote.code === 0 && remote.stdout.trim()) return remote.stdout.trim();
  for (const name of ['main', 'master']) {
    if ((await runGit(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`])).code === 0) return name;
  }
  return null;
}

/** The rows a data folder's files held at a commit, read from git: each .jsonl file directly in it, one row a line. */
async function tablesAt(root: string, dataDir: string, schema: SchemaDescription, commit: string): Promise<Record<string, Row[]>> {
  const folder = path.relative(root, dataDir).split(path.sep).join('/') || '.';
  const key = `${root}\u0000${folder}\u0000${commit}`;
  const known = cache.get(key);
  if (known) return known;
  const listed = await runGit(root, ['ls-tree', '--name-only', commit, '--', `${folder}/`]);
  const files = listed.code === 0 ? listed.stdout.split('\n').filter((f) => f.endsWith('.jsonl')) : [];
  const tables: Record<string, Row[]> = {};
  await Promise.all(files.map(async (file) => {
    const name = path.posix.basename(file, '.jsonl');
    if (!schema.tables[name]?.stored) return;
    const shown = await runGit(root, ['show', '--no-textconv', `${commit}:./${file}`], { cap: FILE_CAP });
    if (shown.code !== 0) return;
    const rows: Row[] = [];
    for (const line of shown.stdout.split('\n')) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as unknown;
        if (row && typeof row === 'object' && !Array.isArray(row)) rows.push(row as Row);
      } catch {
        // A line that is not a row (a conflict marker, say) is left out.
      }
    }
    if (rows.length) tables[name] = rows;
  }));
  cache.set(key, tables);
  return tables;
}

/** The product folder's data at the baseline asked for. */
export async function baseline(root: string, dataDir: string, schema: SchemaDescription, since: BaselineSince): Promise<BaselineAnswer> {
  const inside = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
  if (inside.missing) return { state: 'no-repo', message: 'git is not installed on this machine, so there is no commit to compare with.' };
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return { state: 'no-repo', message: 'The product folder is not a git repository, so there is no commit to compare with.' };
  let base: string | null = null;
  let rev: string;
  if (since === 'commit') rev = 'HEAD';
  else if (since === 'branch') {
    base = await defaultBranch(root);
    if (!base) return { state: 'no-commit', message: 'The repository has no default branch (main or master) to compare with.' };
    const merged = await runGit(root, ['merge-base', 'HEAD', base]);
    if (merged.code !== 0) return { state: 'no-commit', message: `The branch shares no commit with ${base}.` };
    rev = merged.stdout.trim();
  } else rev = since.commit;
  const FIELD = '\x1f';
  const shown = await runGit(root, ['log', '-1', '--no-color', `--format=%H${FIELD}%h${FIELD}%aI${FIELD}%s`, rev, '--']);
  const [commit, short, date, subject] = shown.stdout.trim().split(FIELD);
  if (shown.code !== 0 || !commit || !HASH.test(commit)) {
    return { state: 'no-commit', message: since === 'commit' ? 'The repository has no commits yet.' : 'That commit is not in the repository.' };
  }
  return { state: 'ok', commit, short, date, subject: subject ?? '', base, tables: await tablesAt(root, dataDir, schema, commit) };
}
