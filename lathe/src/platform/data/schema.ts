// The schema: the numbered SQL migrations in lathe/schema/, applied in order, and a description of the tables they
// make, read back from the database itself (its tables, columns, keys, checks and comments, and the meta_* rows).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { DuckDBConnection } from '@duckdb/node-api';
import { PACKAGE_DIR } from '../../config.ts';

/** The folder of numbered SQL migrations, such as 001-meta.sql. */
export const SCHEMA_DIR = path.join(PACKAGE_DIR, 'schema');

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Every migration in SCHEMA_DIR, in order. A file not named <number>-<name>.sql is an error. */
export function readMigrations(dir = SCHEMA_DIR): Migration[] {
  const migrations = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const match = /^(\d+)-[a-z0-9-]+\.sql$/.exec(file);
      if (!match) throw new Error(`${path.join(dir, file)}: a migration is named <number>-<name>.sql, such as 001-meta.sql.`);
      return { version: Number(match[1]), name: file, sql: readFileSync(path.join(dir, file), 'utf8') };
    })
    .sort((a, b) => a.version - b.version);
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version === migrations[i - 1].version) {
      throw new Error(`${dir}: migrations ${migrations[i - 1].name} and ${migrations[i].name} have the same number.`);
    }
  }
  return migrations;
}

