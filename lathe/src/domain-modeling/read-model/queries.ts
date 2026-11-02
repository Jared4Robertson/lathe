// The Read model aggregate's own reads, each answered from its read model (LA-MOD-RM30) through its reader
// (reader.ts), which the query runner gives each handler: a read model whole as its page reads it, the read models of a
// domain, and the next free ID for a record of one of its kinds. A handler never sees the data, a repository or the
// aggregate's model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadModelKind } from './model.ts';
import type { ReadModelPage, ReadModelSummary } from './read-model.ts';
import { readModelReader, type ReadModelReader } from './reader.ts';
import { GET_READ_MODEL_IDENTITY, LIST_READ_MODELS_IDENTITY, NEXT_READ_MODEL_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The read model that holds the record, as its page reads it: the read model itself, or a query, its projection, its reader or a query handler. */
export function getReadModel(reader: ReadModelReader, input: { id: string }): ReadModelPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a read model or a record in one`);
}

/** GET a read model whole (LA-MOD-QRY179). */
export const GET_READ_MODEL: QueryDefinition<{ id: string }, ReadModelPage, ReadModelReader> = {
  ...GET_READ_MODEL_IDENTITY,
  input: { id: id('The read model, or a query, its projection, its reader or a query handler in it.', 'required') },
  reader: readModelReader,
  run: getReadModel,
  text: readModelText,
};

/** The read models of a domain, by ID. */
export function listReadModels(reader: ReadModelReader, input: { domain_id: string }): ReadModelSummary[] {
  return reader.readModelsOf(input.domain_id) ?? refuse('missing', `there is no domain ${input.domain_id}`);
}

/** List the read models of a domain (LA-MOD-QRY180). */
export const LIST_READ_MODELS: QueryDefinition<{ domain_id: string }, ReadModelSummary[], ReadModelReader> = {
  ...LIST_READ_MODELS_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: readModelReader,
  run: listReadModels,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No read models.'),
};

/** The one ID of each kind a read model or a query has one of, and its name in a refusal. */
const ONE: Record<'projection' | 'reader' | 'query_handler', { suffix: string; name: string }> = {
  projection: { suffix: 'PJ', name: 'projection' },
  reader: { suffix: 'RD', name: 'reader' },
  query_handler: { suffix: 'H', name: 'query handler' },
};

/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['read_model', 'query', 'projection', 'reader', 'query_handler'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a read model's is its domain's ID, RM
 * and one past the highest number in use; a query's its read model's domain's ID, QRY and the next number. A read
 * model has one projection (PJ) and one reader (RD), and a query one handler (H), so theirs is fixed, and refused once
 * taken.
 */
export function nextReadModelId(reader: ReadModelReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Read model aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as ReadModelKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== shape.parents[0]) refuse('parent', `a ${kind} sits under a ${shape.parents[0]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  switch (kind) {
    case 'read_model':
      return onePast(reader, `${input.parent}-${shape.letters}`, shape);
    case 'query':
      return onePast(reader, `${reader.page(input.parent)!.readModel.domain_id}-${shape.letters}`, shape);
    case 'projection':
    case 'reader':
    case 'query_handler': {
      const own = `${input.parent}-${ONE[kind].suffix}`;
      if (reader.kindOf(own)) refuse('exists', `${input.parent} already has its ${ONE[kind].name}, ${own}`);
      return own;
    }
  }
}

/** Get the next ID for a record of the Read model aggregate (LA-MOD-QRY181). */
export const NEXT_READ_MODEL_ID: QueryDefinition<{ kind: string; parent: string }, string, ReadModelReader> = {
  ...NEXT_READ_MODEL_ID_IDENTITY,
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
