// Generated from data/ by `npm run generate`. Do not edit.
// The standard commands whose handler is the pattern: load the standard, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { StandardRepository } from '../repository.ts';
import type { AddStandard } from './add-standard.ts';
import type { ChangeStandard } from './change-standard.ts';
import type { RemoveStandard } from './remove-standard.ts';
import type { AddStandardRule } from './add-standard-rule.ts';
import type { ChangeStandardRule } from './change-standard-rule.ts';
import type { RemoveStandardRule } from './remove-standard-rule.ts';
import type { AddStandardRuleTest } from './add-standard-rule-test.ts';
import type { ChangeStandardRuleTest } from './change-standard-rule-test.ts';
import type { RemoveStandardRuleTest } from './remove-standard-rule-test.ts';

/** Adds a standard to its product, with no rules yet. */
export function addStandard(tx: Transaction, input: AddStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.create({ root: input.id, standard: input, rules: [], ruleTests: [] });
  standards.save(standard);
}

/** Changes a standard's title or description. Its product never changes. */
export function changeStandard(tx: Transaction, input: ChangeStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.id) ?? tx.refuse('missing', `there is no standard ${input.id}`);
  standard.standard = changed(standard.standard, input, ['title', 'type', 'description']);
  standards.save(standard);
}

/** Removes a standard whole: its rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a technical record that meets a rule. */
export function removeStandard(tx: Transaction, input: RemoveStandard): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.id) ?? tx.refuse('missing', `there is no standard ${input.id}`);
  standards.remove(standard);
}

/** Adds a rule to its standard. */
export function addStandardRule(tx: Transaction, input: AddStandardRule): void {
  const standards = new StandardRepository(tx);
  const standard = standards.load(input.standard_id) ?? tx.refuse('missing', `there is no standard ${input.standard_id}`);
  standard.rules.push(input);
  standards.save(standard);
}

/** Changes a standard rule's title, statement or group. */
export function changeStandardRule(tx: Transaction, input: ChangeStandardRule): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule', input.id) ?? tx.refuse('missing', `there is no standard rule ${input.id}`);
  standard.rules = standard.rules.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name']) : x));
  standards.save(standard);
}

/** Removes a standard rule with its tests and the links they start. Refused while a technical record meets it or anything else references it or its tests. */
export function removeStandardRule(tx: Transaction, input: RemoveStandardRule): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule', input.id) ?? tx.refuse('missing', `there is no standard rule ${input.id}`);
  standard.rules = standard.rules.filter((x) => x.id !== input.id);
  standard.ruleTests = standard.ruleTests.filter((x) => x.row.standard_rule_id !== input.id);
  standards.save(standard);
}

/** Adds a standard rule test under its rule, with the test data sets it starts from. */
export function addStandardRuleTest(tx: Transaction, input: AddStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule', input.standard_rule_id) ?? tx.refuse('missing', `there is no standard rule ${input.standard_rule_id}`);
  const { starts_from = [], ...row } = input;
  standard.ruleTests.push({ row, startsFrom: starts_from });
  standards.save(standard);
}

/** Changes a standard rule test's way of running or the test data sets it starts from (the whole list). */
export function changeStandardRuleTest(tx: Transaction, input: ChangeStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule_test', input.id) ?? tx.refuse('missing', `there is no standard rule test ${input.id}`);
  standard.ruleTests = standard.ruleTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  standards.save(standard);
}

/** Removes a standard rule test and the links it starts. Refused while anything references it. */
export function removeStandardRuleTest(tx: Transaction, input: RemoveStandardRuleTest): void {
  const standards = new StandardRepository(tx);
  const standard = standards.loadHolding('standard_rule_test', input.id) ?? tx.refuse('missing', `there is no standard rule test ${input.id}`);
  standard.ruleTests = standard.ruleTests.filter((x) => x.row.id !== input.id);
  standards.save(standard);
}
