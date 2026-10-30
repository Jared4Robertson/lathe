// The Read model aggregate's own reads, each answered from its read model (LA-AUT-RM30) through its reader
// (reader.ts), which the query runner gives each handler: a read model whole as its page reads it, the read models of a
// domain, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or the
// aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { READ_MODEL_SLICE, type ReadModelKind } from './model.ts';
import type { ReadModelPage, ReadModelSummary } from './read-model.ts';
import { readModelReader, type ReadModelReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The read model that holds the record, as its page reads it: the read model itself, or a query, its projection, its reader or a query handler. */
export function getReadModel(reader: ReadModelReader, input: { id: string }): ReadModelPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a read model or a record in one`);
}

/** GET a read model whole (LA-AUT-QRY179). */
export const GET_READ_MODEL: QueryDefinition<{ id: string }, ReadModelPage, ReadModelReader> = {
  id: 'LA-AUT-QRY179',
  slice: READ_MODEL_SLICE,
  name: 'get-read-model',
  description: 'Reads a read model whole as its page shows it, by its ID or the ID of any record in it: the record asked for and its kind, the read model\'s row and fields in order, what it reads, calls and is fed by, its queries by ID each with what it selects by and calls and its handler, its projection and its reader (each piece of code with the standard rules it meets and the packages it uses).',
  method: 'GET',
  route: '/api/read-model/get-read-model',
  input: { id: id('The read model, or a query, its projection, its reader or a query handler in it.', 'required') },
  reader: readModelReader,
  run: getReadModel,
  text: readModelText,
};

/** The read models of a domain, by ID. */
export function listReadModels(reader: ReadModelReader, input: { domain_id: string }): ReadModelSummary[] {
  return reader.readModelsOf(input.domain_id) ?? refuse('missing', `there is no domain ${input.domain_id}`);
}

/** List the read models of a domain (LA-AUT-QRY180). */
export const LIST_READ_MODELS: QueryDefinition<{ domain_id: string }, ReadModelSummary[], ReadModelReader> = {
  id: 'LA-AUT-QRY180',
  slice: READ_MODEL_SLICE,
  name: 'list-read-models',
  description: 'Lists the read models of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/read-model/list-read-models',
  input: { domain_id: id('The domain.', 'required') },
  reader: readModelReader,
  run: listReadModels,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No read models.'),
};

/** The kind of record each of the aggregate's kinds sits under, for its next ID. */
const UNDER: Record<ReadModelKind, string> = {
  read_model: 'domain',
  query: 'read_model',
  projection: 'read_model',
  reader: 'read_model',
  query_handler: 'query',
};

// One past the highest number in use after the prefix, padded to two digits.
const onePast = (reader: ReadModelReader, prefix: string): string => `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;

/** The one ID of each kind a read model or a query has one of, and its name in a refusal. */
const ONE: Record<'projection' | 'reader' | 'query_handler', { suffix: string; name: string }> = {
  projection: { suffix: 'PJ', name: 'projection' },
  reader: { suffix: 'RD', name: 'reader' },
  query_handler: { suffix: 'H', name: 'query handler' },
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a read model's is its domain's ID, RM
 * and one past the highest number in use; a query's its read model's domain's ID, QRY and the next number. A read
 * model has one projection (PJ) and one reader (RD), and a query one handler (H), so theirs is fixed, and refused once
 * taken.
 */
export function nextReadModelId(reader: ReadModelReader, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Read model aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as ReadModelKind;
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  switch (kind) {
    case 'read_model':
      return onePast(reader, `${input.parent}-RM`);
    case 'query':
      return onePast(reader, `${reader.page(input.parent)!.readModel.domain_id}-QRY`);
    case 'projection':
    case 'reader':
    case 'query_handler': {
      const own = `${input.parent}-${ONE[kind].suffix}`;
      if (reader.kindOf(own)) refuse('exists', `${input.parent} already has its ${ONE[kind].name}, ${own}`);
      return own;
    }
  }
}

/** Get the next ID for a record of the Read model aggregate (LA-AUT-QRY181). */
export const NEXT_READ_MODEL_ID: QueryDefinition<{ kind: string; parent: string }, string, ReadModelReader> = {
  id: 'LA-AUT-QRY181',
  slice: READ_MODEL_SLICE,
  name: 'next-id',
  description: 'The next free ID for a read model (under its domain) or a query (under its read model): one past the highest in use; or the one ID of a projection or a reader (under its read model) or a query handler (under its query).',
  method: 'GET',
  route: '/api/read-model/next-id',
  input: {
    kind: id('The kind: read_model, query, projection, reader or query_handler.', 'required'),
    parent: id('The record it will sit under: a domain for a read model, a query for a query handler, else the read model.', 'required'),
  },
  reader: readModelReader,
  run: nextReadModelId,
  text: (next) => next,
};

/** A read model as text: its row, fields and links, then its queries with their handlers, its projection and its reader. */
function readModelText(page: ReadModelPage): string {
  const { readModel: row } = page;
  const lines = [`Read model ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  description: ${row.description}`];
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  const technical = (t: { meets: string[]; packages: string[] }) => [...t.meets.map((x) => `meets ${x}`), ...t.packages.map((x) => `uses ${x}`)];
  const code = (label: string, c: { code: { id: string; title: string }; meets: string[]; packages: string[] }) => `${label} ${c.code.id}: ${c.code.title}${listed(technical(c))}`;
  for (const f of page.fields) {
    const type = f.type ?? f.type_value_object_id ?? f.type_aggregate_id;
    lines.push(`  field ${f.position}: ${f.name} (${type}${f.required ? ', required' : ''}): ${f.meaning}`);
  }
  if (page.reads.length) lines.push(`  reads: ${page.reads.join(', ')}`);
  if (page.calls.length) lines.push(`  calls: ${page.calls.join(', ')}`);
  if (page.fedBy.length) lines.push(`  fed by: ${page.fedBy.join(', ')}`);
  for (const q of page.queries) {
    lines.push(`Query ${q.query.id}: ${q.query.title}${listed([...q.selectsBy.map((x) => `selects by ${x}`), ...q.calls.map((x) => `calls ${x}`)])}`);
    if (q.handler) lines.push(`  ${code('query handler', q.handler)}`);
  }
  if (page.projection) lines.push(code('Projection', page.projection));
  if (page.reader) lines.push(code('Reader', page.reader));
  return lines.join('\n');
}

/** The Read model aggregate's queries, as the CLI and the MCP server register them. */
export const READ_MODEL_QUERIES: readonly AnyQuery[] = [GET_READ_MODEL, LIST_READ_MODELS, NEXT_READ_MODEL_ID];
