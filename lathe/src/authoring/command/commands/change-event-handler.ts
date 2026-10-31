import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EventHandlerRow } from '../../../platform/data/tables.ts';
import { changed, COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The event handler's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEventHandler = Pick<EventHandlerRow, 'id'> & { title?: string; file?: string | null; description?: string; meets?: string[]; packages?: string[] };

export const CHANGE_EVENT_HANDLER: CommandDefinition<ChangeEventHandler> = {
  id: 'LA-AUT-CMD250',
  slice: COMMAND_SLICE,
  name: 'change-event-handler',
  description: "Changes an event handler's title, file or description, or the standard rules it meets or the packages it uses (each list whole). Its policy does not change.",
  method: 'POST',
  route: '/api/command/change-event-handler',
  input: {
    id: column('event_handler', 'id', 'required'),
    title: column('event_handler', 'title', 'optional'),
    file: column('event_handler', 'file', 'clearable'),
    description: column('event_handler', 'description', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeEventHandler,
};

/** Changes the event handler's columns and links. */
export function changeEventHandler(tx: Transaction, input: ChangeEventHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('event_handler', input.id) ?? tx.refuse('missing', `there is no event handler ${input.id}`);
  command.eventHandlers = command.eventHandlers.map((h) =>
    h.row.id === input.id ? { row: changed(h.row, input, ['title', 'file', 'description']), meets: input.meets ?? h.meets, packages: input.packages ?? h.packages } : h,
  );
  holdToRules(tx, command);
  commands.save(command);
}
