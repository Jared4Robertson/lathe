// What every aggregate's command and query is defined with: its record ID, its names on each interface, its input
// (each field read from the schema's own column, or a list or one of record IDs), and its handler. Each aggregate lists
// its definitions in its commands/index.ts; the CLI, the MCP server and the HTTP API register each one by name, so a
// route or tool always runs the one command it names and nothing is dispatched by a table or kind.
import { valueProblem, type Row, type Value } from '../data/rows.ts';
import type { ColumnDescription, SchemaDescription } from '../data/schema.ts';
import type { ReadView } from '../data/rules.ts';
import type { TableName } from '../data/tables.ts';
import type { Transaction } from '../data/transaction.ts';

/** Whether a field must be given; an optional one may also be cleared with null (a Change's optional column). */
type Mode = 'required' | 'optional' | 'clearable';
type Flags<M extends Mode> = M extends 'required' ? { required: true; clearable: false } : M extends 'optional' ? { required: false; clearable: false } : { required: false; clearable: true };

/** A field that is a column of one of the schema's tables: its type and meaning are the column's. */
interface ColumnField {
  kind: 'column';
  table: TableName;
  column: string;
}

/** A field that names one record by its ID (such as the view a step happens in), or a list of them, or of texts. */
interface IdField {
  kind: 'id' | 'ids' | 'texts';
  description: string;
}

/**
 * A field that is a record's part rows, in order (such as an entity's fields): each item a row of the part table's own
 * columns but its owner and its position, which the record and the item's place in the list give.
 */
interface PartsField {
  kind: 'parts';
  table: TableName;
  description: string;
}

/** One field of a command's or query's input. */
export type Field = (ColumnField | IdField | PartsField) & { required: boolean; clearable: boolean };

/** The field for a value of type V: required unless V may be undefined, and clearable only when V may be null. */
type FieldFor<V> = Field & { required: undefined extends V ? false : true; clearable: null extends V ? true : false };

/** An input type's fields, one per property of the type and no other, each required and clearable as the type is. */
export type InputSpec<T> = { [K in keyof T]-?: FieldFor<T[K]> };

/** A column of the table, as an input field. */
export function column<M extends Mode>(table: TableName, name: string, mode: M): ColumnField & Flags<M> {
  return { kind: 'column', table, column: name, ...flags(mode) };
}

/** One record's ID. */
export function id<M extends Mode>(description: string, mode: M): IdField & Flags<M> {
  return { kind: 'id', description, ...flags(mode) };
}

/** A list of record IDs; an empty list clears it. */
export function ids<M extends Exclude<Mode, 'clearable'>>(description: string, mode: M): IdField & Flags<M> {
  return { kind: 'ids', description, ...flags(mode) };
}

/** A list of texts; an empty list clears it. */
export function texts<M extends Exclude<Mode, 'clearable'>>(description: string, mode: M): IdField & Flags<M> {
  return { kind: 'texts', description, ...flags(mode) };
}

/** A record's part rows, in order: the list replaces its parts, and an empty list clears them. */
export function parts<M extends Exclude<Mode, 'clearable'>>(table: TableName, description: string, mode: M): PartsField & Flags<M> {
  return { kind: 'parts', table, description, ...flags(mode) };
}

function flags<M extends Mode>(mode: M): Flags<M> {
  return { required: mode === 'required', clearable: mode === 'clearable' } as Flags<M>;
}

/** What an aggregate's commands and queries are reached by: `lathe use-case`, the use_case_ tools, /api/use-case/. */
export interface Slice {
  /** The aggregate's record ID, such as LA-AUT-A11. */
  aggregate: string;
  /** Its name in kebab case, such as use-case. */
  name: string;
}

/** One command: what it is in the model, how each interface names it, its input and its handler. */
export interface CommandDefinition<T = never> {
  /** The command's record ID, such as LA-AUT-CMD112. */
  id: string;
  slice: Slice;
  /** Its name in kebab case, such as add-flow-step: `lathe use-case add-flow-step`, tool use_case_add_flow_step. */
  name: string;
  /** What it does, for the help and the tool's description. */
  description: string;
  /** Its HTTP method and route, written whole so the route is found in this file: POST /api/<slice>/<name>. */
  method: 'POST';
  route: string;
  input: InputSpec<T>;
  /** Loads its aggregate through its repository, runs the aggregate's rules, saves, and raises its event. */
  handler: (tx: Transaction, input: T) => void | Promise<void>;
}

