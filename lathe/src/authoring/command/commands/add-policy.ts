import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PolicyRow } from '../../../platform/data/tables.ts';
import { COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export type AddPolicy = Pick<PolicyRow, 'id' | 'title' | 'command_id' | 'statement'> & { hears?: string };

export const ADD_POLICY: CommandDefinition<AddPolicy> = {
  id: 'LA-AUT-CMD246',
  slice: COMMAND_SLICE,
  name: 'add-policy',
  description: "Adds a policy under the command it sends, with the one event it hears: its own domain's, or another domain's published one.",
  method: 'POST',
  route: '/api/command/add-policy',
  input: {
    id: column('policy', 'id', 'required'),
    title: column('policy', 'title', 'required'),
    command_id: column('policy', 'command_id', 'required'),
    statement: column('policy', 'statement', 'required'),
    hears: id('The event it hears: of its own domain, or another domain\'s published one.', 'optional'),
  },
  handler: addPolicy,
};

export function addPolicy(tx: Transaction, input: AddPolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command', input.command_id) ?? tx.refuse('missing', `there is no command ${input.command_id}`);
  const { hears, ...row } = input;
  command.policies.push({ row, hears: hears ?? null });
  holdToRules(tx, command);
  commands.save(command);
}
