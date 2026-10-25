// Folders (sections): each kind's folder within its stage, and the folders a product's specs are read in,
// as Client lays out its specs (FORMAT.md section 15).
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { loadWorkspace, PACKAGE_DIR, type Workspace } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-sections-'));
  temps.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/** The good fixture, with a product extension folder holding the given CSV files. */
async function withExtension(files: Record<string, string>): Promise<Workspace> {
  const root = tempDir();
  cpSync(fixture('good'), root, { recursive: true });
  writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ metaExtensions: 'lathe-meta' }));
  mkdirSync(path.join(root, 'lathe-meta'));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(root, 'lathe-meta', name), text);
  return loadWorkspace(root);
}

const sectionOf = (ws: Workspace, kind: string) => ws.kinds.find((k) => k.kind === kind)?.section;
const problemsOf = (ws: Workspace, check: string) => ws.problems.filter((p) => p.check === check);

describe('folders', () => {
  it('LA-CHK-T260 The engine loads each kind\'s section and the folders of sections.csv, in stage then order', async () => {
    const ws = await loadWorkspace(fixture('good'));
    expect(ws.sections.map((s) => [s.stage, s.order, s.section, s.label])).toEqual([
      ['', 1, 'shared', 'Shared'],
      ['define', 1, 'domain-model', 'Domain model'],
      ['define', 2, 'use-cases', 'Use cases'],
      ['design', 1, 'interaction-design', 'Interaction design'],
      ['design', 2, 'technical-specification', 'Technical specification'],
      ['design', 3, 'test-plan', 'Test plan'],
    ]);
    expect(ws.sections[0].description).toContain('patterns');
    expect(Object.fromEntries(ws.kinds.map((k) => [k.kind, k.section]))).toMatchObject({
      product: '', domain: '', question: '', fitness: '',
      aggregate: 'domain-model', domain_rule: 'domain-model',
      capability: 'use-cases', use_case: 'use-cases', requirement: 'use-cases',
      flow: 'interaction-design', flow_step: 'interaction-design', view: 'interaction-design', endpoint: 'interaction-design', interaction_requirement: 'interaction-design',
      component: 'technical-specification',
      test: 'test-plan',
      pattern: 'shared', pattern_rule: 'shared',
    });
    expect(ws.problems.filter((p) => p.check === 'unknown-section' || p.check === 'section-stage-mismatch')).toEqual([]);
  });

  it('LA-CHK-T261 An extension adds a folder, changes one, and moves or places a kind, merging as kinds do', async () => {
    const ws = await withExtension({
      'sections.csv': 'section,stage,order,label,description\nrisks,define,3,Risks,"What could go wrong."\ntest-plan,,,Tests and checks,\n',
      'kinds.csv': 'kind,label,stage,section,parent_kinds,required_fields,obligation,description\nrisk,Risk,define,risks,domain,,no,A risk.\naggregate,,,,,,,\n',
    });
    expect(ws.sections.filter((s) => s.stage === 'define').map((s) => s.section)).toEqual(['domain-model', 'use-cases', 'risks']);
    expect(ws.sections.find((s) => s.section === 'test-plan')).toMatchObject({ stage: 'design', order: 3, label: 'Tests and checks', description: 'The tests that prove the obligations.' });
    expect(sectionOf(ws, 'risk')).toBe('risks');
    // An empty section keeps the default's.
    expect(sectionOf(ws, 'aggregate')).toBe('domain-model');
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);

    const moved = await withExtension({ 'kinds.csv': 'kind,label,stage,section,parent_kinds,required_fields,obligation,description\ndomain_rule,,,use-cases,,,,\n' });
    expect(sectionOf(moved, 'domain_rule')).toBe('use-cases');
    expect(moved.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('LA-CHK-T262 A kind naming a section sections.csv does not list is an unknown-section error', async () => {
    const ws = await withExtension({ 'kinds.csv': 'kind,label,stage,section,parent_kinds,required_fields,obligation,description\nrisk,Risk,define,risk-log,domain,,no,A risk.\n' });
    expect(problemsOf(ws, 'unknown-section')).toEqual([
      { severity: 'error', check: 'unknown-section', record: null, message: 'Kind "risk" sits in section "risk-log", which sections.csv does not list.' },
    ]);
    // A kind with no section is fine.
    const none = await withExtension({ 'kinds.csv': 'kind,label,stage,section,parent_kinds,required_fields,obligation,description\nrisk,Risk,define,,domain,,no,A risk.\n' });
    expect(problemsOf(none, 'unknown-section')).toEqual([]);
  });

  it('LA-CHK-T263 A kind whose section belongs to another stage is a section-stage-mismatch error; a product-level folder takes any stage', async () => {
    const ws = await withExtension({ 'kinds.csv': 'kind,label,stage,section,parent_kinds,required_fields,obligation,description\ncomponent,,,use-cases,,,,\nquestion,,,test-plan,,,,\n' });
    expect(problemsOf(ws, 'section-stage-mismatch').map((p) => p.message)).toEqual([
      'Kind "component" is in stage "design", but its section "use-cases" belongs to stage "define".',
      'Kind "question" is in stage "", but its section "test-plan" belongs to stage "design".',
    ]);
    // Patterns are define-stage kinds in the shared folder, which has no stage: no mismatch.
    expect(problemsOf(await loadWorkspace(fixture('good')), 'section-stage-mismatch')).toEqual([]);
    const shared = await withExtension({ 'kinds.csv': 'kind,label,stage,section,parent_kinds,required_fields,obligation,description\ncomponent,,,shared,,,,\n' });
    expect(problemsOf(shared, 'section-stage-mismatch')).toEqual([]);
  });

  it('LA-CHK-T264 A meta-model folder without sections.csv gives no folders, and kinds without a section column sit in none', async () => {
    const meta = tempDir();
    cpSync(path.join(PACKAGE_DIR, 'meta', 'relations.csv'), path.join(meta, 'relations.csv'));
    writeFileSync(path.join(meta, 'kinds.csv'), 'kind,label,stage,parent_kinds,required_fields,obligation,description\nproduct,Product,,,,no,Root.\ndomain,Domain,,product,,no,A domain.\n');
    const ws = await loadWorkspace(fixture('good'), { metaDir: meta });
    expect(ws.sections).toEqual([]);
    expect(ws.kinds.map((k) => k.section)).toEqual(['', '']);
    expect(problemsOf(ws, 'unknown-section')).toEqual([]);
  });
});
