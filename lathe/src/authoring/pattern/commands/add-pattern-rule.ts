import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRuleRow } from '../../../platform/data/tables.ts';
import { PATTERN_SLICE } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new pattern rule. */
export type AddPatternRule = Pick<PatternRuleRow, 'id' | 'title' | 'pattern_id' | 'statement' | 'group_name' | 'notes'>;

export const ADD_PATTERN_RULE: CommandDefinition<AddPatternRule> = {
  id: 'LA-AUT-CMD193',
  slice: PATTERN_SLICE,
  name: 'add-pattern-rule',
  description: 'Adds a rule to its pattern, owed by every follower.',
  method: 'POST',
  route: '/api/pattern/add-pattern-rule',
  input: {
    id: column('pattern_rule', 'id', 'required'),
    title: column('pattern_rule', 'title', 'required'),
    pattern_id: column('pattern_rule', 'pattern_id', 'required'),
    statement: column('pattern_rule', 'statement', 'required'),
    group_name: column('pattern_rule', 'group_name', 'optional'),
    notes: column('pattern_rule', 'notes', 'optional'),
  },
  handler: addPatternRule,
};

/** Adds the rule to its pattern. */
export function addPatternRule(tx: Transaction, input: AddPatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.pattern_id) ?? tx.refuse('missing', `there is no pattern ${input.pattern_id}`);
  pattern.rules.push(input);
  holdToRules(tx, pattern);
  patterns.save(pattern);
}
