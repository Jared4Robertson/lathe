import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PolicyRow } from '../../../platform/data/tables.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_POLICY_IDENTITY } from './identities.generated.ts';

export type AddPolicy = Pick<PolicyRow, 'id' | 'title' | 'command_id' | 'statement'> & { hears?: string };

export const ADD_POLICY = {
  ...ADD_POLICY_IDENTITY,
  input: {
    id: column('policy', 'id', 'required'),
    title: column('policy', 'title', 'required'),
    command_id: column('policy', 'command_id', 'required'),
    statement: column('policy', 'statement', 'required'),
    hears: id('The event it hears: of its own domain, or another domain\'s published one.', 'optional'),
  },
  handler: addPolicy,
} satisfies CommandDefinition<AddPolicy>;

export function addPolicy(tx: Transaction, input: AddPolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('command', input.command_id) ?? tx.refuse('missing', `there is no command ${input.command_id}`);
  const { hears, ...row } = input;
  command.policies.push({ row, hears: hears ?? null });
  holdToRules(tx, command);
  commands.save(command);
}
