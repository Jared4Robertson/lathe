// The Pattern aggregate's rules, written once: each command's handler runs them on the instance it would save, and
// every load and commit runs them over all data (patternRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { PatternRuleTestRow } from '../../platform/data/tables.ts';
import { PATTERN_AGGREGATE } from './model.ts';

/**
 * Every row that breaks LA-AUT-INV105: a pattern rule has at most one pattern rule test per domain. Each test after
 * the first of its rule and domain is refused.
 */
export function patternRuleTestPerDomain(tests: readonly PatternRuleTestRow[]): RuleProblem[] {
  return beyondFirst(tests, (r) => `${r.pattern_rule_id} ${r.domain_id}`).map((r) => ({
    rule: 'pattern-rule-test-per-domain',
    table: 'pattern_rule_test',
    row: r as unknown as Row,
    message: `pattern rule ${r.pattern_rule_id} already has its test for domain ${r.domain_id}, so ${r.id} cannot be a second: a rule has one test per domain`,
  }));
}

/** The rules over all data. */
export const patternRules: AggregateRules = {
  aggregate: PATTERN_AGGREGATE,
  check: (view) => patternRuleTestPerDomain(view.rows('pattern_rule_test') as unknown as PatternRuleTestRow[]),
};
