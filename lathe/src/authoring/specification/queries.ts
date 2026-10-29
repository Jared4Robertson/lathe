// The Specification aggregate's own reads (read model LA-AUT-RM25): a specification whole, the specifications of a
// domain, and the next free ID for a record of one of its kinds. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { SPECIFICATION_SLICE } from './model.ts';
import { SPECIFICATION_OF, specificationPagesFrom, type SpecificationPage, type SpecificationSummary } from './read-model.ts';

type SpecificationKind = keyof typeof SPECIFICATION_OF;

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The specification that holds the record: the specification itself, or its predicate or test. */
export function getSpecification(view: ReadView, input: { id: string }): SpecificationPage {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (!(record.kind in SPECIFICATION_OF)) refuse('kind', `${input.id} is a ${record.kind}, not a specification or a record in one`);
  const column = SPECIFICATION_OF[record.kind as SpecificationKind];
  return specificationPagesFrom(view, column === null ? input.id : String(record.row[column]))[0];
}

/** GET a specification whole (LA-AUT-QRY170). */
export const GET_SPECIFICATION: QueryDefinition<{ id: string }, SpecificationPage> = {
  id: 'LA-AUT-QRY170',
  slice: SPECIFICATION_SLICE,
  name: 'get-specification',
  description: 'Reads a specification whole, by its ID or the ID of its predicate or test: its row, the aggregates it reads, its predicate with the standard rules it meets and the packages it uses, and its test with the data sets it starts from.',
  method: 'GET',
  route: '/api/specification/get-specification',
  input: { id: id('The specification, or its predicate or test.', 'required') },
  run: getSpecification,
  text: specificationText,
};

/** The domain a specification's ID names: the longest domain ID it starts with, and a hyphen. */
function domainNamed(view: ReadView, recordId: string): string | undefined {
  let found: string | undefined;
  for (const d of view.rows('domain')) {
    const domainId = String(d.id);
    if (recordId.startsWith(`${domainId}-`) && (found === undefined || domainId.length > found.length)) found = domainId;
  }
  return found;
}

/** The specifications of a domain, by ID: those whose ID names it. */
export function listSpecifications(view: ReadView, input: { domain_id: string }): SpecificationSummary[] {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return view
    .rows('specification')
    .filter((s) => domainNamed(view, String(s.id)) === input.domain_id)
    .map((s) => ({ id: String(s.id), title: String(s.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the specifications of a domain (LA-AUT-QRY171). */
export const LIST_SPECIFICATIONS: QueryDefinition<{ domain_id: string }, SpecificationSummary[]> = {
  id: 'LA-AUT-QRY171',
  slice: SPECIFICATION_SLICE,
  name: 'list-specifications',
  description: 'Lists the specifications of a domain (those whose ID names it), by ID, with their titles.',
  method: 'GET',
  route: '/api/specification/list-specifications',
  input: { domain_id: id('The domain.', 'required') },
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
export function nextSpecificationId(view: ReadView, input: { kind: string; parent: string }): string {
  if (!(input.kind in UNDER)) refuse('kind', `${input.kind} is not a kind of the Specification aggregate; its kinds are ${Object.keys(UNDER).join(', ')}`);
  const kind = input.kind as SpecificationKind;
  const parent = view.record(input.parent);
  if (parent?.kind !== UNDER[kind]) refuse('parent', `a ${kind} sits under a ${UNDER[kind]}, and ${input.parent} is ${parent ? `a ${parent.kind}` : 'no record'}`);
  if (kind === 'specification') {
    const prefix = `${input.parent}-SP`;
    let highest = 0;
    for (const row of view.rows('specification')) {
      const id = String(row.id);
      if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) highest = Math.max(highest, Number(id.slice(prefix.length)));
    }
    return `${prefix}${String(highest + 1).padStart(2, '0')}`;
  }
  const own = `${input.parent}-${kind === 'predicate' ? 'PR' : 'T'}`;
  if (view.record(own)) refuse('exists', `${input.parent} already has its ${kind === 'predicate' ? 'predicate' : 'test'}, ${own}`);
  return own;
}

/** Get the next ID for a record of the Specification aggregate (LA-AUT-QRY172). */
export const NEXT_SPECIFICATION_ID: QueryDefinition<{ kind: string; parent: string }, string> = {
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
  run: nextSpecificationId,
  text: (next) => next,
};

/** A specification as text: its row, what it reads, then its predicate and test. */
function specificationText(page: SpecificationPage): string {
  const { specification: row, predicate, test } = page;
  const lines = [`Specification ${row.id}: ${row.title}`, `  statement: ${row.statement}`];
  if (page.reads.length) lines.push(`  reads: ${page.reads.join(', ')}`);
  const listed = (links: string[]) => (links.length ? ` [${links.join('; ')}]` : '');
  if (predicate) lines.push(`Predicate ${predicate.id}: ${predicate.title}${predicate.file ? ` (${predicate.file})` : ''}${listed([...predicate.meets.map((x) => `meets ${x}`), ...predicate.packages.map((x) => `uses ${x}`)])}`);
  if (test) lines.push(`Specification test ${test.id}: ${test.title} (${test.level}, ${test.state})${listed(test.startsFrom.map((x) => `starts from ${x}`))}`);
  return lines.join('\n');
}

/** The Specification aggregate's queries, as the CLI and the MCP server register them. */
export const SPECIFICATION_QUERIES: readonly AnyQuery[] = [GET_SPECIFICATION, LIST_SPECIFICATIONS, NEXT_SPECIFICATION_ID];
