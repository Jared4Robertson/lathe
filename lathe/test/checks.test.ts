import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Problem, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const ofCheck = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);
const records = (problems: Problem[]) => problems.map((p) => p.record).sort();

const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of ['good', 'broken-links', 'broken-tests', 'broken-parse', 'broken-structure']) {
    workspaces[name] = await loadWorkspace(fixture(name));
  }
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

  it('LA-CHK-T05 Coverage counts satisfied and proved requirements', () => {
    expect(workspaces.good.coverage).toEqual([
      {
        domain: 'EX-NOTE',
        requirements: 1,
        requirements_satisfied: 1,
        requirements_proved: 1,
        rules: 1,
        rules_satisfied: 1,
        rules_proved: 1,
        gaps: [],
      },
    ]);
    expect(workspaces['broken-links'].coverage).toEqual([
      {
        domain: 'BX-D',
        requirements: 1,
        requirements_satisfied: 0,
        requirements_proved: 0,
        rules: 0,
        rules_satisfied: 0,
        rules_proved: 0,
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

  it('marks every structural problem as an error and work-to-do as a warning', () => {
    for (const p of workspaces['broken-structure'].problems) {
      const warning = ['unsatisfied', 'unproved', 'use-case-without-requirements', 'component-file-missing'].includes(p.check);
      expect(p.severity).toBe(warning ? 'warning' : 'error');
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
