// The Entry point aggregate's own reads (read model LA-AUT-RM40): an entry point's page, the entry points of a domain,
// and the next free ID for one. Each reads only the read model, through its reader (reader.ts), and changes
// nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { ENTRY_POINT_SLICE } from './model.ts';
import type { EntryPointPage, EntryPointSummary } from './read-model.ts';
import { entryPointReader, type EntryPointReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The entry point with this ID, whole. */
export function getEntryPoint(reader: EntryPointReader, input: { id: string }): EntryPointPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (kind !== 'entry_point') refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not an entry point`);
  return reader.page(input.id)!;
}

/** Get an entry point whole (LA-AUT-QRY120). */
export const GET_ENTRY_POINT: QueryDefinition<{ id: string }, EntryPointPage, EntryPointReader> = {
  id: 'LA-AUT-QRY120',
  slice: ENTRY_POINT_SLICE,
  name: 'get-entry-point',
  description: 'Reads an entry point whole, by its ID: its row, the packages it uses and the standard rules it meets.',
  method: 'GET',
  route: '/api/entry-point/get-entry-point',
  input: { id: id('The entry point.', 'required') },
  reader: entryPointReader,
  run: getEntryPoint,
  text: entryPointText,
};

/** The entry points of a domain, by ID. */
export function listEntryPoints(reader: EntryPointReader, input: { domain_id: string }): EntryPointSummary[] {
  if (reader.kindOf(input.domain_id) !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return reader.list(input.domain_id);
}

/** List the entry points of a domain (LA-AUT-QRY121). */
export const LIST_ENTRY_POINTS: QueryDefinition<{ domain_id: string }, EntryPointSummary[], EntryPointReader> = {
  id: 'LA-AUT-QRY121',
  slice: ENTRY_POINT_SLICE,
  name: 'list-entry-points',
  description: 'Lists the entry points of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/entry-point/list-entry-points',
  input: { domain_id: id('The domain.', 'required') },
  reader: entryPointReader,
  run: listEntryPoints,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No entry points.'),
};

/** The next free ID for an entry point of the domain: its domain's ID and ENTRY, one past the highest number in use. */
export function nextEntryPointId(reader: EntryPointReader, input: { domain_id: string }): string {
  const shape = reader.idShape('entry_point');
  if (reader.kindOf(input.domain_id) !== shape.parents[0]) refuse('parent', `an entry point sits under a domain, and ${input.domain_id} is not one`);
  return onePast(reader, `${input.domain_id}-${shape.letters}`, shape);
}

/** Get the next ID for an entry point (LA-AUT-QRY122). */
export const NEXT_ENTRY_POINT_ID: QueryDefinition<{ domain_id: string }, string, EntryPointReader> = {
  id: 'LA-AUT-QRY122',
  slice: ENTRY_POINT_SLICE,
  name: 'next-id',
  description: 'The next free ID for an entry point of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/entry-point/next-id',
  input: { domain_id: id('The domain it will sit under.', 'required') },
  reader: entryPointReader,
  run: nextEntryPointId,
  text: (next) => next,
};

/** An entry point as text: its row, then what it uses and meets. */
function entryPointText(record: EntryPointPage): string {
  const row = record.entryPoint;
  const lines = [`Entry point ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, ...(row.file ? [`  file: ${row.file}`] : [])];
  lines.push(`  description: ${row.description}`);
  if (record.packages.length) lines.push(`  packages: ${record.packages.join(', ')}`);
  if (record.meets.length) lines.push(`  meets: ${record.meets.join(', ')}`);
  return lines.join('\n');
}

/** The Entry point aggregate's queries, as the CLI and the MCP server register them. */
export const ENTRY_POINT_QUERIES: readonly AnyQuery[] = [GET_ENTRY_POINT, LIST_ENTRY_POINTS, NEXT_ENTRY_POINT_ID];
