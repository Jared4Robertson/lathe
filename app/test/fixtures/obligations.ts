import type { Coverage, Kind, ObligationCoverage, SpecRecord, Workspace } from '../../../lathe/src/types';
import { workspace as baseWorkspace } from './workspace';

// The component-test workspace as the pass-4 engine reports it: every kind says whether it is an
// obligation, coverage has one row per obligation kind, and DM-SHOP adds:
// - interaction requirements at its view and endpoint (one fulfilling nothing yet),
// - a product's own obligation kind, `security_control`, at the endpoint,
// - a manual test and a planned test.

const OBLIGATIONS = ['domain_rule', 'requirement', 'interaction_requirement', 'security_control'];

const extraKinds: Kind[] = [
  { kind: 'interaction_requirement', label: 'Interaction requirement', stage: 'design', parent_kinds: ['view', 'endpoint', 'flow'], required_fields: [], obligation: true, description: 'One rule a view, endpoint or flow must follow.' },
  { kind: 'security_control', label: 'Security control', stage: 'design', parent_kinds: ['endpoint'], required_fields: [], obligation: true, description: 'A product kind: a control an endpoint must enforce.' },
];

function record(id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}, body = ''): SpecRecord {
  return { id, kind, title, parent, product: 'DM', domain: 'DM-SHOP', fields, body, path: `specs/dm/${id}.md` };
}

const records: SpecRecord[] = [
  record('DM-SHOP-V01-R01', 'interaction_requirement', 'The basket page lists at most 50 lines', 'DM-SHOP-V01', {}, 'The basket page MUST NOT list more than 50 lines.'),
  record('DM-SHOP-E01-R01', 'interaction_requirement', 'Adding to a full basket answers 409', 'DM-SHOP-E01', {}, 'The endpoint MUST answer 409 when the basket is full.'),
  record('DM-SHOP-E01-R02', 'interaction_requirement', 'An unknown item answers 404', 'DM-SHOP-E01', {}, 'The endpoint MUST answer 404 for an unknown item.'),
  record('DM-SHOP-E01-S01', 'security_control', 'Only the basket owner adds items', 'DM-SHOP-E01'),
  record('DM-SHOP-T02', 'test', 'A person fills a basket to 50', 'DM-SHOP', { test_type: 'acceptance', state: 'manual' }, 'Add 50 items, then try one more.'),
  record('DM-SHOP-T03', 'test', 'A full basket answers 409', 'DM-SHOP', { test_type: 'api', state: 'planned' }),
];

const obligation = (kind: string, label: string, total: number, designed: number, built: number, proved: number, planned: number): ObligationCoverage =>
  ({ kind, label, total, designed, built, proved, planned });

const coverage: Record<string, ObligationCoverage[]> = {
  'DM-SHOP': [
    obligation('domain_rule', 'Domain rule', 1, 1, 1, 1, 0),
    obligation('requirement', 'Requirement', 2, 2, 1, 1, 0),
    obligation('interaction_requirement', 'Interaction requirement', 3, 1, 1, 0, 1),
    obligation('security_control', 'Security control', 1, 0, 0, 0, 0),
  ],
  'DM-PAY': [
    obligation('domain_rule', 'Domain rule', 0, 0, 0, 0, 0),
    obligation('requirement', 'Requirement', 1, 0, 0, 0, 0),
    obligation('interaction_requirement', 'Interaction requirement', 0, 0, 0, 0, 0),
    obligation('security_control', 'Security control', 0, 0, 0, 0, 0),
  ],
};

export function obligationWorkspace(): Workspace {
  const ws = baseWorkspace();
  ws.kinds = [...ws.kinds.map((k) => ({ ...k, obligation: OBLIGATIONS.includes(k.kind) })), ...extraKinds];
  ws.records.push(...structuredClone(records));
  ws.links.push(
    { source: 'DM-SHOP-V01-R01', relation: 'fulfills', target: 'DM-SHOP-DR01' },
    { source: 'DM-SHOP-E01-R01', relation: 'fulfills', target: 'DM-SHOP-UC01-R02' },
    { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-SHOP-E01-R01' },
    { source: 'DM-SHOP-T02', relation: 'proves', target: 'DM-SHOP-DR01' },
    { source: 'DM-SHOP-T03', relation: 'proves', target: 'DM-SHOP-E01-R01' },
  );
  ws.coverage = ws.coverage.map((c): Coverage => ({ ...c, obligations: coverage[c.domain] ?? [] }));
  const shop = ws.coverage.find((c) => c.domain === 'DM-SHOP')!;
  shop.rules_proved = 1;
  shop.gaps = [
    { id: 'DM-SHOP-UC01-R02', kind: 'requirement', missing: 'proves' },
    { id: 'DM-SHOP-V01-R01', kind: 'interaction_requirement', missing: 'satisfies' },
    { id: 'DM-SHOP-V01-R01', kind: 'interaction_requirement', missing: 'proves' },
    { id: 'DM-SHOP-E01-R01', kind: 'interaction_requirement', missing: 'proves' },
    { id: 'DM-SHOP-E01-R02', kind: 'interaction_requirement', missing: 'satisfies' },
    { id: 'DM-SHOP-E01-R02', kind: 'interaction_requirement', missing: 'proves' },
    { id: 'DM-SHOP-E01-S01', kind: 'security_control', missing: 'satisfies' },
    { id: 'DM-SHOP-E01-S01', kind: 'security_control', missing: 'proves' },
  ];
  return ws;
}
