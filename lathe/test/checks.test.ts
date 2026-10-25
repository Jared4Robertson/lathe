import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Problem, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const records = (problems: Problem[]) => problems.map((p) => p.record).sort();
/** One obligation kind's line in a domain's coverage: total, designed, built and proved. */
const line = (kind: string, total: number, designed: number, built: number, proved: number) => expect.objectContaining({ kind, total, designed, built, proved });

const FIXTURES = ['good', 'broken-links', 'broken-tests', 'broken-parse', 'broken-structure', 'configured', 'unfinished', 'fitness'];
const WARNINGS = ['unsatisfied', 'unproved', 'use-case-without-requirements', 'component-file-missing', 'rule-not-applied', 'use-case-without-flow', 'interaction-requirement-fulfills-nothing', 'test-type-mismatch'];
const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of FIXTURES) workspaces[name] = await loadWorkspace(fixture(name));
  workspaces['broken-meta'] = await loadWorkspace(fixture('broken-meta'), { metaDir: fixture('broken-meta/meta') });
});

describe('Lathe-cited checks', () => {
  it('LA-CHK-T01 Duplicate IDs are reported as errors', () => {
    const found = ofCheck(workspaces['broken-links'], 'duplicate-id');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', record: 'BX-D-A1' });
    expect(found[0].message).toContain('specs/p/d/a1.md');
    expect(found[0].message).toContain('specs/p/d/a1-again.md');
  });

  it('LA-CHK-T02 A link to a missing record is reported as an error', () => {
    const found = ofCheck(workspaces['broken-links'], 'dangling-link');
    expect(found).toEqual([
      { severity: 'error', check: 'dangling-link', record: 'BX-D-UC01', message: expect.stringContaining('BX-D-DR99') },
    ]);
  });

  it('LA-CHK-T03 A disallowed relation is reported as an error', () => {
    const ws = workspaces['broken-links'];
    const found = ofCheck(ws, 'relation-not-allowed');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', record: 'BX-D-V01' });
    expect(found[0].message).toContain('BX-D-UC01-R01');
    // A question may be "about" any kind ('*'), so that link is not reported.
    expect(found.some((p) => p.record === 'BX-D-Q01')).toBe(false);
    // An unknown relation is its own error, not a disallowed one.
    expect(ofCheck(ws, 'unknown-relation')).toMatchObject([{ severity: 'error', record: 'BX-D-V01' }]);
  });

  it('LA-CHK-T04 A test whose run_by file lacks its ID is reported as an error', () => {
    const ws = workspaces['broken-tests'];
    expect(ofCheck(ws, 'test-file-missing-id')).toMatchObject([{ severity: 'error', record: 'BX-D-T01' }]);
    expect(ofCheck(ws, 'test-file-missing')).toMatchObject([{ severity: 'error', record: 'BX-D-T02' }]);
    expect(ws.problems.some((p) => p.record === 'BX-D-T03')).toBe(false);
  });

  it('LA-CHK-T05 Coverage counts satisfied and proved requirements and lists the gaps', () => {
    expect(workspaces.good.coverage).toMatchObject([
      {
        domain: 'EX-NOTE',
        obligations: expect.arrayContaining([
          line('requirement', 1, 1, 1, 1),
          line('domain_rule', 1, 1, 1, 1),
        ]),
        gaps: [],
      },
    ]);
    expect(workspaces['broken-links'].coverage).toMatchObject([
      {
        domain: 'BX-D',
        obligations: expect.arrayContaining([
          line('requirement', 1, 0, 0, 0),
          line('domain_rule', 0, 0, 0, 0),
        ]),
        gaps: [
          { id: 'BX-D-UC01-R01', kind: 'requirement', missing: 'satisfies' },
          { id: 'BX-D-UC01-R01', kind: 'requirement', missing: 'proves' },
        ],
      },
    ]);
  });

  it('LA-CHK-T06 A malformed record file becomes a parse error, not a crash', () => {
    const ws = workspaces['broken-parse'];
    const found = ofCheck(ws, 'parse-error');
    expect(found.every((p) => p.severity === 'error' && p.record === null)).toBe(true);
    const files = ['bad-link-list.md', 'bad-links.md', 'bad-yaml.md', 'header-list.md', 'no-header.md', 'not-string.md'];
    expect(found).toHaveLength(files.length);
    for (const file of files) expect(found.some((p) => p.message.includes(`specs/p/d/${file}`))).toBe(true);
    // Loading carries on: the good files are still records.
    expect(ws.records.map((r) => r.id).sort()).toEqual(['BX', 'BX-D', 'BX-D-A5']);
  });
});

