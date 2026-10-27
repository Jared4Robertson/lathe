// The writers' operations, shared by the CLI (lathe add, set, ...) and the plugin's MCP server: write through the
// command layer and report the rows that changed, or the refusal; read a record, a list or the next free ID; and run
// the check. Each operation opens the store afresh, so it always works on the data files as they are now (the Owner,
// the app or git may have changed them since the last call). Writes never commit: the Agent or the Owner commits.
import path from 'node:path';
import { loadWorkspace } from '../index.ts';
import { describeKey, rowKey, rowLine, type Row, type Value } from '../store/rows.ts';
import { sqlString, type SchemaDescription, type TableDescription } from '../store/schema.ts';
import { openStore, StoreError, type Command, type Store, type StoreProblem } from '../store/store.ts';

/** One row a write added, changed or removed. */
export interface RowChange {
  change: 'added' | 'changed' | 'removed';
  table: string;
  /** The row's key as people read it, such as TL-LEND-UC01 or entity_id TL-LEND-EN01, position 2. */
  key: string;
  /** The row as it is now, or as it was for a removed row. */
  row: Row;
  /** Whether the row is a link, whose key reads as its source, relation and target. */
  link: boolean;
}

/** What an operation gives back: its result, or the refusal with every reason. A refusal changed nothing. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problems: StoreProblem[] };

/** What a write changed: the rows, and the data files written, relative to the repo root. */
export interface Written {
  changes: RowChange[];
  files: string[];
}

/** A write as the writers take it: a record is named by its ID, any other row by its table and key columns. */
export type WriteRequest =
  | { op: 'add'; table: string; row: Row }
  | { op: 'set'; target: string; fields: Record<string, Value | null> }
  | { op: 'remove'; target: string; fields?: Record<string, Value> }
  | { op: 'move'; id: string; parent: string }
  | { op: 'link' | 'unlink'; source: string; relation: string; target: string };

class Refusal extends Error {
  readonly problems: StoreProblem[];
  constructor(rule: string, message: string) {
    super(message);
    this.problems = [{ rule, message }];
  }
}

const refuse = (rule: string, message: string): never => {
  throw new Refusal(rule, message);
};

/** Opens the store at root, runs the operation, and closes it; a refusal or a store that does not load is an Outcome. */
export async function withStore<T>(root: string, run: (store: Store) => Promise<T>): Promise<Outcome<T>> {
  let store: Store;
  try {
    store = await openStore(root);
  } catch (error) {
    if (error instanceof StoreError) return { ok: false, problems: [{ rule: 'load', message: 'the data files do not load; fix them first' }, ...error.problems] };
    throw error;
  }
  try {
    return { ok: true, value: await run(store) };
  } catch (error) {
    if (error instanceof StoreError || error instanceof Refusal) return { ok: false, problems: error.problems };
    throw error;
  } finally {
    await store.close();
  }
}

/** The schema, with the product's own kinds: from its data, or Lathe's alone when the data does not load. */
export async function readSchema(root: string): Promise<SchemaDescription> {
  let store: Store;
  try {
    store = await openStore(root);
  } catch {
    // A data folder that does not exist loads as empty data, with Lathe's schema.
    store = await openStore(root, { dataDir: path.join(root, '.lathe-schema-only') });
  }
  const schema = store.schema;
  await store.close();
  return schema;
}

/** The stored tables a writer may name: every kind, part, declaration and checking table, links aside. */
export const rowTables = (schema: SchemaDescription): TableDescription[] =>
  Object.values(schema.tables)
    .filter((t) => t.stored && t.role !== 'link')
    .sort((a, b) => a.name.localeCompare(b.name));

/** The columns that place a record under its parent, which only move changes. */
export const parentColumns = (schema: SchemaDescription, table: string): Set<string> =>
  new Set(schema.kinds[table]?.parents.map((p) => p.column) ?? []);

// A target names a record by its ID, or a table whose key columns are among the fields.
function resolve(store: Store, target: string, fields: Record<string, Value | null> = {}): { table: TableDescription; key: string | Record<string, Value>; rest: Record<string, Value | null> } {
  const table = store.schema.tables[target];
  if (table) {
    if (!table.stored || table.role === 'link') refuse('command', `${target} is a ${table.role} table; name a record by its ID, or a part, declaration or checking table`);
    const missing = table.primaryKey.filter((c) => fields[c] === undefined || fields[c] === null);
    if (missing.length) refuse('command', `a row of ${target} is named by its key: give ${missing.join(' and ')}`);
    const key: Record<string, Value> = {};
    const rest: Record<string, Value | null> = {};
    for (const [column, value] of Object.entries(fields)) {
      if (table.primaryKey.includes(column)) key[column] = value as Value;
      else rest[column] = value;
    }
    return { table, key: table.primaryKey.length === 1 && table.role === 'kind' ? String(key[table.primaryKey[0]]) : key, rest };
  }
  const record = store.record(target) ?? refuse('missing', `no record has the ID ${target}, and there is no table ${target}`);
  return { table: store.schema.tables[record.kind], key: target, rest: fields };
}

