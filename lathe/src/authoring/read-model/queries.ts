// The Read model aggregate's own reads (read model LA-AUT-RM30): a read model whole, the read models of a domain, and
// the next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { READ_MODEL_SLICE } from './model.ts';
import { PARENT_OF, readModelPagesFrom, type ReadModelPage, type ReadModelSummary } from './read-model.ts';

type ReadModelKind = keyof typeof PARENT_OF;

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The read model that holds the record: the read model itself, or a query, its projection or a query handler. */
export function getReadModel(view: ReadView, input: { id: string }): ReadModelPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in PARENT_OF)) refuse('kind', `${input.id} is a ${record.kind}, not a read model or a record in one`);
  let at = record;
  while (at.kind !== 'read_model') {
    const column = PARENT_OF[at.kind as Exclude<ReadModelKind, 'read_model'>];
    at = view.record(String(at.row[column]))!;
  }
  return readModelPagesFrom(view, String(at.row.id))[0];
}

/** GET a read model whole (LA-AUT-QRY179). */
export const GET_READ_MODEL: QueryDefinition<{ id: string }, ReadModelPage> = {
  id: 'LA-AUT-QRY179',
  slice: READ_MODEL_SLICE,
  name: 'get-read-model',
  description: 'Reads a read model whole, by its ID or the ID of any record in it: its row and fields, what it reads, calls and is fed by, its queries with what they select by and call, its projection and its query handlers.',
  method: 'GET',
  route: '/api/read-model/get-read-model',
  input: { id: id('The read model, or a query, its projection or a query handler in it.', 'required') },
  run: getReadModel,
  text: readModelText,
};

/** The read models of a domain, by ID. */
export function listReadModels(view: ReadView, input: { domain_id: string }): ReadModelSummary[] {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return view
    .rows('read_model')
    .filter((r) => r.domain_id === input.domain_id)
    .map((r) => ({ id: String(r.id), title: String(r.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the read models of a domain (LA-AUT-QRY180). */
export const LIST_READ_MODELS: QueryDefinition<{ domain_id: string }, ReadModelSummary[]> = {
  id: 'LA-AUT-QRY180',
  slice: READ_MODEL_SLICE,
  name: 'list-read-models',
  description: 'Lists the read models of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/read-model/list-read-models',
  input: { domain_id: id('The domain.', 'required') },
  run: listReadModels,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No read models.'),
};

/** The kind of record each of the aggregate's kinds sits under, for its next ID. */
const UNDER: Record<ReadModelKind, string> = {
  read_model: 'domain',
  query: 'read_model',
  projection: 'read_model',
  query_handler: 'query',
};

// One past the highest number in use after the prefix, among the table's IDs, padded to two digits.
function onePast(view: ReadView, table: string, prefix: string): string {
  let highest = 0;
  for (const row of view.rows(table)) {
    const id = String(row.id);
    if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) highest = Math.max(highest, Number(id.slice(prefix.length)));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a read model's is its domain's ID, RM
 * and one past the highest number in use; a query's its read model's domain's ID, QRY and the next number. A read
 * model has one projection (PJ) and a query one handler (H), so theirs is fixed, and refused once taken.
 */
export function nextReadModelId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Read model aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as ReadModelKind;
  const parent = view.record(input.parent) ?? refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is no record`);
  if (parent.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is a ${parent.kind}`);
  switch (kind) {
    case 'read_model':
      return onePast(view, 'read_model', `${input.parent}-RM`);
    case 'query':
      return onePast(view, 'query', `${String(parent.row.domain_id)}-QRY`);
    case 'projection':
    case 'query_handler': {
      const own = `${input.parent}-${kind === 'projection' ? 'PJ' : 'H'}`;
      if (view.record(own)) refuse('exists', `${input.parent} already has its ${kind === 'projection' ? 'projection' : 'query handler'}, ${own}`);
      return own;
    }
  }
}

/** Get the next ID for a record of the Read model aggregate (LA-AUT-QRY181). */
export const NEXT_READ_MODEL_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
  id: 'LA-AUT-QRY181',
  slice: READ_MODEL_SLICE,
  name: 'next-id',
  description: 'The next free ID for a read model (under its domain) or a query (under its read model): one past the highest in use; or the one ID of a projection (under its read model) or a query handler (under its query).',
  method: 'GET',
  route: '/api/read-model/next-id',
  input: {
    kind: id('The kind: read_model, query, projection or query_handler.', 'required'),
    parent: id('The record it will sit under: a domain for a read model, a query for a query handler, else the read model.', 'required'),
  },
  run: nextReadModelId,
  text: (next) => next,
};

/** A read model as text: its row, fields and links, then its queries with their handlers, and its projection. */
function readModelText(page: ReadModelPage): string {
  const { readModel: row, projection } = page;
  const lines = [`Read model ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  description: ${row.description}`];
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  const technical = (t: { meets: string[]; packages: string[] }) => [...t.meets.map((x) => `meets ${x}`), ...t.packages.map((x) => `uses ${x}`)];
  for (const f of page.fields) {
    const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
    lines.push(`  field ${f.position}: ${f.name} (${type}${f.required ? ', required' : ''}): ${f.meaning}`);
  }
  if (page.reads.length) lines.push(`  reads: ${page.reads.join(', ')}`);
  if (page.calls.length) lines.push(`  calls: ${page.calls.join(', ')}`);
  if (page.fedBy.length) lines.push(`  fed by: ${page.fedBy.join(', ')}`);
  for (const q of page.queries) {
    lines.push(`Query ${q.id}: ${q.title}${listed([...q.selectsBy.map((x) => `selects by ${x}`), ...q.calls.map((x) => `calls ${x}`)])}`);
    if (q.handler) lines.push(`  query handler ${q.handler.id}: ${q.handler.title}${listed(technical(q.handler))}`);
  }
  if (projection) lines.push(`Projection ${projection.id}: ${projection.title}${listed(technical(projection))}`);
  return lines.join('\n');
}

/** The Read model aggregate's queries, as the CLI and the MCP server register them. */
export const READ_MODEL_QUERIES: readonly AnyQuery[] = [GET_READ_MODEL, LIST_READ_MODELS, NEXT_READ_MODEL_ID];
