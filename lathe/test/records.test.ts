// Tests for the Modeling domain (LA-MOD): spec records and the rules every record follows.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Problem, type Workspace } from '../src/index.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const REPO = path.resolve(HERE, '..', '..');

// A test that writes gets its own empty product repo.
const temps: string[] = [];
function tempRepo(): { root: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-records-'));
  temps.push(root);
  return { root };
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of ['records-good', 'records-broken']) workspaces[name] = await loadWorkspace(path.join(FIXTURES, name));
});
const broken = (check: string) =>
  workspaces['records-broken'].problems
    .filter((p: Problem) => p.check === check)
    .map((p) => p.record)
    .sort();

describe('spec records', () => {
  it('LA-MOD-T23 A record is one Markdown file whose header holds its fields and links', () => {
    const ws = workspaces['records-good'];
    expect(ws.problems).toEqual([]);
    const uc = ws.records.find((r) => r.id === 'MX-D-UC01')!;
    expect(uc).toMatchObject({
      kind: 'use_case',
      title: 'Make a mark',
      parent: 'MX-D',
      product: 'MX',
      domain: 'MX-D',
      path: 'specs/mx/d/01-define/use-cases/UC01-make-a-mark.md',
      fields: { actor: 'Writer' },
    });
    expect(uc.body.trim()).toBe('A writer makes a mark.');
    expect(ws.links).toContainEqual({ source: 'MX-D-UC01', relation: 'applies', target: 'MX-D-DR01' });
    expect(ws.records).toHaveLength(8);
  });

  it('LA-MOD-T24 A record points at the code that builds it (file) and the code that proves it (run_by)', () => {
    const ws = workspaces['records-good'];
    expect(ws.records.find((r) => r.id === 'MX-D-C01')!.fields.file).toBe('code/mark_service.txt');
    expect(ws.records.find((r) => r.id === 'MX-D-T01')!.fields.run_by).toBe('code/mark_test.txt');
    expect(ws.coverage).toEqual([expect.objectContaining({
      domain: 'MX-D',
      obligations: expect.arrayContaining([
        expect.objectContaining({ kind: 'requirement', proved: 1 }),
        expect.objectContaining({ kind: 'domain_rule', proved: 1 }),
      ]),
      gaps: [],
    })]);
  });

  it('LA-MOD-T25 Moving or renaming record files does not change what they mean, and README.md is ignored', async () => {
    const { root } = tempRepo();
    // Put every record of the good workspace flat in one oddly named folder, with a README.md that is not a record.
    const from = path.join(FIXTURES, 'records-good');
    cpSync(path.join(from, 'code'), path.join(root, 'code'), { recursive: true });
    const flat = path.join(root, 'specs', 'everything-here');
    mkdirSync(flat, { recursive: true });
    let n = 0;
    for (const entry of readdirSync(path.join(from, 'specs'), { recursive: true, withFileTypes: true })) {
      if (entry.isFile() && entry.name !== 'README.md') cpSync(path.join(entry.parentPath, entry.name), path.join(flat, `record-${++n}.md`));
    }
    writeFileSync(path.join(flat, 'README.md'), 'Just notes, with no header.\n');

    const moved = await loadWorkspace(root);
    const original = workspaces['records-good'];
    const meaning = (ws: Workspace) => ws.records.map(({ path: _path, ...r }) => r).sort((a, b) => a.id.localeCompare(b.id));
    expect(moved.problems).toEqual([]);
    expect(meaning(moved)).toEqual(meaning(original));
    expect(moved.links).toEqual(expect.arrayContaining(original.links));
    expect(moved.coverage).toEqual(original.coverage);
  });

  it('LA-MOD-T26 Two records with the same ID are an error, even in different products', () => {
    expect(broken('duplicate-id')).toEqual(['BA-D-A1']);
  });

  it('LA-MOD-T27 An ID that does not match the pattern is an error', () => {
    expect(broken('bad-id')).toEqual(['ba-d-a2']);
  });

  it('LA-MOD-T28 A missing, unknown, disallowed or looping parent is an error, as is a product with a parent', () => {
    expect(broken('missing-parent')).toEqual(['BA-D-A3']);
    expect(broken('unknown-parent')).toEqual(['BA-D-A4']);
    expect(broken('parent-kind-not-allowed')).toEqual(['BA-D-A5', 'BA-D-A6', 'BA-D-DR01']);
    expect(broken('parent-cycle')).toEqual(['BA-D-A5', 'BA-D-A6']);
    expect(broken('product-has-parent')).toEqual(['BB']);
  });

  it('LA-MOD-T29 A record without a title, a known kind or its kind\'s required fields is an error', () => {
    expect(broken('missing-title')).toEqual(['BA-D-A7']);
    expect(broken('unknown-kind')).toEqual(['BA-D-W01']);
    expect(broken('missing-required-field')).toEqual(['BA-D-UC01']);
    const missing = workspaces['records-broken'].problems.find((p) => p.check === 'missing-required-field')!;
    expect(missing.message).toContain('actor');
  });

  it('LA-MOD-T30 A link to a record that does not exist is an error', () => {
    expect(broken('dangling-link')).toEqual(['BA-D-UC02']);
  });

  it('LA-MOD-T31 A link whose relation is unknown or not allowed for its kinds is an error', () => {
    expect(broken('relation-not-allowed')).toEqual(['BA-D-V01']);
    expect(broken('unknown-relation')).toEqual(['BA-D-V01']);
  });

  it('LA-MOD-T32 A test whose run_by file is missing or lacks its ID is an error; a missing component file is only a warning', () => {
    expect(broken('test-file-missing')).toEqual(['BA-D-T01']);
    expect(broken('proof-not-in-file')).toEqual(['BA-D-T02']);
    const later = workspaces['records-broken'].problems.filter((p) => p.record === 'BA-D-C01');
    expect(later).toEqual([expect.objectContaining({ severity: 'warning', check: 'component-file-missing' })]);
  });

  it("LA-MOD-T33 Every rule and requirement in Lathe's own specs states its rule with MUST, SHOULD or MAY under a short title", async () => {
    // Lathe's own records only: other products in this repo are examples with their own owners.
    const ws = await loadWorkspace(REPO);
    const rules = ws.records.filter((r) => r.product === 'LA' && (r.kind === 'requirement' || r.kind === 'domain_rule'));
    expect(rules.length).toBeGreaterThan(0);
    const unstated = rules.filter((r) => !/\b(MUST|SHOULD|MAY)\b/.test(r.body)).map((r) => r.id);
    const longTitles = rules.filter((r) => r.title.split(/\s+/).length > 15).map((r) => r.id);
    expect({ unstated, longTitles }).toEqual({ unstated: [], longTitles: [] });
  });
});
