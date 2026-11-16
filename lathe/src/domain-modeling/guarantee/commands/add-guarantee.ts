import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { GuaranteeRow } from '../../../platform/data/tables.ts';
import { ADD_GUARANTEE_IDENTITY } from './identities.generated.ts';
import { addGuarantee } from './handlers.generated.ts';

export type AddGuarantee = Pick<GuaranteeRow, 'id' | 'title' | 'domain_id' | 'statement'> & { kept_by?: string[] };

export const ADD_GUARANTEE = {
  ...ADD_GUARANTEE_IDENTITY,
  input: {
    id: column('guarantee', 'id', 'required'),
    title: column('guarantee', 'title', 'required'),
    domain_id: column('guarantee', 'domain_id', 'required'),
    statement: column('guarantee', 'statement', 'required'),
    kept_by: ids('The building blocks that keep it: technical records and data stores, by ID.', 'optional'),
  },
  handler: addGuarantee,
} satisfies CommandDefinition<AddGuarantee>;
