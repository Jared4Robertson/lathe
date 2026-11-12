// Schema 1 to 2: one flow per interface. A product now declares its interfaces (web app, API, CLI, agent tools,
// desktop or other), and each flow names the one it goes through, with its ID ending in that interface's number
// (TL-LEND-UC01-FL becomes TL-LEND-UC01-FL01, its steps TL-LEND-UC01-FL01-S01 and its test TL-LEND-UC01-FL01-T).
//
// The files phase gives every product with flows one interface, <P>-IF01, of kind other, and puts every flow through
// it, renaming each flow, step and flow test, and every mention of their IDs in any table, links and text alike. Which
// interface each flow really walks only the Owner knows: that, and the IDs in code (a test's file names its test's
// ID), are the to-dos.
//
// Schema 2 also has five test levels, which say only how a test runs: unit, integration (was database), service (was
// api and contract), system (was e2e-api) and browser (was e2e-ui). Manual stops being a level: a manual test's state
// already says a person runs it, and it takes the level that fits its kind, browser for a flow, view, use case or
// policy test (a person using the product), otherwise the lowest level its kind allows.
//
// And a repository sits under a domain and persists its one aggregate with a persists link: each repository moves
// from under its aggregate to under that aggregate's domain, renamed <domain>-REPO<nn> (TL-LEND-A1-REPO becomes
// TL-LEND-REPO01) wherever it is named, and persists its aggregate, one to one as before. Which records are one piece of
// code persisting several aggregates only the Owner knows: splitting that code into one repository per aggregate, and
// the IDs in code, are the to-dos.
//
// And every kind's text is required or absent (LA-STD-NAMING-R09). The descriptions of flows, flow steps, data models,
// value types, predicates, event types, services and tables go, and a test's Given opens its When. A lead or scenario
// the schema now requires and a record lacks gets a stand-in that starts "To write:" and says what belongs there; writing
// each from the code is a to-do.
//
// And a command sits under the entity it changes, not its aggregate: each command moves to its aggregate's root entity
// (entity_id in place of aggregate_id). Which commands change a child entity only the Owner knows: moving those under
// their entity is the to-do.
//
// And an entry point and a tooling record are Lathe's own kinds, under their domain: a product that declared either as
// its own kind loses the declaration (its product_kind and product_kind_field rows), and its records keep their ID,
// title, domain and file, and an entry point its description. A field Lathe's kind has no column for goes, as a to-do;
// an entry point without a description gets a stand-in that starts "To write:".
//
// And no rule has an exception: a command's recorded change of another aggregate (command_change), a repository's
// recorded share of another (repository_share), a pattern rule's setting and applies-when condition, and a follower's
// not-applicable reason for a setting are gone. Their rows go; a not-applicable reason becomes the setting's value, as
// a value like any other. Changing the model so each rule holds everywhere is the to-do.
import { ALLOWED_LEVELS } from '../src/coverage.ts';
import type { Converter, RawData, UpgradeNotes } from '../src/upgrade.ts';

type Raw = Record<string, unknown>;

const RENAMED_LEVELS: Readonly<Record<string, string>> = { database: 'integration', api: 'service', contract: 'service', 'e2e-api': 'system', 'e2e-ui': 'browser' };
/** The test kinds a person runs through the product itself, so a manual one runs at browser. */
const MANUAL_IN_BROWSER = new Set(['flow_test', 'view_test', 'use_case_test', 'policy_test']);

