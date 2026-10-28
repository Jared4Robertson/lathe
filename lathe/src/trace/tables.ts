// Tables against the real schema: for each table record kept in a database (storage table, view or materialized
// view) that names a file, whether that file defines it as the spec says: its name, its columns (from its entity's or
// read model's fields) and its primary, unique and foreign keys. The engine puts one fact per expected part into
// table_facts before the checks run; the check table-schema-mismatch reports the parts the file lacks, and the
// coverage gap table-without-file a table stored as a table that names no file.
//
// It reads the file as text, never runs it, and recognizes:
// - CREATE [OR REPLACE] [TEMP|TEMPORARY] [MATERIALIZED] TABLE|VIEW [IF NOT EXISTS] <name>, in a SQL file or inside a
//   string in code, the name bare, quoted ("", ``, []) or schema-qualified;
// - a parenthesized body of column definitions: each column's name (its first word), and on it PRIMARY KEY, UNIQUE
//   and REFERENCES <table>; and the table constraints PRIMARY KEY (...), UNIQUE (...) and FOREIGN KEY (...)
//   REFERENCES <table>, with or without CONSTRAINT <name>;
// - an AS SELECT body (a view, or a table made from a query), up to the statement's end, after any WITH clauses: the
//   main SELECT list's columns, each the name an item gives with AS or a plain (qualified) column; an expression
//   with no AS names no column. SELECT * FROM a WITH clause's query takes that query's list. Any other star (t.*, or * from a
//   table) cannot say from the text what it brings, so then a column also counts when its name appears anywhere in
//   the body as a whole word;
// - CREATE UNIQUE INDEX <name> ON <table> (...) as a unique key, and ALTER TABLE <table> ADD [CONSTRAINT <name>]
//   PRIMARY KEY|UNIQUE|FOREIGN KEY ... as the key it adds.
// Names compare in any letter case. Keys compare by their set of columns, a foreign key also by its target table; a
// unique key's name and condition, index keys, column types, NOT NULL, CHECKs and which statement made the table (a
// view may be made by CREATE TABLE ... AS, as DuckDB has no materialized view) are not compared. An expression in an
// index's column list is not a column. Statements built at run time from pieces the text does not show are not seen.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Store } from '../store/store.ts';
import type { Row } from '../store/rows.ts';

/** What one CREATE TABLE or VIEW (and the indexes and ALTERs on it) in a file defines. */
export interface TableDefinition {
  name: string;
  /** The column names, lowercased, from column definitions and the SELECT lists of AS bodies. */
  columns: Set<string>;
  /** The text of AS bodies whose SELECT list has a star, lowercased, where a column counts when it appears as a whole word. */
  bodies: string[];
  keys: RecognizedKey[];
}

/** A key as the file states it: its columns lowercased, and for a foreign key its target table. */
export interface RecognizedKey {
  type: 'primary' | 'unique' | 'foreign' | 'index';
  columns: string[];
  target?: string;
}

/** One part of a table record the file should define, and whether it does. */
export interface TableFact {
  record: string;
  name: string;
  file: string;
  /** table: the table itself; column; or the key's type. */
  part: 'table' | 'column' | 'primary' | 'unique' | 'foreign';
  /** What is expected, as the message names it: the column, or the key's columns (and target). */
  expected: string;
  found: boolean;
}

/** The storages that live in a database, whose file is read for the table's definition. */
export const DATABASE_STORAGES = ['table', 'view', 'materialized view'];

/** table_facts, filled by the engine before the checks run. */
export const TABLE_FACTS_SQL = `CREATE OR REPLACE TABLE table_facts (record VARCHAR NOT NULL, name VARCHAR NOT NULL, file VARCHAR NOT NULL, part VARCHAR NOT NULL, expected VARCHAR NOT NULL, found BOOLEAN NOT NULL);`;

const IDENT = String.raw`(?:"[^"]+"|\x60[^\x60]+\x60|\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_$]*)`;
const QUALIFIED = `${IDENT}(?:\\s*\\.\\s*${IDENT})*`;

