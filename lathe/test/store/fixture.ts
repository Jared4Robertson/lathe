// A small product with a record of every kind, a row of every part table and a link of every relation, written as
// data files into a fresh folder, for the store's tests.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SCHEMA_VERSION, type Row } from '../../src/index.ts';

export type Data = Record<string, Row[]>;

const automated = (file: string) => ({ level: 'unit', state: 'automated', file });

/** Every kind, part, link, declaration and checking table, with rows that load. */
export function everyKind(): Data {
  return {
    product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }],
    role: [{ product_id: 'TL', name: 'Member', description: 'Someone who borrows tools.' }, { product_id: 'TL', name: 'Librarian', description: 'Someone who lends and repairs tools at the desk.' }],
    product_setting: [{ product_id: 'TL', max_children: 15, max_entities_per_aggregate: 7, technology_words: [] }],

    // Domain model.
    domain: [{ id: 'TL-LEND', title: 'Lending', product_id: 'TL', position: 1, subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
    aggregate: [
      { id: 'TL-LEND-A1', title: 'Loan', domain_id: 'TL-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' },
      { id: 'TL-LEND-A2', title: 'Tool', domain_id: 'TL-LEND', identity: 'Tool ID', description: 'A tool the library holds.' },
    ],
    entity: [
      { id: 'TL-LEND-EN01', title: 'Loan', aggregate_id: 'TL-LEND-A1', role: 'root', description: 'The loan itself.' },
      { id: 'TL-LEND-EN02', title: 'Return', aggregate_id: 'TL-LEND-A1', role: 'child', in_root_table: true, description: 'The tool coming back.' },
    ],
    entity_field: [
      { entity_id: 'TL-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The loan number.', type: 'whole number', required: true, column_name: 'id', example: '31' },
      { entity_id: 'TL-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'TL-VO01', required: true },
      { entity_id: 'TL-LEND-EN01', position: 3, name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'TL-LEND-A2', required: true, column_name: 'tool_id' },
    ],
    value_object: [{ id: 'TL-VO01', title: 'Email address', description: 'Where a member gets mail.' }],
    value_object_field: [{ value_object_id: 'TL-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }],
    constraint: [{ id: 'TL-VO01-C01', title: 'One at sign', value_object_id: 'TL-VO01', statement: 'An email address MUST hold exactly one @.' }],
    invariant: [{ id: 'TL-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'TL-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }],
    specification: [{ id: 'TL-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }],
    domain_event: [{ id: 'TL-LEND-EV01', title: 'Loan opened', aggregate_id: 'TL-LEND-A1', published: true, description: 'A tool went out on loan.' }],
    event_field: [{ domain_event_id: 'TL-LEND-EV01', position: 1, name: 'Loan ID', meaning: 'Which loan.', type_aggregate_id: 'TL-LEND-A1', required: true }],
    command: [{ id: 'TL-LEND-CMD01', title: 'Open a loan', entity_id: 'TL-LEND-EN01', description: 'Lends a free tool to a member.' }],
    read_model: [{ id: 'TL-LEND-RM01', title: 'Loans by member', domain_id: 'TL-LEND', description: 'Each member with their loans.' }],
    read_model_field: [{ read_model_id: 'TL-LEND-RM01', position: 1, name: 'Days overdue', meaning: 'How late the loan is.', type: 'whole number', required: false }],
    query: [{ id: 'TL-LEND-QRY01', title: 'List free tools', read_model_id: 'TL-LEND-RM01', description: 'The tools no active loan names.' }],
    policy: [{ id: 'TL-LEND-PO01', title: 'Remind on loan', command_id: 'TL-LEND-CMD01', statement: 'Whenever a loan is opened, the library MUST open its reminder.' }],
    domain_service: [{ id: 'TL-LEND-DS01', title: 'Late fee', domain_id: 'TL-LEND', statement: 'The fee MUST be a day rate times the days late.' }],
    storage_requirement: [{ id: 'TL-LEND-A1-SR01', title: 'A loan is saved with its event', aggregate_id: 'TL-LEND-A1', statement: 'A loan MUST be saved with its outbox event, or neither.' }],
    term: [
      { id: 'TL-LEND-TM01', title: 'Loan', domain_id: 'TL-LEND', meaning: 'One tool lent to one member until it is returned.' },
      { id: 'TL-LEND-TM02', title: 'Overdue loan', domain_id: 'TL-LEND', meaning: 'A loan past its due date.' },
    ],
    builds_on: [{ source_id: 'TL-LEND-TM02', target_id: 'TL-LEND-TM01' }],

    // Use cases.
    business_outcome: [{ id: 'TL-BO01', title: 'More tools in use', product_id: 'TL', statement: 'Members borrow more of the tools the library holds.', measure: 'Loans opened per tool per month.', target: 'Two loans per tool per month within a year.' }],
    journey: [{ id: 'TL-JR01', title: 'Borrow a tool and bring it back', product_id: 'TL', trigger: 'A member wants a tool.', result: 'The tool is back on the shelf.' }],
    journey_step: [{ id: 'TL-JR01-S01', title: 'The library reminds the borrower', journey_id: 'TL-JR01', path: 'main', position: 1 }],
    capability: [{ id: 'TL-LEND-CAP01', title: 'Lending', domain_id: 'TL-LEND', position: 1, description: 'Lending tools and taking them back.' }],
    use_case: [{ id: 'TL-LEND-UC01', title: 'Borrow a tool', capability_id: 'TL-LEND-CAP01', goal: 'Take a tool home.' }],
    use_case_actor: [{ use_case_id: 'TL-LEND-UC01', position: 1, role_name: 'Member' }],
    uc_requirement: [{ id: 'TL-LEND-UC01-R01', title: 'Tool is free', use_case_id: 'TL-LEND-UC01', statement: 'The library MUST refuse a tool on loan.', group_name: 'Validation' }],
    pattern: [{ id: 'TL-PAT-ACT', title: 'Librarian action', product_id: 'TL', description: 'An action the librarian takes at the desk.' }],
    pattern_setting: [{ pattern_id: 'TL-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' }],
    pattern_rule: [
      {
        id: 'TL-PAT-ACT-R01',
        title: 'A saved tool reads the same',
        pattern_id: 'TL-PAT-ACT',
        statement: 'A saved tool MUST read the same in the catalog.',
      },
    ],
    slot: [{ id: 'TL-PAT-ACT-SL01', title: 'Saving rule', pattern_id: 'TL-PAT-ACT', statement: 'A fill MUST refuse what its record does not allow before anything is saved.' }],

    // Interface design.
    interface: [{ id: 'TL-IF01', title: 'Web app', product_id: 'TL', kind: 'web app', description: 'The desk app the librarian uses.', public: false }],
    interface_actor: [{ interface_id: 'TL-IF01', position: 1, role_name: 'Member' }],
    flow: [{ id: 'TL-LEND-UC01-FL', title: 'Borrow a tool', use_case_id: 'TL-LEND-UC01' }],
    flow_step: [{ id: 'TL-LEND-UC01-FL-S01', title: 'Pick a tool', flow_id: 'TL-LEND-UC01-FL', path: 'main', position: 1, interface_id: 'TL-IF01' }],
    view: [{ id: 'TL-V01', title: 'Catalog', route: '/catalog', description: 'Every tool, with whether it is free.' }],
    view_requirement: [{ id: 'TL-V01-R01', title: 'Free tools first', view_id: 'TL-V01', statement: 'The catalog MUST list free tools first.' }],
    endpoint: [{ id: 'TL-LEND-EP01', title: 'POST /loans', command_id: 'TL-LEND-CMD01', method: 'POST', route: '/loans', description: 'Takes a member and a tool; answers 201 with the loan.' }],
    api_requirement: [{ id: 'TL-LEND-EP01-R01', title: 'Unknown tool', endpoint_id: 'TL-LEND-EP01', statement: 'An unknown tool MUST give 404.' }],
    integration: [{ id: 'TL-INT01', title: 'Mail', system: 'Mail service', description: 'Reminders sent to members.' }],

    // Technical specification.
    repository: [{ id: 'TL-LEND-REPO01', title: 'LoanRepository', domain_id: 'TL-LEND', file: 'src/lending/loans.ts', description: 'Keeps loans in the loans table.' }],
    persists: [{ source_id: 'TL-LEND-REPO01', target_id: 'TL-LEND-A1' }],
    data_store: [{ id: 'TL-STORE01', title: 'DATABASE_URL', product_id: 'TL', kind: 'database', description: "The library's database, run by the service that also sends its mail." }],
    provided_by: [{ source_id: 'TL-STORE01', target_id: 'TL-INT01' }],
    generates: [{ source_id: 'TL-LEND-TOOL01', target_id: 'TL-LEND-EN01-DM' }],
    fills: [{ source_id: 'TL-LEND-CMD01-H', target_id: 'TL-PAT-ACT-SL01' }],
    stored_in: [{ source_id: 'TL-LEND-REPO01', target_id: 'TL-STORE01' }],
    data_model: [{ id: 'TL-LEND-EN01-DM', title: 'Loan', entity_id: 'TL-LEND-EN01', file: 'src/lending/loan.ts' }],
    table: [
      { id: 'TL-LEND-EN01-TB', title: 'loans', entity_id: 'TL-LEND-EN01', name: 'loans', storage: 'table', file: 'migrations/001.sql' },
      { id: 'TL-LEND-RM01-TB', title: 'loans_by_member', read_model_id: 'TL-LEND-RM01', name: 'loans_by_member', storage: 'view' },
      { id: 'TL-LEND-TB01', title: 'outbox', domain_id: 'TL-LEND', name: 'outbox', storage: 'table' },
    ],
    table_key: [
      { table_id: 'TL-LEND-EN01-TB', position: 1, type: 'primary', columns: ['id'] },
      { table_id: 'TL-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], invariant_id: 'TL-LEND-INV01', condition: 'returned_at IS NULL' },
      { table_id: 'TL-LEND-RM01-TB', position: 1, type: 'foreign', columns: ['loan_id'], target_table_id: 'TL-LEND-EN01-TB' },
    ],
    value_type: [{ id: 'TL-VO01-VT', title: 'EmailAddress', value_object_id: 'TL-VO01' }],
    rule: [{ id: 'TL-LEND-INV01-RL', title: 'tool-on-loan', invariant_id: 'TL-LEND-INV01', file: 'src/lending/loan.ts' }],
    predicate: [{ id: 'TL-LEND-SP01-PR', title: 'isFree', specification_id: 'TL-LEND-SP01' }],
    event_type: [{ id: 'TL-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'TL-LEND-EV01', delivery: 'outbox' }],
    projection: [{ id: 'TL-LEND-RM01-PJ', title: 'loansByMember', read_model_id: 'TL-LEND-RM01', description: 'A view over the loans table.' }],
    reader: [{ id: 'TL-LEND-RM01-RD', title: 'LoansByMemberReader', read_model_id: 'TL-LEND-RM01', description: 'Reads the loans view for the query handlers.' }],
    command_handler: [{ id: 'TL-LEND-CMD01-H', title: 'openLoan', command_id: 'TL-LEND-CMD01', file: 'src/lending/loans.ts', description: 'Saves the loan and its event in one transaction.' }],
    query_handler: [{ id: 'TL-LEND-QRY01-H', title: 'listFreeTools', query_id: 'TL-LEND-QRY01', description: 'Selects from the view on each call.' }],
    event_handler: [{ id: 'TL-LEND-PO01-H', title: 'onLoanOpened', policy_id: 'TL-LEND-PO01', description: 'Hears the event from the outbox relay.' }],
    service: [{ id: 'TL-LEND-DS01-SV', title: 'lateFee', domain_service_id: 'TL-LEND-DS01' }],
    ui_component: [{ id: 'TL-UI01', title: 'CatalogPage', file: 'web/catalog.tsx', description: 'The catalog page.' }],
    endpoint_handler: [{ id: 'TL-LEND-EP01-H', title: 'postLoan', endpoint_id: 'TL-LEND-EP01', description: 'Reads the body and calls openLoan.' }],
    adapter: [{ id: 'TL-INT01-AD', title: 'mailer', integration_id: 'TL-INT01', description: 'Sends mail over SMTP.' }],
    entry_point: [{ id: 'TL-LEND-ENTRY01', title: 'server.ts', domain_id: 'TL-LEND', file: 'src/server.ts', description: 'Opens the database and serves the API.' }],
    tooling: [{ id: 'TL-LEND-TOOL01', title: 'vitest.config.ts', domain_id: 'TL-LEND', file: 'vitest.config.ts' }],
    package_use: [{ record_id: 'TL-INT01-AD', package: 'nodemailer' }],
    standard: [{ id: 'TL-STD-CODE', title: 'Code', product_id: 'TL', type: 'engineering', description: 'How the code is written.' }],
    standard_rule: [{ id: 'TL-STD-CODE-R01', title: 'Node prefix', standard_id: 'TL-STD-CODE', statement: 'Code MUST import node: modules.' }],

    // Test plan.
    constraint_test: [{ id: 'TL-VO01-C01-T', title: 'One at sign', constraint_id: 'TL-VO01-C01', ...automated('test/email.test.ts'), accepts: 'a@b.org', refuses: 'a@@b.org' }],
    invariant_test: [{ id: 'TL-LEND-INV01-T', title: 'A second loan is refused', invariant_id: 'TL-LEND-INV01', ...automated('test/loans.test.ts'), when: 'With a tool on loan, lends it again', then: 'It is refused' }],
    specification_test: [{ id: 'TL-LEND-SP01-T', title: 'Free tools', specification_id: 'TL-LEND-SP01', level: 'integration', state: 'not automated yet', when: 'Asks for free tools', then: 'Expects only the tool on no loan' }],
    policy_test: [{ id: 'TL-LEND-PO01-T', title: 'A reminder follows a loan', policy_id: 'TL-LEND-PO01', ...automated('test/policies.test.ts'), when: 'Opens a loan', then: 'Expects a reminder' }],
    storage_requirement_test: [{ id: 'TL-LEND-A1-SR01-T01', title: 'A failed save leaves nothing', storage_requirement_id: 'TL-LEND-A1-SR01', ...automated('test/loans.test.ts'), level: 'integration', when: 'Opens a loan whose event cannot be written', then: 'Expects neither saved' }],
    domain_service_test: [{ id: 'TL-LEND-DS01-T01', title: 'Three days late', domain_service_id: 'TL-LEND-DS01', ...automated('test/fees.test.ts'), when: 'Works out the fee for three days late', then: 'Expects three day rates' }],
    use_case_test: [{ id: 'TL-LEND-UC01-R01-T01', title: 'A lent tool is refused', uc_requirement_id: 'TL-LEND-UC01-R01', level: 'system', state: 'automated', file: 'test/borrow.test.ts', when: 'Borrows a tool on loan', then: 'Expects a refusal' }],
    view_test: [{ id: 'TL-V01-R01-T01', title: 'Free tools come first', view_requirement_id: 'TL-V01-R01', level: 'browser', state: 'automated', file: 'e2e/catalog.spec.ts', when: 'Opens the catalog', then: 'Expects the free tools first' }],
    endpoint_test: [{ id: 'TL-LEND-EP01-R01-T01', title: 'Unknown tool gives 404', api_requirement_id: 'TL-LEND-EP01-R01', level: 'service', state: 'automated', file: 'test/api.test.ts', when: 'Posts a loan for an unknown tool', then: 'Expects 404' }],
    flow_test: [{ id: 'TL-LEND-UC01-FL-T', title: 'Borrow end to end', flow_id: 'TL-LEND-UC01-FL', level: 'browser', state: 'automated', file: 'e2e/borrow.spec.ts', steps: ['Open the catalog', 'Borrow a tool'], expected_result: 'The loan is listed.' }],
    journey_test: [{ id: 'TL-JR01-T', title: 'A tool is borrowed and brought back', journey_id: 'TL-JR01', level: 'service', state: 'not automated yet', steps: ['Borrow a tool', 'Bring it back'], expected_result: 'The tool is back on the shelf.' }],
    test_data_set: [{ id: 'TL-LEND-TD01', title: 'One tool on loan', domain_id: 'TL-LEND', environment: 'A fresh database.', accounts: 'One member.', records: 'One tool, on loan to the member.', prepare: 'Run the seed.', reset: 'Drop the database.', file: 'test/seed.ts', description: 'What the lending tests start from.' }],
    integration_test: [{ id: 'TL-INT01-T01', title: 'A mail is sent', integration_id: 'TL-INT01', level: 'system', state: 'manual', manual_reason: 'The mail service has no test mode.', size: 'volume', smoke: true, external: true, when: 'Sends a reminder', then: 'Expects the mail to arrive' }],
    pattern_rule_test: [{ id: 'TL-PAT-ACT-R01-T01', title: 'A saved tool reads the same', pattern_rule_id: 'TL-PAT-ACT-R01', domain_id: 'TL-LEND', ...automated('test/catalog.test.ts'), when: 'Saves a tool', then: 'Expects the catalog to read the same' }],
    standard_rule_test: [{ id: 'TL-STD-CODE-R01-T01', title: 'No bare built-in import', standard_rule_id: 'TL-STD-CODE-R01', ...automated('test/imports.test.ts'), when: 'Scans the imports', then: 'Expects every built-in imported with node:' }],

    question: [{ id: 'TL-LEND-Q01', title: 'How long is a loan?', domain_id: 'TL-LEND', owner: 'Librarian', description: 'Two weeks or one, for every tool or by tool.' }],

    // Links.
    has_one: [{ source_id: 'TL-LEND-EN01', target_id: 'TL-LEND-EN02' }],
    has_many: [{ source_id: 'TL-LEND-EN01', target_id: 'TL-LEND-EN02' }],
    raises: [{ source_id: 'TL-LEND-CMD01', target_id: 'TL-LEND-EV01' }],
    checks: [{ source_id: 'TL-LEND-CMD01', target_id: 'TL-LEND-SP01' }],
    reads: [
      { source_id: 'TL-LEND-RM01', target_id: 'TL-LEND-A1' },
      { source_id: 'TL-LEND-SP01', target_id: 'TL-LEND-A1' },
      { source_id: 'TL-LEND-SP01', target_id: 'TL-LEND-A2' },
    ],
    selects_by: [{ source_id: 'TL-LEND-QRY01', target_id: 'TL-LEND-SP01' }],
    hears: [{ source_id: 'TL-LEND-PO01', target_id: 'TL-LEND-EV01' }],
    fed_by: [{ source_id: 'TL-LEND-RM01', target_id: 'TL-LEND-EV01' }],
    calls: [{ source_id: 'TL-LEND-CMD01', target_id: 'TL-LEND-DS01' }],
    fulfills: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-UC01-R01' }],
    invokes: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-CMD01' }],
    presents: [{ source_id: 'TL-V01', target_id: 'TL-LEND-CMD01' }],
    offers: [{ source_id: 'TL-IF01', target_id: 'TL-LEND-UC01' }],
    exchanges_with: [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-INT01' }],
    renders: [{ source_id: 'TL-UI01', target_id: 'TL-V01' }],
    builds: [{ source_id: 'TL-UI01', target_id: 'TL-V01-R01' }],
    follows: [{ source_id: 'TL-LEND-UC01', target_id: 'TL-PAT-ACT' }],
    setting_value: [{ follower_id: 'TL-LEND-UC01', pattern_id: 'TL-PAT-ACT', setting: 'record', value: 'Tool' }],
    meets: [{ source_id: 'TL-LEND-CMD01-H', target_id: 'TL-STD-CODE-R01' }],
    about: [{ source_id: 'TL-LEND-Q01', target_id: 'TL-LEND-UC01' }],
    serves: [{ source_id: 'TL-LEND-CAP01', target_id: 'TL-BO01' }],
    carries_out: [{ source_id: 'TL-JR01-S01', target_id: 'TL-LEND-PO01' }],
    measured_by: [{ source_id: 'TL-BO01', target_id: 'TL-LEND-DS01-T01' }],
    starts_from: [{ source_id: 'TL-INT01-T01', target_id: 'TL-LEND-TD01' }],

    // A product's own kind, a technical kind under the command, with a relation of its own.
    product_kind: [{ name: 'cli_command', product_id: 'TL', label: 'CLI command', description: "A command of the library's CLI.", parent_kind: 'command', stage: 'technical-specification', obligation: false, complexity: 'accidental', id_pattern: '<command>-CLI' }],
    product_kind_field: [{ kind: 'cli_command', position: 1, name: 'usage', type: 'text', required: true, description: 'How it is typed.' }],
    product_relation: [
      { name: 'documents', source_kind: 'cli_command', target_kind: 'view', product_id: 'TL', forward_label: 'Documents', reverse_label: 'Documented by', description: 'The CLI command is documented in the view.' },
    ],
    cli_command: [{ id: 'TL-LEND-CMD01-CLI', title: 'tl borrow', command_id: 'TL-LEND-CMD01', usage: 'tl borrow <tool>' }],
    documents: [{ source_id: 'TL-LEND-CMD01-CLI', target_id: 'TL-V01' }],
    check: [{ name: 'duplicate-id', domain_id: 'LA-CHK', position: 1, severity: 'error', summary: 'An ID names one record.', explanation: 'Give each record its own ID.', query: 'SELECT NULL AS record, NULL AS message WHERE false', kinds: ['product'] }],
  };
}

const roots: string[] = [];

/** Removes every folder writeData made. */
export function removeData(): void {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/**
 * A fresh folder (a product repo root) holding the data as data/<table>.jsonl files, one JSON object per line, and a
 * lathe.config.json naming this Lathe's schema version.
 */
export function writeData(data: Data): string {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-store-'));
  roots.push(root);
  mkdirSync(path.join(root, 'data'));
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION, data: 'data' }, null, 2)}\n`);
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length) writeFileSync(path.join(root, 'data', `${table}.jsonl`), rows.map((r) => `${JSON.stringify(r)}\n`).join(''));
  }
  return root;
}

/** A fresh, empty folder named by its prefix in the temp folder, with a lathe.config.json naming this Lathe's schema version. */
export function configuredRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  writeFileSync(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  return root;
}

/** A deep copy of the data with one table's rows changed. */
export function withTable(data: Data, table: string, rows: Row[]): Data {
  return { ...structuredClone(data), [table]: rows };
}
