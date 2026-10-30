// The Specification aggregate's own reads, each answered from its read model (LA-AUT-RM25) through its reader
// (reader.ts), which the query runner gives each handler: a specification whole as its page reads it, the
// specifications of a domain, and the next free ID for a record of one of its kinds. A handler never sees the data, a
// repository or the aggregate's model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { SPECIFICATION_SLICE, type SpecificationKind } from './model.ts';
import type { SpecificationPage, SpecificationSummary } from './read-model.ts';
import { specificationReader, type SpecificationReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

const article = (kind: string) => (/^[aeiou]/.test(kind) ? 'an' : 'a');

/** The specification that holds the record, as its page reads it: the specification itself, or its predicate or test. */
export function getSpecification(reader: SpecificationReader, input: { id: string }): SpecificationPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${article(kind)} ${kind}, not a specification or a record in one`);
}

/** GET a specification whole (LA-AUT-QRY170). */
export const GET_SPECIFICATION: QueryDefinition<{ id: string }, SpecificationPage, SpecificationReader> = {
  id: 'LA-AUT-QRY170',
  slice: SPECIFICATION_SLICE,
  name: 'get-specification',
  description: 'Reads a specification whole as its page shows it, by its ID or the ID of its predicate or test: the record asked for and its kind, the specification\'s row and the domain its ID names, the aggregates it reads, its predicate with the standard rules it meets and the packages it uses, and its test with the test data sets it starts from.',
  method: 'GET',
  route: '/api/specification/get-specification',
  input: { id: id('The specification, or its predicate or test.', 'required') },
  reader: specificationReader,
  run: getSpecification,
  text: specificationText,
};

/** The specifications of a domain, by ID: those whose ID names it. */
export function listSpecifications(reader: SpecificationReader, input: { domain_id: string }): SpecificationSummary[] {
  return reader.specificationsOf(input.domain_id) ?? refuse('missing', `there is no domain ${input.domain_id}`);
}

/** List the specifications of a domain (LA-AUT-QRY171). */
export const LIST_SPECIFICATIONS: QueryDefinition<{ domain_id: string }, SpecificationSummary[], SpecificationReader> = {
  id: 'LA-AUT-QRY171',
  slice: SPECIFICATION_SLICE,
  name: 'list-specifications',
  description: 'Lists the specifications of a domain (those whose ID names it), by ID, with their titles.',
  method: 'GET',
  route: '/api/specification/list-specifications',
  input: { domain_id: id('The domain.', 'required') },
  reader: specificationReader,
  run: listSpecifications,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No specifications.'),
};

/** The kind of record each of the aggregate's kinds sits under, for its next ID. */
const UNDER: Record<SpecificationKind, string> = {
  specification: 'domain',
  predicate: 'specification',
  specification_test: 'specification',
};

/**
 * The next free ID for a record of one of the aggregate's kinds under its parent: a specification's is its domain's ID,
 * SP and one past the highest number in use; a specification has one predicate (PR) and one test (T), so theirs is
 * fixed, and refused once taken.
 */
export function nextSpecificationId(reader: SpecificationReader, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Specification aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as SpecificationKind;
  const parentKind = reader.kindOf(input.parent);
  if (parentKind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parentKind ? `${article(parentKind)} ${parentKind}` : 'no record'}`);
  if (kind === 'specification') {
    const prefix = `${input.parent}-SP`;
    return `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;
  }
  const own = `${input.parent}-${kind === 'predicate' ? 'PR' : 'T'}`;
  if (reader.kindOf(own)) refuse('exists', `${input.parent} already has its ${kind === 'predicate' ? 'predicate' : 'test'}, ${own}`);
  return own;
}

/** Get the next ID for a record of the Specification aggregate (LA-AUT-QRY172). */
export const NEXT_SPECIFICATION_ID: QueryDefinition<{ kind: string; parent: string }, string, SpecificationReader> = {
  id: 'LA-AUT-QRY172',
  slice: SPECIFICATION_SLICE,
  name: 'next-id',
  description: 'The next free ID for a specification (under its domain: one past the highest in use), or the one ID of a predicate or specification test (under its specification).',
  method: 'GET',
  route: '/api/specification/next-id',
  input: {
    kind: id('The kind: specification, predicate or specification_test.', 'required'),
    parent: id('The record it will sit under: a domain for a specification, else the specification.', 'required'),
  },
  reader: specificationReader,
  run: nextSpecificationId,
  text: (next) => next,
};

/** A specification as text: its row, what it reads, then its predicate and test. */
function specificationText(page: SpecificationPage): string {
  const { specification: row } = page;
  const predicate = page.predicate && { ...page.predicate.predicate, meets: page.predicate.meets, packages: page.predicate.packages };
  const test = page.test && { ...page.test.test, startsFrom: page.test.startsFrom };
  const lines = [`Specification ${row.id}: ${row.title}`, `  statement: ${row.statement}`];
  if (page.reads.length) lines.push(`  reads: ${page.reads.join(', ')}`);
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  if (predicate) lines.push(`Predicate ${predicate.id}: ${predicate.title}${predicate.file ? ` (${predicate.file})` : ''}${listed([...predicate.meets.map((x) => `meets ${x}`), ...predicate.packages.map((x) => `uses ${x}`)])}`);
  if (test) lines.push(`Specification test ${test.id}: ${test.title} (${test.level}, ${test.state})${listed(test.startsFrom.map((x) => `starts from ${x}`))}`);
  return lines.join('\n');
}

/** The Specification aggregate's queries, as the CLI and the MCP server register them. */
export const SPECIFICATION_QUERIES: readonly AnyQuery[] = [GET_SPECIFICATION, LIST_SPECIFICATIONS, NEXT_SPECIFICATION_ID];
