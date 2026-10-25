import type { Kind, SpecLink, SpecRecord, Workspace } from '../../../lathe/src/types';
import { workspace as baseWorkspace } from './workspace';

// The component-test workspace with layers and a test proving each kind of obligation.
// DM-SHOP's Technical specification has three layers, whose order is not their ID order:
//   Models (LAY02, order 1): DM-SHOP-C02, DM-SHOP-C03 · Services (LAY03, order 2): DM-SHOP-C04 ·
//   Web app (LAY01, order 3): DM-SHOP-C05 · and DM-SHOP-C01 outside any layer.
// Its Test plan, by family and what each test proves (capabilities Browsing, order 1, and Filling the basket, order 2):
//   Acceptance tests: Browsing › Look at an item: T03 · Filling the basket: T09 (under it, proving
//     nothing) › Empty the basket: T02, T04 · Use cases outside any capability › Add an item to the basket: T01
//   Domain rule tests: T05 · Pattern tests › Saving: T06 · Interaction tests: T13 (an endpoint's) ·
//   UI tests: T07 (a view's interaction requirement), T10 (test_type ui) ·
//   Design checks: T11 (test_type design), T12 (only supports links) · Engineering checks: T08.
// DM-PAY has no layers and only an engineering check.

const extraKinds: Kind[] = [
  { kind: 'layer', label: 'Layer', stage: 'design', section: 'technical-specification', parent_kinds: ['domain'], required_fields: ['order'], obligation: false, proof_only: false, description: 'An ordered part of a domain\'s technical specification that groups its components.' },
  { kind: 'pattern', label: 'Pattern', stage: 'define', section: 'shared', parent_kinds: ['product'], required_fields: [], obligation: false, proof_only: false, description: 'Behavior several use cases share.' },
  { kind: 'pattern_rule', label: 'Pattern rule', stage: 'define', section: 'shared', parent_kinds: ['pattern'], required_fields: [], obligation: true, proof_only: false, description: 'One rule of a pattern.' },
  { kind: 'interaction_requirement', label: 'Interaction requirement', stage: 'design', section: 'interaction-design', parent_kinds: ['view', 'endpoint', 'flow'], required_fields: [], obligation: true, proof_only: false, description: 'One rule a view, endpoint or flow must follow.' },
];

function record(id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}): SpecRecord {
  const parts = id.split('-');
  const domain = parts[1] === 'PAT' ? null : parts.slice(0, 2).join('-');
  return { id, kind, title, parent, product: 'DM', domain, fields, body: '', path: `specs/dm/${id}.md`, mentions: [] };
}

const component = (id: string, title: string, parent: string) => record(id, 'component', title, parent, { component_type: 'module', file: `src/${id}.ts` });
const test = (id: string, title: string, parent = 'DM-SHOP') => record(id, 'test', title, parent, { test_type: 'unit', run_by: `test/${id}.test.ts` });

