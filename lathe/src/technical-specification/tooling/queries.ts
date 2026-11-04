// The Tooling aggregate's own reads (read model LA-TEC-RM41): a tooling record's page, the tooling records of a domain,
// and the next free ID for one. Each reads only the read model, through its reader (reader.ts), and changes
// nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ToolingPage, ToolingSummary } from './read-model.ts';
import { toolingReader, type ToolingReader } from './reader.ts';
import { GET_TOOLING_IDENTITY, LIST_TOOLING_IDENTITY, NEXT_TOOLING_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The tooling record with this ID, whole. */
export function getTooling(reader: ToolingReader, input: { id: string }): ToolingPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (kind !== 'tooling') refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a tooling record`);
  return reader.page(input.id)!;
}

/** Get a tooling record whole (LA-TEC-QRY123). */
export const GET_TOOLING: QueryDefinition<{ id: string }, ToolingPage, ToolingReader> = {
  ...GET_TOOLING_IDENTITY,
  input: { id: id('The tooling record.', 'required') },
  reader: toolingReader,
  run: getTooling,
  text: toolingText,
};

/** The tooling records of a domain, by ID. */
export function listTooling(reader: ToolingReader, input: { domain_id: string }): ToolingSummary[] {
  if (reader.kindOf(input.domain_id) !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return reader.list(input.domain_id);
}

/** List the tooling records of a domain (LA-TEC-QRY124). */
export const LIST_TOOLING: QueryDefinition<{ domain_id: string }, ToolingSummary[], ToolingReader> = {
  ...LIST_TOOLING_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: toolingReader,
  run: listTooling,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No tooling records.'),
};

/** The next free ID for a tooling record of the domain: its domain's ID and TOOL, one past the highest number in use. */
export function nextToolingId(reader: ToolingReader, input: { domain_id: string }): string {
  const shape = reader.idShape('tooling');
  if (reader.kindOf(input.domain_id) !== shape.parents[0]) refuse('parent', `a tooling record sits under a domain, and ${input.domain_id} is not one`);
  return onePast(reader, `${input.domain_id}-${shape.letters}`, shape);
}

/** Get the next ID for a tooling record (LA-TEC-QRY125). */
export const NEXT_TOOLING_ID: QueryDefinition<{ domain_id: string }, string, ToolingReader> = {
  ...NEXT_TOOLING_ID_IDENTITY,
  input: { domain_id: id('The domain it will sit under.', 'required') },
  reader: toolingReader,
  run: nextToolingId,
  text: (next) => next,
};

/** A tooling record as text: its row, then what it uses, meets and generates. */
function toolingText(record: ToolingPage): string {
  const row = record.tooling;
  const lines = [`Tooling ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, ...(row.file ? [`  file: ${row.file}`] : [])];

  if (record.packages.length) lines.push(`  packages: ${record.packages.join(', ')}`);
  if (record.helpers.length) lines.push(`  helper files: ${record.helpers.join(", ")}`);
  if (record.meets.length) lines.push(`  meets: ${record.meets.join(', ')}`);
  if (record.generates.length) lines.push(`  generates: ${record.generates.join(', ')}`);
  return lines.join('\n');
}
