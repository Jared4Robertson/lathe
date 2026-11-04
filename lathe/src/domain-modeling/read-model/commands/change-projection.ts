import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ProjectionRow } from '../../../platform/data/tables.ts';
import { CHANGE_PROJECTION_IDENTITY } from './identities.generated.ts';
import { changeProjection } from './handlers.generated.ts';

/** The projection's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeProjection = Pick<ProjectionRow, 'id'> & { title?: ProjectionRow['title']; file?: ProjectionRow['file'] | null; description?: ProjectionRow['description']; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_PROJECTION = {
  ...CHANGE_PROJECTION_IDENTITY,
  input: {
    id: column('projection', 'id', 'required'),
    title: column('projection', 'title', 'optional'),
    file: column('projection', 'file', 'clearable'),
    description: column('projection', 'description', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeProjection,
} satisfies CommandDefinition<ChangeProjection>;
