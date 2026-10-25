// The format reference generated from the meta-model and the check headers: formatReference, the
// undocumented check, `lathe format`, GET /api/format and the committed REFERENCE.md.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { CHECKS_DIR, formatReference, loadWorkspace, PACKAGE_DIR, parseCheckHeader, renderReference, type FormatReference } from '../src/index.ts';
import { handleApi } from '../src/server/api.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(here, 'fixtures', name);
const lathe = (...args: string[]) => spawnSync(process.execPath, [path.join(here, '..', 'bin', 'lathe.ts'), ...args], { encoding: 'utf8' });
const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-reference-'));
  temps.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('check headers', () => {
  it('LA-CHK-T300 Every check file starts with a summary, an explanation and a severity line that matches its SQL', () => {
    const files = readdirSync(CHECKS_DIR).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      const sql = readFileSync(path.join(CHECKS_DIR, file), 'utf8');
      const header = parseCheckHeader(sql);
      expect(header.missing, file).toEqual([]);
      // The summary is one sentence.
      expect(header.summary.match(/[.!?](\s|$)/g)?.length ?? 0, `${file}: ${header.summary}`).toBe(1);
      // The severities the header names are the ones the SELECT can return.
      const severityLine = sql.split('\n').find((line) => line.includes('AS severity')) ?? '';
      const literals = [...new Set([...severityLine.matchAll(/'(error|warning)'/g)].map((m) => m[1]))].sort();
      expect([...header.severities].sort(), file).toEqual(literals);
    }
  });

  it('LA-CHK-T301 A header is read as summary, explanation, severity and kinds', () => {
    const header = parseCheckHeader(
      [
        '-- A use case has an actor.',
        '--',
        '-- The actor is who reaches the goal.',
        '--   * a list item stays a list item;',
        '--',
        '-- Add the `actor` field.',
        '--',
        '-- severity: error, warning',
        '-- kinds: use_case',
        "SELECT 'error' AS severity",
        '-- a later comment is not part of the header',
      ].join('\n'),
    );
    expect(header).toEqual({
      summary: 'A use case has an actor.',
      explanation: 'The actor is who reaches the goal.\n  * a list item stays a list item;\n\nAdd the `actor` field.',
      severities: ['error', 'warning'],
      kinds: ['use_case'],
      missing: [],
    });
    expect(parseCheckHeader('-- Only a summary.\nSELECT 1').missing).toEqual(['explanation', 'severity line']);
    expect(parseCheckHeader('SELECT 1').missing).toEqual(['summary sentence', 'explanation', 'severity line']);
    expect(parseCheckHeader('-- A.\n--\n-- B.\n--\n-- severity: fatal\nSELECT 1').missing).toEqual(['valid severity line (error or warning)']);
  });
});