const extraRecords: SpecRecord[] = [
  record('DM-SHOP-CAP01', 'capability', 'Filling the basket', 'DM-SHOP', { order: '2' }),
  record('DM-SHOP-CAP02', 'capability', 'Browsing', 'DM-SHOP', { order: '1' }),
  record('DM-SHOP-UC02', 'use_case', 'Empty the basket', 'DM-SHOP-CAP01', { actor: 'Shopper' }),
  record('DM-SHOP-UC02-R01', 'requirement', 'An emptied basket holds nothing', 'DM-SHOP-UC02'),
  record('DM-SHOP-UC03', 'use_case', 'Look at an item', 'DM-SHOP-CAP02', { actor: 'Shopper' }),
  record('DM-SHOP-UC03-R01', 'requirement', 'The item shows its price', 'DM-SHOP-UC03'),
  record('DM-SHOP-V01-IR01', 'interaction_requirement', 'The basket page lists items newest first', 'DM-SHOP-V01'),
  record('DM-PAT-SAVE', 'pattern', 'Saving', 'DM'),
  record('DM-PAT-SAVE-R01', 'pattern_rule', 'A save says what it saved', 'DM-PAT-SAVE'),

  record('DM-SHOP-LAY01', 'layer', 'Web app', 'DM-SHOP', { order: '3' }),
  record('DM-SHOP-LAY02', 'layer', 'Models', 'DM-SHOP', { order: '1' }),
  record('DM-SHOP-LAY03', 'layer', 'Services', 'DM-SHOP', { order: '2' }),
  component('DM-SHOP-C02', 'Basket model', 'DM-SHOP-LAY02'),
  component('DM-SHOP-C03', 'Item model', 'DM-SHOP-LAY02'),
  component('DM-SHOP-C04', 'Checkout service', 'DM-SHOP-LAY03'),
  component('DM-SHOP-C05', 'Basket page component', 'DM-SHOP-LAY01'),

  test('DM-SHOP-T02', 'Emptying a basket clears it'),
  test('DM-SHOP-T03', 'An item shows its price'),
  test('DM-SHOP-T04', 'A priced item can be emptied out'),
  test('DM-SHOP-T05', 'A basket stops at 50 items'),
  test('DM-SHOP-T06', 'Saving a basket says so'),
  test('DM-SHOP-T07', 'Newest items come first'),
  test('DM-SHOP-T08', 'The basket module type-checks'),
  test('DM-SHOP-T09', 'The filling screens load', 'DM-SHOP-CAP01'),
  { ...test('DM-SHOP-T10', 'The basket page renders'), fields: { test_type: 'ui', run_by: 'test/DM-SHOP-T10.test.ts' } },
  { ...test('DM-SHOP-T11', 'The basket page is reviewed'), fields: { test_type: 'design', state: 'manual' } },
  test('DM-SHOP-T12', 'The basket limit is load-tested'),
  record('DM-SHOP-E01-IR01', 'interaction_requirement', 'Adding to a full basket answers 409', 'DM-SHOP-E01'),
  test('DM-SHOP-T13', 'A full basket answers 409'),
  test('DM-PAY-T01', 'The payment module builds', 'DM-PAY'),
];

const extraLinks: SpecLink[] = [
  // T02 proves a requirement and a domain rule: the first group that applies (acceptance) wins.
  { source: 'DM-SHOP-T02', relation: 'proves', target: 'DM-SHOP-UC02-R01' },
  { source: 'DM-SHOP-T02', relation: 'proves', target: 'DM-SHOP-DR01' },
  { source: 'DM-SHOP-T03', relation: 'proves', target: 'DM-SHOP-UC03-R01' },
  // T04 proves requirements of UC03 (Browsing) and UC02 (Filling): the first use case in ID order, UC02, places it.
  { source: 'DM-SHOP-T04', relation: 'proves', target: 'DM-SHOP-UC03-R01' },
  { source: 'DM-SHOP-T04', relation: 'proves', target: 'DM-SHOP-UC02-R01' },
  { source: 'DM-SHOP-T05', relation: 'proves', target: 'DM-SHOP-DR01' },
  { source: 'DM-SHOP-T06', relation: 'proves', target: 'DM-PAT-SAVE-R01' },
  { source: 'DM-SHOP-T06', relation: 'proves', target: 'DM-SHOP-V01-IR01' },
  { source: 'DM-SHOP-T07', relation: 'proves', target: 'DM-SHOP-V01-IR01' },
  { source: 'DM-SHOP-T08', relation: 'covers', target: 'DM-SHOP-C01' },
  { source: 'DM-SHOP-C04', relation: 'depends_on', target: 'DM-SHOP-C02' },
  { source: 'DM-SHOP-T12', relation: 'supports', target: 'DM-SHOP-DR01' },
  { source: 'DM-SHOP-T13', relation: 'proves', target: 'DM-SHOP-E01-IR01' },
];

/** The demo workspace with DM-SHOP's components in layers and its tests proving every kind. */
export function layerWorkspace(): Workspace {
  const w = baseWorkspace();
  const known = new Set(w.kinds.map((k) => k.kind));
  // Each kind goes after the kind before it in the meta-model (layer before component).
  for (const k of extraKinds.filter((x) => !known.has(x.kind))) {
    const at = k.kind === 'layer' ? w.kinds.findIndex((x) => x.kind === 'component') : w.kinds.length;
    w.kinds.splice(at < 0 ? w.kinds.length : at, 0, k);
  }
  w.records.push(...structuredClone(extraRecords));
  w.links.push(...structuredClone(extraLinks));
  if (!w.relations.some((r) => r.relation === 'supports')) {
    w.relations = [...w.relations, { relation: 'supports', source_kind: 'test', target_kind: 'domain_rule', role: '', description: 'The test backs the domain rule without proving it.', forward_label: 'Supports', reverse_label: 'Supported by' }];
  }
  return w;
}
