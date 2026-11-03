// LA-STD-PRINCIPLES-R07-T01 (LA-STD-PRINCIPLES-R07): no tracked file names a product Lathe was tried on for a client or a
// collaborator, a person as a person, or a machine's own paths. A scan of every text file git tracks.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The author's first and family names, from parts so this file's own text names neither. */
const FIRST = 'Jar' + 'ed';
const FAMILY = 'Robert' + 'son';
/** The client product's name, from parts too. */
const PRODUCT = 'S' + '2';
/** The product of a collaborator who tried Lathe, from parts too. */
const COLLABORATOR_PRODUCT = 'Ste' + 'go';

/** What no tracked file may name, each with what it is. */
const FORBIDDEN: { what: string; pattern: RegExp }[] = [
  { what: 'a client product', pattern: new RegExp(`\\b${PRODUCT}(?:_sandbox)?\\b`, 'i') },
  { what: "a collaborator's product", pattern: new RegExp(`\\b${COLLABORATOR_PRODUCT}\\b`, 'i') },
  { what: 'a person', pattern: new RegExp(`\\b${FIRST}\\b`, 'i') },
  { what: "a person's home folder name", pattern: new RegExp(FIRST + FAMILY, 'i') },
  { what: 'a home folder', pattern: /\/(?:Users|home)\/(?!person\/|Shared\/)[\w.-]+\//i },
  { what: 'the system temp folder', pattern: /\/private\/tmp\//i },
];

/**
 * The lines that may name the author: the packages' author and owner fields. The package name `@jaredrob/lathe` and
 * the GitHub owner in the repo's URL are not matched by any pattern above.
 */
const ALLOWED = new RegExp(`^\\s*"(?:author|owner)":\\s*(?:\\{\\s*"name":\\s*)?"${FIRST} A ${FAMILY}"`);

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

describe('LA-STD-PRINCIPLES-R07-T01 no tracked file names a product Lathe was tried on, a person or a machine', () => {
  it('finds each kind of mention and lets the neutral fixture and the author fields pass', () => {
    // The samples are built from parts, so this file's own text names nothing it forbids.
    const u = '/' + 'Users/';
    const sample = [
      `as ${PRODUCT} lays out its specs`,
      `open ~/Development/${PRODUCT}_sandbox`,
      `tried on ${COLLABORATOR_PRODUCT.toUpperCase()} first`,
      `the ${COLLABORATOR_PRODUCT.toLowerCase()}graph module`,
      `decided by ${FIRST}`,
      `cd ~/${FIRST.toLowerCase()}${FAMILY.toLowerCase()}`,
      `${u}someone/Development/Lathe`,
      '/' + 'home/someone/work',
      '/' + 'private/tmp/x',
      `${u}person/Development/Lathe`,
      `  "author": "${FIRST} A ${FAMILY}",`,
      `  "owner": { "name": "${FIRST} A ${FAMILY}" },`,
      "import { openStore } from '@jaredrob/lathe';",
    ].join('\n');
    expect(findings('f', sample)).toEqual([
      'f:1: names a client product',
      'f:2: names a client product',
      "f:3: names a collaborator's product",
      'f:5: names a person',
      "f:6: names a person's home folder name",
      'f:7: names a home folder',
      'f:8: names a home folder',
      'f:9: names the system temp folder',
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