describe('the format reference', () => {
  let defaults: FormatReference;

  it("LA-CHK-T302 The reference holds every kind, relation, folder and check of Lathe's meta-model", async () => {
    defaults = await formatReference(PACKAGE_DIR);
    const useCase = defaults.kinds.find((k) => k.kind === 'use_case')!;
    expect(useCase).toMatchObject({
      label: 'Use case',
      stage: 'define',
      section: 'use-cases',
      parent_kinds: ['domain', 'capability'],
      required_fields: ['actor'],
      obligation: 'no',
      id: { pattern: '<P>-<D>-UC<nn>', example: 'TL-LEND-UC01' },
    });
    // Children are the kinds that list it as a parent.
    expect(useCase.child_kinds).toEqual(['requirement', 'question']);
    expect(defaults.kinds.find((k) => k.kind === 'requirement')?.obligation).toBe('yes');
    expect(defaults.kinds.find((k) => k.kind === 'pattern_rule')?.obligation).toBe('proof');
    expect(defaults.kinds.every((k) => k.id !== null)).toBe(true);
    expect(defaults.relations.find((r) => r.relation === 'proves')).toMatchObject({ source_kind: 'test', role: 'proof' });
    expect(defaults.sections.map((s) => s.section)).toEqual(['shared', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    // Every Lathe check file, then the engine's own problems.
    const files = readdirSync(CHECKS_DIR).filter((f) => f.endsWith('.sql'));
    expect(defaults.checks.filter((c) => c.origin === 'lathe')).toHaveLength(files.length);
    expect(defaults.checks.filter((c) => c.origin === 'engine').map((c) => c.check)).toEqual([
      'parse-error',
      'parent-cycle',
      'product-check-name-clash',
      'product-checks-missing',
    ]);
    expect(defaults.checks.find((c) => c.check === 'test-file-missing')).toMatchObject({
      severity: 'error',
      severities: ['error', 'warning'],
      source: 'checks/13-test-file-missing.sql',
      kinds: ['test'],
    });
    expect(defaults.concepts).toContain('# Lathe spec format');
  });

  it("LA-CHK-T303 A product's reference shows its extensions and its own checks", async () => {
    const widened = await formatReference(fixture('widen-extension'));
    expect(widened.kinds.find((k) => k.kind === 'domain_rule')).toMatchObject({ label: 'Business rule', parent_kinds: ['aggregate', 'domain'] });
    expect(widened.kinds.find((k) => k.kind === 'policy')).toMatchObject({ obligation: 'yes', description: 'A policy the business sets.', id: null });
    expect(widened.kinds.find((k) => k.kind === 'domain')?.child_kinds).toContain('policy');

    const house = await formatReference(fixture('product-checks-house'));
    const own = house.checks.filter((c) => c.origin === 'product');
    // A product check named like one of Lathe's does not run, so it is not documented either.
    expect(own.map((c) => c.check)).toEqual(['one-record-view-per-aggregate', 'broken']);
    expect(own[0]).toMatchObject({ source: 'house-checks/01-one-record-view-per-aggregate.sql', severity: 'warning', kinds: ['aggregate', 'use_case'] });
    expect(house.checks.at(-1)?.origin).toBe('product');
  });

  it('LA-CHK-T304 The committed REFERENCE.md is the reference as lathe format writes it', async () => {
    const committed = readFileSync(path.join(PACKAGE_DIR, 'REFERENCE.md'), 'utf8');
    // When this fails, run `npm --prefix lathe run reference` and commit REFERENCE.md.
    expect(committed).toBe(renderReference(defaults ?? (await formatReference(PACKAGE_DIR))));
  });

  it('LA-CHK-T305 The Markdown gives the concepts, then kinds, relations, folders and checks, each with an anchor', async () => {
    const markdown = renderReference(defaults ?? (await formatReference(PACKAGE_DIR)));
    const at = (text: string) => markdown.indexOf(text);
    expect(at('# Lathe spec format')).toBe(0);
    expect(at('## 17. Entities and the ERD')).toBeLessThan(at('\n## Kinds\n'));
    expect(at('\n## Kinds\n')).toBeLessThan(at('\n## Relations\n'));
    expect(at('\n## Relations\n')).toBeLessThan(at('\n## Folders\n'));
    expect(at('\n## Folders\n')).toBeLessThan(at('\n## Checks\n'));
    for (const anchor of ['kind-use_case', 'relation-proves', 'folder-test-plan', 'check-unproved', 'check-parse-error', 'check-undocumented']) {
      expect(markdown).toContain(`<a id="${anchor}"></a>`);
    }
    // Every link inside the document lands on one of its anchors.
    const anchors = new Set([...markdown.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]));
    const targets = [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(100);
    expect(targets.filter((t) => !anchors.has(t))).toEqual([]);
  });
});

describe('the undocumented check', () => {
  it('LA-CHK-T306 A kind or relation without a description, or a check without its header, is an undocumented error', async () => {
    const meta = tempDir();
    for (const file of ['kinds.csv', 'relations.csv', 'sections.csv', 'ids.csv']) cpSync(path.join(PACKAGE_DIR, 'meta', file), path.join(meta, file));
    writeFileSync(path.join(meta, 'kinds.csv'), `${readFileSync(path.join(meta, 'kinds.csv'), 'utf8')}note,Note,,,domain,,no,\n`);
    writeFileSync(path.join(meta, 'relations.csv'), `${readFileSync(path.join(meta, 'relations.csv'), 'utf8')}annotates,note,*,,\n`);
    const checks = tempDir();
    cpSync(CHECKS_DIR, checks, { recursive: true });
    writeFileSync(path.join(checks, '99-bare.sql'), "-- Only a summary.\nSELECT 'warning' AS severity, 'bare' AS \"check\", NULL AS record, 'x' AS message WHERE false");
    const ws = await loadWorkspace(fixture('good'), { metaDir: meta, checksDir: checks });
    const found = ws.problems.filter((p) => p.check === 'undocumented');
    expect(found.every((p) => p.severity === 'error' && p.record === null)).toBe(true);
    expect(found.map((p) => p.message)).toEqual([
      expect.stringContaining('The kind note has no description in kinds.csv'),
      expect.stringContaining('The relation annotates from note to * has no description in relations.csv'),
      expect.stringContaining('The check checks/99-bare.sql has no explanation or severity line in its header comment'),
    ]);
  });

  it("LA-CHK-T307 A product's own checks are held to the same rule, and Lathe's defaults are all documented", async () => {
    const house = await loadWorkspace(fixture('product-checks-house'));
    expect(house.problems.filter((p) => p.check === 'undocumented').map((p) => p.message)).toEqual([
      expect.stringContaining('The check house-checks/03-broken.sql has no summary sentence or explanation or severity line'),
    ]);
    const good = await loadWorkspace(fixture('good'));
    expect(good.problems.filter((p) => p.check === 'undocumented')).toEqual([]);
  });
});

describe('relation labels', () => {
  it('LA-CHK-T310 A relation rule without both labels is a relation-unlabeled error', async () => {
    const root = tempDir();
    cpSync(fixture('good'), root, { recursive: true });
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ metaExtensions: 'lathe-meta' }));
    const meta = path.join(root, 'lathe-meta');
    mkdirSync(meta);
    writeFileSync(
      path.join(meta, 'relations.csv'),
      [
        'relation,source_kind,target_kind,role,forward_label,reverse_label,description',
        // A restatement with empty labels keeps the default's.
        'proves,test,requirement,,,,"The test checks the requirement."',
        'annotates,question,requirement,,,,"The question annotates the requirement."',
        'blocks,question,domain_rule,,Blocks,,"The question blocks the domain rule."',
        'echoes,question,question,,,Echoed by,"The question echoes another."',
      ].join('\n'),
    );
    const ws = await loadWorkspace(root);
    const found = ws.problems.filter((p) => p.check === 'relation-unlabeled');
    expect(found.every((p) => p.severity === 'error' && p.record === null)).toBe(true);
    expect(found.map((p) => p.message)).toEqual([
      expect.stringContaining('The relation annotates from question to requirement has no forward_label or reverse_label in relations.csv'),
      expect.stringContaining('The relation blocks from question to domain_rule has no reverse_label'),
      expect.stringContaining('The relation echoes from question to question has no forward_label'),
    ]);
    expect(ws.relations.find((r) => r.relation === 'proves' && r.target_kind === 'requirement')).toMatchObject({
      forward_label: 'Proves',
      reverse_label: 'Proved by',
      description: 'The test checks the requirement.',
    });
    // Lathe's own meta-model is fully labeled.
    const good = await loadWorkspace(fixture('good'));
    expect(good.problems.filter((p) => p.check === 'relation-unlabeled')).toEqual([]);
  });

  it('LA-CHK-T311 The reference reads each relation by its labels', async () => {
    const ref = await formatReference(fixture('good'));
    for (const r of ref.relations) {
      expect(r.forward_label.trim(), r.relation).not.toBe('');
      expect(r.reverse_label.trim(), r.relation).not.toBe('');
    }
    expect(ref.relations.find((r) => r.relation === 'satisfies')).toMatchObject({ forward_label: 'Satisfies', reverse_label: 'Designed by' });
    const markdown = renderReference(ref);
    expect(markdown).toContain('| From | To | Role | Forward | Reverse | Meaning |');
    expect(markdown).toContain('| Satisfies | Designed by |');
    const start = markdown.indexOf('<a id="kind-requirement"></a>');
    const requirement = markdown.slice(start, markdown.indexOf('<a id="kind-', start + 1));
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Designed by \(\[`satisfies`\]\(#relation-satisfies\)\)/);
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Proved by \(\[`proves`\]\(#relation-proves\)\)/);
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Carried out in \(\[`fulfills`\]\(#relation-fulfills\)\)/);
  });
});

describe('lathe format and GET /api/format', () => {
  it('LA-CHK-T308 lathe format prints the reference, or writes it with --out', async () => {
    const expected = renderReference(await formatReference(fixture('widen-extension')));
    const printed = lathe('format', '--root', fixture('widen-extension'));
    expect(printed.status).toBe(0);
    expect(printed.stdout).toBe(expected);
    const out = path.join(tempDir(), 'REFERENCE.md');
    const written = lathe('format', '--root', fixture('widen-extension'), '--out', out);
    expect(written.status).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(expected);
    expect(lathe('help').stdout).toContain('format');
  });

  it('LA-CHK-T309 GET /api/format serves the product reference as JSON', async () => {
    let status = 0;
    let body = '';
    const headers: Record<string, string> = {};
    const res = {
      set statusCode(value: number) {
        status = value;
      },
      setHeader: (name: string, value: string) => (headers[name] = value),
      end: (text: string) => (body = text),
    } as unknown as ServerResponse;
    const handled = await handleApi(fixture('widen-extension'), { method: 'GET' } as IncomingMessage, res, '/api/format');
    expect(handled).toBe(true);
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('application/json');
    const reference = JSON.parse(body) as FormatReference;
    expect(reference).toEqual(JSON.parse(JSON.stringify(await formatReference(fixture('widen-extension')))));
    expect(reference.kinds.some((k) => k.kind === 'policy')).toBe(true);
  });
});
