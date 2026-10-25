import type { Kind, ObligationCoverage, RelationRule, SpecRecord, Workspace } from '../../../lathe/src/types';
import { workspace as baseWorkspace } from './workspace';

// The component-test workspace with the pass-5 model: a pattern, DM-PAT-CHECKOUT, with two rules,
// followed by a use case in each of DM's domains, and records that cite other records in prose.
// - DM-SHOP follows it and marks `audit` Not applicable, so R02 (which names `audit`) does not
//   apply there; R01 is designed, built and proved there.
// - DM-PAY follows it with a real `audit`, so it owes both rules: R01 is designed by a component
//   whose file is missing (so not built) and only a planned test proves it; R02 is open.
// - Prose: DM-SHOP-UC01 cites a domain rule, the pattern, an ID in code and an unknown ID;
//   DM-PAY-UC01 cites DM-SHOP-UC01 next to a requirement ID it does not mention.

const patternKinds: Kind[] = [
  { kind: 'capability', label: 'Capability', stage: 'define', section: 'use-cases', parent_kinds: ['domain'], required_fields: ['order'], obligation: false, proof_only: false, description: 'An ordered slice of a domain.' },
  { kind: 'pattern', label: 'Pattern', stage: 'define', section: 'shared', parent_kinds: ['product'], required_fields: ['settings'], obligation: false, proof_only: false, description: 'Behavior several use cases share.' },
  { kind: 'pattern_rule', label: 'Pattern rule', stage: 'define', section: 'shared', parent_kinds: ['pattern'], required_fields: [], obligation: true, proof_only: false, description: 'One rule of a pattern.' },
];

const patternRelations: RelationRule[] = [
  { relation: 'follows', source_kind: 'use_case', target_kind: 'pattern', role: '', description: 'The use case follows the pattern.' },
  { relation: 'satisfies', source_kind: 'component', target_kind: 'pattern_rule', role: 'design', description: 'The component designs the pattern rule.' },
  { relation: 'proves', source_kind: 'test', target_kind: 'pattern_rule', role: 'proof', description: 'The test proves the pattern rule.' },
];

function record(id: string, kind: string, title: string, parent: string, fields: Record<string, string> = {}, body = '', mentions: string[] = []): SpecRecord {
  const parts = id.split('-');
  const domain = parts[1] === 'PAT' ? null : parts.slice(0, 2).join('-');
  return { id, kind, title, parent, product: 'DM', domain, fields, body, path: `specs/dm/${id}.md`, mentions };
}

const extraRecords: SpecRecord[] = [
  record('DM-PAT-CHECKOUT', 'pattern', 'Checkout step', 'DM', { settings: 'record audit' }, 'A shopper confirms one step, and the shop shows what it saved.'),
  record('DM-PAT-CHECKOUT-R01', 'pattern_rule', 'The step shows what it saved', 'DM-PAT-CHECKOUT', {}, 'The step MUST show the saved record.'),
  record('DM-PAT-CHECKOUT-R02', 'pattern_rule', 'The step writes an audit line', 'DM-PAT-CHECKOUT', { setting: 'audit' }, 'The step MUST write the audit line its `audit` setting names.'),
  record('DM-PAY-C01', 'component', 'Payment form', 'DM-PAY', { component_type: 'view', file: 'src/pay.tsx' }),
  record('DM-PAY-T01', 'test', 'Paying shows the receipt', 'DM-PAY', { test_type: 'acceptance', state: 'planned' }),
];

const followFields: Record<string, Record<string, string>> = {
  'DM-SHOP-UC01': { record: 'Basket', audit: 'Not applicable: adding to a basket changes nothing worth auditing' },
  'DM-PAY-UC01': { record: 'Payment', audit: 'The payments log' },
};

