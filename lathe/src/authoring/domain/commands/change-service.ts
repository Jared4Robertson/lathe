import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ServiceRow } from '../../../platform/data/tables.ts';
import { CHANGE_SERVICE_IDENTITY } from './identities.generated.ts';
import { changeService } from './handlers.generated.ts';

/** The service's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeService = Pick<ServiceRow, 'id'> & { title?: ServiceRow['title']; file?: ServiceRow['file'] | null; meets?: string[]; packages?: string[] };

export const CHANGE_SERVICE = {
  ...CHANGE_SERVICE_IDENTITY,
  input: {
    id: column('service', 'id', 'required'),
    title: column('service', 'title', 'optional'),
    file: column('service', 'file', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeService,
} satisfies CommandDefinition<ChangeService>;
