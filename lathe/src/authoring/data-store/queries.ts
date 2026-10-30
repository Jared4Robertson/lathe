// The Data store aggregate's own reads, each answered from its read model (LA-AUT-RM43) through its reader (reader.ts),
// which the query runner gives each handler: a data store whole as its page reads it, the data stores of a product or
// domain, and the next free ID for a data store. A handler never sees the data, a repository or the aggregate's model;
// each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { DATA_STORE_SLICE } from './model.ts';
import type { DataStorePage, DataStoreSummary } from './read-model.ts';
import { dataStoreReader, type DataStoreReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The data store, as its page reads it. */
export function getDataStore(reader: DataStoreReader, input: { id: string }): DataStorePage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a data store`);
}

/** GET a data store whole (LA-AUT-QRY225). */
export const GET_DATA_STORE: QueryDefinition<{ id: string }, DataStorePage, DataStoreReader> = {
  id: 'LA-AUT-QRY225',
  slice: DATA_STORE_SLICE,
  name: 'get-data-store',
  description: "Reads a data store whole as its page shows it: its row, the product or domain it sits under, the integration that reaches it, and the repositories, readers and tables stored in it.",
  method: 'GET',
  route: '/api/data-store/get-data-store',
  input: { id: id('The data store.', 'required') },
  reader: dataStoreReader,
  run: getDataStore,
  text: dataStoreText,
};

/** The data stores of a product (its own and its domains') or of a domain, by ID. */
export function listDataStores(reader: DataStoreReader, input: { parent: string }): DataStoreSummary[] {
  return reader.storesOf(input.parent) ?? refuse('missing', `there is no product or domain ${input.parent}`);
}

/** List the data stores of a product or domain (LA-AUT-QRY226). */
export const LIST_DATA_STORES: QueryDefinition<{ parent: string }, DataStoreSummary[], DataStoreReader> = {
  id: 'LA-AUT-QRY226',
  slice: DATA_STORE_SLICE,
  name: 'list-data-stores',
  description: "Lists the data stores of a product (its own and its domains') or of a domain, by ID, with their titles and kinds.",
  method: 'GET',
  route: '/api/data-store/list-data-stores',
  input: { parent: id('The product or domain.', 'required') },
  reader: dataStoreReader,
  run: listDataStores,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title} (${r.kind})`).join('\n') : 'No data stores.'),
};

/** The next free ID for a data store under its product or domain: the parent's ID, STORE and one past the highest in use. */
export function nextDataStoreId(reader: DataStoreReader, input: { kind: string; parent: string }): string {
  if (input.kind !== 'data_store') refuse('kind', `${input.kind} is not a kind of the Data store aggregate; its kind is data_store`);
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== 'product' && parentKind !== 'domain') refuse('parent', `a data_store sits under a product or a domain, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  const prefix = `${input.parent}-STORE`;
  return `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;
}

/** Get the next ID for a data store (LA-AUT-QRY227). */
export const NEXT_DATA_STORE_ID: QueryDefinition<{ kind: string; parent: string }, string, DataStoreReader> = {
  id: 'LA-AUT-QRY227',
  slice: DATA_STORE_SLICE,
  name: 'next-id',
  description: 'The next free ID for a data store under its product or domain: one past the highest in use.',
  method: 'GET',
  route: '/api/data-store/next-id',
  input: {
    kind: id('The kind: data_store.', 'required'),
    parent: id('The product or domain it will sit under.', 'required'),
  },
  reader: dataStoreReader,
  run: nextDataStoreId,
  text: (next) => next,
};

/** A data store as text: its row, its parent and provider, then what is stored in it. */
function dataStoreText(page: DataStorePage): string {
  const { store, parent, providedBy } = page;
  const lines = [`Data store ${store.id}: ${store.title} (${store.kind})`, `  under: ${parent.id} (${parent.title})`, `  description: ${store.description}`];
  if (providedBy) lines.push(`  provided by: ${providedBy.id} (${providedBy.title})`);
  for (const r of page.stores) lines.push(`Stores ${r.kind} ${r.id}: ${r.title}`);
  return lines.join('\n');
}

/** The Data store aggregate's queries, as the CLI and the MCP server register them. */
export const DATA_STORE_QUERIES: readonly AnyQuery[] = [GET_DATA_STORE, LIST_DATA_STORES, NEXT_DATA_STORE_ID];
