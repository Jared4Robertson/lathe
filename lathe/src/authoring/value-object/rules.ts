// The Value object aggregate's rules, written once: each command's handler runs them on the rows it would save, and
// every load and commit runs them over all data (valueObjectRules, listed in AGGREGATE_RULES).
import { beyondFirst, refuseBroken, type AggregateRules, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ConstraintTestRow, ValueObjectFieldRow, ValueTypeRow } from '../../platform/data/tables.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { VALUE_OBJECT_AGGREGATE, valueObjectRows, valueObjectsFrom, type ValueObject } from './model.ts';

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
/** A field's name as people read it: trimmed, and in any letter case. */
const spoken = (name: string) => name.trim().toLowerCase();

/**
 * Every field of the value object that breaks LA-AUT-INV180 (a field is typed by exactly one of a basic type, a value
 * object or an aggregate, and never by its own value object) or LA-AUT-INV181 (no two fields of one value object have
 * the same name, trimmed and in any letter case).
 */
export function valueObjectProblems(valueObject: ValueObject): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const named = new Map<string, ValueObjectFieldRow>();
  for (const field of valueObjectRows(valueObject).get('value_object_field') as unknown as ValueObjectFieldRow[]) {
    const types = [field.type, field.type_value_object_id, field.type_aggregate_id].filter((t) => t !== undefined && t !== null);
    const row = field as unknown as Row;
    if (types.length !== 1) {
      problems.push({ rule: 'value-object-field-one-type', table: 'value_object_field', row, message: `field ${field.name} of value object ${field.value_object_id} is typed by ${types.length ? types.join(' and ') : 'nothing'}: a field has exactly one of a basic type, a value object or an aggregate` });
    } else if (field.type_value_object_id === valueObject.root) {
      problems.push({ rule: 'value-object-field-one-type', table: 'value_object_field', row, message: `field ${field.name} of value object ${field.value_object_id} cannot be typed by its own value object` });
    }
    const earlier = named.get(spoken(field.name));
    if (earlier) {
      problems.push({ rule: 'value-object-field-name', table: 'value_object_field', row, message: `value object ${field.value_object_id} already has a field named ${earlier.name}, so its field ${field.position} cannot be named ${field.name}: a field's name is its own in its value object, trimmed and in any letter case` });
    } else named.set(spoken(field.name), field);
  }
  return problems;
}

/** The rules over all data: every value object, whole, and the "one each" rule over every row. */
export const valueObjectRules: AggregateRules = {
  aggregate: VALUE_OBJECT_AGGREGATE,
  check: (view) => [
    ...valueObjectsFrom((table) => view.rows(table)).flatMap((valueObject) => valueObjectProblems(valueObject)),
    ...valueObjectOneEach(view.rows('value_type') as unknown as ValueTypeRow[], view.rows('constraint_test') as unknown as ConstraintTestRow[]),
  ],
};

/** Refuses the command, with every reason, when the value object as it would be saved breaks one of its rules. */
export function holdToRules(_tx: Transaction, valueObject: ValueObject): void {
  refuseBroken(valueObjectProblems(valueObject));
}
