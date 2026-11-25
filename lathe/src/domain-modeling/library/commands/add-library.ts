import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { LibraryRow } from '../../../platform/data/tables.ts';
import { ADD_LIBRARY_IDENTITY } from './identities.generated.ts';
import { addLibrary } from './handlers.generated.ts';

/** A new library: its row, and the business outcomes it serves. */
export type AddLibrary = Pick<LibraryRow, 'id' | 'title' | 'domain_id' | 'description'> & { serves?: string[] };

export const ADD_LIBRARY = {
  ...ADD_LIBRARY_IDENTITY,
  input: {
    id: column('library', 'id', 'required'),
    title: column('library', 'title', 'required'),
    domain_id: column('library', 'domain_id', 'required'),
    description: column('library', 'description', 'required'),
    serves: ids('The business outcomes of its product it serves: what its consumers rely on it for.', 'optional'),
  },
  handler: addLibrary,
} satisfies CommandDefinition<AddLibrary>;
