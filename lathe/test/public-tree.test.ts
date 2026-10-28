// LA-STD-CODE-R04-T01 (LA-STD-CODE-R04): no tracked file names a client product Lathe was tried on, a person as a
// person, or a machine's own paths. A scan of every text file git tracks.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** What no tracked file may name, each with what it is. */
const FORBIDDEN: { what: string; pattern: RegExp }[] = [
  { what: 'a client product', pattern: /\bS2(?:_sandbox)?\b/i },
  { what: 'a person', pattern: /\bJared\b/i },
  { what: "a person's home folder name", pattern: /jaredrobertson/i },
  { what: 'a home folder', pattern: /\/(?:Users|home)\/(?!person\/|Shared\/)[\w.-]+\//i },
  { what: 'the system temp folder', pattern: /\/private\/tmp\//i },
];

/**
 * The lines that may name the author: the packages' author and owner fields. The package name `@jaredrob/lathe` and
 * the GitHub owner in the repo's URL are not matched by any pattern above.
 */
const ALLOWED = /^\s*"(?:author|owner)":\s*(?:\{\s*"name":\s*)?"Jared A Robertson"/;

/** Each forbidden mention in a file's text, as `file:line: what`. */
function findings(file: string, text: string): string[] {
  return text.split('\n').flatMap((line, i) =>
    ALLOWED.test(line) ? [] : FORBIDDEN.filter(({ pattern }) => pattern.test(line)).map(({ what }) => `${file}:${i + 1}: names ${what}`),
  );
}

function trackedFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: REPO, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr}`);
  return result.stdout.split('\0').filter(Boolean);
}

describe('LA-STD-CODE-R04-T01 no tracked file names a client product, a person or a machine', () => {
  it('finds each kind of mention and lets the neutral fixture and the author fields pass', () => {
    // The samples are built from parts, so this file's own text names nothing it forbids.
    const u = '/' + 'Users/';
    const sample = [
      'as S' + '2 lays out its specs',
      'open ~/Development/S' + '2_sandbox',
      'decided by Jar' + 'ed',
      `${u}someone/Development/Lathe`,
      '/' + 'home/someone/work',
      '/' + 'private/tmp/claude/x',
      `${u}person/Development/Lathe`,
      '  "author": "Jar' + 'ed A Robertson",',
      '  "owner": { "name": "Jar' + 'ed A Robertson" },',
      "import { openStore } from '@jaredrob/lathe';",
    ].join('\n');
    expect(findings('f', sample)).toEqual([
      'f:1: names a client product',
      'f:2: names a client product',
      'f:3: names a person',
      'f:4: names a home folder',
      'f:5: names a home folder',
      'f:6: names the system temp folder',
    ]);
  });

  it('every text file git tracks names none of them', () => {
    const files = trackedFiles();
    expect(files.length).toBeGreaterThan(200);
    const found = files.flatMap((file) => {
      let bytes: Buffer;
      try {
        bytes = readFileSync(path.join(REPO, file));
      } catch {
        return []; // Deleted in the working tree and not yet committed.
      }
      if (bytes.includes(0)) return []; // A binary file: an image, an icon or a font.
      return findings(file, bytes.toString('utf8'));
    });
    expect(found).toEqual([]);
  });
});
