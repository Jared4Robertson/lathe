// The Storage requirement aggregate's own reads, each answered from its read model (LA-AUT-RM42) through its reader
// (reader.ts), which the query runner gives each handler: a storage requirement whole as its page reads it, the
// storage requirements of an aggregate or read model, and the next free ID for a record of one of its kinds. A handler
// never sees the data, a repository or the aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { STORAGE_REQUIREMENT_SLICE, type StorageRequirementKind } from './model.ts';
import type { StorageRequirementPage, StorageRequirementSummary } from './read-model.ts';
import { storageRequirementReader, type StorageRequirementReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The storage requirement that holds the record, as its page reads it: the requirement itself, or one of its tests. */
export function getStorageRequirement(reader: StorageRequirementReader, input: { id: string }): StorageRequirementPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a storage requirement or a record in one`);
}

/** GET a storage requirement whole (LA-AUT-QRY220). */
export const GET_STORAGE_REQUIREMENT: QueryDefinition<{ id: string }, StorageRequirementPage, StorageRequirementReader> = {
  id: 'LA-AUT-QRY220',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'get-storage-requirement',
  description: "Reads a storage requirement whole as its page shows it, by its ID or the ID of one of its storage requirement tests: the record asked for and its kind, the requirement's row, the aggregate or read model it is about, the repository or reader that builds it with the data store that names, and its storage requirement tests with the test data sets each starts from.",
  method: 'GET',
  route: '/api/storage-requirement/get-storage-requirement',
  input: { id: id('The storage requirement, or one of its storage requirement tests.', 'required') },
  reader: storageRequirementReader,
  run: getStorageRequirement,
  text: storageRequirementText,
};

/** The storage requirements of an aggregate or read model, by ID. */
export function listStorageRequirements(reader: StorageRequirementReader, input: { parent: string }): StorageRequirementSummary[] {
  return reader.requirementsOf(input.parent) ?? refuse('missing', `there is no aggregate or read model ${input.parent}`);
}

/** List the storage requirements of an aggregate or read model (LA-AUT-QRY221). */
export const LIST_STORAGE_REQUIREMENTS: QueryDefinition<{ parent: string }, StorageRequirementSummary[], StorageRequirementReader> = {
  id: 'LA-AUT-QRY221',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'list-storage-requirements',
  description: 'Lists the storage requirements of an aggregate or read model, by ID, with their titles.',
  method: 'GET',
  route: '/api/storage-requirement/list-storage-requirements',
  input: { parent: id('The aggregate or read model.', 'required') },
  reader: storageRequirementReader,
  run: listStorageRequirements,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No storage requirements.'),
};


/** The kinds of the aggregate with an ID under a parent; how each is written the schema says (`idShape`). */
const KINDS: readonly string[] = ['storage_requirement', 'storage_requirement_test'];

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a storage requirement's is its
 * aggregate's or read model's ID, SR and one past the highest number in use; a storage requirement test's is its requirement's ID,
 * T and one past the highest in use.
 */
export function nextStorageRequirementId(reader: StorageRequirementReader, input: { kind: string; parent: string }): string {
  if (!KINDS.includes(input.kind)) refuse('kind', `${input.kind} is not a kind of the Storage requirement aggregate; its kinds are ${KINDS.join(', ')}`);
  const kind = input.kind as StorageRequirementKind;
  const shape = reader.idShape(kind);
  const parentKind = reader.kindOf(input.parent);
  if (!parentKind || !shape.parents.includes(parentKind)) {
    refuse('parent', `a ${kind} sits under ${shape.parents.map((k) => `${article(k)} ${k}`).join(' or ')}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  }
  return onePast(reader, `${input.parent}-${shape.letters}`, shape);
}

/** Get the next ID for a record of the Storage requirement aggregate (LA-AUT-QRY222). */
export const NEXT_STORAGE_REQUIREMENT_ID: QueryDefinition<{ kind: string; parent: string }, string, StorageRequirementReader> = {
  id: 'LA-AUT-QRY222',
  slice: STORAGE_REQUIREMENT_SLICE,
  name: 'next-id',
  description: 'The next free ID for a storage requirement (under its aggregate or read model) or a storage requirement test (under its storage requirement): one past the highest in use.',
  method: 'GET',
  route: '/api/storage-requirement/next-id',
  input: {
    kind: id('The kind: storage_requirement or storage_requirement_test.', 'required'),
    parent: id('The record it will sit under: an aggregate or read model for a storage requirement, else the storage requirement.', 'required'),
  },
  reader: storageRequirementReader,
  run: nextStorageRequirementId,
  text: (next) => next,
};

/** A storage requirement as text: its row, its parent and builder, then its tests. */
function storageRequirementText(page: StorageRequirementPage): string {
  const { requirement: row, parent, builder } = page;
  const lines = [`Storage requirement ${row.id}: ${row.title}`, `  about: ${parent.id} (${parent.title})`, `  statement: ${row.statement}`];
  if (builder) lines.push(`  built by: ${builder.id} ${builder.title}${builder.file ? ` (${builder.file})` : ''}${builder.storedIn ? `, stored in ${builder.storedIn.id} ${builder.storedIn.title}` : ', which names no data store'}`);
  const listed = (links: string[]) => (links.length ? ` [${links.map((x) => `starts from ${x}`).join('; ')}]` : '');
  for (const { test, startsFrom } of page.tests) lines.push(`Storage requirement test ${test.id}: ${test.title} (${test.level}, ${test.state})${listed(startsFrom)}`);
  return lines.join('\n');
}

/** The Storage requirement aggregate's queries, as the CLI and the MCP server register them. */
export const STORAGE_REQUIREMENT_QUERIES: readonly AnyQuery[] = [GET_STORAGE_REQUIREMENT, LIST_STORAGE_REQUIREMENTS, NEXT_STORAGE_REQUIREMENT_ID];
