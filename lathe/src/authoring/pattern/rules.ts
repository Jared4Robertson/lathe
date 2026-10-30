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

/**
 * Every rule of the pattern that breaks LA-AUT-INV19: the setting it depends on and its applies-when setting are
 * settings of its pattern, and its applies-when condition is given whole (setting, negation and value) or not at all.
 */
export function patternProblems(pattern: Pattern): RuleProblem[] {
  const settings = new Set(pattern.settings.map((s) => s.name));
  const problems: RuleProblem[] = [];
  const broken = (rule: Pattern['rules'][number], message: string) =>
    problems.push({ rule: 'pattern-rule-setting', table: 'pattern_rule', row: rule as unknown as Row, message: `pattern rule ${rule.id} ${message}` });
  const given = (value: unknown) => value !== undefined && value !== null;
  for (const rule of pattern.rules) {
    if (given(rule.setting) && !settings.has(String(rule.setting))) broken(rule, `depends on setting ${String(rule.setting)}, which pattern ${pattern.root} does not have`);
    const parts = [rule.applies_when_setting, rule.applies_when_negated, rule.applies_when_value].filter(given).length;
    if (parts !== 0 && parts !== 3) broken(rule, 'gives part of its applies-when condition: give its setting, whether it is negated and its value, or none of them');
    else if (given(rule.applies_when_setting) && !settings.has(String(rule.applies_when_setting))) broken(rule, `applies when setting ${String(rule.applies_when_setting)}, which pattern ${pattern.root} does not have`);
  }
  return problems;
}

/** The rules over all data: every pattern, whole, and each rule's tests. */
export const patternRules: AggregateRules = {
  aggregate: PATTERN_AGGREGATE,
  check: (view) => [
    ...patternsFrom((table) => view.rows(table)).flatMap((pattern) => patternProblems(pattern)),
    ...patternRuleTestPerDomain(view.rows('pattern_rule_test') as unknown as PatternRuleTestRow[]),
  ],
};

/** Refuses the command, with every reason, when the pattern as it would be saved breaks one of its rules. */
export function holdToRules(_tx: Transaction, pattern: Pattern): void {
  refuseBroken(patternProblems(pattern));
}
