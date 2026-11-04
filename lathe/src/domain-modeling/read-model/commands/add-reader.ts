import { column, id, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ReaderRow } from '../../../platform/data/tables.ts';
import { ADD_READER_IDENTITY } from './identities.generated.ts';
import { addReader } from './handlers.generated.ts';

export type AddReader = Pick<ReaderRow, 'id' | 'title' | 'read_model_id' | 'file' | 'description'> & { stored_in?: string; meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_READER = {
  ...ADD_READER_IDENTITY,
  input: {
    id: column('reader', 'id', 'required'),
    title: column('reader', 'title', 'required'),
    read_model_id: column('reader', 'read_model_id', 'required'),
    file: column('reader', 'file', 'optional'),
    description: column('reader', 'description', 'required'),
    stored_in: id("The data store it reads its read model's table in.", 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addReader,
} satisfies CommandDefinition<AddReader>;
