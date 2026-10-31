import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CommandRow } from '../../../platform/data/tables.ts';
import { COMMAND_SLICE, newCommand } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type AddCommand = Pick<CommandRow, 'id' | 'title' | 'entity_id' | 'description'> & { raises?: string[]; checks?: string[]; calls?: string[] };

export const ADD_COMMAND: CommandDefinition<AddCommand> = {
  id: 'LA-AUT-CMD240',
  slice: COMMAND_SLICE,
  name: 'add-command',
  description: 'Adds a command under the entity it changes, with the events of its aggregate it raises, the specifications it checks and the domain services it calls.',
  method: 'POST',
  route: '/api/command/add-command',
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
};

export function addCommand(tx: Transaction, input: AddCommand): void {
  const commands = new CommandRepository(tx);
  const { raises = [], checks = [], calls = [], ...row } = input;
  const command = commands.create(newCommand(row, { raises, checks, calls }));
  holdToRules(tx, command);
  commands.save(command);
}
