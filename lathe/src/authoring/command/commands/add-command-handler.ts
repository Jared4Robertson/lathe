import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CommandHandlerRow } from '../../../platform/data/tables.ts';
import { CommandRepository } from '../repository.ts';
import { commandOneEach, holdToRules } from '../rules.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { ADD_COMMAND_HANDLER_IDENTITY } from './identities.generated.ts';

export type AddCommandHandler = Pick<CommandHandlerRow, 'id' | 'title' | 'command_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

export const ADD_COMMAND_HANDLER: CommandDefinition<AddCommandHandler> = {
  ...ADD_COMMAND_HANDLER_IDENTITY,
  input: {
    id: column('command_handler', 'id', 'required'),
    title: column('command_handler', 'title', 'required'),
    command_id: column('command_handler', 'command_id', 'required'),
    file: column('command_handler', 'file', 'optional'),
    description: column('command_handler', 'description', 'required'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addCommandHandler,
};

/** Adds the handler to its command, refused when the command has one. */
export function addCommandHandler(tx: Transaction, input: AddCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command', input.command_id) ?? tx.refuse('missing', `there is no command ${input.command_id}`);
  const { meets = [], packages = [], ...row } = input;
  refuseBroken(commandOneEach([...(command.handler ? [command.handler.row] : []), row], [], [], []));
  command.handler = { row, meets, packages };
  holdToRules(tx, command);
  commands.save(command);
}
