// The Library aggregate's own reads (read model LA-MOD-RM46): a library's page, the libraries of a domain, and the next free
// ID for one. Each reads only the read model, through its reader (reader.ts), and changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { LibraryPage, LibrarySummary } from './read-model.ts';
import { libraryReader, type LibraryReader } from './reader.ts';
import { GET_LIBRARY_IDENTITY, LIST_LIBRARIES_IDENTITY, NEXT_LIBRARY_ID_IDENTITY } from './queries.generated.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The library with this ID, whole. */
export function getLibrary(reader: LibraryReader, input: { id: string }): LibraryPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (kind !== 'library') refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a library`);
  return reader.page(input.id)!;
}

/** Get a library (LA-MOD-QRY234). */
export const GET_LIBRARY: QueryDefinition<{ id: string }, LibraryPage, LibraryReader> = {
  ...GET_LIBRARY_IDENTITY,
  input: { id: id('The library.', 'required') },
  reader: libraryReader,
  run: getLibrary,
  text: libraryText,
};

/** The libraries of a domain, by ID. */
export function listLibraries(reader: LibraryReader, input: { domain_id: string }): LibrarySummary[] {
  if (reader.kindOf(input.domain_id) !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return reader.list(input.domain_id);
}

/** List a domain's libraries (LA-MOD-QRY235). */
export const LIST_LIBRARIES: QueryDefinition<{ domain_id: string }, LibrarySummary[], LibraryReader> = {
  ...LIST_LIBRARIES_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: libraryReader,
  run: listLibraries,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No libraries.'),
};

/** The next free ID for a library of the domain: its domain's ID and its letters, one past the highest number in use. */
export function nextLibraryId(reader: LibraryReader, input: { domain_id: string }): string {
  const shape = reader.idShape('library');
  if (reader.kindOf(input.domain_id) !== shape.parents[0]) refuse('parent', `a library sits under a domain, and ${input.domain_id} is not one`);
  return onePast(reader, `${input.domain_id}-${shape.letters}`, shape);
}

/** Get the next library ID (LA-MOD-QRY236). */
export const NEXT_LIBRARY_ID: QueryDefinition<{ domain_id: string }, string, LibraryReader> = {
  ...NEXT_LIBRARY_ID_IDENTITY,
  input: { domain_id: id('The domain it will sit under.', 'required') },
  reader: libraryReader,
  run: nextLibraryId,
  text: (next) => next,
};

/** A library as text: its row, what it serves, then the guarantees it makes. */
function libraryText(page: LibraryPage): string {
  const row = page.library;
  const lines = [`Library ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  description: ${row.description}`];
  if (page.serves.length) lines.push(`  serves: ${page.serves.join(', ')}`);
  for (const g of page.guarantees) lines.push(`Guarantee ${g.id}: ${g.title}`);
  return lines.join('\n');
}
