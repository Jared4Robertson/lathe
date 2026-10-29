// Add an event handler (LA-AUT-CMD249): Adds the handler that carries out a policy: its name in code, its file and what it does, with the standard rules it meets and the packages it uses. A policy has one event handler.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EventHandlerRow } from '../../../platform/data/tables.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new event handler, with the standard rules it meets and the packages it uses. */
export type AddEventHandler = Pick<EventHandlerRow, 'id' | 'title' | 'policy_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

/** Add an event handler (LA-AUT-CMD249). */
export const ADD_EVENT_HANDLER: CommandDefinition<AddEventHandler> = {
  id: 'LA-AUT-CMD249',
  slice: COMMAND_SLICE,
  name: 'add-event-handler',
  description: 'Adds the handler that carries out a policy: its name in code, its file and what it does, with the standard rules it meets and the packages it uses. A policy has one event handler.',
  method: 'POST',
  route: '/api/command/add-event-handler',
  input: {
    id: column('event_handler', 'id', 'required'),
    title: column('event_handler', 'title', 'required'),
    policy_id: column('event_handler', 'policy_id', 'required'),
    file: column('event_handler', 'file', 'optional'),
    description: column('event_handler', 'description', 'required'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addEventHandler,
};

/** Adds the event handler to its policy, refused when the policy has one. */
export function addEventHandler(tx: Transaction, input: AddEventHandler): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.policy_id) ?? tx.refuse('missing', `there is no policy ${input.policy_id}`);
  const { meets = [], packages = [], ...row } = input;
  command.eventHandlers.push({ row, meets, packages });
  holdToRules(tx, command);
  commands.save(command);
}
