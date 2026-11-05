// One write, as a transaction: a draft of every table, which a command's handler changes through its aggregate's
// repository (data-files.ts) and nothing else, then the commit. The commit holds the new state to every key,
// constraint and integrity query of the schema and every aggregate's rules over all data (the store builds it in a
// fresh database, or holds only what the changed tables can break), and only when it passes makes it the current
// state and rewrites the data files of the tables that changed, all or nothing (journal.ts).
//
// Only the store creates a transaction (Store.transact), one at a time; only data-files.ts changes its draft.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RowChange } from '../../server/contract.ts';
import { describeKey, normalizeRow, rowKey, sortRows, tableText, type Row } from './rows.ts';
import type { SchemaDescription, TableDescription } from './schema.ts';
import { writeAll, type FileChange } from './journal.ts';
import { StoreError, problemAt, type Origin, type StoreProblem } from './problems.ts';
import type { CheckedProblems, ReadView } from './rules.ts';
import { WRITE_RULES } from '../../write-rules.ts';

/** Every table's rows by key. */
export type Tables = Map<string, Map<string, Row>>;

/** The tables whose rows declare a product's own kinds and relations: a change to them changes the schema. */
export const DECLARATION_TABLES = ['product_kind', 'product_kind_field', 'product_relation'] as const;

/** What the store lends a transaction: its current state, and how it builds and adopts a new one. */
export interface TransactionHost {
  readonly dataDir: string;
  readonly schema: SchemaDescription;
  readonly schemaDb: string;
  readonly tables: Tables;
  readonly origins: WeakMap<Row, Origin>;
  readonly builtIn: WeakSet<Row>;
  buildSchema(tables: Tables, origins: WeakMap<Row, Origin>): Promise<{ schemaDb: string; schema: SchemaDescription }>;
  /**
   * Holds the state, whose changed tables are given, to every refusal of its whole build: built in a fresh database
   * (its name), or held without one (null) when the store can hold it so; throws a StoreError when it is refused.
   */
  build(schemaDb: string, schema: SchemaDescription, tables: Tables, origins: WeakMap<Row, Origin>, changed: ReadonlySet<string>): Promise<string | null>;
  /** Drops a database build made for a state the store does not adopt. */
  discard(dataDb: string): Promise<void>;
  /** Makes the state the store's current one, with its database when it was built in one. */
  adopt(state: { tables: Tables; schema: SchemaDescription; schemaDb: string; dataDb: string | null }): Promise<void>;
}

/** What a committed transaction changed. */
export interface Committed {
  /** The tables whose rows changed. */
  tables: string[];
  /** The data files written or removed, relative to the data folder. */
  files: string[];
  /** Each row added, changed or removed, before and after. */
  changes: RowChange[];
}

interface Draft {
  host: TransactionHost;
  tables: Tables;
  changed: Set<string>;
  schema: SchemaDescription;
  /** The rows a move gave new IDs and nothing else (DataFiles.carryRenames): they say nothing new, so the write rules pass them by. */
  renamed: WeakSet<Row>;
  /** The checks' run over the data before the write, for a command that reads it (CommandDefinition.checked). */
  checked: CheckedProblems | undefined;
}

const drafts = new WeakMap<Transaction, Draft>();

/** One write in progress: the tables as the command leaves them, read-only to everything but data-files.ts. */
export class Transaction implements ReadView {
  constructor(host: TransactionHost, checked?: CheckedProblems) {
    drafts.set(this, { host, tables: new Map(host.tables), changed: new Set(), schema: host.schema, renamed: new WeakSet(), checked });
  }

  /** The problems the checks found in the data as it was before this write, when the command's runner was given them; a command that reads them says so (CommandDefinition.checked). */
  get checkedProblems(): CheckedProblems | undefined {
    return drafts.get(this)!.checked;
  }

  /** The schema, Lathe's and the product's own kinds and relations. */
  get schema(): SchemaDescription {
    return drafts.get(this)!.schema;
  }

  /** A table's rows as the transaction has them, sorted by key. */
  rows(table: string): Row[] {
    const description = this.schema.tables[table];
    const rows = [...(drafts.get(this)!.tables.get(table)?.values() ?? [])];
    return description ? sortRows(description, rows) : rows;
  }

  /** The record with this ID, with its kind, or undefined. */
  record(id: string): { kind: string; row: Row } | undefined {
    const { tables } = drafts.get(this)!;
    for (const kind of Object.keys(this.schema.kinds)) {
      const row = tables.get(kind)?.get(id);
      if (row) return { kind, row };
    }
    return undefined;
  }

  /** Whether the row is one of Lathe's own, which no write changes. */
  isBuiltIn(row: Row): boolean {
    return drafts.get(this)!.host.builtIn.has(row);
  }

  /** Refuses the command: nothing changes, and the reason is reported under the rule's name. */
  refuse(rule: string, message: string): never {
    throw new StoreError([{ rule, message }]);
  }
}

/** The draft's tables, to change, and the rows a move only renamed: for data-files.ts only (a test holds it to that). */
export function draftOf(tx: Transaction): { tables: Tables; renamed: WeakSet<Row> } {
  const draft = drafts.get(tx)!;
  return { tables: draft.tables, renamed: draft.renamed };
}

/** Makes the table's rows the transaction's own copy, to change. */
export function editableTable(tx: Transaction, name: string): Map<string, Row> {
  const draft = drafts.get(tx)!;
  if (!draft.changed.has(name)) {
    draft.tables.set(name, new Map(draft.tables.get(name) ?? []));
    draft.changed.add(name);
  }
  return draft.tables.get(name)!;
}

