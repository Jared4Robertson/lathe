// Generated from data/ by `npm run generate`. Do not edit.
// The value-object commands whose handler is the pattern: load the value object, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ValueObjectRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddValueObject } from './add-value-object.ts';
import type { ChangeValueObject } from './change-value-object.ts';
import type { RemoveValueObject } from './remove-value-object.ts';
import type { AddConstraint } from './add-constraint.ts';
import type { ChangeConstraint } from './change-constraint.ts';
import type { RemoveConstraint } from './remove-constraint.ts';
import type { ChangeValueType } from './change-value-type.ts';
import type { RemoveValueType } from './remove-value-type.ts';
import type { ChangeConstraintTest } from './change-constraint-test.ts';
import type { RemoveConstraintTest } from './remove-constraint-test.ts';

/** Adds a value object, in the product its ID names, with its fields in order. */
export function addValueObject(tx: Transaction, input: AddValueObject): void {
  const valueObjects = new ValueObjectRepository(tx);
  const { fields = [], ...row } = input;
  const valueObject = valueObjects.create({ root: row.id, valueObject: row, fields: fields, constraints: [], valueType: null, constraintTests: [] });
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}

/** Changes a value object's title or description, or its fields (the whole list, in order). */
export function changeValueObject(tx: Transaction, input: ChangeValueObject): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.id) ?? tx.refuse('missing', `there is no value object ${input.id}`);
  valueObject.valueObject = changed(valueObject.valueObject, input, ['title', 'description']);
  valueObject.fields = input.fields ?? valueObject.fields;
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}

/** Removes a value object whole: its fields, constraints with their tests and its value type, and the links they start. Refused while anything outside it references what is in it, such as a field it types. */
export function removeValueObject(tx: Transaction, input: RemoveValueObject): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.id) ?? tx.refuse('missing', `there is no value object ${input.id}`);
  valueObjects.remove(valueObject);
}

/** Adds a constraint to its value object: a rule each value is held to when it is created. */
export function addConstraint(tx: Transaction, input: AddConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.value_object_id) ?? tx.refuse('missing', `there is no value object ${input.value_object_id}`);
  valueObject.constraints.push(input);
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}

/** Changes a constraint's title or statement. Its value object never changes. */
export function changeConstraint(tx: Transaction, input: ChangeConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint', input.id) ?? tx.refuse('missing', `there is no constraint ${input.id}`);
  valueObject.constraints = valueObject.constraints.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement']) : x));
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}

/** Removes a constraint with its test and the links it starts. Refused while anything else references them. */
export function removeConstraint(tx: Transaction, input: RemoveConstraint): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint', input.id) ?? tx.refuse('missing', `there is no constraint ${input.id}`);
  valueObject.constraints = valueObject.constraints.filter((x) => x.id !== input.id);
  valueObject.constraintTests = valueObject.constraintTests.filter((x) => x.row.constraint_id !== input.id);
  valueObjects.save(valueObject);
}

/** Changes a value type's title or file, or the standard rules it meets or packages it uses (each the whole list). */
export function changeValueType(tx: Transaction, input: ChangeValueType): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('value_type', input.id) ?? tx.refuse('missing', `there is no value type ${input.id}`);
  const held = valueObject.valueType!;
  valueObject.valueType = { row: changed(held.row, input, ['title', 'file']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages };
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}

/** Removes a value object's value type with the links it starts and the packages it uses. Refused while anything references it. */
export function removeValueType(tx: Transaction, input: RemoveValueType): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('value_type', input.id) ?? tx.refuse('missing', `there is no value type ${input.id}`);
  valueObject.valueType = null;
  valueObjects.save(valueObject);
}

/** Changes a constraint test's way of running or the test data sets it starts from (the whole list). */
export function changeConstraintTest(tx: Transaction, input: ChangeConstraintTest): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint_test', input.id) ?? tx.refuse('missing', `there is no constraint test ${input.id}`);
  valueObject.constraintTests = valueObject.constraintTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'accepts', 'refuses', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}

/** Removes a constraint's test with the links it starts. Refused while anything references it, such as a business outcome it measures. */
export function removeConstraintTest(tx: Transaction, input: RemoveConstraintTest): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('constraint_test', input.id) ?? tx.refuse('missing', `there is no constraint test ${input.id}`);
  valueObject.constraintTests = valueObject.constraintTests.filter((x) => x.row.id !== input.id);
  valueObjects.save(valueObject);
}
