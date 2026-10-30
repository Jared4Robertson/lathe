// The Value object aggregate's rules, written once: each command's handler runs them on the rows it would save, and
// every load and commit runs them over all data (valueObjectRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ConstraintTestRow, ValueTypeRow } from '../../platform/data/tables.ts';
import { VALUE_OBJECT_AGGREGATE } from './model.ts';

/**
 * Every row that breaks LA-AUT-INV101: a value object has at most one value type, and a constraint at most one
 * constraint test. Each value type or test after the first of its parent is refused.
 */
export function valueObjectOneEach(valueTypes: readonly ValueTypeRow[], constraintTests: readonly ConstraintTestRow[]): RuleProblem[] {
  return [
    ...beyondFirst(valueTypes, (r) => r.value_object_id).map((r) => ({
      rule: 'value-object-one-each',
      table: 'value_type',
      row: r as unknown as Row,
      message: `value object ${r.value_object_id} already has its value type, so ${r.id} cannot be a second: a value object has one`,
    })),
    ...beyondFirst(constraintTests, (r) => r.constraint_id).map((r) => ({
      rule: 'value-object-one-each',
      table: 'constraint_test',
      row: r as unknown as Row,
      message: `constraint ${r.constraint_id} already has its test, so ${r.id} cannot be a second: a constraint has one`,
    })),
  ];
}

/** The rules over all data. */
export const valueObjectRules: AggregateRules = {
  aggregate: VALUE_OBJECT_AGGREGATE,
  check: (view) => valueObjectOneEach(view.rows('value_type') as unknown as ValueTypeRow[], view.rows('constraint_test') as unknown as ConstraintTestRow[]),
};
