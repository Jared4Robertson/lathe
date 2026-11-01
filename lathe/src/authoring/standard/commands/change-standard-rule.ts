import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { StandardRuleRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { StandardRepository } from '../repository.ts';
import { CHANGE_STANDARD_RULE_IDENTITY } from './identities.generated.ts';

/** The rule's changes: a column given is set, null clears an optional one. */
export type ChangeStandardRule = Pick<StandardRuleRow, 'id'> & { title?: StandardRuleRow['title']; statement?: StandardRuleRow['statement']; group_name?: StandardRuleRow['group_name'] | null };

export const CHANGE_STANDARD_RULE = {
  ...CHANGE_STANDARD_RULE_IDENTITY,
  input: {
    id: column('standard_rule', 'id', 'required'),
    title: column('standard_rule', 'title', 'optional'),
    statement: column('standard_rule', 'statement', 'optional'),
    group_name: column('standard_rule', 'group_name', 'clearable'),
  },
  handler: changeStandardRule,
} satisfies CommandDefinition<ChangeStandardRule>;

/** Changes the rule's columns. */
export function changeStandardRule(tx: Transaction, input: ChangeStandardRule): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule', input.id) ?? tx.refuse('missing', `there is no standard rule ${input.id}`);
  standard.rules = standard.rules.map((r) => (r.id === input.id ? changed(r, input, ['title', 'statement', 'group_name']) : r));
  standards.save(standard);
}
