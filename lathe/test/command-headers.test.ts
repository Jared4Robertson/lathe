// A command file carries no comment that restates its identity: its ID or description. The records are the one place
// they are written, generated into the slice's identities (the CLI, the MCP server and the HTTP API show them), so a
// comment that copies them drifts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readIdentities } from '../scripts/generate/identities.ts';
import { PACKAGE_DIR } from '../src/index.ts';

const REPO = path.join(PACKAGE_DIR, '..');

/** Every command file: a file under a commands folder that defines a command, other than its folder's index. */
function commandFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = path.join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\/commands\/[^/]+\.ts$/.test(full) && !full.endsWith('/index.ts') && readFileSync(full, 'utf8').includes(': CommandDefinition<')) found.push(full);
    }
  };
  walk(dir);
  return found.sort();
}

/** The comments in a source file: its line comments and its block comments. */
function comments(text: string): string[] {
  return [...text.matchAll(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm)].map((m) => m[0]);
}

/** Text as a reader sees it: case, quotes and layout ignored, so a comment's wrapping does not hide a copy. */
const plain = (text: string) => text.replace(/[`'"*/]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Runs of words a comment and a description share: a copy of eight words or more, or the whole ID. */
const RUN = 8;
function runsOf(text: string): Set<string> {
  const words = plain(text).split(' ');
  const runs = new Set<string>();
  for (let i = 0; i + RUN <= words.length; i++) runs.add(words.slice(i, i + RUN).join(' '));
  return runs;
}

describe('LA-STD-CODE-R10-T01 command files restate nothing of their definitions', () => {
  const files = commandFiles(path.join(REPO, 'lathe/src'));

  it('finds every command file', () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it('gives no comment the ID or description of the command it defines', () => {
    const identities = new Map(readIdentities(REPO).map((d) => [d.file, d]));
    const restating = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const identity = identities.get(path.relative(REPO, file));
      expect(identity, `${file} defines a command of the records`).toBeDefined();
      const copied = runsOf(identity!.description);
      return comments(text)
        .filter((comment) => plain(comment).includes(identity!.id.toLowerCase()) || [...runsOf(comment)].some((run) => copied.has(run)))
        .map((comment) => `${path.relative(REPO, file)}: ${comment.trim().slice(0, 120)}`);
    });
    expect(restating).toEqual([]);
  });
});
