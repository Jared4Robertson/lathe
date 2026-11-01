import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { CommandRow } from '../../../platform/data/tables.ts';
import { ADD_COMMAND_IDENTITY } from './identities.generated.ts';
import { addCommand } from './handlers.generated.ts';

export type AddCommand = Pick<CommandRow, 'id' | 'title' | 'entity_id' | 'description'> & { raises?: string[]; checks?: string[]; calls?: string[] };

export const ADD_COMMAND = {
  ...ADD_COMMAND_IDENTITY,
  input: {
    id: column('command', 'id', 'required'),
    title: column('command', 'title', 'required'),
    entity_id: column('command', 'entity_id', 'required'),
    description: column('command', 'description', 'required'),
    raises: ids('The events of its aggregate it raises: only those a policy hears or a read model is fed by.', 'optional'),
    checks: ids('The specifications of its domain it checks before it acts.', 'optional'),
    calls: ids('The domain services of its domain it calls.', 'optional'),
  },
  handler: addCommand,
} satisfies CommandDefinition<AddCommand>;
