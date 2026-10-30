// No exceptions to Lathe's own rules (LA-STD-PRINCIPLES-R03): nothing in the schema, the checks, the CLI or the
// plugin records, grants or teaches an exception, a waiver, an exemption or a way to skip a rule.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_COMMANDS, ALL_QUERIES } from '../src/commands.ts';
import { PACKAGE_DIR } from '../src/index.ts';

const REPO = path.join(PACKAGE_DIR, '..');

/** The files under a folder, from the repo root, whose names end so. */
function filesUnder(dir: string, ending: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = path.join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(ending)) found.push(path.relative(REPO, full));
    }
  };
  walk(path.join(REPO, dir));
  return found.sort();
}

const read = (file: string) => readFileSync(path.join(REPO, file), 'utf8');

/** A name that records an exception, a waiver, an exemption or an opt-out. */
const EXCEPTION_NAME = /exception|waiv|exempt|deviation|applies_when|not_applicable|_share$|_change$|allow_dirty|skip/;

/** Text that grants an exception to a rule, or teaches how to record one. */
const EXCEPTION_TEXT = /\b(recorded exceptions?|deliberate deviations? (is|are) recorded|is exempt|are exempt|exempt from|waived( in| there| when)|applies[- ]when|not applicable|\brepository_share\b|\bcommand_change\b|--allow-dirty|--skip\b|--force\b)/i;

describe('LA-STD-PRINCIPLES-R03-T01 no kind, column, flag or check records an exception to a rule', () => {
  it('names no table or column of the schema for an exception, a waiver or an opt-out', () => {
    const named = filesUnder('lathe/schema', '.sql').flatMap((file) => {
      const text = read(file);
      const tables = [...text.matchAll(/^CREATE TABLE "?(\w+)"? \(([\s\S]*?)^\);/gm)];
      return tables.flatMap(([, table, body]) => [table, ...[...body.matchAll(/^\s+"?(\w+)"? [A-Z]/gm)].map((m) => `${table}.${m[1]}`)]);
    });
    expect(named.length).toBeGreaterThan(100);
    expect(named.filter((name) => EXCEPTION_NAME.test(name.split('.').at(-1)!))).toEqual([]);
  });

  it('gives no check a clause that exempts, waives or excepts a kind', () => {
    const checks = read('lathe/data/check.jsonl').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(checks.length).toBeGreaterThan(10);
    const granting = checks.filter((c) => EXCEPTION_TEXT.test(`${String(c.summary)} ${String(c.explanation)} ${String(c.query)}`)).map((c) => c.name);
    expect(granting).toEqual([]);
  });

  it('gives the CLI, its commands and its tools no flag or field that skips a rule', () => {
    const cli = read('lathe/bin/lathe.ts');
    const options = [...(/options: \{([\s\S]*?)\n  \},/.exec(cli)?.[1] ?? '').matchAll(/^\s+([\w-]+):/gm)].map((m) => m[1]);
    expect(options).toContain('root');
    const fields = [...ALL_COMMANDS, ...ALL_QUERIES].flatMap((d) => Object.keys(d.input).map((field) => `${d.slice.name} ${d.name} --${field}`));
    expect([...options, ...fields].filter((name) => EXCEPTION_NAME.test(name.replaceAll('-', '_')))).toEqual([]);
    expect(cli).not.toMatch(EXCEPTION_TEXT);
  });

  it("teaches no exception in the plugin's skills or README", () => {
    const docs = [...filesUnder('plugin', '.md'), 'README.md', 'lathe/README.md'];
    const teaching = docs.filter((file) => EXCEPTION_TEXT.test(read(file)));
    expect(teaching).toEqual([]);
  });
});
