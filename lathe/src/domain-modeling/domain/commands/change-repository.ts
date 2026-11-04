import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { RepositoryRow } from '../../../platform/data/tables.ts';
import { CHANGE_REPOSITORY_IDENTITY } from './identities.generated.ts';
import { changeRepository } from './handlers.generated.ts';

/** The repository's changes: a column given is set, null clears an optional one or the aggregate it persists; a list given replaces the list. */
export type ChangeRepository = Pick<RepositoryRow, 'id'> & { title?: RepositoryRow['title']; file?: RepositoryRow['file'] | null; description?: RepositoryRow['description']; persists?: string | null; stored_in?: string | null; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_REPOSITORY = {
  ...CHANGE_REPOSITORY_IDENTITY,
  input: {
    id: column('repository', 'id', 'required'),
    title: column('repository', 'title', 'optional'),
    file: column('repository', 'file', 'clearable'),
    description: column('repository', 'description', 'optional'),
    persists: id('The aggregate it loads and saves, whole: one of its own domain.', 'clearable'),
    stored_in: id('The data store it loads and saves its aggregate in.', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeRepository,
} satisfies CommandDefinition<ChangeRepository>;
