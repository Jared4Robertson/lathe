import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { LibraryRow } from '../../../platform/data/tables.ts';
import { CHANGE_LIBRARY_IDENTITY } from './identities.generated.ts';
import { changeLibrary } from './handlers.generated.ts';

/** The library's changes: a column given is set; serves, when given, replaces the list. */
export type ChangeLibrary = Pick<LibraryRow, 'id'> & { title?: string; description?: string; serves?: string[] };

export const CHANGE_LIBRARY = {
  ...CHANGE_LIBRARY_IDENTITY,
  input: {
    id: column('library', 'id', 'required'),
    title: column('library', 'title', 'optional'),
    description: column('library', 'description', 'optional'),
    serves: ids('The business outcomes of its product it serves. Replaces the list.', 'optional'),
  },
  handler: changeLibrary,
} satisfies CommandDefinition<ChangeLibrary>;
