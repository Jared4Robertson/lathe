// What the engine's tests share: products written as the store writes them into a fresh folder, with the code files their
// records name, then loaded with Lathe's built-in checks. complete() is a small product with a record of nearly every
// kind that gives no problem and no gap; sparse() falls short of every minimum coverage reports.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import { loadWorkspace, openStore, StoreError, type Problem, type Row, type Store, type StoreProblem, type Workspace } from '../src/index.ts';
import { ALL_COMMANDS } from '../src/commands.ts';
import { runCommand } from '../src/platform/commands/run.ts';
import type { Committed } from '../src/platform/data/transaction.ts';
import { tableText } from '../src/platform/data/rows.ts';
import { DATABASE_STORAGES, expectedColumns } from '../src/trace/tables.ts';
import { writeData, type Data } from './store/fixture.ts';

export { removeData, withTable, writeData, type Data } from './store/fixture.ts';

// Each test writes and loads whole products through the store, which takes seconds when the machine is busy.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

export interface BuildOptions {
  /** IDs the code files leave out, so a file exists but does not name them. */
  silent?: string[];
  /** Files not written, though records name them. */
  missing?: string[];
  /** Files written as given, in place of the generated ones. */
  files?: Record<string, string>;
}

/**
 * Writes the rows into a fresh product folder as data files and loads them with every key and check, so rows the store
 * would refuse fail the build; then writes each table's file as the store writes it (rows sorted by key, columns in
 * the table's order). Then writes each file a record names, holding a comment line with the ID of each record that
 * names it, and a CREATE TABLE for each table kept in a database that names it, with the columns and keys the spec
 * gives (table-schema-mismatch).
 */
export async function build(data: Data, options: BuildOptions = {}): Promise<string> {
  const root = writeData(data);
  const store = await openStore(root, { latheDataDir: null });
  const creates = new Map<string, string[]>();
  try {
    const unknown = Object.keys(data).filter((t) => data[t].length && !store.schema.tables[t]);
    if (unknown.length) throw new Error(`build: no table ${unknown.join(', ')}`);
    for (const [name, rows] of Object.entries(data)) {
      if (rows.length) writeFileSync(path.join(root, 'data', `${name}.jsonl`), tableText(store.schema.tables[name], store.rows(name)));
    }
    for (const table of store.rows('table')) {
      if (typeof table.file !== 'string' || !DATABASE_STORAGES.includes(String(table.storage))) continue;
      const keys = store.rows('table_key').filter((k) => k.table_id === table.id).flatMap((k) => {
        const columns = (k.columns as string[]).join(', ');
        if (k.type === 'primary') return [`PRIMARY KEY (${columns})`];
        if (k.type === 'unique') return [`UNIQUE (${columns})`];
        const target = store.rows('table').find((t) => t.id === k.target_table_id)?.name;
        return k.type === 'foreign' ? [`FOREIGN KEY (${columns}) REFERENCES ${target}`] : [];
      });
      const body = [...expectedColumns(store, table).map((c) => `"${c}" TEXT`), ...keys].join(', ');
      creates.set(table.file, [...(creates.get(table.file) ?? []), `CREATE TABLE "${table.name}" (${body});`]);
    }
  } finally {
    await store.close();
  }
  const files = new Map<string, string[]>();
  for (const rows of Object.values(data)) {
    for (const row of rows) {
      if (typeof row.file !== 'string' || typeof row.id !== 'string') continue;
      const lines = files.get(row.file) ?? [];
      if (!options.silent?.includes(row.id)) lines.push(`// ${row.id}`);
      files.set(row.file, lines);
    }
  }
  for (const [file, statements] of creates) files.set(file, [...(files.get(file) ?? []), ...statements]);
  // An endpoint handler's file names its endpoint's method and route, and a UI component's the routes of the views it
  // renders (endpoint-route-not-in-file, view-route-not-in-file).
  const byId = new Map(Object.values(data).flat().filter((r) => typeof r.id === 'string').map((r) => [r.id as string, r]));
  for (const handler of data.endpoint_handler ?? []) {
    const endpoint = byId.get(String(handler.endpoint_id));
    if (endpoint && typeof handler.file === 'string') files.get(handler.file)?.push(`// ${endpoint.method} ${endpoint.route}`);
  }
  for (const link of data.renders ?? []) {
    const component = byId.get(String(link.source_id));
    const route = byId.get(String(link.target_id))?.route;
    if (typeof component?.file === 'string' && typeof route === 'string') files.get(component.file)?.push(`// ${route}`);
  }
  for (const [file, lines] of files) {
    if (options.missing?.includes(file) || options.files?.[file] !== undefined) continue;
    write(root, file, `${lines.join('\n')}\n`);
  }
  for (const [file, text] of Object.entries(options.files ?? {})) write(root, file, text);
  return root;
}