/** Turns a writer's request into the store's command. */
function command(store: Store, request: WriteRequest): Command {
  switch (request.op) {
    case 'add':
      return { op: 'add', table: request.table, row: request.row };
    case 'set': {
      const { table, key, rest } = resolve(store, request.target, request.fields);
      if (!Object.keys(rest).length) refuse('command', `give at least one column of ${table.name} to change`);
      return { op: 'set', table: table.name, key, changes: rest };
    }
    case 'remove': {
      const { table, key, rest } = resolve(store, request.target, request.fields);
      if (Object.keys(rest).length) refuse('command', `remove takes only the key of ${table.name}, not ${Object.keys(rest).join(', ')}`);
      return { op: 'remove', table: table.name, key };
    }
    case 'move':
      return { op: 'move', id: request.id, parent: request.parent };
    case 'link':
    case 'unlink':
      return { op: request.op, relation: request.relation, source: request.source, target: request.target };
  }
}

// Every stored row's line, by table and key, to tell what a write changed.
function snapshot(store: Store): Map<string, Map<string, { line: string; row: Row }>> {
  const tables = new Map<string, Map<string, { line: string; row: Row }>>();
  for (const table of Object.values(store.schema.tables)) {
    if (!table.stored) continue;
    tables.set(table.name, new Map(store.rows(table.name).map((row) => [rowKey(table, row), { line: rowLine(table, row), row }])));
  }
  return tables;
}

/** Applies the requests as one write, in one transaction, and reports the rows it changed. */
export async function write(root: string, requests: WriteRequest[] | ((store: Store) => WriteRequest[])): Promise<Outcome<Written>> {
  return withStore(root, async (store) => {
    const commands = (typeof requests === 'function' ? requests(store) : requests).map((r) => command(store, r));
    const before = snapshot(store);
    const result = await store.apply(commands);
    const after = snapshot(store);
    const changes: RowChange[] = [];
    for (const name of result.tables) {
      const was = before.get(name) ?? new Map();
      const now = after.get(name) ?? new Map();
      const table = store.schema.tables[name] ?? null;
      // A link reads as its two ends and its relation: TL-LEND-T01 proves TL-LEND-UC01-R01.
      const key = (row: Row) => (table?.role === 'link' ? `${row.source_id} ${name} ${row.target_id}` : table ? describeKey(table, row) : JSON.stringify(row));
      for (const [k, { line, row }] of now) {
        const old = was.get(k);
        if (!old) changes.push({ change: 'added', table: name, link: table?.role === 'link', key: key(row), row });
        else if (old.line !== line) changes.push({ change: 'changed', table: name, link: table?.role === 'link', key: key(row), row });
      }
      for (const [k, { row }] of was) if (!now.has(k)) changes.push({ change: 'removed', table: name, link: table?.role === 'link', key: key(row), row });
    }
    const files = result.files.map((f) => path.relative(root, path.join(store.dataDir, f)) || f);
    return { changes, files };
  });
}

/** A record with what belongs to it and what it links. */
export interface Shown {
  kind: string;
  label: string;
  row: Row;
  parent: string | null;
  /** Rows of part tables it owns, such as entity fields or use case steps. */
  parts: { table: string; rows: Row[] }[];
  /** Records whose parent it is. */
  children: { id: string; kind: string; title: string }[];
  /** Links it starts and links that end at it, read by the relation's labels. */
  links: { relation: string; label: string; direction: 'out' | 'in'; id: string; title: string }[];
}

