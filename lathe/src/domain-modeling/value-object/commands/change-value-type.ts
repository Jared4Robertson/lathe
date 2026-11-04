import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ValueTypeRow } from '../../../platform/data/tables.ts';
import { CHANGE_VALUE_TYPE_IDENTITY } from './identities.generated.ts';
import { changeValueType } from './handlers.generated.ts';

/** The value type's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeValueType = Pick<ValueTypeRow, 'id'> & { title?: ValueTypeRow['title']; file?: ValueTypeRow['file'] | null; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_VALUE_TYPE = {
  ...CHANGE_VALUE_TYPE_IDENTITY,
  input: {
    id: column('value_type', 'id', 'required'),
    title: column('value_type', 'title', 'optional'),
    file: column('value_type', 'file', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeValueType,
} satisfies CommandDefinition<ChangeValueType>;
