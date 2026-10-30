// Change a pattern rule (LA-AUT-CMD194): Changes a pattern rule's title, statement, group, setting or notes.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRuleRow } from '../../../platform/data/tables.ts';
import { PATTERN_SLICE, changed } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The rule's changes: a column given is set, null clears an optional one. */
export type ChangePatternRule = Pick<PatternRuleRow, 'id'> & { title?: PatternRuleRow['title']; statement?: PatternRuleRow['statement']; group_name?: PatternRuleRow['group_name'] | null; setting?: PatternRuleRow['setting'] | null; notes?: PatternRuleRow['notes'] | null };

/** Change a pattern rule (LA-AUT-CMD194). */
export const CHANGE_PATTERN_RULE: CommandDefinition<ChangePatternRule> = {
  id: 'LA-AUT-CMD194',
  slice: PATTERN_SLICE,
  name: 'change-pattern-rule',
  description: "Changes a pattern rule's title, statement, group, setting or notes.",
  method: 'POST',
  route: '/api/pattern/change-pattern-rule',
  input: {
    id: column('pattern_rule', 'id', 'required'),
    title: column('pattern_rule', 'title', 'optional'),
    statement: column('pattern_rule', 'statement', 'optional'),
    group_name: column('pattern_rule', 'group_name', 'clearable'),
    setting: column('pattern_rule', 'setting', 'clearable'),
    notes: column('pattern_rule', 'notes', 'clearable'),
  },
  handler: changePatternRule,
};

/** Changes the rule's columns. */
export function changePatternRule(tx: Transaction, input: ChangePatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.id) ?? tx.refuse('missing', `there is no pattern rule ${input.id}`);
  pattern.rules = pattern.rules.map((r) => (r.id === input.id ? changed(r, input, ['title', 'statement', 'group_name', 'setting', 'notes']) : r));
  holdToRules(tx, pattern);
  patterns.save(pattern);
}
