// Change a command (LA-AUT-CMD241): Changes a command's title or description, or the events it raises, the specifications it checks or the domain services it calls (each list whole). The entity it changes does not change.
import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CommandRow } from '../../../platform/data/tables.ts';
import { changed, COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The command's changes: a column given is set; a list given replaces its list. */
export type ChangeCommand = Pick<CommandRow, 'id'> & { title?: string; description?: string; raises?: string[]; checks?: string[]; calls?: string[] };

/** Change a command (LA-AUT-CMD241). */
export const CHANGE_COMMAND: CommandDefinition<ChangeCommand> = {
  id: 'LA-AUT-CMD241',
  slice: COMMAND_SLICE,
  name: 'change-command',
  description: "Changes a command's title or description, or the events it raises, the specifications it checks or the domain services it calls (each list whole). The entity it changes does not change.",
  method: 'POST',
  route: '/api/command/change-command',
  input: {
    id: column('command', 'id', 'required'),
    title: column('command', 'title', 'optional'),
    description: column('command', 'description', 'optional'),
    raises: ids('The events of its aggregate it raises. Replaces the list.', 'optional'),
    checks: ids('The specifications of its domain it checks before it acts. Replaces the list.', 'optional'),
    calls: ids('The domain services of its domain it calls. Replaces the list.', 'optional'),
  },
  handler: changeCommand,
};

/** Changes the command's columns and links. */
export function changeCommand(tx: Transaction, input: ChangeCommand): void {
  const commands = new CommandRepository(tx);
  const command = commands.load(input.id) ?? tx.refuse('missing', `there is no command ${input.id}`);
  command.command = changed(command.command, input, ['title', 'description']);
  command.raises = input.raises ?? command.raises;
  command.checks = input.checks ?? command.checks;
  command.calls = input.calls ?? command.calls;
  holdToRules(tx, command);
  commands.save(command);
}
