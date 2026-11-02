// Each change lands on main as one squash commit whose title carries a Conventional Commits type
// (LA-STD-ENGINEERING-R01), so each release's notes group themselves. This checks one title, from three places:
//   node lathe/scripts/check-commits.ts --message-file <file>   the commit-msg hook (.githooks/commit-msg), on main
//   node lathe/scripts/check-commits.ts --title "<title>"       scripts/ci.sh --title, and the PR title check on GitHub
// It prints the title with its reason and exits 1 when it carries no type.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The types a title may open with; `spec` is a change to the spec's records alone (data/*.jsonl). */
export const TYPES = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'revert', 'spec'] as const;

const SCOPE = /^\([a-z0-9]+(?:-[a-z0-9]+)*\)$/;

/** Why a commit title is refused, or null when it is `type(scope)!: summary`: the scope optional, lowercase words
 * joined by hyphens, and `!` a breaking change. */
export function titleProblem(title: string): string | null {
  const typed = /^([a-zA-Z]+)(\([^)]*\))?(!)?:(.*)$/.exec(title);
  if (!typed) return `it opens with no type: write type(scope): summary, the type one of ${TYPES.join(', ')}`;
  const [, type, scope, , rest] = typed;
  if (!(TYPES as readonly string[]).includes(type)) return `"${type}" is not a type: use one of ${TYPES.join(', ')}`;
  if (scope !== undefined && !SCOPE.test(scope)) return `the scope ${scope} must be lowercase words joined by hyphens`;
  if (!/^ \S/.test(rest)) return 'the colon must be followed by one space and the summary';
  return null;
}

/** A commit message's title: its first line that is neither blank nor a comment git strips. */
export function messageTitle(message: string): string {
  return message.split('\n').find((line) => line.trim() !== '' && !line.startsWith('#'))?.trim() ?? '';
}

function main(args: string[]): number {
  const [flag, value] = args;
  let title: string;
  if (flag === '--message-file' && value) title = messageTitle(readFileSync(value, 'utf8'));
  else if (flag === '--title' && value !== undefined) title = value.trim();
  else {
    console.error('Usage: node lathe/scripts/check-commits.ts --message-file <file> | --title "<title>"');
    return 2;
  }
  const problem = titleProblem(title);
  if (problem === null) return 0;
  console.error(`The title carries no type (type(scope)!: summary):\n  ${title}\n  ${problem}`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
