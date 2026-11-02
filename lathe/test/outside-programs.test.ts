// LA-PAT-AGGREGATE-COMMANDS-R11, proved in each domain that follows the pattern: code that runs an outside
// program, such as git or the speech helper, starts it with spawn or execFile and an array of arguments, never through
// a shell, so no record ID or path can be read as shell syntax. A scan of every source file.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The folders the rule covers: the engine and server (with the CLI and scripts) and the desktop app. */
const FOLDERS = ['lathe/src', 'lathe/bin', 'lathe/scripts', 'desktop/src', 'desktop/scripts'];
const SOURCE = /\.(?:c|m)?(?:t|j)sx?$/;

function sourceFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name === 'node_modules' || e.name === 'dist') return [];
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(full) : SOURCE.test(e.name) ? [full] : [];
  });
}

/** What reads a command line through a shell: child_process's exec or execSync, or any start with the shell option on. */
function shellRuns(text: string): string[] {
  const found: string[] = [];
  const imported = /import\s*\{([^}]*)\}\s*from\s*['"]node:child_process['"]/g;
  for (const m of text.matchAll(imported)) {
    for (const name of m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ''))) {
      if (name === 'exec' || name === 'execSync') found.push(name);
    }
  }
  if (/\b(?:child_process|cp)\.exec(?:Sync)?\s*\(/.test(text)) found.push('exec');
  if (/\bshell\s*:\s*(?:true\b|['"`])/.test(text)) found.push('shell');
  return found;
}

describe('LA-PAT-AGGREGATE-COMMANDS-R11-T01 LA-PAT-AGGREGATE-COMMANDS-R11-T04 LA-PAT-AGGREGATE-COMMANDS-R11-T05 LA-PAT-AGGREGATE-COMMANDS-R11-T06 LA-PAT-AGGREGATE-COMMANDS-R11-T07 LA-PAT-AGGREGATE-COMMANDS-R11-T08 LA-PAT-AGGREGATE-COMMANDS-R11-T02 LA-PAT-AGGREGATE-COMMANDS-R11-T03 an outside program runs from an argument array', () => {
  it('finds exec, execSync and a shell option, and lets spawn, execFile and shell: false pass', () => {
    // The samples quote through q, so this file's own text starts nothing.
    const q = "'";
    const runs = (...lines: string[]) => shellRuns(lines.join('\n'));
    expect(runs(`import { exec, spawn } from ${q}node:child_process${q};`)).toEqual(['exec']);
    expect(runs(`import { execSync as run } from ${q}node:child_process${q};`)).toEqual(['execSync']);
    expect(runs(`spawn(${q}git${q}, args, { shell: true });`)).toEqual(['shell']);
    expect(runs(`spawn(${q}git${q}, args, { shell: ${q}/bin/sh${q} });`)).toEqual(['shell']);
    expect(runs(`function open(shell: Shell) {}`)).toEqual([]);
    expect(runs(`import { execFile, spawn } from ${q}node:child_process${q};`, `spawn(${q}git${q}, args, { cwd, shell: false });`)).toEqual([]);
  });

  it('the engine, the server and the desktop app start every outside program with an argument array and no shell', () => {
    const files = FOLDERS.flatMap((folder) => sourceFiles(path.join(REPO, folder)));
    expect(files.length).toBeGreaterThan(50);
    const found = files.flatMap((file) => shellRuns(readFileSync(file, 'utf8')).map((what) => `${path.relative(REPO, file)}: ${what}`));
    expect(found).toEqual([]);
  });
});
