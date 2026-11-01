import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { RuleRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { AggregateRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_RULE_IDENTITY } from './identities.generated.ts';

/** The rule's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeRule = Pick<RuleRow, 'id'> & { title?: string; file?: string | null; meets?: string[]; packages?: string[] };

export const CHANGE_RULE = {
  ...CHANGE_RULE_IDENTITY,
  input: {
    id: column('rule', 'id', 'required'),
    title: column('rule', 'title', 'optional'),
    file: column('rule', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeRule,
} satisfies CommandDefinition<ChangeRule>;

/** Changes the rule's columns and links. */
export function changeRule(tx: Transaction, input: ChangeRule): void {
  const aggregates = new AggregateRepository(tx);
  const aggregate = aggregates.loadHolding('rule', input.id) ?? tx.refuse('missing', `there is no rule ${input.id}`);
  aggregate.rules = aggregate.rules.map((r) =>
    r.row.id === input.id ? { row: changed(r.row, input, ['title', 'file']), meets: input.meets ?? r.meets, packages: input.packages ?? r.packages } : r,
  );
  holdToRules(tx, aggregate);
  aggregates.save(aggregate);
}
