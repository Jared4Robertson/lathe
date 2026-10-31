import { column, id, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PolicyRow } from '../../../platform/data/tables.ts';
import { changed, COMMAND_SLICE } from '../model.ts';
import { CommandRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The policy's changes: a column given is set; null clears the event it hears. */
export type ChangePolicy = Pick<PolicyRow, 'id'> & { title?: string; statement?: string; hears?: string | null };

export const CHANGE_POLICY: CommandDefinition<ChangePolicy> = {
  id: 'LA-AUT-CMD247',
  slice: COMMAND_SLICE,
  name: 'change-policy',
  description: "Changes a policy's title or statement, or the event it hears; null clears the event. The command it sends does not change.",
  method: 'POST',
  route: '/api/command/change-policy',
  input: {
    id: column('policy', 'id', 'required'),
    title: column('policy', 'title', 'optional'),
    statement: column('policy', 'statement', 'optional'),
    hears: id('The event it hears: of its own domain, or another domain\'s published one.', 'clearable'),
  },
  handler: changePolicy,
};

/** Changes the policy's columns and the event it hears. */
export function changePolicy(tx: Transaction, input: ChangePolicy): void {
  const commands = new CommandRepository(tx);
  const command = commands.loadHolding('policy', input.id) ?? tx.refuse('missing', `there is no policy ${input.id}`);
  command.policies = command.policies.map((policy) =>
    policy.row.id === input.id ? { row: changed(policy.row, input, ['title', 'statement']), hears: input.hears === undefined ? policy.hears : input.hears } : policy,
  );
  holdToRules(tx, command);
  commands.save(command);
}