function write(root: string, file: string, text: string) {
  const at = path.join(root, file);
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, text);
}

/** Builds the rows as a product and loads it with Lathe's built-in checks. */
export const loadData = async (data: Data, options: BuildOptions = {}): Promise<Workspace> => loadWorkspace(await build(data, options));

/** The problems one check found. */
export const ofCheck = (ws: Workspace, check: string): Problem[] => ws.problems.filter((p) => p.check === check);

/** The records a list of problems is about, sorted. */
export const records = (problems: { record: string | null }[]) => problems.map((p) => p.record).sort();

/** Every gap in a workspace's coverage, as `missing id`. */
export const gaps = (ws: Workspace) => ws.coverage.flatMap((c) => c.gaps.map((g) => `${g.missing} ${g.id}`)).sort();

/** One obligation kind's coverage in a domain, or in the product outside the domains (domain null). */
export const obligation = (ws: Workspace, domain: string | null, kind: string) => ws.coverage.find((c) => c.domain === domain)?.obligations.find((o) => o.kind === kind);

/** Runs one aggregate command on the store, named as the CLI names it: run(store, 'view add-view', {...}). */
export async function run(store: Store, command: string, input: Record<string, unknown>): Promise<Committed> {
  const [aggregate, name] = command.split(' ');
  const definition = ALL_COMMANDS.find((d) => d.slice.name === aggregate && d.name === name);
  if (!definition) throw new Error(`there is no command ${command}`);
  return runCommand(store, definition, input);
}

