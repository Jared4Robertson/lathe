import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { TermRow } from '../../../platform/data/tables.ts';
import { ADD_TERM_IDENTITY } from './identities.generated.ts';
import { addTerm } from './handlers.generated.ts';

export type AddTerm = Pick<TermRow, 'id' | 'title' | 'domain_id' | 'meaning' | 'group_name'> & { builds_on?: string[] };

export const ADD_TERM = {
  ...ADD_TERM_IDENTITY,
  input: {
    id: column('term', 'id', 'required'),
    title: column('term', 'title', 'required'),
    domain_id: column('term', 'domain_id', 'required'),
    meaning: column('term', 'meaning', 'required'),
    group_name: column('term', 'group_name', 'optional'),
    builds_on: ids('The terms its meaning uses, of any domain of the product, each defined without it.', 'optional'),
  },
  handler: addTerm,
} satisfies CommandDefinition<AddTerm>;
