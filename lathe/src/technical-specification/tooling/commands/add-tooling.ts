import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { ADD_TOOLING_IDENTITY } from './identities.generated.ts';
import { addTooling } from './handlers.generated.ts';

export type AddTooling = Pick<ToolingRow, 'id' | 'title' | 'domain_id' | 'file'> & { packages?: string[]; meets?: string[]; generates?: string[] };

export const ADD_TOOLING = {
  ...ADD_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
    title: column('tooling', 'title', 'required'),
    domain_id: column('tooling', 'domain_id', 'required'),
    file: column('tooling', 'file', 'optional'),
    packages: texts('The packages it uses, as the product\'s package.json files list them.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    generates: ids('The technical records it generates: derived, never written by hand.', 'optional'),
  },
  handler: addTooling,
} satisfies CommandDefinition<AddTooling>;
