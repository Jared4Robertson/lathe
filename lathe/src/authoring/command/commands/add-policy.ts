import { column, id, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { PolicyRow } from '../../../platform/data/tables.ts';
import { ADD_POLICY_IDENTITY } from './identities.generated.ts';
import { addPolicy } from './handlers.generated.ts';

export type AddPolicy = Pick<PolicyRow, 'id' | 'title' | 'command_id' | 'statement'> & { hears?: string; exchanges_with?: string[] };

export const ADD_POLICY = {
  ...ADD_POLICY_IDENTITY,
  input: {
    id: column('policy', 'id', 'required'),
    title: column('policy', 'title', 'required'),
    command_id: column('policy', 'command_id', 'required'),
    statement: column('policy', 'statement', 'required'),
    hears: id('The event it hears: of its own domain, or another domain\'s published one.', 'optional'),
    exchanges_with: ids('The integrations it exchanges with as it acts, such as the mail service it sends a reminder through.', 'optional'),
  },
  handler: addPolicy,
} satisfies CommandDefinition<AddPolicy>;
