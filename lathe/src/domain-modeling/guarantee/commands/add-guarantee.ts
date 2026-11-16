import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GuaranteeRow } from '../../../platform/data/tables.ts';
import { ADD_GUARANTEE_IDENTITY } from './identities.generated.ts';
import { addGuarantee } from './handlers.generated.ts';

export type AddGuarantee = Pick<GuaranteeRow, 'id' | 'title' | 'domain_id' | 'generated_component_id' | 'library_id' | 'statement' | 'consumers' | 'group_name'> & { kept_by?: string[]; meets?: string[] };

export const ADD_GUARANTEE = {
  ...ADD_GUARANTEE_IDENTITY,
  input: {
    id: column('guarantee', 'id', 'required'),
    title: column('guarantee', 'title', 'required'),
    domain_id: column('guarantee', 'domain_id', 'optional'),
    generated_component_id: column('guarantee', 'generated_component_id', 'optional'),
    library_id: column('guarantee', 'library_id', 'optional'),
    statement: column('guarantee', 'statement', 'required'),
    consumers: column('guarantee', 'consumers', 'optional'),
    group_name: column('guarantee', 'group_name', 'optional'),
    kept_by: ids('The building blocks that keep it: technical records and data stores, by ID.', 'optional'),
    meets: ids('The standard rules it follows in what it promises.', 'optional'),
  },
  handler: addGuarantee,
} satisfies CommandDefinition<AddGuarantee>;
