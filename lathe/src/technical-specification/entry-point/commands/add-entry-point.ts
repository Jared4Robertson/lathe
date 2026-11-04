import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EntryPointRow } from '../../../platform/data/tables.ts';
import { ADD_ENTRY_POINT_IDENTITY } from './identities.generated.ts';
import { addEntryPoint } from './handlers.generated.ts';

export type AddEntryPoint = Pick<EntryPointRow, 'id' | 'title' | 'domain_id' | 'file' | 'description'> & { packages?: string[]; helpers?: string[]; meets?: string[] };

export const ADD_ENTRY_POINT = {
  ...ADD_ENTRY_POINT_IDENTITY,
  input: {
    id: column('entry_point', 'id', 'required'),
    title: column('entry_point', 'title', 'required'),
    domain_id: column('entry_point', 'domain_id', 'required'),
    file: column('entry_point', 'file', 'optional'),
    description: column('entry_point', 'description', 'required'),
    packages: texts('The packages it uses, as the product\'s package.json files list them.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
  },
  handler: addEntryPoint,
} satisfies CommandDefinition<AddEntryPoint>;
