// The `lathe` command line, run as a child process the way a person or agent runs it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loadWorkspace } from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, 'fixtures', name);
const lathe = (...args: string[]) => {
  const result = spawnSync(process.execPath, [path.join(here, '..', 'bin', 'lathe.ts'), ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};
const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-cli-'));
  temps.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('lathe check', () => {
  it('LA-CHK-T09 The check prints errors, then warnings, then coverage with designed, built and proved', () => {
    const { stdout } = lathe('check', '--root', fixture('broken-links'));
    const errors = stdout.indexOf('\nErrors (');
    const warnings = stdout.indexOf('\nWarnings (');
    const coverage = stdout.indexOf('\nCoverage:');
    expect(errors).toBeGreaterThan(-1);
    expect(warnings).toBeGreaterThan(errors);
    expect(coverage).toBeGreaterThan(warnings);
    expect(stdout.slice(errors, warnings)).toContain('[dangling-link] BX-D-UC01:');
    expect(stdout.slice(warnings, coverage)).toContain('[unproved] BX-D-UC01-R01:');
    expect(stdout.slice(coverage)).toContain('BX-D requirement: 0/1 designed, 0/1 built, 0/1 proved, 0/1 planned; 2 gaps');

    const unfinished = lathe('check', '--root', fixture('unfinished')).stdout;
    expect(unfinished).toContain('UX-D domain_rule: 1/1 designed, 1/1 built, 0/1 proved, 0/1 planned; 1 gap');
    expect(unfinished).toContain('UX-D requirement: 2/3 designed, 1/3 built, 1/3 proved, 0/3 planned; 3 gaps');
  });

  it('LA-CHK-T10 The check exits 1 on any error and 0 otherwise, whatever the warnings', () => {
    expect(lathe('check', '--root', fixture('broken-links')).status).toBe(1);
    expect(lathe('check', '--root', fixture('fitness')).status).toBe(1);
    const good = lathe('check', '--root', fixture('good'));
    expect(good.status).toBe(0);
    expect(good.stdout).toContain('0 errors, 0 warnings.');
    const warningsOnly = lathe('check', '--root', fixture('unfinished'));
    expect(warningsOnly.stdout).toMatch(/0 errors, [1-9]\d* warnings\./);
    expect(warningsOnly.status).toBe(0);
  });

  it('LA-CHK-T11 With --json the check prints the whole workspace', async () => {
    const { stdout, status } = lathe('check', '--json', '--root', fixture('broken-links'));
    expect(status).toBe(1);
    expect(JSON.parse(stdout)).toEqual(await loadWorkspace(fixture('broken-links')));
  });
});

describe('lathe init', () => {
  it('LA-CHK-T26 Init writes a config and a first product record, and refuses bad or repeated input', () => {
    const root = tempDir();
    const first = lathe('init', '--root', root, '--name', 'Tool Library', '--prefix', 'TL');
    expect(first.status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(root, 'lathe.config.json'), 'utf8'))).toEqual({ specs: 'specs', diagrams: 'diagrams' });
    const product = path.join(root, 'specs', 'tool-library', 'product.md');
    expect(readFileSync(product, 'utf8')).toMatch(/^---\nid: TL\nkind: product\ntitle: Tool Library\n---\n/);
    expect(lathe('check', '--root', root).status).toBe(0);

    // It does not overwrite the product record.
    writeFileSync(product, `${readFileSync(product, 'utf8')}My own words.\n`);
    const again = lathe('init', '--root', root, '--name', 'Tool Library', '--prefix', 'TL');
    expect(again.status).toBe(2);
    expect(again.stderr).toContain('already exists');
    expect(readFileSync(product, 'utf8')).toContain('My own words.');

    // It refuses a prefix that is not a valid ID, and a missing name or prefix, writing nothing.
    const other = tempDir();
    for (const args of [['--name', 'X', '--prefix', 'tl'], ['--name', 'X', '--prefix', 'T-L'], ['--name', 'X'], ['--prefix', 'TL']]) {
      const refused = lathe('init', '--root', other, ...args);
      expect(refused.status).toBe(2);
      expect(existsSync(path.join(other, 'lathe.config.json'))).toBe(false);
    }

    // An existing config is kept, and its specs folder is used.
    const configured = tempDir();
    const config = `${JSON.stringify({ specs: 'docs/specs' })}\n`;
    writeFileSync(path.join(configured, 'lathe.config.json'), config);
    expect(lathe('init', '--root', configured, '--name', 'Notes', '--prefix', 'NT').status).toBe(0);
    expect(readFileSync(path.join(configured, 'lathe.config.json'), 'utf8')).toBe(config);
    expect(existsSync(path.join(configured, 'docs', 'specs', 'notes', 'product.md'))).toBe(true);
  });
});
