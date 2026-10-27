// A small product with a record of every kind, a row of every part table and a link of every relation, written as
// data files into a fresh folder, for the store's tests.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Row } from '../../src/index.ts';

export type Data = Record<string, Row[]>;

/** Every kind, part, link, declaration and checking table, with rows that load. */
export function everyKind(): Data {
  return {
    product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
    role: [{ product_id: 'TL', name: 'Member' }, { product_id: 'TL', name: 'Librarian' }],
    product_setting: [{ product_id: 'TL', max_children: 15 }],
    domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL' }],
    aggregate: [
      { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID' },
      { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND' },
    ],
    entity: [
      { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root' },
      { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child' },
    ],
    entity_field: [{ entity_id: 'TL-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The loan number.', type: 'Whole number', example: '31' }],
    domain_event: [{ id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1' }],
    event_field: [{ domain_event_id: 'TL-LEND-EV01', position: 1, name: 'Loan ID', meaning: 'Which loan.', type: 'Loan reference' }],
    domain_rule: [
      { id: 'TL-LEND-DR01', title: 'One active loan per tool', domain_id: 'TL-LEND', aggregate_id: 'TL-LEND-A1', entity_id: 'TL-LEND-EN01', statement: 'A tool MUST NOT have two active loans.' },
      { id: 'TL-LEND-DR02', title: 'Loans and tools agree', domain_id: 'TL-LEND', statement: 'A loan MUST name a tool that exists.' },
    ],
    capability: [{ id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1 }],
    use_case: [{ id: 'TL-LEND-UC01', title: 'Borrow a tool', domain_id: 'TL-LEND', capability_id: 'TL-LEND-CAP01', goal: 'Take a tool home.' }],
    use_case_actor: [{ use_case_id: 'TL-LEND-UC01', position: 1, role_name: 'Member' }],
    use_case_step: [{ use_case_id: 'TL-LEND-UC01', position: 1, description: 'The member picks a tool.' }],
    requirement: [{ id: 'TL-LEND-UC01-R01', title: 'Tool is free', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a tool on loan.', group_name: 'Validation' }],
    pattern: [{ id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL' }],
    pattern_setting: [{ pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' }],
    pattern_rule: [
      {
        id: 'TL-PAT-ACT-R01',
        title: 'A saved tool reads the same',
        pattern_id: 'TL-PAT-ACT',
        statement: 'A saved tool MUST read the same in the catalog.',
        setting: 'record',
        applies_when_setting: 'record',
        applies_when_negated: false,
        applies_when_value: 'Tool',
      },
    ],
    standard: [{ id: 'TL-STD-CODE', title: 'Code', product_id: 'TL' }],
    standard_rule: [{ id: 'TL-STD-CODE-R01', title: 'Node prefix', standard_id: 'TL-STD-CODE', statement: 'Code MUST import node: modules.' }],
    flow: [{ id: 'TL-LEND-F01', title: 'Borrow and return', domain_id: 'TL-LEND', capability_id: 'TL-LEND-CAP01' }],
    flow_step: [{ id: 'TL-LEND-F01-S01', title: 'Pick a tool', flow_id: 'TL-LEND-F01', path: 'main', position: 1 }],
    view: [{ id: 'TL-LEND-V01', title: 'Catalog', domain_id: 'TL-LEND', route: '/catalog' }],
    api: [{ id: 'TL-LEND-API01', title: 'Loans', domain_id: 'TL-LEND' }],
    api_shape: [{ api_id: 'TL-LEND-API01', position: 1, name: 'Loan', meaning: 'One loan.', fields: 'id, toolId' }],
    endpoint: [{ id: 'TL-LEND-E01', title: 'Borrow a tool', domain_id: 'TL-LEND', api_id: 'TL-LEND-API01', method: 'POST', route: '/loans' }],
    integration: [{ id: 'TL-LEND-INT01', title: 'Mail', domain_id: 'TL-LEND', system: 'Mail service' }],
    interaction_requirement: [{ id: 'TL-LEND-E01-R01', title: 'Unknown tool', domain_id: 'TL-LEND', endpoint_id: 'TL-LEND-E01', statement: 'An unknown tool MUST give 404.' }],
    // The sub-layer's ID sorts before its parent's, so loading must put parents first.
    layer: [
      { id: 'TL-LEND-LAY01', title: 'Services', domain_id: 'TL-LEND', parent_layer_id: 'TL-LEND-LAY02', position: 1 },
      { id: 'TL-LEND-LAY02', title: 'Server', domain_id: 'TL-LEND', position: 1 },
    ],
    component: [
      { id: 'TL-LEND-C01', title: 'lending-service.ts', domain_id: 'TL-LEND', layer_id: 'TL-LEND-LAY01', component_type: 'service', file: 'src/lending-service.ts' },
      { id: 'TL-LEND-C02', title: 'store.ts', domain_id: 'TL-LEND', component_type: 'store', file: 'src/store.ts' },
    ],
    design_flow: [{ id: 'TL-LEND-DF01', title: 'Borrow', domain_id: 'TL-LEND', layer_id: 'TL-LEND-LAY02' }],
    design_step: [{ id: 'TL-LEND-DF01-S01', title: 'Check and save', design_flow_id: 'TL-LEND-DF01', path: 'main', position: 1, transaction_name: 'borrow', statements: 'one INSERT' }],
    test: [{ id: 'TL-LEND-T01', title: 'A tool on loan is refused', domain_id: 'TL-LEND', capability_id: 'TL-LEND-CAP01', test_type: 'acceptance', state: 'automated', file: 'test/api.test.ts', given: 'A tool on loan', when: 'A member borrows it', then: 'It is refused' }],
    question: [{ id: 'TL-LEND-Q01', title: 'How long is a loan?', product_id: 'TL', domain_id: 'TL-LEND', owner: 'Librarian' }],
    relates_to: [{ source_id: 'TL-LEND-A1', target_id: 'TL-LEND-A2' }],
    applies: [{ source_id: 'TL-LEND-UC01', target_id: 'TL-LEND-DR01' }],
    follows: [{ source_id: 'TL-LEND-UC01', target_id: 'TL-PAT-ACT' }],
    setting_value: [{ follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting: 'record', value: 'Tool' }],
    fulfills: [{ source_id: 'TL-LEND-F01', target_id: 'TL-LEND-UC01-R01' }],
    uses: [{ source_id: 'TL-LEND-F01', target_id: 'TL-LEND-V01' }],
    satisfies: [{ source_id: 'TL-LEND-C01', target_id: 'TL-LEND-UC01-R01' }],
    implements: [{ source_id: 'TL-LEND-C01', target_id: 'TL-LEND-E01' }],
    depends_on: [{ source_id: 'TL-LEND-C01', target_id: 'TL-LEND-C02' }],
    proves: [
      { source_id: 'TL-LEND-T01', target_id: 'TL-LEND-INV01' },
      { source_id: 'TL-LEND-T01', target_id: 'TL-LEND-UC01-R01' },
    ],
    supports: [{ source_id: 'TL-LEND-T01', target_id: 'TL-LEND-DR01' }],
    about: [{ source_id: 'TL-LEND-Q01', target_id: 'TL-LEND-UC01' }],
    carries_out: [{ source_id: 'TL-LEND-F01', target_id: 'TL-LEND-UC01' }],
    runs: [{ source_id: 'TL-LEND-T01', target_id: 'TL-LEND-F01' }],
    covers: [{ source_id: 'TL-LEND-T01', target_id: 'TL-LEND-C01' }],
    has_one: [{ source_id: 'TL-LEND-EN01', target_id: 'TL-LEND-EN02' }],
    has_many: [{ source_id: 'TL-LEND-EN01', target_id: 'TL-LEND-EN02' }],
    refers_to: [{ source_id: 'TL-LEND-EN02', target_id: 'TL-LEND-EN01' }],
    raised_by: [{ source_id: 'TL-LEND-EV01', target_id: 'TL-LEND-EN01' }],
    reacts_to: [{ source_id: 'TL-LEND-A2', target_id: 'TL-LEND-EV01' }],
    involves: [{ source_id: 'TL-LEND-DR02', target_id: 'TL-LEND-A1' }],
    deepens: [{ source_id: 'TL-LEND-DF01', target_id: 'TL-LEND-F01' }],
    meets: [{ source_id: 'TL-LEND-C01', target_id: 'TL-STD-CODE-R01' }],
    // A product's own kind, an obligation under the aggregate, with a relation of its own and a pair added to proves.
    product_kind: [{ name: 'invariant', product_id: 'TL', label: 'Invariant', description: 'A product-specific obligation.', parent_kind: 'aggregate', stage: 'define', section: 'domain-model', obligation: 'full' }],
    product_kind_field: [{ kind: 'invariant', position: 1, name: 'strength', type: 'text', required: true, description: 'How strictly it holds.' }],
    product_relation: [
      { name: 'enforces', source_kind: 'component', target_kind: 'invariant', product_id: 'TL', role: 'design', forward_label: 'Enforces', reverse_label: 'Enforced by', description: 'The component enforces the invariant.' },
      { name: 'proves', source_kind: 'test', target_kind: 'invariant', product_id: 'TL', role: 'proof', forward_label: 'Proves', reverse_label: 'Proved by', description: 'The test proves the invariant.' },
    ],
    invariant: [{ id: 'TL-LEND-INV01', title: 'Loans are numbered', aggregate_id: 'TL-LEND-A1', strength: 'always' }],
    enforces: [{ source_id: 'TL-LEND-C01', target_id: 'TL-LEND-INV01' }],
    check: [{ name: 'duplicate-id', position: 1, severity: 'error', summary: 'An ID names one record.', explanation: 'Give each record its own ID.', query: 'SELECT 1 WHERE false', kinds: ['product'] }],
  };
}

const roots: string[] = [];

/** Removes every folder writeData made. */
export function removeData(): void {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** A fresh folder (a product repo root) holding the data as data/<table>.jsonl files, one JSON object per line. */
export function writeData(data: Data): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-store-'));
  roots.push(root);
  mkdirSync(path.join(root, 'data'));
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length) writeFileSync(path.join(root, 'data', `${table}.jsonl`), rows.map((r) => `${JSON.stringify(r)}\n`).join(''));
  }
  return root;
}

/** A deep copy of the data with one table's rows changed. */
export function withTable(data: Data, table: string, rows: Row[]): Data {
  return { ...structuredClone(data), [table]: rows };
}
