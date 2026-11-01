import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { RepositoryRow } from '../../../platform/data/tables.ts';
import { ADD_REPOSITORY_IDENTITY } from './identities.generated.ts';
import { addRepository } from './handlers.generated.ts';

export type AddRepository = Pick<RepositoryRow, 'id' | 'title' | 'domain_id' | 'file' | 'description'> & { persists?: string; stored_in?: string; meets?: string[]; packages?: string[] };

export const ADD_REPOSITORY = {
  ...ADD_REPOSITORY_IDENTITY,
  input: {
    id: column('repository', 'id', 'required'),
    title: column('repository', 'title', 'required'),
    domain_id: column('repository', 'domain_id', 'required'),
    file: column('repository', 'file', 'optional'),
    description: column('repository', 'description', 'required'),
    persists: id('The aggregate it loads and saves, whole: one of its own domain.', 'optional'),
    stored_in: id('The data store it loads and saves its aggregate in.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addRepository,
} satisfies CommandDefinition<AddRepository>;