/** The record with this ID, with its parts, children and links. */
export async function show(root: string, id: string): Promise<Outcome<Shown>> {
  return withStore(root, async (store) => {
    const record = store.record(id) ?? refuse('missing', `no record has the ID ${id}`);
    const schema = store.schema;
    const title = (other: string) => String(store.record(other)?.row.title ?? '');
    const parts = Object.values(schema.tables)
      .filter((t) => t.role === 'part' && t.ownerColumn)
      .map((t) => ({ table: t.name, rows: store.rows(t.name).filter((r) => r[t.ownerColumn!] === id) }))
      .filter((p) => p.rows.length)
      .sort((a, b) => a.table.localeCompare(b.table));
    const children = (await store.query<{ id: string; kind: string }>(`SELECT id, kind FROM record_parent WHERE parent_id = ${sqlString(id)} ORDER BY kind, id`)).map((c) => ({
      ...c,
      title: title(c.id),
    }));
    const [parent] = await store.query<{ parent_id: string | null }>(`SELECT parent_id FROM record_parent WHERE id = ${sqlString(id)}`);
    const links: Shown['links'] = [];
    for (const relation of Object.values(schema.relations).sort((a, b) => a.name.localeCompare(b.name))) {
      for (const row of store.rows(relation.name)) {
        if (row.source_id === id) links.push({ relation: relation.name, label: relation.forwardLabel, direction: 'out', id: String(row.target_id), title: title(String(row.target_id)) });
        if (row.target_id === id) links.push({ relation: relation.name, label: relation.reverseLabel, direction: 'in', id: String(row.source_id), title: title(String(row.source_id)) });
      }
    }
    return { kind: record.kind, label: schema.kinds[record.kind].label, row: record.row, parent: parent?.parent_id ?? null, parts, children, links };
  });
}

/** The rows of a table, or only those under a parent: a record whose parent columns name it, a part it owns, or a
 *  link that starts or ends at it. */
export async function list(root: string, table: string, parent?: string): Promise<Outcome<Row[]>> {
  return withStore(root, async (store) => {
    const schema = store.schema;
    const description =
      schema.tables[table] ?? refuse('unknown-table', `there is no table ${table}; the tables are ${Object.values(schema.tables).filter((t) => t.stored).map((t) => t.name).sort().join(', ')}`);
    if (!description.stored) refuse('unknown-table', `${table} is not a stored table`);
    const rows = store.rows(table);
    if (parent === undefined) return rows;
    if (description.role === 'kind') {
      const columns = [...parentColumns(schema, table)];
      if (!columns.length) refuse('command', `a ${table} sits under nothing, so --parent does not apply`);
      return rows.filter((r) => columns.some((c) => r[c] === parent));
    }
    if (description.role === 'part' && description.ownerColumn) return rows.filter((r) => r[description.ownerColumn!] === parent);
    if (description.role === 'link') return rows.filter((r) => r.source_id === parent || r.target_id === parent);
    return refuse('command', `a row of ${table} has no parent, so --parent does not apply`);
  });
}

// One way a kind's IDs are written: a base (the product, the domain or the parent's ID), letters, and a number.
interface IdShape {
  base: 'product' | 'domain' | 'parent';
  letters: string;
  width: number;
}

// Reads a kind's ID pattern, such as "<P>-<D>-UC<nn>" or "<use case>-R<nn>"; alternatives are joined by "or".
function idShapes(pattern: string): IdShape[] {
  return pattern
    .split(/,?\s+or\s+(?![^<]*>)/)
    .map((alternative) => /^((?:<[^>]+>)(?:-<[^>]+>)*)-([A-Z]+)<(n+)>/.exec(alternative.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ base: m[1] === '<P>' ? 'product' : m[1] === '<P>-<D>' ? 'domain' : 'parent', letters: m[2], width: m[3].length }));
}

/** The next free ID for a record of the kind under the parent, by the kind's ID pattern. */
export async function nextId(root: string, kind: string, parent: string): Promise<Outcome<string>> {
  return withStore(root, async (store) => {
    const schema = store.schema;
    const description = schema.kinds[kind] ?? refuse('unknown-kind', `there is no kind ${kind}; the kinds are ${Object.keys(schema.kinds).sort().join(', ')}`);
    const under = store.record(parent) ?? refuse('missing', `no record has the ID ${parent}`);
    if (!description.parents.some((p) => p.kind === under.kind)) {
      refuse('parent', `a ${kind} sits under ${description.parents.map((p) => p.kind).join(' or ') || 'nothing'}, not under ${under.kind} ${parent}`);
    }
    const pattern = description.idPattern ?? refuse('id-pattern', `the kind ${kind} has no ID pattern`);
    const shapes = idShapes(pattern);
    if (!shapes.length) refuse('id-pattern', `a ${kind}'s ID ends in a name you choose (${pattern}, such as ${description.idExample}), so it has no next number`);
    const [scope] = await store.query<{ product_id: string | null; domain_id: string | null }>(`SELECT product_id, domain_id FROM record_scope WHERE id = ${sqlString(parent)}`);
    const pick =
      (!['product', 'domain'].includes(under.kind) ? shapes.find((s) => s.base === 'parent') : undefined) ??
      (scope?.domain_id ? shapes.find((s) => s.base === 'domain') : undefined) ??
      shapes.find((s) => s.base === 'product') ??
      shapes.find((s) => s.base === 'parent') ??
      refuse('id-pattern', `a ${kind} under ${under.kind} ${parent} has no ID pattern (${pattern})`);
    const base = pick.base === 'parent' ? parent : pick.base === 'domain' ? scope?.domain_id : scope?.product_id;
    if (!base) refuse('id-pattern', `${parent} sits in no ${pick.base}, which a ${kind}'s ID starts with (${pattern})`);
    const shape = new RegExp(`^${base!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-${pick.letters}(\\d+)$`);
    let highest = 0;
    for (const k of Object.keys(schema.kinds)) {
      for (const row of store.rows(k)) {
        const m = shape.exec(String(row.id));
        if (m) highest = Math.max(highest, Number(m[1]));
      }
    }
    return `${base}-${pick.letters}${String(highest + 1).padStart(pick.width, '0')}`;
  });
}

