import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { SpecificationRow } from '../../../platform/data/tables.ts';
import { ADD_SPECIFICATION_IDENTITY } from './identities.generated.ts';
import { addSpecification } from './handlers.generated.ts';

export type AddSpecification = Pick<SpecificationRow, 'id' | 'title' | 'statement'> & { reads?: string[] };

export const ADD_SPECIFICATION = {
  ...ADD_SPECIFICATION_IDENTITY,
  input: {
    id: column('specification', 'id', 'required'),
    title: column('specification', 'title', 'required'),
    statement: column('specification', 'statement', 'required'),
    reads: ids('The aggregates it reads, of its own domain.', 'optional'),
  },
  handler: addSpecification,
} satisfies CommandDefinition<AddSpecification>;