/** One query: how each interface names it, its input, and what it reads. */
export interface QueryDefinition<T = never, R = unknown> {
  /** The query's record ID, such as LA-AUT-QRY100. */
  id: string;
  slice: Slice;
  name: string;
  description: string;
  input: InputSpec<T>;
  /** Reads the answer, or refuses with a reason. */
  run: (view: ReadView, input: T) => R;
  /** The answer as text, as the CLI prints it and the tool returns it. */
  text: (answer: R) => string;
}

/** Any command, as the interfaces register it: its input's type is known only to its own handler. */
export type AnyCommand = Omit<CommandDefinition, 'input' | 'handler'> & { input: Record<string, Field>; handler: (tx: Transaction, input: never) => void | Promise<void> };

/** Any query, as the interfaces register it. */
export type AnyQuery = Omit<QueryDefinition, 'input' | 'run' | 'text'> & { input: Record<string, Field>; run: (view: ReadView, input: never) => unknown; text: (answer: never) => string };

/** A definition's MCP tool name: its slice and name in snake case, such as use_case_add_flow_step. */
export const toolName = (definition: { slice: Slice; name: string }): string => `${definition.slice.name}_${definition.name}`.replaceAll('-', '_');

/** An input that is not of the definition's shape: refused before anything is read or written. */
export class InputError extends Error {}

// The column a field reads its type and meaning from.
function columnOf(schema: SchemaDescription, field: ColumnField): ColumnDescription {
  const found = schema.tables[field.table]?.columns.find((c) => c.name === field.column);
  if (!found) throw new Error(`${field.table} has no column ${field.column}`);
  return found;
}

/** The input checked against the definition's fields: every field known, every required one given, each of its type. */
export function parseInput(schema: SchemaDescription, definition: { name: string; input: Record<string, Field> }, args: unknown): never {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) throw new InputError(`${definition.name} takes a JSON object`);
  const given = args as Record<string, unknown>;
  const fields = definition.input;
  const unknown = Object.keys(given).filter((name) => !(name in fields));
  if (unknown.length) throw new InputError(`${definition.name} takes no ${unknown.join(', ')}; it takes ${Object.keys(fields).join(', ')}`);
  const input: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = given[name];
    if (value === undefined || (value === null && !field.clearable)) {
      if (field.required) throw new InputError(`${definition.name} needs ${name}`);
      if (value === null) throw new InputError(`${name} cannot be cleared; leave it out to keep it`);
      continue;
    }
    if (value !== null) {
      const problem = fieldProblem(schema, field, value);
      if (problem) throw new InputError(`${name} ${JSON.stringify(value)} ${problem}`);
    }
    input[name] = value;
  }
  return input as never;
}

// The columns an item of a parts field gives: the part table's own, but its owner and its position.
function partColumns(schema: SchemaDescription, field: PartsField): ColumnDescription[] {
  const table = schema.tables[field.table];
  if (!table?.ownerColumn) throw new Error(`${field.table} is not a part table`);
  return table.columns.filter((c) => c.name !== table.ownerColumn && c.name !== 'position');
}

// The first problem of a parts field's item, or null.
function partProblem(schema: SchemaDescription, field: PartsField, item: unknown, at: number): string | null {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return `item ${at} is not a JSON object`;
  const columns = partColumns(schema, field);
  const given = item as Record<string, unknown>;
  const unknown = Object.keys(given).filter((name) => !columns.some((c) => c.name === name));
  if (unknown.length) return `item ${at} has no ${unknown.join(', ')}; an item takes ${columns.map((c) => c.name).join(', ')}`;
  for (const column of columns) {
    const value = given[column.name];
    if (value === undefined || value === null) {
      if (column.required) return `item ${at} needs ${column.name}`;
      continue;
    }
    const problem = valueProblem(column, value);
    if (problem) return `item ${at} ${column.name} ${JSON.stringify(value)} ${problem}`;
  }
  return null;
}

function fieldProblem(schema: SchemaDescription, field: Field, value: unknown): string | null {
  switch (field.kind) {
    case 'parts':
      if (!Array.isArray(value)) return `is not a list of ${field.table} rows`;
      for (const [at, item] of value.entries()) {
        const problem = partProblem(schema, field, item, at + 1);
        if (problem) return problem;
      }
      return null;
    case 'column':
      return valueProblem(columnOf(schema, field), value);
    case 'id':
      return typeof value === 'string' && value.trim() !== '' ? null : 'is not a record ID';
    case 'ids':
    case 'texts':
      return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim() !== '') ? null : `is not a list of ${field.kind === 'ids' ? 'record IDs' : 'texts'}`;
  }
}

