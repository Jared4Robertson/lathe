import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Coverage, Problem, SpecLink, SpecRecord, Workspace } from '../../../lathe/src/types';
import { indexWorkspace } from '../../src/specs/data';

// A small in-memory workspace for the graph tests, using the real kinds and relations.

const sample: Workspace = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../../lathe/fixtures/workspace.sample.json'), 'utf8'));

type Spec = [id: string, kind: string, title: string, parent: string | null, fields?: Record<string, string>, body?: string];

const SPECS: Spec[] = [
  ['P', 'product', 'Product', null],
  ['P-D', 'domain', 'Domain', 'P'],
  ['P-D-A1', 'aggregate', 'Thing', 'P-D'],
  ['P-D-DR01', 'domain_rule', 'A thing has one owner', 'P-D-A1', {}, 'A thing MUST have exactly one owner.\n\nMore detail here.'],
  ['P-D-DR02', 'domain_rule', 'A thing is never deleted', 'P-D-A1', {}, 'A thing MUST NOT be **deleted**, only archived.'],
  ['P-D-UC01', 'use_case', 'Lend a thing', 'P-D', { actor: 'Member' }],
  ['P-D-UC01-R01', 'requirement', 'The owner is shown', 'P-D-UC01', {}, 'The page MUST show the owner.'],
  ['P-D-V01', 'view', 'Thing page', 'P-D', { route: '/things/<id>' }],
  ['P-D-E01', 'endpoint', 'Get a thing', 'P-D', { method: 'GET', route: '/api/things/:id' }],
  ['P-D-C01', 'component', 'Thing service', 'P-D', { component_type: 'service', file: 'src/thing.ts' }],
  ['P-D-C02', 'component', 'Thing router', 'P-D', { component_type: 'router', file: 'src/router.ts' }],
  ['P-D-T01', 'test', 'The owner is shown', 'P-D', { test_type: 'unit', run_by: 'test/thing.test.ts' }],
  ['P-D-Q01', 'question', 'Can a thing have two owners?', 'P-D', { owner: 'Jared' }],
];

export const LINKS: [string, string, string][] = [
  ['P-D-UC01', 'applies', 'P-D-DR01'],
  ['P-D-V01', 'fulfills', 'P-D-UC01-R01'],
  ['P-D-V01', 'uses', 'P-D-E01'],
  ['P-D-C01', 'satisfies', 'P-D-UC01-R01'],
  ['P-D-C01', 'satisfies', 'P-D-DR01'],
  ['P-D-C01', 'implements', 'P-D-V01'],
  ['P-D-C02', 'implements', 'P-D-E01'],
  ['P-D-C02', 'depends_on', 'P-D-C01'],
  ['P-D-T01', 'proves', 'P-D-UC01-R01'],
  ['P-D-Q01', 'about', 'P-D-A1'],
];

export const PROBLEMS: Problem[] = [
  { severity: 'error', check: 'run-by-mentions-id', record: 'P-D-T01', message: 'test/thing.test.ts does not mention P-D-T01' },
  { severity: 'warning', check: 'rule-not-proved', record: 'P-D-DR01', message: 'No test proves P-D-DR01' },
  { severity: 'warning', check: 'rule-not-satisfied', record: 'P-D-DR02', message: 'No component satisfies P-D-DR02' },
  { severity: 'warning', check: 'rule-not-proved', record: 'P-D-DR02', message: 'No test proves P-D-DR02' },
];

const COVERAGE: Coverage[] = [{
  domain: 'P-D',
  requirements: 1, requirements_satisfied: 1, requirements_built: 1, requirements_proved: 1,
  rules: 2, rules_satisfied: 1, rules_built: 1, rules_proved: 0, obligations: [],
  gaps: [
    { id: 'P-D-DR01', kind: 'domain_rule', missing: 'proves' },
    { id: 'P-D-DR02', kind: 'domain_rule', missing: 'satisfies' },
    { id: 'P-D-DR02', kind: 'domain_rule', missing: 'proves' },
  ],
}];

export function testWorkspace(): Workspace {
  const records: SpecRecord[] = SPECS.map(([id, kind, title, parent, fields = {}, body = '']) => ({
    id, kind, title, parent, fields, body,
    product: 'P',
    domain: kind === 'product' ? null : 'P-D',
    path: `specs/${id}.md`,
    mentions: [],
  }));
  const links: SpecLink[] = LINKS.map(([source, relation, target]) => ({ source, relation, target }));
  return { kinds: sample.kinds, relations: sample.relations, records, links, problems: PROBLEMS, coverage: COVERAGE };
}

export const testIndex = () => indexWorkspace(testWorkspace());

/** The test workspace with a second use case that has six requirements: more than a handful of one kind. */
export function groupedWorkspace(): Workspace {
  const w = testWorkspace();
  const base = w.records.find((r) => r.id === 'P-D-UC01')!;
  w.records.push({ ...base, id: 'P-D-UC02', title: 'Return a thing', path: 'specs/P-D-UC02.md' });
  const req = w.records.find((r) => r.id === 'P-D-UC01-R01')!;
  for (let i = 1; i <= 6; i++) {
    w.records.push({ ...req, id: `P-D-UC02-R0${i}`, title: `Return rule ${i}`, parent: 'P-D-UC02', path: `specs/P-D-UC02-R0${i}.md` });
  }
  return w;
}
