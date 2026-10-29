// The Tooling aggregate's own reads (read model LA-AUT-RM41): a tooling record whole, the tooling records of a domain, and the
// next free ID for one. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { toolingsFrom, TOOLING_SLICE, type Tooling } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The tooling record with this ID, whole. */
export function getTooling(view: ReadView, input: { id: string }): Tooling {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'tooling') refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not a tooling record`);
  return toolingsFrom((table) => view.rows(table), input.id)[0];
}

/** Get a tooling record whole (LA-AUT-QRY123). */
export const GET_TOOLING: QueryDefinition<{ id: string }, Tooling> = {
  id: 'LA-AUT-QRY123',
  slice: TOOLING_SLICE,
  name: 'get-tooling',
  description: 'Reads a tooling record whole, by its ID: its row, the packages it uses and the standard rules it meets.',
  method: 'GET',
  route: '/api/tooling/get-tooling',
  input: { id: id('The tooling record.', 'required') },
  run: getTooling,
  text: toolingText,
};

/** The tooling records of a domain, by ID. */
export function listTooling(view: ReadView, input: { domain_id: string }): { id: string; title: string }[] {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return view
    .rows('tooling')
    .filter((r) => r.domain_id === input.domain_id)
    .map((r) => ({ id: String(r.id), title: String(r.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the tooling records of a domain (LA-AUT-QRY124). */
export const LIST_TOOLING: QueryDefinition<{ domain_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY124',
  slice: TOOLING_SLICE,
  name: 'list-tooling',
  description: 'Lists the tooling records of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/tooling/list-tooling',
  input: { domain_id: id('The domain.', 'required') },
  run: listTooling,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No tooling records.'),
};

/** The next free ID for a tooling record of the domain: its domain's ID and TOOL, one past the highest number in use. */
export function nextToolingId(view: ReadView, input: { domain_id: string }): string {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('parent', `a tooling record sits under a domain, and ${input.domain_id} is not one`);
  const prefix = `${input.domain_id}-TOOL`;
  let highest = 0;
  for (const row of view.rows('tooling')) {
    const id = String(row.id);
    if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) highest = Math.max(highest, Number(id.slice(prefix.length)));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** Get the next ID for a tooling record (LA-AUT-QRY125). */
export const NEXT_TOOLING_ID: QueryDefinition<{ domain_id: string }, string> = {
  id: 'LA-AUT-QRY125',
  slice: TOOLING_SLICE,
  name: 'next-id',
  description: 'The next free ID for a tooling record of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/tooling/next-id',
  input: { domain_id: id('The domain it will sit under.', 'required') },
  run: nextToolingId,
  text: (next) => next,
};

/** A tooling record as text: its row, then what it uses and meets. */
function toolingText(record: Tooling): string {
  const row = record.tooling;
  const lines = [`Tooling ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, ...(row.file ? [`  file: ${row.file}`] : [])];

  if (record.packages.length) lines.push(`  packages: ${record.packages.join(', ')}`);
  if (record.meets.length) lines.push(`  meets: ${record.meets.join(', ')}`);
  return lines.join('\n');
}

/** The Tooling aggregate's queries, as the CLI and the MCP server register them. */
export const TOOLING_QUERIES: readonly AnyQuery[] = [GET_TOOLING, LIST_TOOLING, NEXT_TOOLING_ID];