/**
 * Commits the transaction: holds the new state to every key, check and rule, then rewrites the files of the tables
 * that changed, all or nothing, and makes it current. Nothing changes when anything is refused, or when the files
 * cannot be written (a write a crash leaves is settled by the next load or reload).
 */
export async function commit(tx: Transaction): Promise<Committed> {
  const draft = drafts.get(tx)!;
  const { host, tables, changed } = draft;
  const origins = host.origins;
  let schema = host.schema;
  let schemaDb = host.schemaDb;
  if (DECLARATION_TABLES.some((t) => changed.has(t))) {
    const built = await host.buildSchema(tables, origins);
    schemaDb = built.schemaDb;
    schema = built.schema;
    // Rows of product kinds are checked again against their (possibly changed) columns.
    const problems: StoreProblem[] = [];
    for (const name of Object.keys(schema.kinds).filter((k) => schema.kinds[k].productId !== null)) {
      for (const row of tables.get(name)?.values() ?? []) {
        const result = normalizeRow(schema.tables[name], row);
        if ('problem' in result) problems.push(problemAt(origins, row, { rule: 'column', table: name, key: String(row.id), message: result.problem }));
      }
    }
    for (const name of tables.keys()) {
      if (!schema.tables[name] && tables.get(name)!.size) problems.push({ rule: 'unknown-table', table: name, message: `${name} has rows but is no longer a kind or relation` });
    }
    if (problems.length) throw new StoreError(problems);
  }
  const names = [...changed].sort();
  const changes = rowChanges(schema, host.tables, tables, names);
  refuseWritten(schema, tables, origins, changes.filter((c) => !c.after || !draft.renamed.has(c.after)));
  const dataDb = await host.build(schemaDb, schema, tables, origins, changed);
  let files: string[];
  try {
    files = await writeFiles(host.dataDir, schema, tables, host.builtIn, origins, names);
  } catch (error) {
    // The files were not written, so the state is not adopted: its database is dropped, or it stays in memory.
    if (dataDb !== null) await host.discard(dataDb);
    throw error;
  }
  await host.adopt({ tables, schema, schemaDb, dataDb });
  return { tables: names, files, changes };
}

// Holds the rows the write adds or changes to the write rules (write-rules.ts), over the data as it leaves it, and
// refuses the write with every problem they find. A row a move only gave new IDs is not given: it says nothing new.
function refuseWritten(schema: SchemaDescription, tables: Tables, origins: WeakMap<Row, Origin>, changes: readonly RowChange[]): void {
  const view: ReadView = {
    schema,
    rows: (table) => [...(tables.get(table)?.values() ?? [])],
    record: (id) => {
      for (const kind of Object.keys(schema.kinds)) {
        const row = tables.get(kind)?.get(id);
        if (row) return { kind, row };
      }
      return undefined;
    },
  };
  const problems = WRITE_RULES.flatMap((rule) => rule.check(view, changes));
  if (problems.length) {
    throw new StoreError(problems.map((p) => problemAt(origins, p.row, { rule: p.rule, table: p.table, key: describeKey(schema.tables[p.table], p.row), message: p.message })));
  }
}

// The rows of the tables a write changed, before and after, paired by key.
function rowChanges(schema: SchemaDescription, before: Tables, after: Tables, names: string[]): RowChange[] {
  const changes: RowChange[] = [];
  for (const name of names) {
    const table = schema.tables[name];
    if (!table) continue;
    const old = before.get(name) ?? new Map<string, Row>();
    const now = after.get(name) ?? new Map<string, Row>();
    for (const row of sortRows(table, [...now.values()])) {
      const was = old.get(rowKey(table, row));
      if (!was) changes.push({ table: name, key: describeKey(table, row), before: null, after: row });
      else if (was !== row && JSON.stringify(was) !== JSON.stringify(row)) changes.push({ table: name, key: describeKey(table, row), before: was, after: row });
    }
    for (const row of sortRows(table, [...old.values()])) if (!now.has(rowKey(table, row))) changes.push({ table: name, key: describeKey(table, row), before: row, after: null });
  }
  return changes;
}

// Rewrites the files of the changed tables in one all-or-nothing write (journal.ts); a file whose text is unchanged is
// left as it is. An empty table has no file, and Lathe's own rows are never written into the product's folder.
async function writeFiles(dataDir: string, schema: SchemaDescription, tables: Tables, builtIn: WeakSet<Row>, origins: WeakMap<Row, Origin>, changed: string[]): Promise<string[]> {
  const changes: FileChange[] = [];
  for (const name of changed) {
    const file = `${name}.jsonl`;
    const full = path.join(dataDir, file);
    const rows = [...(tables.get(name)?.values() ?? [])].filter((row) => !builtIn.has(row));
    const table: TableDescription | undefined = schema.tables[name];
    if (!rows.length || !table) {
      if (existsSync(full)) changes.push({ file, text: null });
      continue;
    }
    const text = tableText(table, rows);
    const display = path.join(path.basename(dataDir), file);
    sortRows(table, rows).forEach((row, index) => origins.set(row, { file: display, line: index + 1 }));
    if (existsSync(full) && readFileSync(full, 'utf8') === text) continue;
    changes.push({ file, text });
  }
  await writeAll(dataDir, changes);
  return changes.map((c) => c.file);
}
