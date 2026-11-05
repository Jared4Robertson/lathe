// LA-STD-ENGINEERING-R01 (Land a change on main, LA-CHK-UC10, through the Git commit-msg hook, LA-INT66): each change lands on main as one squash commit whose title carries a Conventional Commits
// type, checked by lathe/scripts/check-commits.ts. Its rule on titles, its two entry points (--title, as scripts/ci.sh and
// the PR title check pass it, and --message-file), and the commit-msg hook in a temporary git repo made here, which
// gets its author from the environment, reads no machine git config and sets core.hooksPath in its own config only.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { messageTitle, titleProblem } from '../scripts/check-commits.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'lathe', 'scripts', 'check-commits.ts');
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Owner',
  GIT_AUTHOR_EMAIL: 'owner@example.com',
  GIT_COMMITTER_NAME: 'Owner',
  GIT_COMMITTER_EMAIL: 'owner@example.com',
};
const temps: string[] = [];
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function temp() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-commits-'));
  temps.push(dir);
  return dir;
}
function git(cwd: string, ...args: string[]) {
  return spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
}
function check(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: GIT_ENV, encoding: 'utf8' });
}

describe('LA-STD-ENGINEERING-R01-T01 LA-CHK-UC10-R01-T01 the squash commit a change lands on main with carries a type', () => {
  it('passes typed titles, with or without a scope and a breaking mark', () => {
    for (const title of [
      'feat(journeys): a journey runs from a trigger to a result',
      'fix: the Graph frames the focus',
      'spec(graph): the walk test starts in Test planning',
      'feat(server)!: drop the old route',
      'refactor(local-network): one serving use case',
      'chore(main): release 6.1.0',
    ]) expect(titleProblem(title), title).toBeNull();
  });

  it('refuses a title with no type, an unknown type, a bad scope or no summary, each with its reason', () => {
    expect(titleProblem('Merge 241-generators (four more Adds generated)')).toMatch(/opens with no type/);
    expect(titleProblem("Merge branch 'main' into 243-typed-commits")).toMatch(/opens with no type/);
    expect(titleProblem('Stability: the walk starts from Test planning')).toMatch(/"Stability" is not a type/);
    expect(titleProblem('feature: something')).toMatch(/"feature" is not a type/);
    expect(titleProblem('Fix: capitalized')).toMatch(/"Fix" is not a type/);
    expect(titleProblem('feat(Journeys): upper-case scope')).toMatch(/scope \(Journeys\)/);
    expect(titleProblem('feat:no space')).toMatch(/one space/);
    expect(titleProblem('feat: ')).toMatch(/one space/);
    expect(titleProblem('')).toMatch(/opens with no type/);
  });

  it('reads a message\'s title past blank lines and the comments git strips', () => {
    expect(messageTitle('\n# Squash commit -- not updating HEAD\nfix: the title\n\n* A branch commit\n')).toBe('fix: the title');
  });

  it('--title and --message-file pass a typed title and refuse an untyped one, naming it', () => {
    const dir = temp();
    expect(check(dir, '--title', 'docs: the README says how to enable the hook').status).toBe(0);
    const refused = check(dir, '--title', 'Add the hook');
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('Add the hook');
    const file = path.join(dir, 'COMMIT_EDITMSG');
    writeFileSync(file, 'ci: check PR titles\n\n* Stability: a free-form branch commit\n');
    expect(check(dir, '--message-file', file).status).toBe(0);
    writeFileSync(file, 'Check PR titles\n');
    expect(check(dir, '--message-file', file).status).toBe(1);
    expect(check(dir).status).toBe(2);
  });

  it('LA-INT66-T01 LA-CHK-UC10-FL-T the commit-msg hook refuses an untyped title on main and lets a branch\'s commits be free-form', () => {
    const repo = temp();
    mkdirSync(path.join(repo, 'lathe', 'scripts'), { recursive: true });
    cpSync(SCRIPT, path.join(repo, 'lathe', 'scripts', 'check-commits.ts'));
    cpSync(path.join(REPO, '.githooks'), path.join(repo, '.githooks'), { recursive: true });
    expect(git(repo, 'init', '--quiet', '--initial-branch=main').status).toBe(0);
    expect(git(repo, 'config', 'core.hooksPath', '.githooks').status).toBe(0);
    expect(git(repo, 'add', '.').status).toBe(0);

    const untyped = git(repo, 'commit', '--quiet', '-m', 'Add the check');
    expect(untyped.status).not.toBe(0);
    expect(untyped.stderr).toContain('Add the check');
    expect(git(repo, 'commit', '--quiet', '-m', 'build: add the check').status).toBe(0);

    expect(git(repo, 'switch', '--quiet', '-c', 'work').status).toBe(0);
    expect(git(repo, 'commit', '--quiet', '--allow-empty', '-m', 'Stability: a free-form branch commit').status).toBe(0);
    expect(git(repo, 'switch', '--quiet', 'main').status).toBe(0);
    expect(git(repo, 'merge', '--quiet', '--squash', 'work').status).toBe(0);
    expect(git(repo, 'commit', '--quiet', '--allow-empty', '-m', 'Squash work').status).not.toBe(0);
    expect(git(repo, 'commit', '--quiet', '--allow-empty', '-m', 'test(graph): squash work\n\n* Stability: a free-form branch commit').status).toBe(0);
    expect(git(repo, 'log', '--format=%s', 'main').stdout).toBe('test(graph): squash work\nbuild: add the check\n');
  });
});
