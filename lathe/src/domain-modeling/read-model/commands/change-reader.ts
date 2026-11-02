import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ReaderRow } from '../../../platform/data/tables.ts';
import { CHANGE_READER_IDENTITY } from './identities.generated.ts';
import { changeReader } from './handlers.generated.ts';

/** The reader's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeReader = Pick<ReaderRow, 'id'> & { title?: ReaderRow['title']; file?: ReaderRow['file'] | null; description?: ReaderRow['description']; stored_in?: string | null; meets?: string[]; packages?: string[] };

export const CHANGE_READER = {
  ...CHANGE_READER_IDENTITY,
  input: {
    id: column('reader', 'id', 'required'),
    title: column('reader', 'title', 'optional'),
    file: column('reader', 'file', 'clearable'),
    description: column('reader', 'description', 'optional'),
    stored_in: id("The data store it reads its read model's table in.", 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeReader,
} satisfies CommandDefinition<ChangeReader>;
