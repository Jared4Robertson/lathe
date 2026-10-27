// Folders (sections): each kind's folder within its stage, and the folders a product's records are read in, as Client
// lays out its specs. The folders are the schema's meta_section rows; a product's own kind names one of them.
import { afterAll, describe, expect, it } from 'vitest';
import { openStore, type Workspace } from '../src/index.ts';
import { everyKind, load, loadData, refusals, removeData, withTable, writeData } from './helpers.ts';

afterAll(removeData);

const sectionOf = (ws: Workspace, kind: string) => ws.kinds.find((k) => k.kind === kind)?.section;
const problemsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);

/** The everyKind product with a product kind, risk, placed by the given columns. */
const withRisk = (columns: Record<string, string>) => {
  const data = everyKind();
  const risk = { name: 'risk', product_id: 'TL', label: 'Risk', description: 'A risk.', parent_kind: 'domain', obligation: 'none', ...columns };
  return withTable(data, 'product_kind', [...data.product_kind, risk]);
};

describe('folders', () => {
  it("LA-AUT-T57 The engine loads each kind's section and the folders in stage then order", async () => {
    const ws = await load('good');
    expect(ws.sections.map((s) => [s.stage, s.order, s.section, s.label])).toEqual([
      ['define', 1, 'domain-model', 'Domain model'],
      ['define', 2, 'use-cases', 'Capabilities'],
      ['design', 1, 'interaction-design', 'Interaction design'],
      ['design', 2, 'technical-specification', 'Technical specification'],
      ['design', 3, 'test-plan', 'Test plan'],
      ['', 1, 'shared', 'Shared'],
    ]);
    expect(ws.sections.at(-1)!.description).toContain('patterns');
    expect(Object.fromEntries(ws.kinds.map((k) => [k.kind, k.section]))).toMatchObject({
      product: '', domain: '', question: '',
      aggregate: 'domain-model', domain_rule: 'domain-model',
      capability: 'use-cases', use_case: 'use-cases', requirement: 'use-cases',
      flow: 'interaction-design', flow_step: 'interaction-design', view: 'interaction-design', endpoint: 'interaction-design', interaction_requirement: 'interaction-design',
      component: 'technical-specification',
      test: 'test-plan',
      pattern: 'shared', pattern_rule: 'shared',
    });
    expect(problemsOf(ws, 'section-stage-mismatch')).toEqual([]);
  });

  it("LA-AUT-T58 A product's own kind is placed in one of the schema's folders, and Lathe's kinds keep theirs", async () => {
    const ws = await loadData(withRisk({ stage: 'define', section: 'domain-model' }));
    expect(sectionOf(ws, 'risk')).toBe('domain-model');
    expect(sectionOf(ws, 'aggregate')).toBe('domain-model');
    expect(ws.sections).toEqual((await load('good')).sections);
    expect(problemsOf(ws, 'section-stage-mismatch')).toEqual([]);
  });

  it('LA-AUT-T59 A kind naming a folder that is not listed is refused', async () => {
    // product_kind.section is a foreign key into the schema's folders.
    await expect(openStore(writeData(withRisk({ stage: 'define', section: 'risk-log' })), { latheDataDir: null })).rejects.toThrow(/risk-log/);
    // A kind with no folder is fine.
    expect(await refusals(withRisk({ stage: 'define' }))).toEqual([]);
  });

  it('LA-AUT-T60 A kind in another stage\'s folder is a section-stage-mismatch error; a product-level folder takes any stage', async () => {
    const ws = await loadData(withRisk({ stage: 'design', section: 'use-cases' }));
    expect(problemsOf(ws, 'section-stage-mismatch')).toEqual([
      { severity: 'error', check: 'section-stage-mismatch', record: null, message: 'Kind "risk" is in stage "design", but its folder "use-cases" belongs to stage "define".' },
    ]);
    const stageless = await loadData(withRisk({ section: 'test-plan' }));
    expect(problemsOf(stageless, 'section-stage-mismatch').map((p) => p.message)).toEqual(['Kind "risk" is in stage "", but its folder "test-plan" belongs to stage "design".']);
    // Patterns are define-stage kinds in the shared folder, which has no stage: no mismatch.
    expect(problemsOf(await load('good'), 'section-stage-mismatch')).toEqual([]);
    const shared = await loadData(withRisk({ stage: 'design', section: 'shared' }));
    expect(problemsOf(shared, 'section-stage-mismatch')).toEqual([]);
  });

  it('LA-AUT-T61 Every folder is a row of the schema, and a kind with no folder sits in none', async () => {
    const ws = await loadData(withRisk({}));
    expect(sectionOf(ws, 'risk')).toBe('');
    expect(ws.kinds.filter((k) => k.section !== '').every((k) => ws.sections.some((s) => s.section === k.section))).toBe(true);
    expect(problemsOf(ws, 'section-stage-mismatch')).toEqual([]);
  });
});