/** One problem the check found. */
export interface CheckProblem {
  severity: 'error' | 'warning';
  check: string;
  record: string | null;
  message: string;
}

/** Runs the check on the workspace: its errors and warnings. */
export async function check(root: string): Promise<{ errors: number; warnings: number; problems: CheckProblem[] }> {
  const workspace = await loadWorkspace(root);
  const problems = workspace.problems.map((p) => ({ severity: p.severity, check: p.check, record: p.record ?? null, message: p.message }));
  return {
    errors: problems.filter((p) => p.severity === 'error').length,
    warnings: problems.filter((p) => p.severity === 'warning').length,
    problems,
  };
}

// Text, as the CLI prints it and the MCP tools return it.

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** A refusal: nothing changed, then each reason. */
export function refusalText(problems: StoreProblem[]): string {
  const where = (p: StoreProblem) => (p.file ? `${p.file}:${p.line}: ` : '');
  return `Refused; nothing changed:\n${problems.map((p) => `  ${where(p)}${p.message} [${p.rule}]`).join('\n')}`;
}

/** The rows a write changed, one line each, then the files it wrote. */
export function writtenText(written: Written): string {
  if (!written.changes.length) return 'Nothing changed.';
  const verb = { added: 'Added', changed: 'Changed', removed: 'Removed' } as const;
  return [
    ...written.changes.map((c) => c.link ? `${verb[c.change]} link ${c.key}` : `${verb[c.change]} ${c.table} ${c.key}: ${JSON.stringify(c.row)}`),
    ...written.files.map((f) => `Wrote ${f}`),
  ].join('\n');
}

/** A record, its fields, parts, children and links. */
export function shownText(shown: Shown): string {
  const lines = [`${shown.label} ${shown.row.id}: ${shown.row.title}`, `  kind: ${shown.kind}`];
  if (shown.parent) lines.push(`  parent: ${shown.parent}`);
  for (const [column, value] of Object.entries(shown.row)) if (column !== 'id' && column !== 'title') lines.push(`  ${column}: ${Array.isArray(value) ? value.join(', ') : value}`);
  for (const part of shown.parts) {
    lines.push(`${part.table}:`);
    for (const row of part.rows) lines.push(`  ${JSON.stringify(row)}`);
  }
  if (shown.children.length) {
    lines.push('Children:');
    for (const c of shown.children) lines.push(`  ${c.id} (${c.kind}): ${c.title}`);
  }
  if (shown.links.length) {
    lines.push('Links:');
    for (const l of shown.links) lines.push(`  ${l.label} ${l.id}${l.title ? `: ${l.title}` : ''} [${l.relation}${l.direction === 'in' ? ', in' : ''}]`);
  }
  return lines.join('\n');
}

/** A table's rows: a record as its ID and title, any other row as its line. */
export function listText(table: string, rows: Row[]): string {
  if (!rows.length) return `No ${table} rows.`;
  return rows.map((r) => (typeof r.id === 'string' && typeof r.title === 'string' ? `${r.id}  ${r.title}` : JSON.stringify(r))).join('\n');
}

/** The check's problems, errors first, and a count line. */
export function checkText(result: Awaited<ReturnType<typeof check>>): string {
  const line = (p: CheckProblem) => `  [${p.check}]${p.record ? ` ${p.record}:` : ''} ${p.message}`;
  const errors = result.problems.filter((p) => p.severity === 'error');
  const warnings = result.problems.filter((p) => p.severity === 'warning');
  const parts: string[] = [];
  if (errors.length) parts.push(`Errors (${errors.length}):\n${errors.map(line).join('\n')}`);
  if (warnings.length) parts.push(`Warnings (${warnings.length}):\n${warnings.map(line).join('\n')}`);
  parts.push(`${count(result.errors, 'error')}, ${count(result.warnings, 'warning')}.`);
  return parts.join('\n\n');
}
