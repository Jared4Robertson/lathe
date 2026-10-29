// The generic write layer: add, set, move, link, unlink and remove over any table, named by table or relation. It is
// being replaced by each aggregate's own commands (authoring/<aggregate>/commands/) and is deleted at the cutover;
// nothing new calls it.
import { describeKey, normalizeRow, rowKey, type Row, type Value } from './rows.ts';
import type { SchemaDescription, TableDescription } from './schema.ts';
import { StoreError } from './problems.ts';
import { referrers, referrersText, type Located } from './references.ts';
import { DECLARATION_TABLES, draftOf, editableTable, rebuildSchema, type Tables, type Transaction } from './transaction.ts';

/** One write operation. A write is a list of them, applied together in one transaction. */
export type Command =
  /** Adds a row to a kind, part, declaration or checking table. A record's row carries its id and title. */
  | { op: 'add'; table: string; row: Row }
  /** Changes columns of a row; a value of null clears the column. Keys and a record's parent columns stay (see move). */
  | { op: 'set'; table: string; key: KeyInput; changes: Record<string, Value | null> }
  /** Moves a record under another parent, setting its parent column (and clearing the other, for a kind with two). */
  | { op: 'move'; id: string; parent: string }
  /** Links two records with a relation. */
  | { op: 'link'; relation: string; source: string; target: string }
  /** Removes a link. */
  | { op: 'unlink'; relation: string; source: string; target: string }
  /** Removes a row. A record goes with its parts and its own links; anything else that references it refuses it. */
  | { op: 'remove'; table: string; key: KeyInput };

/** A row's key: a record's ID, or the primary key columns of a part, declaration or checking row. */
export type KeyInput = string | Record<string, Value>;

const keyText = (key: KeyInput) => (typeof key === 'string' ? key : Object.entries(key).map(([c, v]) => `${c} ${v}`).join(', '));

function tableOf(schema: SchemaDescription, name: string): TableDescription {
  const table = schema.tables[name];
  if (!table) throw new StoreError([{ rule: 'unknown-table', message: `there is no table ${name}` }]);
  return table;
}

function find(tables: Tables, table: TableDescription, key: KeyInput): Row | undefined {
  const values: Row = typeof key === 'string' ? { [table.primaryKey[0]]: key } : key;
  if (typeof key === 'string' && table.primaryKey.length !== 1) return undefined;
  return tables.get(table.name)?.get(rowKey(table, values));
}

const kindOf = (schema: SchemaDescription, tables: Tables, id: string) => Object.keys(schema.kinds).find((k) => tables.get(k)?.has(id));

// What removing a row takes with it: a record's parts (and theirs), and the links it starts.
function removalSet(schema: SchemaDescription, tables: Tables, table: TableDescription, row: Row): Located[] {
  const removed: Located[] = [{ table: table.name, row }];
  if (table.role !== 'kind') return removed;
  const id = String(row.id);
  for (const t of Object.values(schema.tables)) {
    const rows = [...(tables.get(t.name)?.values() ?? [])];
    if (t.role === 'part' && t.ownerColumn) removed.push(...rows.filter((r) => r[t.ownerColumn!] === id).map((r) => ({ table: t.name, row: r })));
    if (t.role === 'link') removed.push(...rows.filter((r) => r.source_id === id).map((r) => ({ table: t.name, row: r })));
  }
  return removed;
}