describe('product configuration', () => {
  it("LA-CHK-T07 A product's lathe.config.json chooses the specs folder", () => {
    const ws = workspaces.configured;
    expect(ws.records.map((r) => r.id).sort()).toEqual(['CX', 'CX-D', 'CX-D-A1', 'CX-D-RP1']);
    expect(ws.records.find((r) => r.id === 'CX')?.path).toBe('docs/specs/cx/product.md');
    // specs/stray.md is outside the configured folder, so it is not read (and not a parse error).
    expect(ofCheck(ws, 'parse-error')).toEqual([]);
  });

  it("LA-CHK-T08 A product's meta-model extension adds kinds and relations", () => {
    const ws = workspaces.configured;
    expect(ws.kinds.map((k) => k.kind)).toEqual(expect.arrayContaining(['product', 'requirement', 'report']));
    expect(ws.relations).toContainEqual(expect.objectContaining({ relation: 'summarizes', source_kind: 'report', target_kind: 'aggregate' }));
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('coverage, meta-model and fitness', () => {
  it('LA-CHK-T12 Coverage counts designed, built and proved separately', () => {
    expect(workspaces.unfinished.coverage).toMatchObject([
      {
        domain: 'UX-D',
        obligations: expect.arrayContaining([
          line('requirement', 3, 2, 1, 1),
          line('domain_rule', 1, 1, 1, 0),
        ]),
        gaps: [
          { id: 'UX-D-DR01', kind: 'domain_rule', missing: 'proves' },
          { id: 'UX-D-UC01-R02', kind: 'requirement', missing: 'proves' },
          { id: 'UX-D-UC01-R03', kind: 'requirement', missing: 'satisfies' },
          { id: 'UX-D-UC01-R03', kind: 'requirement', missing: 'proves' },
        ],
      },
    ]);
    // Built never exceeds designed.
    for (const ws of Object.values(workspaces)) {
      for (const c of ws.coverage) {
        for (const o of c.obligations) {
          expect(o.built).toBeLessThanOrEqual(o.designed);
          expect(o.proved + o.planned).toBeLessThanOrEqual(o.total);
        }
      }
    }
  });

  it('LA-CHK-T13 Coverage gaps are warnings, so an unfinished design has no errors', () => {
    const ws = workspaces.unfinished;
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(records(ofCheck(ws, 'unsatisfied'))).toEqual(['UX-D-UC01-R03']);
    expect(records(ofCheck(ws, 'unproved'))).toEqual(['UX-D-DR01', 'UX-D-UC01-R02', 'UX-D-UC01-R03']);
    expect(ofCheck(ws, 'component-file-missing')).toMatchObject([{ severity: 'warning', record: 'UX-D-C02' }]);
  });

  it('LA-CHK-T22 A meta-model that names undefined kinds or repeats itself is reported as errors', () => {
    const ws = workspaces['broken-meta'];
    const meta = ws.problems.filter((p) => p.check.startsWith('meta-'));
    expect(meta.every((p) => p.severity === 'error' && p.record === null)).toBe(true);
    const messages = (check: string) => ofCheck(ws, check).map((p) => p.message);
    expect(messages('meta-duplicate-kind')).toEqual([expect.stringContaining('"domain" 2 times')]);
    expect(messages('meta-unknown-parent-kind')).toEqual([expect.stringContaining('parent kind "gadget"')]);
    expect(messages('meta-unknown-relation-kind')).toEqual([
      expect.stringContaining('source kind "sprocket"'),
      expect.stringContaining('target kind "gizmo"'),
    ]);
    expect(messages('meta-duplicate-relation')).toEqual([expect.stringContaining('"uses" from widget to domain 2 times')]);
    expect(messages('meta-bad-required-field')).toHaveLength(2);
    expect(messages('meta-bad-required-field').join(' ')).toContain('"Bad-Name"');
    expect(messages('meta-bad-required-field').join(' ')).toContain('"title"');
    // Lathe's own meta-model, and a product's extension of it, are consistent.
    for (const name of ['good', 'configured']) {
      expect(workspaces[name].problems.filter((p) => p.check.startsWith('meta-'))).toEqual([]);
    }
  });

  it("LA-CHK-T23 A fitness record's date must be a real YYYY-MM-DD date and its score 1 to 5", () => {
    const ws = workspaces.fitness;
    expect(records(ofCheck(ws, 'bad-fitness-date'))).toEqual(['FX-FIT02', 'FX-FIT05']);
    expect(records(ofCheck(ws, 'bad-fitness-score'))).toEqual(['FX-FIT03', 'FX-FIT04']);
    expect(records(ofCheck(ws, 'missing-required-field'))).toEqual(['FX-FIT06']);
    for (const p of ws.problems) expect(p.severity).toBe('error');
    expect(ws.problems.some((p) => p.record === 'FX-FIT01')).toBe(false);
    // A leap day is a real date.
    expect(ws.problems.some((p) => p.record === 'FX-FIT06' && p.check === 'bad-fitness-date')).toBe(false);
  });
});

describe('the good workspace', () => {
  it('has no problems', () => {
    expect(workspaces.good.problems).toEqual([]);
  });

  it('loads records with fields, body, path, product and domain', () => {
    const uc = workspaces.good.records.find((r) => r.id === 'EX-NOTE-UC01');
    expect(uc).toEqual({
      id: 'EX-NOTE-UC01',
      kind: 'use_case',
      title: 'Write a note',
      parent: 'EX-NOTE',
      product: 'EX',
      domain: 'EX-NOTE',
      fields: { actor: 'Person' },
      body: 'A person writes a note.',
      path: 'specs/example/notes/01-define/use-cases/UC01.md',
      mentions: [],
    });
    const product = workspaces.good.records.find((r) => r.id === 'EX');
    expect(product).toMatchObject({ parent: null, product: 'EX', domain: null });
    expect(workspaces.good.records.find((r) => r.id === 'EX-NOTE-DR01')).toMatchObject({ product: 'EX', domain: 'EX-NOTE' });
  });

  it('ignores README.md and loads links, kinds and relations', () => {
    const ws = workspaces.good;
    expect(ws.records).toHaveLength(10);
    expect(ws.links).toContainEqual({ source: 'EX-NOTE-C01', relation: 'satisfies', target: 'EX-NOTE-DR01' });
    expect(ws.links).toHaveLength(8);
    expect(ws.kinds.find((k) => k.kind === 'question')?.parent_kinds).toEqual(['product', 'domain', 'aggregate', 'use_case', 'component']);
    expect(ws.kinds.find((k) => k.kind === 'endpoint')?.required_fields).toEqual(['method', 'route']);
    expect(ws.kinds.find((k) => k.kind === 'product')).toMatchObject({ stage: '', parent_kinds: [], required_fields: [] });
    expect(ws.relations).toContainEqual(expect.objectContaining({ relation: 'about', source_kind: 'question', target_kind: '*' }));
  });
});

describe('structural checks', () => {
  const at = (check: string) => records(ofCheck(workspaces['broken-structure'], check));

  it('reports each structural problem once, against the right record', () => {
    expect(at('bad-id')).toEqual(['bx-d-a1', null]);
    expect(at('unknown-kind')).toEqual(['BX-D-W01']);
    expect(at('missing-title')).toEqual(['BX-D-A2']);
    expect(at('missing-parent')).toEqual(['BX-D-A3']);
    expect(at('unknown-parent')).toEqual(['BX-D-A4']);
    expect(at('parent-kind-not-allowed')).toEqual(['BX-D-A8', 'BX-D-A9', 'BX-D-DR01']);
    expect(at('product-has-parent')).toEqual(['BY']);
    expect(at('missing-required-field')).toEqual(['BX-D-E01']);
    expect(at('parent-cycle')).toEqual(['BX-D-A8', 'BX-D-A9']);
    expect(at('use-case-without-requirements')).toEqual(['BX-D-UC01']);
  });

  it('LA-CHK-T24 Broken records are errors and work to do is a warning', () => {
    const seen = new Set<string>();
    for (const ws of Object.values(workspaces)) {
      for (const p of ws.problems) {
        seen.add(p.check);
        expect(p.severity, `${p.check}: ${p.message}`).toBe(WARNINGS.includes(p.check) ? 'warning' : 'error');
      }
    }
    // Every kind of work to do, and the main kinds of breakage, appear in the fixtures. The structural
    // warnings (rule-not-applied and the rest) have their own fixtures in structure.test.ts.
    const structural = ['rule-not-applied', 'use-case-without-flow', 'interaction-requirement-fulfills-nothing', 'test-type-mismatch'];
    for (const check of [...WARNINGS.filter((w) => !structural.includes(w)), 'parse-error', 'duplicate-id', 'dangling-link', 'meta-duplicate-kind', 'bad-fitness-score']) {
      expect(seen).toContain(check);
    }
  });

  it('LA-CHK-T25 Every problem names its check and, when it has one, its record', () => {
    for (const ws of Object.values(workspaces)) {
      for (const p of ws.problems) {
        expect(p.check).toMatch(/^[a-z][a-z-]*$/);
        expect(p.message.trim().endsWith('.')).toBe(true);
        if (p.record !== null) {
          expect(p.message, p.check).toContain(p.record);
        } else {
          // Problems with no record are about a file, the meta-model, or a record that has no ID.
          const ok = p.check === 'parse-error' || p.check.startsWith('meta-') || /\.md\b/.test(p.message);
          expect(ok, `${p.check}: ${p.message}`).toBe(true);
        }
      }
    }
  });

  it('warns about a component file that does not exist yet', () => {
    expect(ofCheck(workspaces['broken-tests'], 'component-file-missing')).toMatchObject([
      { severity: 'warning', record: 'BX-D-C01', message: expect.stringContaining('code/later.ts') },
    ]);
  });

  it('warns about unsatisfied and unproved requirements', () => {
    const ws = workspaces['broken-links'];
    expect(ofCheck(ws, 'unsatisfied')).toMatchObject([{ severity: 'warning', record: 'BX-D-UC01-R01' }]);
    expect(ofCheck(ws, 'unproved')).toMatchObject([{ severity: 'warning', record: 'BX-D-UC01-R01' }]);
  });
});

describe('loading', () => {
  it('returns an empty workspace when there is no specs folder', async () => {
    const ws = await loadWorkspace(fixture('does-not-exist'));
    expect(ws.records).toEqual([]);
    expect(ws.problems).toEqual([]);
    expect(ws.coverage).toEqual([]);
    expect(ws.kinds.length).toBeGreaterThan(0);
  });
});