/** An identifier as compared: its last part, unquoted and lowercased. */
function bare(name: string): string {
  const last = new RegExp(`(${IDENT})\\s*$`).exec(name.trim())?.[1] ?? name;
  return last.trim().replace(/^["`[]|["`\]]$/g, '').toLowerCase();
}

/** The text from `open` (an opening parenthesis) to its match, without the parentheses; null when it never closes. */
function balanced(text: string, open: number): { inner: string; end: number } | null {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { inner: text.slice(open + 1, i), end: i + 1 };
  }
  return null;
}

/** Splits at commas outside parentheses, braces (a code template's interpolations) and quotes. */
function splitTop(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(' || c === '{') depth++;
    else if (c === ')' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const stripComments = (text: string) => text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** The plain column names in a key's column list; an expression is left out. */
function columnList(list: string): string[] {
  return splitTop(list)
    .map((c) => c.replace(/\s+(ASC|DESC|COLLATE\s+\S+)\s*$/i, '').trim())
    .filter((c) => new RegExp(`^${IDENT}$`).test(c))
    .map(bare);
}

/** The keys a table constraint states (PRIMARY KEY, UNIQUE, FOREIGN KEY ... REFERENCES), or none. */
function tableConstraint(text: string): RecognizedKey | null {
  const body = text.replace(new RegExp(`^CONSTRAINT\\s+${IDENT}\\s+`, 'i'), '');
  let m = /^PRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(body);
  if (m) return { type: 'primary', columns: columnList(m[1]) };
  m = /^UNIQUE(?:\s+(?:KEY|INDEX))?(?:\s+[A-Za-z_][A-Za-z0-9_]*)?\s*\(([^)]*)\)/i.exec(body);
  if (m) return { type: 'unique', columns: columnList(m[1]) };
  m = new RegExp(`^FOREIGN\\s+KEY\\s*\\(([^)]*)\\)\\s*REFERENCES\\s+(${QUALIFIED})`, 'i').exec(body);
  if (m) return { type: 'foreign', columns: columnList(m[1]), target: bare(m[2]) };
  return null;
}

const CONSTRAINT_START = /^(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|INDEX|KEY|EXCLUDE)\b/i;

/** Reads one parenthesized body of column definitions and table constraints into a definition. */
function readColumns(body: string, into: TableDefinition) {
  for (const element of splitTop(stripComments(body))) {
    if (CONSTRAINT_START.test(element)) {
      const key = tableConstraint(element);
      if (key) into.keys.push(key);
      continue;
    }
    const m = new RegExp(`^(${IDENT})`).exec(element);
    if (!m) continue;
    const column = bare(m[1]);
    into.columns.add(column);
    const rest = element.slice(m[0].length);
    if (/\bPRIMARY\s+KEY\b/i.test(rest)) into.keys.push({ type: 'primary', columns: [column] });
    if (/\bUNIQUE\b/i.test(rest)) into.keys.push({ type: 'unique', columns: [column] });
    const ref = new RegExp(`\\bREFERENCES\\s+(${QUALIFIED})`, 'i').exec(rest);
    if (ref) into.keys.push({ type: 'foreign', columns: [column], target: bare(ref[1]) });
  }
}

/** Where the word `word` first stands outside parentheses, braces and quotes in text, from `from`; -1 when nowhere. */
function topWord(text: string, word: string, from = 0): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(' || c === '{') depth++;
    else if (c === ')' || c === '}') depth--;
    else if (depth === 0 && text.startsWith(word, i) && !/[a-z0-9_]/.test(text[i - 1] ?? ' ') && !/[a-z0-9_]/.test(text[i + word.length] ?? ' ')) return i;
  }
  return -1;
}

/** The columns an AS body's main SELECT list names (after its WITH clauses), and whether it selects a star. */
function selectList(body: string, depth = 0): { columns: string[]; star: boolean } {
  const select = topWord(body, 'select');
  if (select < 0) return { columns: [], star: false };
  const start = select + 'select'.length;
  const from = topWord(body, 'from', start);
  const list = body.slice(start, from < 0 ? body.length : from).replace(/^\s*(distinct(\s+on\s*\([^)]*\))?|all)\b/, '');
  const columns: string[] = [];
  let star = false;
  for (const item of splitTop(list)) {
    const named = new RegExp(`\\bas\\s+(${IDENT})$`, 'i').exec(item);
    if (named) columns.push(bare(named[1]));
    else if (/(^|\.)\*$/.test(item)) star = true;
    else if (new RegExp(`^${QUALIFIED}$`).test(item)) columns.push(bare(item));
  }
  // SELECT * FROM a WITH clause's query: that query's list, in turn.
  const source = star && from >= 0 ? /^from\s+([a-z_][a-z0-9_]*)\s*(;|$)/.exec(body.slice(from).trim()) : null;
  const cte = source && depth < 4 ? new RegExp(`\\b${source[1]}\\s+as\\s*(?:(?:not\\s+)?materialized\\s*)?\\(`).exec(body) : null;
  const inner = cte ? balanced(body, cte.index + cte[0].length - 1) : null;
  if (inner) {
    const of = selectList(inner.inner, depth + 1);
    return { columns: [...columns, ...of.columns], star: of.star };
  }
  return { columns, star };
}

/** The index of the brace that closes the code template interpolation opening at `open`, counting nested braces. */
function interpolationEnd(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return text.length;
}

/**
 * Where a statement that starts at `from` ends: its first semicolon outside quotes, parentheses and a code template's
 * interpolations, a backtick that ends the template, or the end.
 */
function statementEnd(text: string, from: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '$' && text[i + 1] === '{') i = interpolationEnd(text, i + 1);
    else if (c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if ((c === ';' && depth === 0) || c === '`') return i;
  }
  return text.length;
}

/** Every table and view the text defines, by lowercased name, with the keys its indexes and ALTERs add. */
export function readDefinitions(text: string): Map<string, TableDefinition> {
  const found = new Map<string, TableDefinition>();
  const definition = (name: string) => {
    const key = bare(name);
    let d = found.get(key);
    if (!d) found.set(key, (d = { name: key, columns: new Set(), bodies: [], keys: [] }));
    return d;
  };
  const create = new RegExp(
    `\\bCREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:(?:TEMP|TEMPORARY|GLOBAL|LOCAL|UNLOGGED)\\s+)*(?:MATERIALIZED\\s+)?(?:TABLE|VIEW)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(${QUALIFIED})\\s*`,
    'gi',
  );
  for (const m of text.matchAll(create)) {
    const d = definition(m[1]);
    const after = m.index + m[0].length;
    if (text[after] === '(') {
      const block = balanced(text, after);
      if (block) readColumns(block.inner, d);
      continue;
    }
    if (/^AS\b/i.test(text.slice(after, after + 3))) {
      const body = stripComments(text.slice(after + 2, statementEnd(text, after))).toLowerCase();
      const selected = selectList(body);
      for (const c of selected.columns) d.columns.add(c);
      if (selected.star) d.bodies.push(body);
    }
  }
  const index = new RegExp(`\\bCREATE\\s+(UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:${QUALIFIED}\\s+)?ON\\s+(${QUALIFIED})\\s*(?:USING\\s+\\w+\\s*)?`, 'gi');
  for (const m of text.matchAll(index)) {
    const after = m.index + m[0].length;
    const block = text[after] === '(' ? balanced(text, after) : null;
    if (block) definition(m[2]).keys.push({ type: m[1] ? 'unique' : 'index', columns: columnList(block.inner) });
  }
  const alter = new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?(${QUALIFIED})\\s+ADD\\s+`, 'gi');
  for (const m of text.matchAll(alter)) {
    const after = m.index + m[0].length;
    const key = tableConstraint(text.slice(after, statementEnd(text, after)).trim());
    if (key) definition(m[1]).keys.push(key);
  }
  return found;
}

/** A field's column name when it gives none: its name lowercased, with every run of other characters an underscore. */
export function columnOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * The columns a table record expects, lowercased: its entity's fields with those of the children kept in its root's
 * table, or its read model's fields, each named by its column_name or else by its name. A field typed by a value
 * object of several fields is flattened into that value object's columns, in turn; one typed by a value object of one
 * field, an aggregate or a basic type is one column. A table under a domain has no fields, so no expected columns.
 */
export function expectedColumns(store: Store, table: Row): string[] {
  const valueObjectFields = new Map<string, Row[]>();
  for (const f of store.rows('value_object_field')) {
    const id = String(f.value_object_id);
    valueObjectFields.set(id, [...(valueObjectFields.get(id) ?? []), f]);
  }
  const columns: string[] = [];
  const add = (field: Row, seen: Set<string>) => {
    const vo = typeof field.type_value_object_id === 'string' ? field.type_value_object_id : null;
    const inner = vo ? (valueObjectFields.get(vo) ?? []) : [];
    if (vo && inner.length > 1 && !seen.has(vo)) {
      for (const f of inner) add(f, new Set([...seen, vo]));
      return;
    }
    columns.push(typeof field.column_name === 'string' ? field.column_name.toLowerCase() : columnOf(String(field.name)));
  };
  const byPosition = (rows: Row[]) => [...rows].sort((a, b) => Number(a.position) - Number(b.position));
  if (typeof table.entity_id === 'string') {
    const entity = store.rows('entity').find((e) => e.id === table.entity_id);
    const kept = store.rows('entity').filter((e) => e.id === table.entity_id || (entity && e.aggregate_id === entity.aggregate_id && e.in_root_table === true && entity.role === 'root'));
    for (const e of kept) for (const f of byPosition(store.rows('entity_field').filter((r) => r.entity_id === e.id))) add(f, new Set());
  } else if (typeof table.read_model_id === 'string') {
    for (const f of byPosition(store.rows('read_model_field').filter((r) => r.read_model_id === table.read_model_id))) add(f, new Set());
  }
  return [...new Set(columns)];
}

/** The text of a file, or of every file under a folder (a technical record's file may be a folder); null when missing. */
async function readTarget(resolved: string): Promise<string | null> {
  let info;
  try {
    info = await stat(resolved);
  } catch {
    return null;
  }
  if (info.isFile()) return readFile(resolved, 'utf8');
  if (!info.isDirectory()) return null;
  const texts: string[] = [];
  for (const entry of await readdir(resolved, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || entry.parentPath.split(path.sep).includes('node_modules')) continue;
    texts.push(await readFile(path.join(entry.parentPath, entry.name), 'utf8'));
  }
  return texts.join('\n;\n');
}

const sameColumns = (a: string[], b: string[]) => a.length === b.length && a.every((c) => b.includes(c));

/**
 * The facts for every table record kept in a database that names a file under root that exists: one for the table,
 * and, when the file defines it, one for each expected column and key. A missing file has no facts
 * (technical-file-missing reports it).
 */
export async function gatherTableFacts(root: string, store: Store): Promise<TableFact[]> {
  const tables = store.rows('table').filter((t) => DATABASE_STORAGES.includes(String(t.storage)) && typeof t.file === 'string');
  if (tables.length === 0) return [];
  const nameOf = new Map(store.rows('table').map((t) => [String(t.id), String(t.name)]));
  const keysOf = new Map<string, Row[]>();
  for (const k of store.rows('table_key')) keysOf.set(String(k.table_id), [...(keysOf.get(String(k.table_id)) ?? []), k]);
  const texts = new Map<string, Promise<Map<string, TableDefinition> | null>>();
  const definitions = (file: string) => {
    let known = texts.get(file);
    if (!known) {
      const resolved = path.resolve(root, file);
      const inside = !path.relative(root, resolved).startsWith('..');
      known = inside ? readTarget(resolved).then((t) => (t === null ? null : readDefinitions(t))) : Promise.resolve(null);
      texts.set(file, known);
    }
    return known;
  };
  const facts: TableFact[] = [];
  for (const table of tables) {
    const record = String(table.id);
    const name = String(table.name);
    const file = String(table.file);
    const defined = await definitions(file);
    if (!defined) continue;
    const d = defined.get(bare(name));
    const fact = (part: TableFact['part'], expected: string, found: boolean) => facts.push({ record, name, file, part, expected, found });
    fact('table', name, d !== undefined);
    if (!d) continue;
    const hasColumn = (column: string) =>
      d.columns.has(column) || d.bodies.some((b) => new RegExp(`(?<![a-z0-9_])${column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9_])`).test(b));
    for (const column of expectedColumns(store, table)) fact('column', column, hasColumn(column));
    for (const key of keysOf.get(record) ?? []) {
      const type = String(key.type);
      if (type !== 'primary' && type !== 'unique' && type !== 'foreign') continue;
      const columns = (key.columns as string[]).map((c) => c.toLowerCase());
      const target = type === 'foreign' ? (nameOf.get(String(key.target_table_id)) ?? '').toLowerCase() : undefined;
      const found = d.keys.some((k) => k.type === type && sameColumns(k.columns, columns) && (target === undefined || k.target === target));
      fact(type, `(${columns.join(', ')})${target ? ` referencing ${target}` : ''}`, found);
    }
  }
  return facts;
}
