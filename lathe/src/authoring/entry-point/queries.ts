// The Entry point aggregate's own reads (read model LA-AUT-RM40): an entry point whole, the entry points of a domain, and the
// next free ID for one. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { entryPointsFrom, ENTRY_POINT_SLICE, type EntryPoint } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The entry point with this ID, whole. */
export function getEntryPoint(view: ReadView, input: { id: string }): EntryPoint {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'entry_point') refuse('kind', `${input.id} is ${/^[aeiou]/.test(record.kind) ? 'an' : 'a'} ${record.kind}, not an entry point`);
  return entryPointsFrom((table) => view.rows(table), input.id)[0];
}

/** Get an entry point whole (LA-AUT-QRY120). */
export const GET_ENTRY_POINT: QueryDefinition<{ id: string }, EntryPoint> = {
  id: 'LA-AUT-QRY120',
  slice: ENTRY_POINT_SLICE,
  name: 'get-entry-point',
  description: 'Reads an entry point whole, by its ID: its row, the packages it uses and the standard rules it meets.',
  method: 'GET',
  route: '/api/entry-point/get-entry-point',
  input: { id: id('The entry point.', 'required') },
  run: getEntryPoint,
  text: entryPointText,
};

/** The entry points of a domain, by ID. */
export function listEntryPoints(view: ReadView, input: { domain_id: string }): { id: string; title: string }[] {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return view
    .rows('entry_point')
    .filter((r) => r.domain_id === input.domain_id)
    .map((r) => ({ id: String(r.id), title: String(r.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the entry points of a domain (LA-AUT-QRY121). */
export const LIST_ENTRY_POINTS: QueryDefinition<{ domain_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY121',
  slice: ENTRY_POINT_SLICE,
  name: 'list-entry-points',
  description: 'Lists the entry points of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/entry-point/list-entry-points',
  input: { domain_id: id('The domain.', 'required') },
  run: listEntryPoints,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No entry points.'),
};

/** The next free ID for an entry point of the domain: its domain's ID and ENTRY, one past the highest number in use. */
export function nextEntryPointId(view: ReadView, input: { domain_id: string }): string {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('parent', `an entry point sits under a domain, and ${input.domain_id} is not one`);
  const prefix = `${input.domain_id}-ENTRY`;
  let highest = 0;
  for (const row of view.rows('entry_point')) {
    const id = String(row.id);
    if (id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length))) highest = Math.max(highest, Number(id.slice(prefix.length)));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** Get the next ID for an entry point (LA-AUT-QRY122). */
export const NEXT_ENTRY_POINT_ID: QueryDefinition<{ domain_id: string }, string> = {
  id: 'LA-AUT-QRY122',
  slice: ENTRY_POINT_SLICE,
  name: 'next-id',
  description: 'The next free ID for an entry point of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/entry-point/next-id',
  input: { domain_id: id('The domain it will sit under.', 'required') },
  run: nextEntryPointId,
  text: (next) => next,
};

/** An entry point as text: its row, then what it uses and meets. */
function entryPointText(record: EntryPoint): string {
  const row = record.entryPoint;
  const lines = [`Entry point ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, ...(row.file ? [`  file: ${row.file}`] : [])];
  lines.push(`  description: ${row.description}`);
  if (record.packages.length) lines.push(`  packages: ${record.packages.join(', ')}`);
  if (record.meets.length) lines.push(`  meets: ${record.meets.join(', ')}`);
  return lines.join('\n');
}

/** The Entry point aggregate's queries, as the CLI and the MCP server register them. */
export const ENTRY_POINT_QUERIES: readonly AnyQuery[] = [GET_ENTRY_POINT, LIST_ENTRY_POINTS, NEXT_ENTRY_POINT_ID];
