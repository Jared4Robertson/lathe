import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { DataModelRow } from '../../../platform/data/tables.ts';
import { ADD_DATA_MODEL_IDENTITY } from './identities.generated.ts';
import { addDataModel } from './handlers.generated.ts';

export type AddDataModel = Pick<DataModelRow, 'id' | 'title' | 'entity_id' | 'file'> & { meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_DATA_MODEL = {
  ...ADD_DATA_MODEL_IDENTITY,
  input: {
    id: column('data_model', 'id', 'required'),
    title: column('data_model', 'title', 'required'),
    entity_id: column('data_model', 'entity_id', 'required'),
    file: column('data_model', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addDataModel,
} satisfies CommandDefinition<AddDataModel>;
