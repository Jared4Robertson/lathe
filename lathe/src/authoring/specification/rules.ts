// The Specification aggregate's rules, written once: each command's handler runs them on the rows it would save, and
// every load and commit runs them over all data (specificationRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { PredicateRow, SpecificationTestRow } from '../../platform/data/tables.ts';
import { SPECIFICATION_AGGREGATE } from './model.ts';

/**
 * Every row that breaks LA-AUT-INV103: a specification has at most one predicate and at most one specification test.
 * Each predicate or test after the first of its specification is refused.
 */
export function specificationOneEach(predicates: readonly PredicateRow[], tests: readonly SpecificationTestRow[]): RuleProblem[] {
  return [
    ...beyondFirst(predicates, (r) => r.specification_id).map((r) => ({
      rule: 'specification-one-each',
      table: 'predicate',
      row: r as unknown as Row,
      message: `specification ${r.specification_id} already has its predicate, so ${r.id} cannot be a second: a specification has one`,
    })),
    ...beyondFirst(tests, (r) => r.specification_id).map((r) => ({
      rule: 'specification-one-each',
      table: 'specification_test',
      row: r as unknown as Row,
      message: `specification ${r.specification_id} already has its test, so ${r.id} cannot be a second: a specification has one`,
    })),
  ];
}

/** The rules over all data. */
export const specificationRules: AggregateRules = {
  aggregate: SPECIFICATION_AGGREGATE,
  check: (view) => specificationOneEach(view.rows('predicate') as unknown as PredicateRow[], view.rows('specification_test') as unknown as SpecificationTestRow[]),
};
