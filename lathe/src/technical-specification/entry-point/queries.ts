// The Entry point aggregate's own reads (read model LA-TEC-RM40): an entry point's page, the entry points of a domain,
// and the next free ID for one. Each reads only the read model, through its reader (reader.ts), and changes
// nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { EntryPointPage, EntryPointSummary } from './read-model.ts';
import { entryPointReader, type EntryPointReader } from './reader.ts';
import { GET_ENTRY_POINT_IDENTITY, LIST_ENTRY_POINTS_IDENTITY, NEXT_ENTRY_POINT_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The entry point with this ID, whole. */
export function getEntryPoint(reader: EntryPointReader, input: { id: string }): EntryPointPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (kind !== 'entry_point') refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not an entry point`);
  return reader.page(input.id)!;
}

/** Get an entry point whole (LA-TEC-QRY120). */
export const GET_ENTRY_POINT: QueryDefinition<{ id: string }, EntryPointPage, EntryPointReader> = {
  ...GET_ENTRY_POINT_IDENTITY,
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

/** List the entry points of a domain (LA-TEC-QRY121). */
export const LIST_ENTRY_POINTS: QueryDefinition<{ domain_id: string }, EntryPointSummary[], EntryPointReader> = {
  ...LIST_ENTRY_POINTS_IDENTITY,
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

/** Get the next ID for an entry point (LA-TEC-QRY122). */
export const NEXT_ENTRY_POINT_ID: QueryDefinition<{ domain_id: string }, string, EntryPointReader> = {
  ...NEXT_ENTRY_POINT_ID_IDENTITY,
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
  if (record.helpers.length) lines.push(`  helper files: ${record.helpers.join(", ")}`);
  if (record.meets.length) lines.push(`  meets: ${record.meets.join(', ')}`);
  return lines.join('\n');
}