/** Applies the commands to the transaction's draft, in order. */
export async function applyCommands(tx: Transaction, commands: Command[]): Promise<void> {
  const { tables: draft, origins, builtIn } = draftOf(tx);
  for (const [index, command] of commands.entries()) {
    const schema = tx.schema;
    const fail = (rule: string, message: string): never => {
      throw new StoreError([{ rule, message, command: index }]);
    };
    const place = (table: string, row: Row) => {
      editableTable(tx, table).set(rowKey(schema.tables[table], row), row);
      origins.set(row, { command: index });
    };
    if (command.op === 'add') {
      const table = tableOf(schema, command.table);
      if (!table.stored || table.role === 'link') fail('command', `add puts rows in kind, part, declaration and checking tables; ${table.name} is a ${table.role} table${table.role === 'link' ? ', so use link' : ''}`);
      const result = normalizeRow(table, command.row);
      if ('problem' in result) fail(result.problem.includes('is required') ? 'required' : 'column', result.problem);
      const row = (result as { row: Row }).row;
      const twin = draft.get(table.name)?.get(rowKey(table, row));
      if (twin) fail('primary-key', `${table.name} ${describeKey(table, row)} already exists${builtIn.has(twin) ? ` as one of Lathe's own (lathe/data/${table.name}.jsonl)` : ''}`);
      place(table.name, row);
    } else if (command.op === 'set') {
      const table = tableOf(schema, command.table);
      const current = find(draft, table, command.key) ?? fail('missing', `there is no ${table.name} ${keyText(command.key)}`);
      if (builtIn.has(current)) fail('built-in', `${table.name} ${describeKey(table, current)} is Lathe's own (lathe/data/${table.name}.jsonl), so it cannot change`);
      const parentColumns = new Set(schema.kinds[table.name]?.parents.map((p) => p.column) ?? []);
      const next: Record<string, unknown> = { ...current };
      for (const [column, value] of Object.entries(command.changes)) {
        if (table.primaryKey.includes(column)) fail('command', `${column} is part of the key of ${table.name}, which never changes; remove the row and add another`);
        if (parentColumns.has(column)) fail('command', `${column} places the record under its parent; use move`);
        next[column] = value;
      }
      const result = normalizeRow(table, next);
      if ('problem' in result) fail(result.problem.includes('is required') ? 'required' : 'column', result.problem);
      editableTable(tx, table.name).delete(rowKey(table, current));
      place(table.name, (result as { row: Row }).row);
    } else if (command.op === 'move') {
      // The column for the new parent's kind takes its ID, and the record's other parent column, if its kind has two,
      // is cleared. What sits inside the record moves with it unchanged.
      const kind = kindOf(schema, draft, command.id) ?? fail('missing', `there is no record ${command.id}`);
      const options = schema.kinds[kind].parents;
      if (!options.length) fail('command', `a ${kind} has no parent, so it cannot move`);
      const parentKind = kindOf(schema, draft, command.parent) ?? fail('parent', `there is no record ${command.parent}`);
      const chosen = options.find((p) => p.kind === parentKind) ?? fail('parent', `a ${kind} sits under ${options.map((p) => p.kind).join(' or ')}, not under ${parentKind} ${command.parent}`);
      const row = draft.get(kind)!.get(command.id)!;
      const next: Row = { ...row };
      for (const option of options) delete next[option.column];
      next[chosen.column] = command.parent;
      if (options.some((o) => next[o.column] !== row[o.column])) place(kind, next);
    } else if (command.op === 'link' || command.op === 'unlink') {
      const relation = schema.relations[command.relation] ?? fail('unknown-relation', `there is no relation ${command.relation}; the relations are ${Object.keys(schema.relations).join(', ')}`);
      const table = schema.tables[relation.name];
      const row: Row = { source_id: command.source, target_id: command.target };
      const exists = draft.get(table.name)?.has(rowKey(table, row));
      if (command.op === 'link') {
        if (exists) fail('primary-key', `${command.source} already ${relation.forwardLabel.toLowerCase()} ${command.target}`);
        place(table.name, row);
      } else {
        if (!exists) fail('missing', `${command.source} does not ${relation.name} ${command.target}`);
        editableTable(tx, table.name).delete(rowKey(table, row));
      }
    } else if (command.op === 'remove') {
      const table = tableOf(schema, command.table);
      const row = find(draft, table, command.key) ?? fail('missing', `there is no ${table.name} ${keyText(command.key)}`);
      if (builtIn.has(row)) fail('built-in', `${table.name} ${describeKey(table, row)} is Lathe's own (lathe/data/${table.name}.jsonl), so it cannot be removed`);
      const removed = removalSet(schema, draft, table, row);
      const found = referrers(schema, draft, removed);
      if (found.length) fail('referenced', `${table.name} ${describeKey(table, row)} is referenced, so it stays: ${referrersText(found)}`);
      for (const r of removed) editableTable(tx, r.table).delete(rowKey(schema.tables[r.table], r.row));
    }
    // A change to the product's own kinds or relations changes the schema the later commands see.
    if ((DECLARATION_TABLES as readonly string[]).includes('table' in command ? command.table : '') && index < commands.length - 1) await rebuildSchema(tx);
  }
}
