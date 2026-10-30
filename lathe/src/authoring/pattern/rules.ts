// The Pattern aggregate's rules, written once: each command's handler runs them on the instance it would save, and
// every load and commit runs them over all data (patternRules, listed in AGGREGATE_RULES).
import { beyondFirst, refuseBroken, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import type { PatternRuleTestRow } from '../../platform/data/tables.ts';
import { PATTERN_AGGREGATE, patternsFrom, type Pattern } from './model.ts';

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

/** Every rule the pattern breaks: LA-AUT-INV105, one pattern rule test per rule and domain. */
export function patternProblems(pattern: Pattern): RuleProblem[] {
  return patternRuleTestPerDomain(pattern.ruleTests.map((t) => t.row));
}

/** The rules over all data: every pattern, whole, and each rule's tests. */
export const patternRules: AggregateRules = {
  aggregate: PATTERN_AGGREGATE,
  check: (view) => patternsFrom((table) => view.rows(table)).flatMap((pattern) => patternProblems(pattern)),
};

/** Refuses the command, with every reason, when the pattern as it would be saved breaks one of its rules. */
export function holdToRules(_tx: Transaction, pattern: Pattern): void {
  refuseBroken(patternProblems(pattern));
}
