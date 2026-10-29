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
// And a repository sits under a domain and persists one aggregate or several: each repository moves from under its
// aggregate to under that aggregate's domain, renamed <domain>-REPO<nn> (TL-LEND-A1-REPO becomes TL-LEND-REPO01) wherever
// it is named, and persists its aggregate. Which records are one piece of code persisting several aggregates only the
// Owner knows: merging them, and the IDs in code, are the to-dos.
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
      notes.todo(`Repository ${String(id)} names aggregate ${String(aggregate)}, which does not exist: give it the domain it sits under and link the aggregates it persists with persists.`);
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
  notes.todo('A repository is one record per piece of code: where several records name one class that persists several aggregates, keep one, link it to each aggregate it persists with persists, and remove the others.');
  notes.todo('Rename the repository IDs your code names: <aggregate>-REPO is now <domain>-REPO<nn>.');
}

const converter: Converter = {
  files(data, notes) {
    testLevels(data, notes);
    domainRepositories(data, notes);
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
  },
};

export default converter;
