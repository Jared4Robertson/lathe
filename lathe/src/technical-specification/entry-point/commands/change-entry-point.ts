import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EntryPointRow } from '../../../platform/data/tables.ts';
import { CHANGE_ENTRY_POINT_IDENTITY } from './identities.generated.ts';
import { changeEntryPoint } from './handlers.generated.ts';

/** The entry point's changes: a column given is set; packages and meets, when given, replace the list. */
export type ChangeEntryPoint = Pick<EntryPointRow, 'id'> & { title?: string; file?: string | null; description?: string; packages?: string[]; helpers?: string[]; meets?: string[] };

export const CHANGE_ENTRY_POINT = {
  ...CHANGE_ENTRY_POINT_IDENTITY,
  input: {
    id: column('entry_point', 'id', 'required'),
    title: column('entry_point', 'title', 'optional'),
    file: column('entry_point', 'file', 'clearable'),
    description: column('entry_point', 'description', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
  },
  handler: changeEntryPoint,
} satisfies CommandDefinition<ChangeEntryPoint>;
