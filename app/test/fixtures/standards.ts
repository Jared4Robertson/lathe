import type { Kind, RelationRule, SpecRecord, Workspace } from '../../../lathe/src/types';
import { patternWorkspace } from './patterns';

// The pattern workspace with a standard beside the pattern, as FORMAT.md section 20 has it: DM-STD-CODE
// in Shared with two rules. R01 is met by the component DM-SHOP-C01 and the test DM-SHOP-T01; R02 is met
// by nothing, so it has the standard-rule-unmet warning.

const standardKinds: Kind[] = [
  { kind: 'standard', label: 'Standard', stage: 'design', section: 'shared', parent_kinds: ['product'], required_fields: [], obligation: false, proof_only: false, description: "A library of engineering rules that holds for the product's code." },
  { kind: 'standard_rule', label: 'Standard rule', stage: 'design', section: 'shared', parent_kinds: ['standard'], required_fields: [], obligation: false, proof_only: false, description: 'One rule of a standard.' },
];

const standardRelations: RelationRule[] = [
  { relation: 'meets', source_kind: 'component', target_kind: 'standard_rule', role: '', description: 'The component follows the standard rule.', forward_label: 'Meets', reverse_label: 'Met by' },
  { relation: 'meets', source_kind: 'test', target_kind: 'standard_rule', role: '', description: 'The test follows the standard rule.', forward_label: 'Meets', reverse_label: 'Met by' },
];

const record = (id: string, kind: string, title: string, parent: string, body: string): SpecRecord =>
  ({ id, kind, title, parent, product: 'DM', domain: null, fields: {}, body, path: `specs/dm/${id}.md`, mentions: [] });

export function standardWorkspace(): Workspace {
  const ws = patternWorkspace();
  // In the meta-model's order: the standards right after the patterns.
  const at = ws.kinds.findIndex((k) => k.kind === 'pattern_rule') + 1;
  ws.kinds = [...ws.kinds.slice(0, at), ...standardKinds, ...ws.kinds.slice(at)];
  ws.relations = [...ws.relations, ...standardRelations];
  ws.records.push(
    record('DM-STD-CODE', 'standard', 'Shop code', 'DM', 'How the shop\'s code is written.'),
    record('DM-STD-CODE-R01', 'standard_rule', 'Errors carry a code', 'DM-STD-CODE', 'An error MUST carry a code.'),
    record('DM-STD-CODE-R02', 'standard_rule', 'Amounts are in cents', 'DM-STD-CODE', 'An amount MUST be held in cents.'),
  );
  ws.links.push(
    { source: 'DM-SHOP-C01', relation: 'meets', target: 'DM-STD-CODE-R01' },
    { source: 'DM-SHOP-T01', relation: 'meets', target: 'DM-STD-CODE-R01' },
  );
  ws.problems.push({ severity: 'warning', check: 'standard-rule-unmet', record: 'DM-STD-CODE-R02', message: 'Nothing meets or cites standard rule DM-STD-CODE-R02 (Amounts are in cents).' });
  return ws;
}
