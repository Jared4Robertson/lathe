// The `lathe` command line, run as a child process the way a person or agent runs it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, SCHEMA_VERSION } from '../src/index.ts';
import { build, changing, complete, removeData, sparse, SPARSE_FILES, writeData } from './helpers.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const lathe = (...args: string[]) => {
  const result = spawnSync(process.execPath, [path.join(here, '..', 'bin', 'lathe.ts'), ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

/** The complete product with an error (a test file not naming its test) and a warning (a technical file not written). */
let broken = '';
let clean = '';
let short = '';
beforeAll(async () => {
  broken = await build(changing(complete(), 'specification_test', () => true, { state: 'not automated yet' }), { silent: ['EX-LEND-INV01-T'], missing: ['src/dates.ts'] });
  clean = await build(complete());
  short = await build(sparse(), SPARSE_FILES);
});
afterAll(removeData);

describe('lathe check', () => {
  it('LA-CHK-UC01-R01-T01 The check prints errors, then warnings, then coverage', () => {
    const { stdout } = lathe('check', '--root', broken);
    const errors = stdout.indexOf('\nErrors (');
    const warnings = stdout.indexOf('\nWarnings (');
    const coverage = stdout.indexOf('\nCoverage:');
    expect(errors).toBeGreaterThan(-1);
    expect(warnings).toBeGreaterThan(errors);
    expect(coverage).toBeGreaterThan(warnings);
    expect(stdout.slice(errors, warnings)).toContain('[test-file-missing-id] EX-LEND-INV01-T:');
    expect(stdout.slice(warnings, coverage)).toContain('[technical-file-missing] EX-LEND-DS01-SV:');
  });

  it('LA-TRC-UC02-R05-T01 The check prints one coverage line per domain and obligation kind, with designed, built and proved, and the gaps', () => {
    const { stdout } = lathe('check', '--root', broken);
    const lines = stdout.slice(stdout.indexOf('\nCoverage:'));
    expect(lines).toContain('  EX-LEND invariant: 1/1 designed, 1/1 built, 0/1 proved\n    gap: Invariant EX-LEND-INV01 is not proved yet.');
    expect(lines).toContain('  EX-LEND specification: 1/1 designed, 1/1 built, 0/1 proved, 1/1 not automated yet');
    expect(lines).toContain('  EX-LEND domain service: 1/1 designed, 0/1 built, 1/1 proved');
    expect(lines).toContain('  EX-LEND pattern rule: proof only, 1/1 proved');
    expect(lines).toContain('  EX-LEND constraint: 1/1 designed, 1/1 built, 1/1 proved');
    expect(lines).toContain('  EX Shared standard rule: 1/1 designed, 1/1 built, 1/1 proved');
    expect(lines).toContain('  EX-LEND tests: 10 automated, 2 manual, 1 not automated yet');

    const gaps = lathe('check', '--root', short).stdout;
    expect(gaps).toContain('  SP-D records short of a minimum (');
    expect(gaps).toContain('    [use-case-without-flow] Use case SP-D-UC01 has no flow.');
    expect(gaps).toContain('  SP Shared records short of a minimum (');
  });

  it("LA-TRC-UC06-R03-T01 After a domain's obligation lines the check prints one line of its tests by state", () => {
    const lines = lathe('check', '--root', broken).stdout.split('\n');
    const tests = lines.findIndex((l) => l === '  EX-LEND tests: 10 automated, 2 manual, 1 not automated yet');
    expect(tests).toBeGreaterThan(-1);
    // Every EX-LEND obligation line comes before it, and none after.
    const domainLines = lines.map((l, i) => [l, i] as const).filter(([l]) => /^ {2}EX-LEND [a-z ]+: /.test(l) && !l.startsWith('  EX-LEND tests:'));
    expect(domainLines.length).toBeGreaterThan(5);
    for (const [, i] of domainLines) expect(i).toBeLessThan(tests);
    expect(lines.filter((l) => l.startsWith('  EX-LEND tests:'))).toHaveLength(1);
  });

  it('LA-CHK-UC01-R02-T01 The check exits 1 on any error and 0 otherwise, whatever the warnings and gaps', () => {
    expect(lathe('check', '--root', broken).status).toBe(1);
    const good = lathe('check', '--root', clean);
    expect(good.status).toBe(0);
    expect(good.stdout).toContain('0 errors, 0 warnings.');
  });

  it('LA-CHK-UC01-R05-T01 Data the store refuses is an error naming the file and line, not a crash', () => {
    const refused = writeData({});
    mkdirSync(path.join(refused, 'data'), { recursive: true });
    writeFileSync(path.join(refused, 'data', 'product.jsonl'), '{"id":"TL","title":"Tool Library","colour":"red"}\n');
    const run = lathe('check', '--root', refused);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('[data-refused]');
    expect(run.stdout).toContain('data/product.jsonl:1');
  });

  it('LA-CHK-UC01-R03-T01 With --json the check prints the whole workspace', async () => {
    const { stdout, status } = lathe('check', '--json', '--root', broken);
    expect(status).toBe(1);
    expect(JSON.parse(stdout)).toEqual(await loadWorkspace(broken));
  });
});

describe('lathe init', () => {
  it('LA-PLT-UC02-R01-T01 Init writes a config and a first product record through the store, and refuses bad or repeated input', () => {
    const root = writeData({});
    rmSync(path.join(root, 'lathe.config.json'));
    const first = lathe('init', '--root', root, '--name', 'Tool Library', '--prefix', 'TL');
    expect(first.status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(root, 'lathe.config.json'), 'utf8'))).toEqual({ schema: SCHEMA_VERSION, data: 'data' });
    const product = path.join(root, 'data', 'product.jsonl');
    expect(JSON.parse(readFileSync(product, 'utf8'))).toMatchObject({ id: 'TL', title: 'Tool Library' });
    expect(lathe('check', '--root', root).status).toBe(0);

    // It does not overwrite the product record.
    const before = readFileSync(product, 'utf8');
    const again = lathe('init', '--root', root, '--name', 'Tool Library', '--prefix', 'TL');
    expect(again.status).toBe(2);
    expect(again.stderr).toContain('already exists');
    expect(readFileSync(product, 'utf8')).toBe(before);

    // It refuses a prefix that is not a valid ID, and a missing name or prefix, writing nothing.
    const other = writeData({});
    rmSync(path.join(other, 'lathe.config.json'));
    for (const args of [['--name', 'X', '--prefix', 'tl'], ['--name', 'X', '--prefix', 'T-L'], ['--name', 'X'], ['--prefix', 'TL']]) {
      const refused = lathe('init', '--root', other, ...args);
      expect(refused.status).toBe(2);
      expect(existsSync(path.join(other, 'lathe.config.json'))).toBe(false);
    }

    // An existing config is kept, and its data folder is used.
    const configured = writeData({});
    const config = `${JSON.stringify({ schema: SCHEMA_VERSION, data: 'spec-data' })}\n`;
    writeFileSync(path.join(configured, 'lathe.config.json'), config);
    expect(lathe('init', '--root', configured, '--name', 'Notes', '--prefix', 'NT').status).toBe(0);
    expect(readFileSync(path.join(configured, 'lathe.config.json'), 'utf8')).toBe(config);
    expect(existsSync(path.join(configured, 'spec-data', 'product.jsonl'))).toBe(true);
  });
});