const bodies: Record<string, { body: string; mentions: string[] }> = {
  'DM-SHOP-UC01': {
    body: 'A shopper adds an item, as DM-PAT-CHECKOUT says, within DM-SHOP-DR01. The code calls `DM-SHOP-DR01` by name. It once cited DM-SHOP-DR99.',
    mentions: ['DM-PAT-CHECKOUT', 'DM-SHOP-DR01'],
  },
  'DM-PAY-UC01': {
    body: 'A shopper pays for the basket filled in DM-SHOP-UC01 (whose rule DM-SHOP-UC01-R01 is not cited here).',
    mentions: ['DM-SHOP-UC01'],
  },
};

const patternRuleLine = (total: number, designed: number, built: number, proved: number, planned: number): ObligationCoverage =>
  ({ kind: 'pattern_rule', label: 'Pattern rule', total, designed, built, proved, planned }) as ObligationCoverage; // no planned_any: as an older engine reports it

export function patternWorkspace(): Workspace {
  const ws = baseWorkspace();
  ws.kinds = [...ws.kinds, ...patternKinds.filter((k) => !ws.kinds.some((x) => x.kind === k.kind))];
  ws.relations = [...ws.relations, ...patternRelations];
  ws.records = ws.records.map((r) => ({ ...r, fields: { ...r.fields, ...followFields[r.id] }, ...bodies[r.id] }));
  ws.records.push(...structuredClone(extraRecords));
  ws.links.push(
    { source: 'DM-SHOP-UC01', relation: 'follows', target: 'DM-PAT-CHECKOUT' },
    { source: 'DM-PAY-UC01', relation: 'follows', target: 'DM-PAT-CHECKOUT' },
    { source: 'DM-SHOP-C01', relation: 'satisfies', target: 'DM-PAT-CHECKOUT-R01' },
    { source: 'DM-SHOP-T01', relation: 'proves', target: 'DM-PAT-CHECKOUT-R01' },
    { source: 'DM-PAY-C01', relation: 'satisfies', target: 'DM-PAT-CHECKOUT-R01' },
    { source: 'DM-PAY-T01', relation: 'proves', target: 'DM-PAT-CHECKOUT-R01' },
  );
  ws.problems.push(
    { severity: 'warning', check: 'unknown-id-in-prose', record: 'DM-SHOP-UC01', message: 'DM-SHOP-UC01 mentions DM-SHOP-DR99, which does not exist.' },
    { severity: 'warning', check: 'component-file-missing', record: 'DM-PAY-C01', message: 'Component DM-PAY-C01 names src/pay.tsx, which does not exist.' },
    { severity: 'warning', check: 'unproved', record: 'DM-PAT-CHECKOUT-R01', message: 'DM-PAT-CHECKOUT-R01 is not proved in DM-PAY.' },
    { severity: 'warning', check: 'unsatisfied', record: 'DM-PAT-CHECKOUT-R02', message: 'DM-PAT-CHECKOUT-R02 is not satisfied in DM-PAY.' },
  );
  const legacy = (c: Workspace['coverage'][number]): ObligationCoverage[] => [
    { kind: 'domain_rule', label: 'Domain rule', total: c.rules, designed: c.rules_satisfied, built: c.rules_built ?? 0, proved: c.rules_proved, planned: 0 } as ObligationCoverage,
    { kind: 'requirement', label: 'Use-case requirement', total: c.requirements, designed: c.requirements_satisfied, built: c.requirements_built ?? 0, proved: c.requirements_proved, planned: 0 } as ObligationCoverage,
  ];
  for (const c of ws.coverage) {
    if (c.domain === 'DM-SHOP') c.obligations = [...legacy(c), patternRuleLine(1, 1, 1, 1, 0)];
    if (c.domain === 'DM-PAY') {
      c.obligations = [...legacy(c), patternRuleLine(2, 1, 0, 0, 1)];
      c.gaps.push(
        { id: 'DM-PAT-CHECKOUT-R01', kind: 'pattern_rule', missing: 'proves' },
        { id: 'DM-PAT-CHECKOUT-R02', kind: 'pattern_rule', missing: 'satisfies' },
        { id: 'DM-PAT-CHECKOUT-R02', kind: 'pattern_rule', missing: 'proves' },
      );
    }
  }
  return ws;
}
