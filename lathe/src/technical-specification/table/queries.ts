// The Table aggregate's own reads, each answered from its read model (LA-TEC-RM38) through its reader (reader.ts),
// which the query runner gives each handler: a table whole as its page reads it, the tables under a parent, and the
// next free ID for a table. A handler never sees the data, a repository or the aggregate's model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { TablePage, TableSummary } from './read-model.ts';
import { tableReader, type TableReader } from './reader.ts';
import { GET_TABLE_IDENTITY, LIST_TABLES_IDENTITY, NEXT_TABLE_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The table with this ID, whole, as its page reads it. */
export function getTable(reader: TableReader, input: { id: string }): TablePage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a table`);
}

/** GET a table whole (LA-TEC-QRY185). */
export const GET_TABLE: QueryDefinition<{ id: string }, TablePage, TableReader> = {
  ...GET_TABLE_IDENTITY,
  input: { id: id('The table.', 'required') },
  reader: tableReader,
  run: getTable,
  text: tableText,
};

/** The kinds a table sits under. */
const PARENT_KINDS: readonly string[] = ['entity', 'read_model', 'domain'];

/** Refuses a parent that is not an entity, a read model or a domain, naming what it is. */
function parentKindOf(reader: TableReader, parent: string): string {
  const kind = reader.kindOf(parent);
  if (!kind || !PARENT_KINDS.includes(kind)) refuse('parent', `a table sits under an entity, a read model or a domain, and ${parent} is ${kind ? `${article(kind)} ${kind}` : 'no record'}`);
  return kind!;
}

/** The tables under a parent (an entity, a read model or a domain), by ID. */
export function listTables(reader: TableReader, input: { parent: string }): TableSummary[] {
  parentKindOf(reader, input.parent);
  return reader.tablesUnder(input.parent);
}

/** List the tables under a parent (LA-TEC-QRY186). */
export const LIST_TABLES: QueryDefinition<{ parent: string }, TableSummary[], TableReader> = {
  ...LIST_TABLES_IDENTITY,
  input: { parent: id('The entity, read model or domain.', 'required') },
  reader: tableReader,
  run: listTables,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No tables.'),
};

/**
 * The next free ID for a table under its parent: an entity or a read model has one table, its ID and TB, refused once
 * taken; a domain's own tables are its ID, TB and one past the highest number in use.
 */
export function nextTableId(reader: TableReader, input: { parent: string }): string {
  const shape = reader.idShape('table');
  if (parentKindOf(reader, input.parent) !== 'domain') {
    const own = `${input.parent}-${shape.letters}`;
    if (reader.kindOf(own)) refuse('exists', `${input.parent} already has its table, ${own}`);
    return own;
  }
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a table (LA-TEC-QRY187). */
export const NEXT_TABLE_ID: QueryDefinition<{ parent: string }, string, TableReader> = {
  ...NEXT_TABLE_ID_IDENTITY,
  input: { parent: id('The entity, read model or domain it will sit under.', 'required') },
  reader: tableReader,
  run: nextTableId,
  text: (next) => next,
};

/** A table as text: its row, its keys in order, then its links. */
function tableText(page: TablePage): string {
  const { table: row, parent } = page;
  const lines = [`Table ${row.id}: ${row.title}`, `  ${parent.kind.replace('_', ' ')}: ${parent.id}`, `  name: ${row.name}`, `  storage: ${row.storage}`];
  if (row.file) lines.push(`  file: ${row.file}`);
  for (const k of page.keys) {
    const extra = [k.name, k.invariant_id && `enforces ${k.invariant_id}`, k.target_table_id && `points at ${k.target_table_id}`, k.condition && `where ${k.condition}`].filter(Boolean);
    lines.push(`  key ${k.position}: ${k.type} (${k.columns.join(', ')})${extra.length ? ` ${extra.join('; ')}` : ''}`);
  }
  for (const m of page.meets) lines.push(`  meets ${m}`);
  for (const p of page.packages) lines.push(`  uses ${p}`);
  for (const h of page.helpers) lines.push(`  helper file ${h}`);
  return lines.join('\n');
}
