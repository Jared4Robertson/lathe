// The Table aggregate's own reads (read model LA-AUT-RM38): a table whole, the tables under a parent, and the next free
// ID for a table. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { TABLE_SLICE } from './model.ts';
import { tablePagesFrom, type TablePage, type TableSummary } from './read-model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The table with this ID, whole. */
export function getTable(view: ReadView, input: { id: string }): TablePage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'table') refuse('kind', `${input.id} is a ${record.kind}, not a table`);
  return tablePagesFrom(view, input.id)[0];
}

/** GET a table whole (LA-AUT-QRY185). */
export const GET_TABLE: QueryDefinition<{ id: string }, TablePage> = {
  id: 'LA-AUT-QRY185',
  slice: TABLE_SLICE,
  name: 'get-table',
  description: 'Reads a table whole, by its ID: its row, its keys in order, the standard rules it meets and the packages it uses.',
  input: { id: id('The table.', 'required') },
  run: getTable,
  text: tableText,
};

/** The kinds a table sits under, by the column that names its parent. */
const PARENT_KIND = { entity_id: 'entity', read_model_id: 'read_model', domain_id: 'domain' } as const;
const PARENT_COLUMNS = ['entity_id', 'read_model_id', 'domain_id'] as const;

/** The tables under a parent (an entity, a read model or a domain), by ID. */
export function listTables(view: ReadView, input: { parent: string }): TableSummary[] {
  const parent = view.record(input.parent);
  const column = PARENT_COLUMNS.find((c) => PARENT_KIND[c] === parent?.kind) ?? refuse('parent', `a table sits under an entity, a read model or a domain, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  return view
    .rows('table')
    .filter((t) => t[column] === input.parent)
    .map((t) => ({ id: String(t.id), title: String(t.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the tables under a parent (LA-AUT-QRY186). */
export const LIST_TABLES: QueryDefinition<{ parent: string }, TableSummary[]> = {
  id: 'LA-AUT-QRY186',
  slice: TABLE_SLICE,
  name: 'list-tables',
  description: 'Lists the tables under an entity, a read model or a domain, by ID, with their titles.',
  input: { parent: id('The entity, read model or domain.', 'required') },
  run: listTables,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No tables.'),
};

/**
 * The next free ID for a table under its parent: an entity or a read model has one table, its ID and TB, refused once
 * taken; a domain's own tables are its ID, TB and one past the highest number in use.
 */
export function nextTableId(view: ReadView, input: { parent: string }): string {
  const parent = view.record(input.parent);
  if (parent?.kind === 'entity' || parent?.kind === 'read_model') {
    const own = `${input.parent}-TB`;
    if (view.record(own)) refuse('exists', `${input.parent} already has its table, ${own}`);
    return own;
  }
  if (parent?.kind !== 'domain') refuse('parent', `a table sits under an entity, a read model or a domain, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  const prefix = `${input.parent}-TB`;
  let highest = 0;
  for (const row of view.rows('table')) {
    const id = String(row.id);
    if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) highest = Math.max(highest, Number(id.slice(prefix.length)));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** Get the next ID for a table (LA-AUT-QRY187). */
export const NEXT_TABLE_ID: QueryDefinition<{ parent: string }, string> = {
  id: 'LA-AUT-QRY187',
  slice: TABLE_SLICE,
  name: 'next-id',
  description: "The next free ID for a table: the one ID of an entity's or read model's table, or a domain's next own table, one past the highest in use.",
  input: { parent: id('The entity, read model or domain it will sit under.', 'required') },
  run: nextTableId,
  text: (next) => next,
};

/** A table as text: its row, its keys in order, then its links. */
function tableText(page: TablePage): string {
  const { table: row } = page;
  const parent = PARENT_COLUMNS.find((c) => row[c] !== undefined)!;
  const lines = [`Table ${row.id}: ${row.title}`, `  ${PARENT_KIND[parent].replace('_', ' ')}: ${row[parent]}`, `  name: ${row.name}`, `  storage: ${row.storage}`];
  if (row.file) lines.push(`  file: ${row.file}`);
  for (const k of page.keys) {
    const extra = [k.name, k.invariant_id && `enforces ${k.invariant_id}`, k.target_table_id && `points at ${k.target_table_id}`, k.condition && `where ${k.condition}`].filter(Boolean);
    lines.push(`  key ${k.position}: ${k.type} (${k.columns.join(', ')})${extra.length ? ` ${extra.join('; ')}` : ''}`);
  }
  for (const m of page.meets) lines.push(`  meets ${m}`);
  for (const p of page.packages) lines.push(`  uses ${p}`);
  return lines.join('\n');
}

/** The Table aggregate's queries, as the CLI and the MCP server register them. */
export const TABLE_QUERIES: readonly AnyQuery[] = [GET_TABLE, LIST_TABLES, NEXT_TABLE_ID];
