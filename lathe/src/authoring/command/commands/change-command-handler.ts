import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { CommandHandlerRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_COMMAND_HANDLER_IDENTITY } from './identities.generated.ts';

/** The handler's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeCommandHandler = Pick<CommandHandlerRow, 'id'> & { title?: string; file?: string | null; description?: string; meets?: string[]; packages?: string[] };

export const CHANGE_COMMAND_HANDLER: CommandDefinition<ChangeCommandHandler> = {
  ...CHANGE_COMMAND_HANDLER_IDENTITY,
  input: {
    id: column('command_handler', 'id', 'required'),
    title: column('command_handler', 'title', 'optional'),
    file: column('command_handler', 'file', 'clearable'),
    description: column('command_handler', 'description', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeCommandHandler,
};

/** Changes the handler's columns and links. */
export function changeCommandHandler(tx: Transaction, input: ChangeCommandHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command_handler', input.id) ?? tx.refuse('missing', `there is no command handler ${input.id}`);
  const handler = command.handler!;
  command.handler = { row: changed(handler.row, input, ['title', 'file', 'description']), meets: input.meets ?? handler.meets, packages: input.packages ?? handler.packages };
  holdToRules(tx, command);
  commands.save(command);
}