/** The reasons the store refuses one aggregate command; throws when the command goes through. */
export async function refusedBy(store: Store, command: string, input: Record<string, unknown>): Promise<StoreProblem[]> {
  try {
    await run(store, command, input);
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
  throw new Error(`${command} went through, but it should have been refused.`);
}

/** What the store refuses when the rows are written as data files and loaded, or [] when they load. */
export async function refusals(data: Data): Promise<StoreProblem[]> {
  try {
    const store = await openStore(writeData(data), { latheDataDir: null });
    await store.close();
    return [];
  } catch (error) {
    if (error instanceof StoreError) return error.problems;
    throw error;
  }
}

/** A copy of the data with rows added to tables. */
export function adding(data: Data, more: Data): Data {
  const copy = structuredClone(data);
  for (const [table, rows] of Object.entries(more)) copy[table] = [...(copy[table] ?? []), ...rows];
  return copy;
}

/** A copy of the data with the rows matching a test removed from a table. */
export function without(data: Data, table: string, match: (row: Row) => boolean): Data {
  return { ...structuredClone(data), [table]: (data[table] ?? []).filter((r) => !match(r)) };
}

/** A copy of the data with the rows of a table matching a test changed; a change to undefined leaves the column out. */
export function changing(data: Data, table: string, match: (row: Row) => boolean, changes: Record<string, Row[string] | undefined>): Data {
  const change = (r: Row): Row => Object.fromEntries(Object.entries({ ...r, ...changes }).filter(([, v]) => v !== undefined)) as Row;
  return { ...structuredClone(data), [table]: (data[table] ?? []).map((r) => (match(r) ? change(r) : r)) };
}

const automated = (level: string, file: string) => ({ level, state: 'automated', file });

/** A small product with a record of nearly every kind, every obligation designed, built and proved, and no gap. */
export function complete(): Data {
  return {
    product: [{ id: 'EX', title: 'Example library', description: 'A small library that lends tools to members.' }],
    role: [{ product_id: 'EX', name: 'Member', description: 'Someone who borrows tools.' }, { product_id: 'EX', name: 'Librarian', description: 'Someone who lends tools at the desk.' }],
    business_outcome: [{ id: 'EX-BO01', title: 'More tools in use', product_id: 'EX', statement: 'Members borrow more of the tools the library holds.', measure: 'Loans opened per tool per month.', target: 'Two loans per tool per month within a year.' }],

    domain: [{ id: 'EX-LEND', title: 'Lending', product_id: 'EX', subdomain_type: 'core', description: 'Lending tools to members and getting them back.' }],
    aggregate: [
      { id: 'EX-LEND-A1', title: 'Loan', domain_id: 'EX-LEND', identity: 'Loan ID', description: 'One tool lent to one member, with its return.' },
      { id: 'EX-LEND-A2', title: 'Tool', domain_id: 'EX-LEND', identity: 'Tool ID', description: 'A tool the library holds.' },
    ],
    entity: [
      { id: 'EX-LEND-EN01', title: 'Loan', aggregate_id: 'EX-LEND-A1', role: 'root', description: 'The loan itself.' },
      { id: 'EX-LEND-EN02', title: 'Return', aggregate_id: 'EX-LEND-A1', role: 'child', in_root_table: true, description: 'The tool coming back.' },
      { id: 'EX-LEND-EN03', title: 'Tool', aggregate_id: 'EX-LEND-A2', role: 'root', description: 'A tool on the shelf or out.' },
    ],
    entity_field: [
      { entity_id: 'EX-LEND-EN01', position: 1, name: 'Loan ID', meaning: 'The loan number.', type: 'whole number', required: true, column_name: 'id' },
      { entity_id: 'EX-LEND-EN01', position: 2, name: 'Borrower email', meaning: 'Where reminders go.', type_value_object_id: 'EX-VO01', required: true },
      { entity_id: 'EX-LEND-EN01', position: 3, name: 'Tool', meaning: 'The tool lent.', type_aggregate_id: 'EX-LEND-A2', required: true, column_name: 'tool_id' },
      { entity_id: 'EX-LEND-EN02', position: 1, name: 'Returned at', meaning: 'When it came back.', type: 'date', required: false },
      { entity_id: 'EX-LEND-EN03', position: 1, name: 'Name', meaning: 'What the tool is called.', type: 'text', required: true },
    ],
    value_object: [{ id: 'EX-VO01', title: 'Email address', description: 'Where a member gets mail.' }],
    value_object_field: [{ value_object_id: 'EX-VO01', position: 1, name: 'Address', meaning: 'The address as typed.', type: 'text', required: true }],
    constraint: [{ id: 'EX-VO01-C01', title: 'One at sign', value_object_id: 'EX-VO01', statement: 'An email address MUST hold exactly one @.' }],
    invariant: [{ id: 'EX-LEND-INV01', title: 'One active loan per tool', aggregate_id: 'EX-LEND-A1', statement: 'A tool MUST NOT have two active loans.' }],
    specification: [{ id: 'EX-LEND-SP01', title: 'Tool is free', statement: 'A tool is free when no active loan names it.' }],
    domain_event: [
      { id: 'EX-LEND-EV01', title: 'Loan opened', aggregate_id: 'EX-LEND-A1', published: false, description: 'A tool went out on loan.' },
      { id: 'EX-LEND-EV02', title: 'Tool added', aggregate_id: 'EX-LEND-A2', published: false, description: 'A tool joined the catalog.' },
    ],
    event_field: [
      { domain_event_id: 'EX-LEND-EV01', position: 1, name: 'Loan', meaning: 'Which loan.', type_aggregate_id: 'EX-LEND-A1', required: true },
      { domain_event_id: 'EX-LEND-EV02', position: 1, name: 'Tool', meaning: 'Which tool.', type_aggregate_id: 'EX-LEND-A2', required: true },
    ],
    command: [
      { id: 'EX-LEND-CMD01', title: 'Open a loan', entity_id: 'EX-LEND-EN01', description: 'Lends a free tool to a member.' },
      { id: 'EX-LEND-CMD02', title: 'Add a tool', entity_id: 'EX-LEND-EN03', description: 'Puts a named tool in the catalog.' },
      { id: 'EX-LEND-CMD03', title: 'Remind the borrower', entity_id: 'EX-LEND-EN01', description: 'Mails the borrower their due date.' },
    ],
    read_model: [{ id: 'EX-LEND-RM01', title: 'Free tools', domain_id: 'EX-LEND', description: 'The tools on no active loan.' }],
    read_model_field: [{ read_model_id: 'EX-LEND-RM01', position: 1, name: 'Tool', meaning: 'A free tool.', type_aggregate_id: 'EX-LEND-A2', required: true }],
    query: [{ id: 'EX-LEND-QRY01', title: 'List free tools', read_model_id: 'EX-LEND-RM01', description: 'The free tools, by name.' }],
    policy: [{ id: 'EX-LEND-PO01', title: 'Remind on loan', command_id: 'EX-LEND-CMD03', statement: 'Whenever a loan is opened, the library MUST remind the borrower.' }],
    domain_service: [{ id: 'EX-LEND-DS01', title: 'Due date', domain_id: 'EX-LEND', statement: 'The due date MUST be 14 days after the loan starts.' }],
    storage_requirement: [{ id: 'EX-LEND-A1-SR01', title: 'A loan survives a restart', aggregate_id: 'EX-LEND-A1', statement: 'A saved loan MUST survive a restart, and a failed save MUST leave nothing behind.' }],
    term: [{ id: 'EX-LEND-TM01', title: 'Loan', domain_id: 'EX-LEND', meaning: 'One tool lent to one member until it is returned.' }],

    capability: [{ id: 'EX-LEND-CAP01', title: 'Lending', domain_id: 'EX-LEND', position: 1, description: 'Lending tools and taking them back.' }],
    serves: [{ source_id: 'EX-LEND-CAP01', target_id: 'EX-BO01' }],
    measured_by: [{ source_id: 'EX-BO01', target_id: 'EX-LEND-UC01-R01-T01' }],
    use_case: [
      { id: 'EX-LEND-UC01', title: 'Borrow a tool', capability_id: 'EX-LEND-CAP01', goal: 'A member takes a free tool home.' },
      { id: 'EX-LEND-UC02', title: 'Add a tool', capability_id: 'EX-LEND-CAP01', goal: 'The librarian puts a new tool in the catalog.' },
    ],
    use_case_actor: [
      { use_case_id: 'EX-LEND-UC01', position: 1, role_name: 'Member' },
      { use_case_id: 'EX-LEND-UC02', position: 1, role_name: 'Librarian' },
    ],
    uc_requirement: [
      { id: 'EX-LEND-UC01-R01', title: 'Tool is free', use_case_id: 'EX-LEND-UC01', statement: 'The library MUST refuse a tool on loan.' },
      { id: 'EX-LEND-UC02-R01', title: 'Tool is named', use_case_id: 'EX-LEND-UC02', statement: 'The library MUST refuse a tool with no name.' },
    ],
    pattern: [{ id: 'EX-PAT-ACT', title: 'Librarian action', product_id: 'EX', description: 'An action the librarian takes at the desk.' }],
    pattern_setting: [{ pattern_id: 'EX-PAT-ACT', position: 1, name: 'record', meaning: 'The record the action saves.' }],
    pattern_rule: [{ id: 'EX-PAT-ACT-R01', title: 'A saved record reads the same', pattern_id: 'EX-PAT-ACT', statement: 'A saved record MUST read the same everywhere.' }],

    interface: [{ id: 'EX-IF01', title: 'Web app', product_id: 'EX', kind: 'web app', description: 'The desk app the librarian uses.' }],
    flow: [
      { id: 'EX-LEND-UC01-FL01', title: 'Borrow a tool in the web app', use_case_id: 'EX-LEND-UC01', interface_id: 'EX-IF01' },
      { id: 'EX-LEND-UC02-FL01', title: 'Add a tool in the web app', use_case_id: 'EX-LEND-UC02', interface_id: 'EX-IF01' },
    ],
    flow_step: [
      { id: 'EX-LEND-UC01-FL01-S01', title: 'Borrow a tool', flow_id: 'EX-LEND-UC01-FL01', path: 'main', position: 1 },
      { id: 'EX-LEND-UC01-FL01-S02', title: 'See the loan', flow_id: 'EX-LEND-UC01-FL01', path: 'main', position: 2 },
      { id: 'EX-LEND-UC02-FL01-S01', title: 'Add a tool', flow_id: 'EX-LEND-UC02-FL01', path: 'main', position: 1 },
    ],
    view: [{ id: 'EX-V01', title: 'Catalog', route: '/catalog', description: 'Every tool, with whether it is free.' }],
    view_requirement: [{ id: 'EX-V01-R01', title: 'Free tools first', view_id: 'EX-V01', statement: 'The catalog MUST list free tools first.' }],
    endpoint: [{ id: 'EX-LEND-EP01', title: 'POST /loans', command_id: 'EX-LEND-CMD01', method: 'POST', route: '/loans', description: 'Takes a member and a tool; answers 201 with the loan.' }],
    api_requirement: [{ id: 'EX-LEND-EP01-R01', title: 'Unknown tool', endpoint_id: 'EX-LEND-EP01', statement: 'An unknown tool MUST give 404.' }],
    integration: [{ id: 'EX-INT01', title: 'Mail', system: 'Mail service', description: 'Reminders sent to members.' }],

    repository: [
      { id: 'EX-LEND-REPO01', title: 'Loans', domain_id: 'EX-LEND', file: 'src/store.ts', description: 'Keeps loans in the loans table.' },
      { id: 'EX-LEND-REPO02', title: 'Tools', domain_id: 'EX-LEND', file: 'src/store.ts', description: 'Keeps tools in the tools table.' },
    ],
    persists: [
      { source_id: 'EX-LEND-REPO01', target_id: 'EX-LEND-A1' },
      { source_id: 'EX-LEND-REPO02', target_id: 'EX-LEND-A2' },
    ],
    data_store: [{ id: 'EX-STORE01', title: 'DATABASE_URL', product_id: 'EX', kind: 'database', description: "The library's database." }],
    stored_in: [
      { source_id: 'EX-LEND-REPO01', target_id: 'EX-STORE01' },
      { source_id: 'EX-LEND-REPO02', target_id: 'EX-STORE01' },
      { source_id: 'EX-LEND-RM01-RD', target_id: 'EX-STORE01' },
      { source_id: 'EX-LEND-EN01-TB', target_id: 'EX-STORE01' },
      { source_id: 'EX-LEND-EN03-TB', target_id: 'EX-STORE01' },
      { source_id: 'EX-LEND-RM01-TB', target_id: 'EX-STORE01' },
    ],
    data_model: [
      { id: 'EX-LEND-EN01-DM', title: 'Loan', entity_id: 'EX-LEND-EN01', file: 'src/model.ts' },
      { id: 'EX-LEND-EN02-DM', title: 'Return', entity_id: 'EX-LEND-EN02', file: 'src/model.ts' },
      { id: 'EX-LEND-EN03-DM', title: 'Tool', entity_id: 'EX-LEND-EN03', file: 'src/model.ts' },
    ],
    table: [
      { id: 'EX-LEND-EN01-TB', title: 'loans', entity_id: 'EX-LEND-EN01', name: 'loans', storage: 'table', file: 'src/schema.sql' },
      { id: 'EX-LEND-EN03-TB', title: 'tools', entity_id: 'EX-LEND-EN03', name: 'tools', storage: 'table', file: 'src/schema.sql' },
      { id: 'EX-LEND-RM01-TB', title: 'free_tools', read_model_id: 'EX-LEND-RM01', name: 'free_tools', storage: 'view', file: 'src/schema.sql' },
    ],
    table_key: [
      { table_id: 'EX-LEND-EN01-TB', position: 1, type: 'primary', columns: ['id'] },
      { table_id: 'EX-LEND-EN03-TB', position: 1, type: 'primary', columns: ['id'] },
    ],
    value_type: [{ id: 'EX-VO01-VT', title: 'EmailAddress', value_object_id: 'EX-VO01', file: 'src/email.ts' }],
    rule: [{ id: 'EX-LEND-INV01-RL', title: 'tool-on-loan', invariant_id: 'EX-LEND-INV01', file: 'src/loans.ts' }],
    predicate: [{ id: 'EX-LEND-SP01-PR', title: 'isFree', specification_id: 'EX-LEND-SP01', file: 'src/loans.ts' }],
    event_type: [
      { id: 'EX-LEND-EV01-ET', title: 'LoanOpened', domain_event_id: 'EX-LEND-EV01', delivery: 'outbox', file: 'src/events.ts' },
      { id: 'EX-LEND-EV02-ET', title: 'ToolAdded', domain_event_id: 'EX-LEND-EV02', delivery: 'in process', file: 'src/events.ts' },
    ],
    projection: [{ id: 'EX-LEND-RM01-PJ', title: 'freeTools', read_model_id: 'EX-LEND-RM01', file: 'src/schema.sql', description: 'A view over the loans and tools tables.' }],
    reader: [{ id: 'EX-LEND-RM01-RD', title: 'FreeToolsReader', read_model_id: 'EX-LEND-RM01', file: 'src/schema.sql', description: 'Reads the free tools view for the query handler.' }],
    command_handler: [
      { id: 'EX-LEND-CMD01-H', title: 'openLoan', command_id: 'EX-LEND-CMD01', file: 'src/loans.ts', description: 'Saves the loan and its event in one transaction.' },
      { id: 'EX-LEND-CMD02-H', title: 'addTool', command_id: 'EX-LEND-CMD02', file: 'src/tools.ts', description: 'Inserts the tool and its event in one transaction.' },
      { id: 'EX-LEND-CMD03-H', title: 'remind', command_id: 'EX-LEND-CMD03', file: 'src/loans.ts', description: 'Sends the mail through the mailer.' },
    ],
    query_handler: [{ id: 'EX-LEND-QRY01-H', title: 'listFreeTools', query_id: 'EX-LEND-QRY01', file: 'src/tools.ts', description: 'Selects from the view on each call.' }],
    event_handler: [{ id: 'EX-LEND-PO01-H', title: 'onLoanOpened', policy_id: 'EX-LEND-PO01', file: 'src/loans.ts', description: 'Hears the event from the outbox relay.' }],
    service: [{ id: 'EX-LEND-DS01-SV', title: 'dueDate', domain_service_id: 'EX-LEND-DS01', file: 'src/dates.ts' }],
    ui_component: [{ id: 'EX-UI01', title: 'CatalogPage', file: 'web/catalog.tsx', description: 'The catalog page.' }],
    endpoint_handler: [{ id: 'EX-LEND-EP01-H', title: 'postLoan', endpoint_id: 'EX-LEND-EP01', file: 'src/router.ts', description: 'Reads the body and calls openLoan.' }],
    adapter: [{ id: 'EX-INT01-AD', title: 'mailer', integration_id: 'EX-INT01', file: 'src/mail.ts', description: 'Sends mail over SMTP.' }],
    standard: [{ id: 'EX-STD-CODE', title: 'Code', product_id: 'EX', description: 'How the code is written.' }],
    standard_rule: [{ id: 'EX-STD-CODE-R01', title: 'Node prefix', standard_id: 'EX-STD-CODE', statement: 'Code MUST import node: modules.' }],

    constraint_test: [{ id: 'EX-VO01-C01-T', title: 'One at sign', constraint_id: 'EX-VO01-C01', ...automated('unit', 'test/email.test.ts'), accepts: 'a@b.org', refuses: 'a@@b.org' }],
    invariant_test: [{ id: 'EX-LEND-INV01-T', title: 'A second loan is refused', invariant_id: 'EX-LEND-INV01', ...automated('integration', 'test/loans.test.ts'), when: 'Lends a tool on loan again', then: 'Expects a refusal' }],
    specification_test: [{ id: 'EX-LEND-SP01-T', title: 'Free tools', specification_id: 'EX-LEND-SP01', ...automated('unit', 'test/loans.test.ts'), when: 'Asks which tools are free', then: 'Expects only the tool on no loan' }],
    policy_test: [{ id: 'EX-LEND-PO01-T', title: 'A reminder follows a loan', policy_id: 'EX-LEND-PO01', ...automated('integration', 'test/loans.test.ts'), when: 'Opens a loan', then: 'Expects a reminder' }],
    storage_requirement_test: [{ id: 'EX-LEND-A1-SR01-T01', title: 'A loan survives a restart', storage_requirement_id: 'EX-LEND-A1-SR01', ...automated('integration', 'test/storage.test.ts'), when: 'Opens a loan, then restarts the database', then: 'Expects the loan read back' }],
    domain_service_test: [{ id: 'EX-LEND-DS01-T01', title: 'Fourteen days', domain_service_id: 'EX-LEND-DS01', ...automated('unit', 'test/dates.test.ts'), when: 'Works out the due date of a loan', then: 'Expects 14 days after it starts' }],
    use_case_test: [
      { id: 'EX-LEND-UC01-R01-T01', title: 'A lent tool is refused', uc_requirement_id: 'EX-LEND-UC01-R01', ...automated('service', 'test/api.test.ts'), when: 'Borrows a tool on loan', then: 'Expects a refusal' },
      { id: 'EX-LEND-UC02-R01-T01', title: 'A nameless tool is refused', uc_requirement_id: 'EX-LEND-UC02-R01', ...automated('service', 'test/api.test.ts'), when: 'Adds a tool with no name', then: 'Expects a refusal' },
    ],
    view_test: [{ id: 'EX-V01-R01-T01', title: 'Free tools come first', view_requirement_id: 'EX-V01-R01', ...automated('browser', 'e2e/catalog.spec.ts'), when: 'Opens the catalog', then: 'Expects the free tools first' }],
    endpoint_test: [{ id: 'EX-LEND-EP01-R01-T01', title: 'Unknown tool gives 404', api_requirement_id: 'EX-LEND-EP01-R01', ...automated('service', 'test/api.test.ts'), when: 'Posts a loan for an unknown tool', then: 'Expects 404' }],
    flow_test: [
      { id: 'EX-LEND-UC01-FL01-T', title: 'Borrow end to end', flow_id: 'EX-LEND-UC01-FL01', ...automated('browser', 'e2e/borrow.spec.ts'), steps: ['Open the catalog', 'Borrow a tool'], expected_result: 'The loan is listed.' },
      { id: 'EX-LEND-UC02-FL01-T', title: 'Add end to end', flow_id: 'EX-LEND-UC02-FL01', level: 'browser', state: 'manual', manual_reason: 'Done at the desk.', steps: ['Open the catalog', 'Add a tool'], expected_result: 'The tool is listed.' },
    ],
    test_data_set: [{ id: 'EX-LEND-TD01', title: 'One tool on loan', domain_id: 'EX-LEND', records: 'One member, one tool, one active loan.', file: 'test/seed.ts', environment: 'A fresh database.', prepare: 'Run the seed.', reset: 'Drop the database.', description: 'What the lending tests start from.' }],
    starts_from: [{ source_id: 'EX-LEND-INV01-T', target_id: 'EX-LEND-TD01' }],
    integration_test: [{ id: 'EX-INT01-T01', title: 'A mail is sent', integration_id: 'EX-INT01', level: 'system', state: 'manual', manual_reason: 'The mail service has no test mode.', when: 'Sends a reminder', then: 'Expects the mail to arrive' }],
    pattern_rule_test: [{ id: 'EX-PAT-ACT-R01-T01', title: 'A saved tool reads the same', pattern_rule_id: 'EX-PAT-ACT-R01', domain_id: 'EX-LEND', ...automated('service', 'test/api.test.ts'), when: 'Saves a tool', then: 'Expects it to read the same' }],
    standard_rule_test: [{ id: 'EX-STD-CODE-R01-T01', title: 'No bare built-in import', standard_rule_id: 'EX-STD-CODE-R01', ...automated('unit', 'test/imports.test.ts'), when: 'Scans the imports', then: 'Expects every built-in imported with node:' }],

    has_one: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN02' }],
    raises: [
      { source_id: 'EX-LEND-CMD01', target_id: 'EX-LEND-EV01' },
      { source_id: 'EX-LEND-CMD02', target_id: 'EX-LEND-EV02' },
    ],
    checks: [{ source_id: 'EX-LEND-CMD01', target_id: 'EX-LEND-SP01' }],
    reads: [
      { source_id: 'EX-LEND-RM01', target_id: 'EX-LEND-A2' },
      { source_id: 'EX-LEND-SP01', target_id: 'EX-LEND-A1' },
    ],
    hears: [{ source_id: 'EX-LEND-PO01', target_id: 'EX-LEND-EV01' }],
    calls: [{ source_id: 'EX-LEND-CMD01', target_id: 'EX-LEND-DS01' }],
    fulfills: [
      { source_id: 'EX-LEND-UC01-FL01-S01', target_id: 'EX-LEND-UC01-R01' },
      { source_id: 'EX-LEND-UC01-FL01-S02', target_id: 'EX-LEND-UC01-R01' },
      { source_id: 'EX-LEND-UC02-FL01-S01', target_id: 'EX-LEND-UC02-R01' },
    ],
    invokes: [
      { source_id: 'EX-LEND-UC01-FL01-S01', target_id: 'EX-LEND-CMD01' },
      { source_id: 'EX-LEND-UC01-FL01-S02', target_id: 'EX-LEND-QRY01' },
      { source_id: 'EX-LEND-UC02-FL01-S01', target_id: 'EX-LEND-CMD02' },
    ],
    happens_in: [
      { source_id: 'EX-LEND-UC01-FL01-S01', target_id: 'EX-V01' },
      { source_id: 'EX-LEND-UC02-FL01-S01', target_id: 'EX-V01' },
    ],
    exchanges_with: [{ source_id: 'EX-LEND-UC01-FL01-S02', target_id: 'EX-INT01' }],
    renders: [{ source_id: 'EX-UI01', target_id: 'EX-V01' }],
    builds: [{ source_id: 'EX-UI01', target_id: 'EX-V01-R01' }],
    follows: [{ source_id: 'EX-LEND-UC02', target_id: 'EX-PAT-ACT' }],
    setting_value: [{ follower_id: 'EX-LEND-UC02', pattern_id: 'EX-PAT-ACT', setting: 'record', value: 'Tool' }],
    meets: [{ source_id: 'EX-LEND-CMD01-H', target_id: 'EX-STD-CODE-R01' }],
  };
}

/** The code of sparse(): its router serves a route no endpoint has (route-without-record). */
export const SPARSE_FILES: BuildOptions = {
  files: { 'src/router.ts': "// SP-D-EP02-H\napp.get('/loans', listLoans);\napp.post('/members', register);\n" },
};

/** A product with one record short of every minimum coverage reports (GAP_RULES), with SPARSE_FILES as its code. */
export function sparse(): Data {
  return {
    product: [{ id: 'SP', title: 'Sparse', description: 'A product short of every minimum.' }],
    business_outcome: [{ id: 'SP-BO01', title: 'Unserved', product_id: 'SP', statement: 'Members return tools on time.', measure: 'Loans returned late per month.', target: 'None.' }],
    domain: [
      { id: 'SP-D', title: 'Lending', product_id: 'SP', subdomain_type: 'core', description: 'Lending tools.' },
      { id: 'SP-E', title: 'Empty', product_id: 'SP', subdomain_type: 'generic', description: 'Nothing yet.' },
    ],
    aggregate: [
      { id: 'SP-D-A1', title: 'Loan', domain_id: 'SP-D', identity: 'Loan ID', description: 'One tool lent to one member.' },
      { id: 'SP-D-A2', title: 'Tool', domain_id: 'SP-D', identity: 'Tool ID', description: 'A tool the library holds.' },
    ],
    entity: [{ id: 'SP-D-EN01', title: 'Return', aggregate_id: 'SP-D-A1', role: 'child', description: 'The tool coming back.' }],
    value_object: [{ id: 'SP-VO01', title: 'Email address', description: 'Where a member gets mail.' }],
    domain_event: [{ id: 'SP-D-EV01', title: 'Tool added', aggregate_id: 'SP-D-A2', published: false, description: 'A tool joined the catalog.' }],
    command: [{ id: 'SP-D-CMD01', title: 'Add a tool', entity_id: 'SP-D-EN01', description: 'Puts a tool in the catalog.' }],
    read_model: [
      { id: 'SP-D-RM01', title: 'Free tools', domain_id: 'SP-D', description: 'The tools on no loan.' },
      { id: 'SP-D-RM02', title: 'Loans', domain_id: 'SP-D', description: 'Every loan.' },
    ],
    table: [{ id: 'SP-D-TB01', title: 'Outbox', domain_id: 'SP-D', name: 'outbox', storage: 'table' }],
    data_store: [{ id: 'SP-STORE01', title: 'DATABASE_URL', product_id: 'SP', kind: 'database', description: 'A database nothing is stored in.' }],
    query: [{ id: 'SP-D-QRY01', title: 'List loans', read_model_id: 'SP-D-RM02', description: 'The loans, newest first.' }],
    specification: [{ id: 'SP-D-SP01', title: 'Tool is free', statement: 'A tool is free when no loan names it.' }],
    policy: [{ id: 'SP-D-PO01', title: 'React', command_id: 'SP-D-CMD01', statement: 'Whenever something happens, the library MUST add a tool.' }],
    domain_service: [{ id: 'SP-D-DS01', title: 'Late fee', domain_id: 'SP-D', statement: 'The fee MUST be a day rate times the days late.' }],
    capability: [
      { id: 'SP-D-CAP01', title: 'Empty', domain_id: 'SP-D', position: 1, description: 'Nothing yet.' },
      { id: 'SP-D-CAP02', title: 'Lending', domain_id: 'SP-D', position: 2, description: 'Lending tools.' },
    ],
    use_case: [
      { id: 'SP-D-UC01', title: 'Borrow a tool', capability_id: 'SP-D-CAP02', goal: 'A member takes a tool home.' },
      { id: 'SP-D-UC02', title: 'Return a tool', capability_id: 'SP-D-CAP02', goal: 'A member brings a tool back.' },
    ],
    pattern: [{ id: 'SP-PAT-X', title: 'Ruleless', product_id: 'SP', description: 'A pattern with no rules.' }],
    interface: [
      { id: 'SP-IF01', title: 'Web app', product_id: 'SP', kind: 'web app', description: 'The desk app.' },
      { id: 'SP-IF02', title: 'CLI', product_id: 'SP', kind: 'CLI', description: 'The command line.' },
    ],
    flow: [{ id: 'SP-D-UC02-FL01', title: 'Return a tool in the web app', use_case_id: 'SP-D-UC02', interface_id: 'SP-IF01' }],
    flow_step: [{ id: 'SP-D-UC02-FL01-S01', title: 'Refuse', flow_id: 'SP-D-UC02-FL01', path: 'refused', position: 1 }],
    view: [{ id: 'SP-V01', title: 'Catalog', description: 'Every tool.' }],
    endpoint: [
      { id: 'SP-D-EP01', title: 'POST /tools', command_id: 'SP-D-CMD01', method: 'POST', route: '/tools', description: 'Takes a tool; answers 201.' },
      { id: 'SP-D-EP02', title: 'GET /loans', query_id: 'SP-D-QRY01', method: 'GET', route: '/loans', description: 'Answers the loans.' },
    ],
    endpoint_handler: [{ id: 'SP-D-EP02-H', title: 'getLoans', endpoint_id: 'SP-D-EP02', file: 'src/router.ts', description: 'Calls the query handler.' }],
    integration: [{ id: 'SP-INT01', title: 'Mail', description: 'Reminders.' }],
    checks: [{ source_id: 'SP-D-CMD01', target_id: 'SP-D-SP01' }],
    happens_in: [{ source_id: 'SP-D-UC02-FL01-S01', target_id: 'SP-V01' }],
    exchanges_with: [{ source_id: 'SP-D-UC02-FL01-S01', target_id: 'SP-INT01' }],
  };
}
