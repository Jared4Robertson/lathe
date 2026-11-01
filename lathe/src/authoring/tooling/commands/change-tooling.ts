import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { CHANGE_TOOLING_IDENTITY } from './identities.generated.ts';
import { changeTooling } from './handlers.generated.ts';

/** The tooling record's changes: a column given is set; packages, meets and generates, when given, replace the list. */
export type ChangeTooling = Pick<ToolingRow, 'id'> & { title?: string; file?: string | null; packages?: string[]; meets?: string[]; generates?: string[] };

export const CHANGE_TOOLING = {
  ...CHANGE_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
    title: column('tooling', 'title', 'optional'),
    file: column('tooling', 'file', 'clearable'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    generates: ids('The technical records it generates. Replaces the list.', 'optional'),
  },
  handler: changeTooling,
} satisfies CommandDefinition<ChangeTooling>;