/** Gives every test one of the five levels. */
function testLevels(data: RawData, notes: UpgradeNotes): void {
  const counts = new Map<string, number>();
  for (const [table, allowed] of Object.entries(ALLOWED_LEVELS)) {
    const rows = data.read(table);
    let changed = false;
    const leveled = rows.map((row): Raw => {
      const old = String(row.level);
      const level = old === 'manual' ? (MANUAL_IN_BROWSER.has(table) ? 'browser' : allowed[0]!) : RENAMED_LEVELS[old];
      if (!level) return row;
      changed = true;
      const key = `${old} to ${level}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return { ...row, level };
    });
    if (changed) data.write(table, leveled);
  }
  if (counts.size) notes.changed(`Every test runs at one of the five levels: ${[...counts].map(([key, n]) => `${n} ${key}`).join(', ')}.`);
  if ([...counts.keys()].some((key) => key.startsWith('manual '))) {
    notes.todo('Each manual test now names the level a person exercises, browser for a flow, view, use case or policy test and otherwise the lowest its kind allows: set the one that fits, such as system for a person running the real CLI.');
  }
}

/** The product of each use case, through its capability and domain. */
function useCaseProducts(data: RawData): Map<string, string> {
  const domains = new Map(data.read('domain').map((d) => [String(d.id), String(d.product_id)]));
  const capabilities = new Map(data.read('capability').map((c) => [String(c.id), domains.get(String(c.domain_id))]));
  return new Map(data.read('use_case').flatMap((u) => {
    const product = capabilities.get(String(u.capability_id));
    return product ? [[String(u.id), product] as const] : [];
  }));
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Moves every repository under its aggregate's domain, numbered there in its aggregates' order, persisting its aggregate. */
function domainRepositories(data: RawData, notes: UpgradeNotes): void {
  const repositories = data.read('repository').filter((r) => r.aggregate_id !== undefined);
  if (repositories.length === 0) return;
  const domains = new Map(data.read('aggregate').map((a) => [String(a.id), String(a.domain_id)]));
  const byAggregate = (a: Raw, b: Raw) => String(a.aggregate_id).localeCompare(String(b.aggregate_id), 'en', { numeric: true });
  const numbers = new Map<string, number>();
  const renamed = new Map<string, string>();
  const persists: Raw[] = [];
  const rows = data.read('repository').filter((r) => r.aggregate_id === undefined);
  for (const repository of [...repositories].sort(byAggregate)) {
    const { id, title, aggregate_id: aggregate, ...rest } = repository;
    const domain = domains.get(String(aggregate));
    if (!domain) {
      notes.todo(`Repository ${String(id)} names aggregate ${String(aggregate)}, which does not exist: give it the domain it sits under and link the aggregate it persists with persists.`);
      continue;
    }
    const number = (numbers.get(domain) ?? 0) + 1;
    numbers.set(domain, number);
    const next = `${domain}-REPO${String(number).padStart(2, '0')}`;
    renamed.set(String(id), next);
    rows.push({ id: next, title, domain_id: domain, ...rest });
    persists.push({ source_id: next, target_id: aggregate });
  }
  // Every mention of an old ID, in any table and column, the repositories' own text among them, names the new one.
  const mention = new RegExp(`(?<![A-Za-z0-9-])(${[...renamed.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![A-Za-z0-9-])`, 'g');
  const rename = (value: unknown): unknown =>
    typeof value === 'string' ? value.replace(mention, (old) => renamed.get(old)!) : Array.isArray(value) ? value.map(rename) : value;
  const renameRow = (row: Raw): Raw => Object.fromEntries(Object.entries(row).map(([column, value]) => [column, rename(value)]));
  if (renamed.size) {
    for (const table of data.tables()) {
      if (table === 'repository') continue;
      const before = data.read(table);
      const after = before.map(renameRow);
      if (JSON.stringify(after) !== JSON.stringify(before)) data.write(table, after);
    }
  }
  data.write('repository', renamed.size ? rows.map(renameRow) : rows);
  data.write('persists', [...data.read('persists'), ...persists]);
  notes.changed(`Every repository sits under its aggregate's domain and persists its aggregate: ${renamed.size} renamed from <aggregate>-REPO to <domain>-REPO<nn>.`);
  notes.todo('A repository persists one aggregate: where several records name one class that persists several aggregates, such as a generic store, split the class into one repository per aggregate and name each record its own.');
  notes.todo('Rename the repository IDs your code names: <aggregate>-REPO is now <domain>-REPO<nn>.');
}

/** The tables whose description is gone: the record they implement, their title or their steps say it. */
const TEXTLESS = ['flow', 'flow_step', 'data_model', 'value_type', 'predicate', 'event_type', 'service', 'table'];
/** The test kinds with a scenario: When and Then, with no Given. */
const SCENARIO_TESTS = ['invariant_test', 'specification_test', 'policy_test', 'domain_service_test', 'use_case_test', 'view_test', 'endpoint_test', 'integration_test', 'pattern_rule_test', 'standard_rule_test'];
/** What each newly required text says, for the stand-in a record without it gets. */
const REQUIRED_TEXT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  product: { description: 'what the product is, who it is for and what it must do' },
  role: { description: 'who takes the role and what they do' },
  domain: { description: 'what the domain covers' },
  aggregate: { description: 'what the aggregate keeps and why its entities change together', identity: 'what identifies one of its records in the business' },
  entity: { description: 'what the entity is' },
  value_object: { description: 'what the value is' },
  domain_event: { description: 'what happened and what brings it about' },
  command: { description: 'what it changes and when it is refused' },
  read_model: { description: 'what it shows and from what' },
  query: { description: 'what it returns' },
  capability: { description: 'what the capability covers' },
  use_case: { goal: 'what the actor wants to reach' },
  pattern: { description: 'the shared behavior' },
  pattern_setting: { meaning: 'what a follower decides in it' },
  interface: { description: 'who uses it and how' },
  view: { description: 'what the view shows and lets a person do' },
  endpoint: { description: 'its request and responses' },
  integration: { description: 'what the product exchanges with it' },
  repository: { description: 'how it keeps its aggregate' },
  projection: { description: 'how it fills its read model and when it is rebuilt' },
  command_handler: { description: 'how it carries out its command' },
  query_handler: { description: 'how it answers its query' },
  event_handler: { description: 'where it hears its event and how it sends its command' },
  endpoint_handler: { description: 'how it reads the request, calls its handler and answers' },
  adapter: { description: 'how it talks to its outside system' },
  ui_component: { description: 'what it renders' },
  standard: { description: 'what the standard covers' },
  question: { description: 'what is open and the options' },
  test_data_set: { description: 'what it is for', environment: 'where it runs', records: 'the records it starts with', prepare: 'how to prepare it', reset: 'how to reset it' },
  constraint_test: { accepts: 'values the value object accepts', refuses: 'values it refuses, and how' },
  flow_test: { expected_result: 'what it expects at the end' },
  ...Object.fromEntries(SCENARIO_TESTS.map((t) => [t, { when: 'what the test does', then: 'what the test expects' }])),
};

const blank = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

/** Drops the descriptions that are gone, folds each Given into its When, and stands in for each required text a record lacks. */
function kindText(data: RawData, notes: UpgradeNotes): void {
  let dropped = 0;
  for (const table of TEXTLESS) {
    const rows = data.read(table);
    if (!rows.some((r) => 'description' in r)) continue;
    dropped += rows.filter((r) => !blank(r.description)).length;
    data.write(table, rows.map(({ description: _, ...row }) => row));
  }
  if (dropped) notes.changed(`The descriptions of flows, flow steps, data models, value types, predicates, event types, services and tables are gone, since the record each implements, its title or its steps say it: ${dropped} removed.`);
  let folded = 0;
  for (const table of SCENARIO_TESTS) {
    const rows = data.read(table);
    if (!rows.some((r) => 'given' in r)) continue;
    data.write(table, rows.map(({ given, ...row }): Raw => {
      if (blank(given)) return row;
      folded++;
      const setup = String(given).trim().replace(/[.]$/, '');
      return { ...row, when: blank(row.when) ? `${setup}.` : `With ${setup[0].toLowerCase()}${setup.slice(1)}: ${String(row.when).trim()}` };
    }));
  }
  if (folded) notes.changed(`Each test's Given opens its When: ${folded} folded.`);
  const missing: string[] = [];
  for (const [table, columns] of Object.entries(REQUIRED_TEXT)) {
    const rows = data.read(table);
    let changed = false;
    const filled = rows.map((row): Raw => {
      const out = { ...row };
      for (const [column, says] of Object.entries(columns)) {
        if (!blank(out[column])) continue;
        out[column] = `To write: ${says}.`;
        missing.push(`${String(row.id ?? row.name ?? table)} ${column}`);
        changed = true;
      }
      return out;
    });
    if (changed) data.write(table, filled);
  }
  if (missing.length) {
    notes.changed(`Each required text a record lacked stands in as "To write: …": ${missing.length} written.`);
    notes.todo(`Write each text that starts "To write:" from the code, saying what the title, parent and links cannot (${missing.length}: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', …' : ''}).`);
  }
}

/** Gives every product with flows one interface, <P>-IF01, and puts every flow through it, renamed wherever it is named. */
function flowInterfaces(data: RawData, notes: UpgradeNotes): void {
  const flows = data.read('flow');
  if (flows.length === 0) return;
  const products = useCaseProducts(data);
  const useCases = [...new Set(flows.map((f) => String(f.use_case_id)))].sort((a, b) => b.length - a.length);
  // A whole use case ID followed by -FL and no more letters or digits: the flow's own ID, or the start of a step's
  // or its test's (TL-LEND-UC01-FL-S01).
  const mention = new RegExp(`(?<![A-Za-z0-9-])(${useCases.map(escape).join('|')})-FL(?![A-Za-z0-9])`, 'g');
  const rename = (value: unknown): unknown =>
    typeof value === 'string' ? value.replace(mention, '$1-FL01') : Array.isArray(value) ? value.map(rename) : value;

  const interfaces = [...new Set(flows.flatMap((f) => products.get(String(f.use_case_id)) ?? []))].sort();
  for (const table of data.tables()) {
    if (table === 'flow') continue;
    const rows = data.read(table);
    const renamed = rows.map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => [column, rename(value)])));
    if (JSON.stringify(renamed) !== JSON.stringify(rows)) data.write(table, renamed);
  }
  data.write('flow', flows.map((flow): Raw => {
    const renamed = Object.fromEntries(Object.entries(flow).map(([column, value]) => [column, rename(value)]));
    const product = products.get(String(flow.use_case_id));
    return product ? { ...renamed, interface_id: `${product}-IF01` } : renamed;
  }));
  data.write('interface', [
    ...data.read('interface'),
    ...interfaces.map((product) => ({
      id: `${product}-IF01`,
      title: 'Interface',
      product_id: product,
      kind: 'other',
      description: 'Every flow written before interfaces were declared goes through this one.',
    })),
  ]);
  notes.changed(`Every flow goes through its product's new interface (${interfaces.map((p) => `${p}-IF01`).join(', ')}), and its ID, its steps' and its test's end in FL01: ${flows.length} flows renamed.`);
  for (const product of interfaces) {
    notes.todo(`${product}-IF01 stands for every interface ${product}'s flows went through: give it the title and kind of the one most of them walk (web app, API, CLI, agent tools, desktop), declare the others, and give each flow that walks another interface that interface, with its ID ending in that interface's number.`);
  }
  notes.todo('Rename the flow, step and flow test IDs your code names, such as a test file naming its flow test: <use case>-FL-T is now <use case>-FL01-T.');
}

/** Moves every command from under its aggregate to under that aggregate's root entity. */
export function commandEntities(data: RawData, notes: UpgradeNotes): void {
  const commands = data.read('command');
  if (!commands.some((c) => c.aggregate_id !== undefined)) return;
  const roots = new Map(data.read('entity').filter((e) => e.role === 'root').map((e) => [String(e.aggregate_id), String(e.id)]));
  let moved = 0;
  data.write('command', commands.map((command): Raw => {
    if (command.aggregate_id === undefined) return command;
    const { id, title, aggregate_id: aggregate, ...rest } = command;
    const root = roots.get(String(aggregate));
    if (!root) {
      notes.todo(`Command ${String(id)} changes aggregate ${String(aggregate)}, which has no root entity: give the aggregate its root and put the command under the entity it changes (entity_id).`);
      return command;
    }
    moved++;
    return { id, title, entity_id: root, ...rest };
  }));
  notes.changed(`Every command sits under the entity it changes: ${moved} moved from their aggregate to its root entity.`);
  notes.todo('A command that changes a child entity (a flow step, a loan\'s return) belongs under that entity: remove it and add it again under the entity with `lathe command add-command --entity_id <entity>`.');
}

/** The columns of Lathe's own entry point and tooling kinds, which a product declared as its own before schema 2. */
const BUILT_IN_KINDS: Readonly<Record<string, readonly string[]>> = {
  entry_point: ['id', 'title', 'domain_id', 'file', 'description'],
  tooling: ['id', 'title', 'domain_id', 'file'],
};

/** Drops a product's own declarations of entry_point and tooling, and fits their records to Lathe's kinds. */
export function builtInKinds(data: RawData, notes: UpgradeNotes): void {
  const declared = data.read('product_kind').filter((k) => String(k.name) in BUILT_IN_KINDS);
  if (!declared.length) return;
  const names = new Set(declared.map((k) => String(k.name)));
  data.write('product_kind', data.read('product_kind').filter((k) => !names.has(String(k.name))));
  data.write('product_kind_field', data.read('product_kind_field').filter((f) => !names.has(String(f.kind))));
  for (const kind of [...names].sort()) {
    const columns = BUILT_IN_KINDS[kind];
    const dropped = new Set<string>();
    const written: string[] = [];
    data.write(kind, data.read(kind).map((row): Raw => {
      for (const column of Object.keys(row)) if (!columns.includes(column)) dropped.add(column);
      const out = Object.fromEntries(columns.filter((c) => !blank(row[c])).map((c) => [c, row[c]]));
      if (kind === 'entry_point' && blank(out.description)) {
        out.description = 'To write: what it does at start-up.';
        written.push(String(row.id));
      }
      return out;
    }));
    if (dropped.size) notes.todo(`${kind} records lost the fields Lathe's ${kind} has no column for (${[...dropped].sort().join(', ')}): write what they said into the record's ${kind === 'entry_point' ? 'description' : 'title or file'}, or into the code.`);
    if (written.length) notes.todo(`Write each entry point's description, what it does at start-up, from its file (${written.join(', ')}).`);
  }
  notes.changed(`Entry points and tooling records are Lathe's own kinds now: the product's declarations of ${[...names].sort().join(' and ')} are gone.`);
}

/** The columns of a pattern rule that waived it, gone with every way out of a rule. */
const WAIVER_COLUMNS = ['setting', 'applies_when_setting', 'applies_when_negated', 'applies_when_value'];

/** Drops every recorded exception and waiver: no rule has one. */
export function noExceptions(data: RawData, notes: UpgradeNotes): void {
  const changes = data.read('command_change');
  const shares = data.read('repository_share');
  if (changes.length) data.write('command_change', []);
  if (shares.length) data.write('repository_share', []);
  if (changes.length || shares.length) {
    notes.changed(`Recorded exceptions are gone: ${changes.length} command changes and ${shares.length} repository shares removed.`);
    notes.todo(`Change the model so each command changes only its own aggregate (another aggregate reacts to its event through a policy, or the two are one aggregate), and each aggregate has a repository of its own: ${[...changes.map((c) => `${String(c.command_id)} changed ${String(c.aggregate_id)}`), ...shares.map((r) => `${String(r.repository_id)} persisted ${String(r.aggregate_id)}`)].join('; ')}.`);
  }
  const rules = data.read('pattern_rule');
  const waived = rules.filter((r) => r.applies_when_setting !== undefined).map((r) => String(r.id));
  if (rules.some((r) => WAIVER_COLUMNS.some((c) => r[c] !== undefined))) {
    data.write('pattern_rule', rules.map((r) => Object.fromEntries(Object.entries(r).filter(([c]) => !WAIVER_COLUMNS.includes(c)))));
    notes.changed('Every follower of a pattern owes every one of its rules: the rules\' settings and applies-when conditions are gone.');
  }
  if (waived.length) notes.todo(`A rule that holds for only some followers belongs to those use cases as their own requirement, not to the pattern: move ${waived.join(', ')}.`);
  const values = data.read('setting_value');
  const reasons = values.filter((v) => v.not_applicable !== undefined);
  if (reasons.length) {
    data.write('setting_value', values.map(({ not_applicable: reason, ...v }) => (reason === undefined ? v : { ...v, value: v.value ?? `Not applicable: ${String(reason)}` })));
    notes.changed(`Each setting's not-applicable reason is its value now: ${reasons.length} given.`);
    notes.todo(`A follower owes every rule of the pattern it follows; where one does not hold for it, it should not follow the pattern. Check each: ${reasons.map((v) => `${String(v.follower_id)} ${String(v.setting)}`).join(', ')}.`);
  }
}

const converter: Converter = {
  files(data, notes) {
    builtInKinds(data, notes);
    testLevels(data, notes);
    domainRepositories(data, notes);
    flowInterfaces(data, notes);
    kindText(data, notes);
    commandEntities(data, notes);
    noExceptions(data, notes);
  },
};

export default converter;