/** Applies every migration in order to the connection's current database, recording each in meta_migration. */
export async function applyMigrations(connection: DuckDBConnection, migrations = readMigrations()): Promise<void> {
  for (const migration of migrations) {
    try {
      await connection.run(migration.sql);
    } catch (error) {
      throw new Error(`Migration ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await connection.run(`INSERT INTO meta_migration VALUES (${migration.version}, ${sqlString(migration.name)})`);
  }
}

/** What a table is for (meta_table.role). Only kind, part, link, declaration and checking tables are stored. */
export type TableRole = 'meta' | 'registry' | 'supertype' | 'kind' | 'part' | 'link' | 'declaration' | 'checking' | 'result';

/** The roles whose rows are kept in data/<table>.jsonl. */
export const STORED_ROLES: readonly TableRole[] = ['kind', 'part', 'link', 'declaration', 'checking'];

/** How a column's values are written in a data file: text, a whole number, true/false, a YYYY-MM-DD date, one of an
 *  enum's values, or a list of texts. */
export type ColumnKind = 'text' | 'integer' | 'boolean' | 'date' | 'enum' | 'text_list';

export interface ColumnDescription {
  name: string;
  /** The SQL type, such as VARCHAR or ENUM('root', 'child'). */
  sqlType: string;
  kind: ColumnKind;
  /** For an enum, its values in order. */
  values?: string[];
  /** Whether every row must give it (NOT NULL). */
  required: boolean;
  description: string | null;
}

export interface ForeignKey {
  columns: string[];
  table: string;
  references: string[];
}

export interface TableDescription {
  name: string;
  role: TableRole;
  /** Whether its rows are kept in a data file. */
  stored: boolean;
  description: string | null;
  /** For a part table, the column naming the record each row belongs to. */
  ownerColumn: string | null;
  /** Columns in their fixed order, which is also their order in a data file's lines. */
  columns: ColumnDescription[];
  primaryKey: string[];
  unique: string[][];
  foreignKeys: ForeignKey[];
  /** CHECK constraint expressions, such as (position >= 1). */
  checks: string[];
}

/** A stage, in the order a product is modeled; links run from what is defined first to what is defined later. */
export type Stage = 'discovery' | 'domain-model' | 'use-cases' | 'interaction-design' | 'technical-specification' | 'test-plan';

/**
 * Whether a kind's records are essential complexity (decided once per product), accidental (from the means used to
 * build it), as the record they sit under (as-parent), or as their own type says (by-type: a standard).
 */
export type Complexity = 'essential' | 'accidental' | 'as-parent' | 'by-type';

/** What a kind's IDs start with, followed by a hyphen: its product's ID, its domain's ID or its parent's ID. */
export type IdScope = 'product' | 'domain' | 'parent';

/** What a link's two ends must share. */
export type LinkScope = 'product' | 'domain' | 'aggregate';

export interface KindParent {
  kind: string;
  column: string;
}

export interface KindDescription {
  name: string;
  label: string;
  /** The stage its records belong to; null for product and open question. */
  stage: Stage | null;
  /** Whether its records are obligations: designed, built and proved. */
  obligation: boolean;
  /** Whether its records are essential or accidental complexity, or follow their parent or type; null for an open question. */
  complexity: Complexity | null;
  idPattern: string | null;
  idExample: string | null;
  /** What its IDs start with; null when its IDs are free (a product's own kind). */
  idScope: IdScope | null;
  /** For a product's own kind, the product that declares it. */
  productId: string | null;
  /** Its place in the order people read kinds, from 1 (meta_kind.position); null for a product's own kind, which follows Lathe's by name. */
  position: number | null;
  description: string | null;
  /**
   * The kinds its records may sit under, and the column naming each. A record has exactly one parent: a kind with two
   * (an endpoint under a command or a query, a table under an entity or a read model) gives a value in exactly one
   * column. Empty for a product and for a kind with no owner (value object, specification, view, integration, UI
   * component), whose product, or domain, follows from its ID.
   */
  parents: KindParent[];
  /** The supertype tables its records are members of. */
  supertypes: string[];
  /** For a code-bound kind, how its titles are written (meta_kind_title); null for a kind titled in words. */
  titleForm: TitleForm | null;
}

/** How a code-bound kind's titles are written: one identifier, an invocation, or a kebab-case name. */
type TitleForm = 'identifier' | 'invocation' | 'kebab-case';

export interface RelationPair {
  source: string;
  /** A kind, or * for any record. */
  target: string;
  description: string;
}

export interface RelationDescription {
  name: string;
  role: 'design' | 'build' | 'proof' | null;
  /** What its two ends must share: product (every link), domain or aggregate. */
  scope: LinkScope;
  forwardLabel: string;
  reverseLabel: string;
  productId: string | null;
  description: string | null;
  /** The table source_id points at: a kind's table or a supertype. */
  sourceTable: string;
  /** The table target_id points at: a kind's table, a supertype, or record_id for any record. */
  targetTable: string;
  pairs: RelationPair[];
}

export interface StageDescription {
  name: Stage;
  /** Its place in the order, from 1. */
  position: number;
  label: string;
  description: string;
}

export interface SchemaDescription {
  /** Every table by name. */
  tables: Record<string, TableDescription>;
  /** The stored tables in dependency order: a table comes after every table its foreign keys point at. */
  loadOrder: string[];
  kinds: Record<string, KindDescription>;
  relations: Record<string, RelationDescription>;
  /** Each supertype table with its member kinds. */
  supertypes: Record<string, string[]>;
  /** The stages, in order. */
  stages: StageDescription[];
}

/** A SQL string literal. */
export const sqlString = (text: string) => `'${text.replaceAll("'", "''")}'`;
/** A quoted SQL identifier, so names such as check, view or when are safe. */
export const sqlName = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function rows<T>(connection: DuckDBConnection, sql: string): Promise<T[]> {
  return (await connection.runAndReadAll(sql)).getRowObjectsJson() as unknown as T[];
}

// Reads ENUM('a', 'b') into its values.
function enumValues(sqlType: string): string[] {
  return [...sqlType.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replaceAll("''", "'"));
}

function columnKind(sqlType: string): ColumnKind {
  if (sqlType.startsWith('ENUM(')) return 'enum';
  switch (sqlType) {
    case 'VARCHAR':
      return 'text';
    case 'INTEGER':
      return 'integer';
    case 'BOOLEAN':
      return 'boolean';
    case 'DATE':
      return 'date';
    case 'VARCHAR[]':
      return 'text_list';
    default:
      throw new Error(`The schema uses the column type ${sqlType}, which data files cannot hold.`);
  }
}

// Orders tables so each comes after the tables its foreign keys point at (a table's keys to itself aside).
function dependencyOrder(tables: Record<string, TableDescription>): string[] {
  const order: string[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string, trail: string[]) => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting') throw new Error(`The schema's foreign keys form a cycle: ${[...trail, name].join(' -> ')}.`);
    state.set(name, 'visiting');
    for (const fk of tables[name].foreignKeys) if (fk.table !== name) visit(fk.table, [...trail, name]);
    state.set(name, 'done');
    order.push(name);
  };
  for (const name of Object.keys(tables).sort()) visit(name, []);
  return order;
}

/** Describes the schema of the connection's current database: every table, kind, relation, supertype and stage. */
export async function describeSchema(connection: DuckDBConnection): Promise<SchemaDescription> {
  const [db] = await rows<{ db: string }>(connection, 'SELECT current_database() AS db');
  const where = `database_name = ${sqlString(db.db)} AND schema_name = 'main'`;
  const metaTables = await rows<{ name: string; role: TableRole; owner_column: string | null }>(connection, 'SELECT * FROM meta_table');
  const tableComments = new Map(
    (await rows<{ table_name: string; comment: string | null }>(connection, `SELECT table_name, comment FROM duckdb_tables() WHERE ${where}`)).map(
      (t) => [t.table_name, t.comment],
    ),
  );
  const columns = await rows<{ table_name: string; column_name: string; data_type: string; is_nullable: boolean; comment: string | null }>(
    connection,
    `SELECT table_name, column_name, data_type, is_nullable, comment FROM duckdb_columns() WHERE ${where}
       AND table_name IN (SELECT table_name FROM duckdb_tables() WHERE ${where}) ORDER BY table_name, column_index`,
  );
  const constraints = await rows<{
    table_name: string;
    constraint_type: string;
    constraint_column_names: string[];
    referenced_table: string | null;
    referenced_column_names: string[];
    expression: string | null;
  }>(
    connection,
    `SELECT table_name, constraint_type, constraint_column_names, referenced_table, referenced_column_names, expression
       FROM duckdb_constraints() WHERE ${where} ORDER BY table_name, constraint_index`,
  );

  const tables: Record<string, TableDescription> = {};
  for (const meta of metaTables) {
    if (!tableComments.has(meta.name)) throw new Error(`meta_table names ${meta.name}, which is not a table.`);
    tables[meta.name] = {
      name: meta.name,
      role: meta.role,
      stored: STORED_ROLES.includes(meta.role),
      description: tableComments.get(meta.name) ?? null,
      ownerColumn: meta.owner_column,
      columns: [],
      primaryKey: [],
      unique: [],
      foreignKeys: [],
      checks: [],
    };
  }
  for (const name of tableComments.keys()) {
    if (!tables[name]) throw new Error(`The table ${name} has no meta_table row saying what it is for.`);
  }
  for (const c of columns) {
    const kind = columnKind(c.data_type);
    tables[c.table_name].columns.push({
      name: c.column_name,
      sqlType: c.data_type,
      kind,
      ...(kind === 'enum' ? { values: enumValues(c.data_type) } : {}),
      required: !c.is_nullable,
      description: c.comment,
    });
  }
  for (const c of constraints) {
    const table = tables[c.table_name];
    if (c.constraint_type === 'PRIMARY KEY') table.primaryKey = c.constraint_column_names;
    else if (c.constraint_type === 'UNIQUE') table.unique.push(c.constraint_column_names);
    else if (c.constraint_type === 'FOREIGN KEY' && c.referenced_table) {
      table.foreignKeys.push({ columns: c.constraint_column_names, table: c.referenced_table, references: c.referenced_column_names });
    } else if (c.constraint_type === 'CHECK' && c.expression) table.checks.push(c.expression);
  }

  const supertypes: Record<string, string[]> = {};
  for (const m of await rows<{ supertype: string; kind: string }>(connection, 'SELECT * FROM meta_supertype_member ORDER BY supertype, kind')) {
    (supertypes[m.supertype] ??= []).push(m.kind);
  }
  const parents = await rows<{ kind: string; parent_kind: string; column_name: string }>(
    connection,
    'SELECT kind, parent_kind, column_name FROM meta_kind_parent ORDER BY kind, position',
  );
  const titleForms = new Map(
    (await rows<{ kind: string; form: TitleForm }>(connection, 'SELECT kind, form FROM meta_kind_title')).map((t) => [t.kind, t.form]),
  );
  const kinds: Record<string, KindDescription> = {};
  for (const k of await rows<{
    name: string;
    label: string;
    stage: Stage | null;
    position: number | null;
    obligation: boolean;
    id_pattern: string | null;
    id_example: string | null;
    id_scope: IdScope | null;
    product_id: string | null;
    complexity: Complexity | null;
  }>(connection, 'SELECT * FROM meta_kind ORDER BY name')) {
    if (tables[k.name]?.role !== 'kind') throw new Error(`The kind ${k.name} has no kind table of the same name.`);
    kinds[k.name] = {
      name: k.name,
      label: k.label,
      stage: k.stage,
      obligation: k.obligation,
      complexity: k.complexity,
      idPattern: k.id_pattern,
      idExample: k.id_example,
      idScope: k.id_scope,
      productId: k.product_id,
      position: k.position === null ? null : Number(k.position),
      description: tables[k.name].description,
      parents: parents.filter((p) => p.kind === k.name).map((p) => ({ kind: p.parent_kind, column: p.column_name })),
      supertypes: Object.keys(supertypes).filter((s) => supertypes[s].includes(k.name)),
      titleForm: titleForms.get(k.name) ?? null,
    };
  }
  const pairs = await rows<{ relation: string; source_kind: string; target_kind: string; description: string }>(
    connection,
    'SELECT * FROM meta_relation_pair ORDER BY relation, source_kind, target_kind',
  );
  const relations: Record<string, RelationDescription> = {};
  for (const r of await rows<{ name: string; role: 'design' | 'build' | 'proof' | null; scope: LinkScope; forward_label: string; reverse_label: string; product_id: string | null }>(
    connection,
    'SELECT * FROM meta_relation ORDER BY name',
  )) {
    const table = tables[r.name];
    if (table?.role !== 'link') throw new Error(`The relation ${r.name} has no link table of the same name.`);
    const end = (column: string) => table.foreignKeys.find((fk) => fk.columns.length === 1 && fk.columns[0] === column)?.table ?? 'record_id';
    relations[r.name] = {
      name: r.name,
      role: r.role,
      scope: r.scope,
      forwardLabel: r.forward_label,
      reverseLabel: r.reverse_label,
      productId: r.product_id,
      description: table.description,
      sourceTable: end('source_id'),
      targetTable: end('target_id'),
      pairs: pairs.filter((p) => p.relation === r.name).map((p) => ({ source: p.source_kind, target: p.target_kind, description: p.description })),
    };
  }
  const stages = (await rows<StageDescription>(connection, 'SELECT * FROM meta_stage ORDER BY position')).map((s) => ({
    ...s,
    position: Number(s.position),
  }));
  const loadOrder = dependencyOrder(tables).filter((name) => tables[name].stored);
  return { tables, loadOrder, kinds, relations, supertypes, stages };
}
