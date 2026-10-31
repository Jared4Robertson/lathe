import { column, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { PatternRuleTestRow } from '../../../platform/data/tables.ts';
import { PATTERN_SLICE } from '../model.ts';
import { PatternRepository } from '../repository.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import { patternRuleTestPerDomain } from '../rules.ts';

export type AddPatternRuleTest = Pick<PatternRuleTestRow, 'id' | 'title' | 'pattern_rule_id' | 'domain_id' | 'level' | 'state' | 'file' | 'manual_reason' | 'size' | 'smoke' | 'external' | 'when' | 'then' | 'notes'> & { starts_from?: string[] };

export const ADD_PATTERN_RULE_TEST: CommandDefinition<AddPatternRuleTest> = {
  id: 'LA-AUT-CMD196',
  slice: PATTERN_SLICE,
  name: 'add-pattern-rule-test',
  description: 'Adds a test of a pattern rule in one domain that follows its pattern, with the test data sets it starts from.',
  method: 'POST',
  route: '/api/pattern/add-pattern-rule-test',
  input: {
    id: column('pattern_rule_test', 'id', 'required'),
    title: column('pattern_rule_test', 'title', 'required'),
    pattern_rule_id: column('pattern_rule_test', 'pattern_rule_id', 'required'),
    domain_id: column('pattern_rule_test', 'domain_id', 'required'),
    level: column('pattern_rule_test', 'level', 'required'),
    state: column('pattern_rule_test', 'state', 'required'),
    file: column('pattern_rule_test', 'file', 'optional'),
    manual_reason: column('pattern_rule_test', 'manual_reason', 'optional'),
    size: column('pattern_rule_test', 'size', 'optional'),
    smoke: column('pattern_rule_test', 'smoke', 'optional'),
    external: column('pattern_rule_test', 'external', 'optional'),
    when: column('pattern_rule_test', 'when', 'required'),
    then: column('pattern_rule_test', 'then', 'required'),
    notes: column('pattern_rule_test', 'notes', 'optional'),
    starts_from: ids('The test data sets it starts from.', 'optional'),
  },
  handler: addPatternRuleTest,
};

export function addPatternRuleTest(tx: Transaction, input: AddPatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.pattern_rule_id) ?? tx.refuse('missing', `there is no pattern rule ${input.pattern_rule_id}`);
  const { starts_from = [], ...row } = input;
  pattern.ruleTests.push({ row, startsFrom: starts_from });
  refuseBroken(patternRuleTestPerDomain(pattern.ruleTests.map((t) => t.row)));
  patterns.save(pattern);
}