type JsonSchema = { [key: string]: unknown };

/** A field's JSON schema, with its meaning: the column's own description, for a column. */
function fieldSchema(schema: SchemaDescription, field: Field): JsonSchema {
  const nullable = (s: JsonSchema): JsonSchema =>
    field.clearable ? { ...s, type: [s.type, 'null'], ...(s.enum ? { enum: [...(s.enum as unknown[]), null] } : {}) } : s;
  if (field.kind === 'id') return nullable({ type: 'string', minLength: 1, description: field.description });
  if (field.kind === 'parts') {
    const columns = partColumns(schema, field);
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: Object.fromEntries(columns.map((c) => [c.name, columnSchema(c)])),
        required: columns.filter((c) => c.required).map((c) => c.name),
        additionalProperties: false,
      },
      description: field.description,
    };
  }
  if (field.kind !== 'column') return { type: 'array', items: { type: 'string', minLength: 1 }, description: field.description };
  return nullable(columnSchema(columnOf(schema, field)));
}

/** A column's JSON schema: its type, with the column's own description. */
function columnSchema(c: ColumnDescription): JsonSchema {
  const typed: JsonSchema = (() => {
    switch (c.kind) {
      case 'integer':
        return { type: 'integer' };
      case 'boolean':
        return { type: 'boolean' };
      case 'date':
        return { type: 'string', format: 'date' };
      case 'enum':
        return { type: 'string', enum: c.values! };
      case 'text_list':
        return { type: 'array', items: { type: 'string', minLength: 1 } };
      default:
        return { type: 'string', minLength: 1 };
    }
  })();
  return { ...typed, ...(c.description ? { description: c.description } : {}) };
}

/** The input's JSON schema, for the MCP tool: one property per field, the required ones listed. */
export function inputSchema(schema: SchemaDescription, input: Record<string, Field>): JsonSchema {
  const fields = Object.entries(input);
  return {
    type: 'object',
    properties: Object.fromEntries(fields.map(([name, field]) => [name, fieldSchema(schema, field)])),
    required: fields.filter(([, field]) => field.required).map(([name]) => name),
    additionalProperties: false,
  };
}

/** A field as a CLI flag's help line: its type, whether it is required, and what it means. */
export function fieldHelp(schema: SchemaDescription, name: string, field: Field): string {
  const s = fieldSchema(schema, field);
  const column = field.kind === 'column' ? columnOf(schema, field) : null;
  const type =
    field.kind === 'parts'
      ? `list of ${field.table} rows as JSON objects (${partColumns(schema, field).map((c) => c.name).join(', ')}), the flag once per item`
      : field.kind === 'ids' || field.kind === 'texts'
        ? 'list, the flag once per item' : !column ? 'record ID' : column.kind === 'enum' ? `one of ${column.values!.join(', ')}` : column.kind;
  const notes = [type, ...(field.required ? ['required'] : []), ...(field.clearable ? ['"" clears it'] : [])];
  return `  --${name.padEnd(24)} ${notes.join(', ')}. ${String(s.description ?? '')}`.trimEnd();
}

/** A CLI flag's texts as the field's value: a number, true or false, a list, or text; "" clears a clearable field. */
export function flagValue(schema: SchemaDescription, name: string, field: Field, raw: string[]): Value | Row[] | null {
  if (field.kind === 'parts') {
    if (raw.length === 1 && raw[0] === '') return [];
    return raw.map((text, at) => {
      try {
        return JSON.parse(text) as Row;
      } catch {
        throw new InputError(`--${name} item ${at + 1} is not a JSON object: ${text}`);
      }
    });
  }
  const list = field.kind === 'ids' || field.kind === 'texts' || (field.kind === 'column' && columnOf(schema, field).kind === 'text_list');
  if (list) return raw.length === 1 && raw[0] === '' ? [] : raw;
  if (raw.length > 1) throw new InputError(`--${name} is given ${raw.length} times; it takes one value`);
  const text = raw[0];
  if (text === '' && field.clearable) return null;
  if (field.kind === 'column') {
    const kind = columnOf(schema, field).kind;
    if (kind === 'integer') {
      if (!/^-?\d+$/.test(text)) throw new InputError(`--${name} ${JSON.stringify(text)} is not a whole number`);
      return Number(text);
    }
    if (kind === 'boolean') {
      if (text !== 'true' && text !== 'false') throw new InputError(`--${name} ${JSON.stringify(text)} is not true or false`);
      return text === 'true';
    }
  }
  return text;
}
