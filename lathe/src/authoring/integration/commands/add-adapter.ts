import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { AdapterRow } from '../../../platform/data/tables.ts';
import { ADD_ADAPTER_IDENTITY } from './identities.generated.ts';
import { addAdapter } from './handlers.generated.ts';

export type AddAdapter = Pick<AdapterRow, 'id' | 'title' | 'integration_id' | 'description' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_ADAPTER = {
  ...ADD_ADAPTER_IDENTITY,
  input: {
    id: column('adapter', 'id', 'required'),
    title: column('adapter', 'title', 'required'),
    integration_id: column('adapter', 'integration_id', 'required'),
    description: column('adapter', 'description', 'required'),
    file: column('adapter', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts("The packages it uses, each listed in one of the product's package.json files.", 'optional'),
  },
  handler: addAdapter,
} satisfies CommandDefinition<AddAdapter>;
