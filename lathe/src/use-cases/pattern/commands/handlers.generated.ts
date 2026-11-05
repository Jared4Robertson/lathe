// Generated from data/ by `npm run generate`. Do not edit.
// The pattern commands whose handler is the pattern: load the pattern, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import { refuseBroken } from '../../../platform/data/rules.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PatternRepository } from '../repository.ts';
import { holdToRules, patternRuleTestPerDomain } from '../rules.ts';
import type { AddPattern } from './add-pattern.ts';
import type { ChangePattern } from './change-pattern.ts';
import type { RemovePattern } from './remove-pattern.ts';
import type { AddPatternRule } from './add-pattern-rule.ts';
import type { ChangePatternRule } from './change-pattern-rule.ts';
import type { RemovePatternRule } from './remove-pattern-rule.ts';
import type { AddPatternRuleTest } from './add-pattern-rule-test.ts';
import type { ChangePatternRuleTest } from './change-pattern-rule-test.ts';
import type { RemovePatternRuleTest } from './remove-pattern-rule-test.ts';
import type { AddSlot } from './add-slot.ts';
import type { ChangeSlot } from './change-slot.ts';
import type { RemoveSlot } from './remove-slot.ts';

/** Adds a pattern to its product, with its settings in order. */
export function addPattern(tx: Transaction, input: AddPattern): void {
  const patterns = new PatternRepository(tx);
  if (tx.record(input.product_id)?.kind !== 'product') tx.refuse('missing', `there is no product ${input.product_id}`);
  const { settings = [], ...row } = input;
  const pattern = patterns.create({ root: row.id, pattern: row, settings: settings, rules: [], ruleTests: [], slots: [] });
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Changes a pattern's title, description or notes, or its settings (the whole list, in order). Its product never changes. */
export function changePattern(tx: Transaction, input: ChangePattern): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.id) ?? tx.refuse('missing', `there is no pattern ${input.id}`);
  pattern.pattern = changed(pattern.pattern, input, ['title', 'description', 'notes']);
  pattern.settings = input.settings ?? pattern.settings;
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Removes a pattern whole: its settings, rules and rule tests, and the links they start. Refused while anything outside it references what is in it, such as a follower. */
export function removePattern(tx: Transaction, input: RemovePattern): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.id) ?? tx.refuse('missing', `there is no pattern ${input.id}`);
  patterns.remove(pattern);
}

/** Adds a rule to its pattern, owed by every follower. */
export function addPatternRule(tx: Transaction, input: AddPatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.pattern_id) ?? tx.refuse('missing', `there is no pattern ${input.pattern_id}`);
  pattern.rules.push(input);
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Changes a pattern rule's title, statement, group or notes. */
export function changePatternRule(tx: Transaction, input: ChangePatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.id) ?? tx.refuse('missing', `there is no pattern rule ${input.id}`);
  pattern.rules = pattern.rules.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name', 'notes']) : x));
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Removes a pattern rule with its tests and the links they start. Refused while anything references it or them. */
export function removePatternRule(tx: Transaction, input: RemovePatternRule): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.id) ?? tx.refuse('missing', `there is no pattern rule ${input.id}`);
  pattern.rules = pattern.rules.filter((x) => x.id !== input.id);
  pattern.ruleTests = pattern.ruleTests.filter((x) => x.row.pattern_rule_id !== input.id);
  patterns.save(pattern);
}

/** Adds a test of a pattern rule in one domain that follows its pattern, with the test data sets it starts from. */
export function addPatternRuleTest(tx: Transaction, input: AddPatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule', input.pattern_rule_id) ?? tx.refuse('missing', `there is no pattern rule ${input.pattern_rule_id}`);
  const { starts_from = [], ...row } = input;
  pattern.ruleTests.push({ row, startsFrom: starts_from });
  refuseBroken(patternRuleTestPerDomain(pattern.ruleTests.map((x) => x.row)));
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Changes a pattern rule test's way of running, the domain it proves the rule in, or the test data sets it starts from (the whole list). */
export function changePatternRuleTest(tx: Transaction, input: ChangePatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule_test', input.id) ?? tx.refuse('missing', `there is no pattern rule test ${input.id}`);
  pattern.ruleTests = pattern.ruleTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'domain_id', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  refuseBroken(patternRuleTestPerDomain(pattern.ruleTests.map((x) => x.row)));
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Removes a pattern rule test and the links it starts. Refused while anything references it. */
export function removePatternRuleTest(tx: Transaction, input: RemovePatternRuleTest): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('pattern_rule_test', input.id) ?? tx.refuse('missing', `there is no pattern rule test ${input.id}`);
  pattern.ruleTests = pattern.ruleTests.filter((x) => x.row.id !== input.id);
  patterns.save(pattern);
}

/** Adds a slot to its pattern: an open-ended part code fills against its contract, with the reason its fills vary by design when they do. */
export function addSlot(tx: Transaction, input: AddSlot): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.load(input.pattern_id) ?? tx.refuse('missing', `there is no pattern ${input.pattern_id}`);
  pattern.slots.push(input);
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Changes a slot's title or contract, or the reason its fills vary by design; null clears the reason. Its pattern does not change. */
export function changeSlot(tx: Transaction, input: ChangeSlot): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('slot', input.id) ?? tx.refuse('missing', `there is no slot ${input.id}`);
  pattern.slots = pattern.slots.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'fills_vary_by_design']) : x));
  holdToRules(tx, pattern);
  patterns.save(pattern);
}

/** Removes a slot from its pattern. Refused while a record fills it. */
export function removeSlot(tx: Transaction, input: RemoveSlot): void {
  const patterns = new PatternRepository(tx);
  const pattern = patterns.loadHolding('slot', input.id) ?? tx.refuse('missing', `there is no slot ${input.id}`);
  pattern.slots = pattern.slots.filter((x) => x.id !== input.id);
  patterns.save(pattern);
}
