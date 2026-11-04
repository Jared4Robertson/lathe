import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ValueTypeRow } from '../../../platform/data/tables.ts';
import { ADD_VALUE_TYPE_IDENTITY } from './identities.generated.ts';
import { addValueType } from './handlers.generated.ts';

export type AddValueType = Pick<ValueTypeRow, 'id' | 'title' | 'value_object_id' | 'file'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_VALUE_TYPE = {
  ...ADD_VALUE_TYPE_IDENTITY,
  input: {
    id: column('value_type', 'id', 'required'),
    title: column('value_type', 'title', 'required'),
    value_object_id: column('value_type', 'value_object_id', 'required'),
    file: column('value_type', 'file', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addValueType,
} satisfies CommandDefinition<AddValueType>;
