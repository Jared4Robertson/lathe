// The Value object aggregate (LA-MOD-A9): a value with no identity of its own, with its fields in order, its
// constraints with their tests (and the test data sets they start from), and its value type in code (with the standard
// rules it meets and the packages it uses). One instance is one value object, whole; it holds only the links its own
// records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ConstraintRow, ConstraintTestRow, ValueObjectFieldRow, ValueObjectRow, ValueTypeRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const VALUE_OBJECT_AGGREGATE = 'LA-MOD-A9';

/** The columns of a field a command gives: its value object and its position follow from the list it is in. */
export const FIELD_COLUMNS = ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'] as const;

/** One field of a value object. Its position is its place in the value object's list. */
export type ValueObjectField = Omit<ValueObjectFieldRow, 'value_object_id' | 'position'>;

/** A technical record with the standard rules it meets and the packages it uses. */
export interface Technical<T> {
  row: T;
  meets: string[];
  packages: string[];
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One value object, whole. */
export interface ValueObject {
  /** The value object's ID: the aggregate's root. */
  readonly root: string;
  valueObject: ValueObjectRow;
  /** Its fields, in order. */
  fields: ValueObjectField[];
  constraints: ConstraintRow[];
  /** Its value type in code, if written: one at most. */
  valueType: Technical<ValueTypeRow> | null;
  constraintTests: Tested<ConstraintTestRow>[];
}

/** The tables the Value object aggregate keeps its rows in: its kinds, its part, and the relations and parts its records start. */
export const VALUE_OBJECT_TABLES = ['value_object', 'value_object_field', 'constraint', 'value_type', 'constraint_test', 'meets', 'package_use', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const VALUE_OBJECT_SHAPE = {
  value_object: { at: 'valueObject', given: { fields: 'fields' } },
  constraint: { at: 'constraints' },
  value_type: { at: 'valueType', one: true, refusedBy: 'oneValueType', lists: { meets: 'meets', packages: 'packages' } },
  constraint_test: { at: 'constraintTests', refusedBy: 'oneConstraintTest', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

export type ValueObjectKind = keyof typeof VALUE_OBJECT_SHAPE;

/** The value objects in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function valueObjectsFrom(rows: (table: string) => Row[], only?: string): ValueObject[] {
  const valueObjects = rows('value_object').filter((r) => only === undefined || r.id === only) as unknown as ValueObjectRow[];
  if (!valueObjects.length) return [];
  const ids = new Set(valueObjects.map((v) => v.id));
  const fields = (rows('value_object_field') as unknown as ValueObjectFieldRow[]).filter((f) => ids.has(f.value_object_id));
  const constraints = (rows('constraint') as unknown as ConstraintRow[]).filter((c) => ids.has(c.value_object_id));
  const valueObjectOf = new Map(constraints.map((c) => [c.id, c.value_object_id]));
  const valueTypesOf = groupBy((rows('value_type') as unknown as ValueTypeRow[]).filter((t) => ids.has(t.value_object_id)), (t) => t.value_object_id);
  const testsOf = groupBy((rows('constraint_test') as unknown as ConstraintTestRow[]).filter((t) => valueObjectOf.has(t.constraint_id)), (t) => valueObjectOf.get(t.constraint_id));
  const fieldsOf = groupBy(fields, (f) => f.value_object_id);
  const constraintsOf = groupBy(constraints, (c) => c.value_object_id);
  const [meets, startsFrom] = ['meets', 'starts_from'].map((table) => bySource(rows(table)));
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  return valueObjects.map((valueObject) => {
    const valueType = groupOf(valueTypesOf, valueObject.id)[0];
    return {
      root: valueObject.id,
      valueObject,
      fields: [...groupOf(fieldsOf, valueObject.id)]
        .sort((a, b) => a.position - b.position)
        .map(({ value_object_id: _owner, position: _at, ...field }) => field),
      constraints: groupOf(constraintsOf, valueObject.id),
      valueType: valueType ? { row: valueType, meets: groupOf(meets, valueType.id), packages: groupOf(packages, valueType.id) } : null,
      constraintTests: groupOf(testsOf, valueObject.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
    };
  });
}

const links = (source: string, ids: string[]): Row[] => ids.map((target) => ({ source_id: source, target_id: target }));

/** The instance's rows, by table. */
export function valueObjectRows(valueObject: ValueObject): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  const { valueType } = valueObject;
  return new Map<string, Row[]>([
    ['value_object', [asRow(valueObject.valueObject)]],
    ['value_object_field', valueObject.fields.map((f, at) => asRow({ value_object_id: valueObject.root, position: at + 1, ...f }))],
    ['constraint', valueObject.constraints.map(asRow)],
    ['value_type', valueType ? [asRow(valueType.row)] : []],
    ['constraint_test', valueObject.constraintTests.map((t) => asRow(t.row))],
    ['meets', valueType ? links(valueType.row.id, valueType.meets) : []],
    ['package_use', valueType ? valueType.packages.map((name) => ({ record_id: valueType.row.id, package: name })) : []],
    ['starts_from', valueObject.constraintTests.flatMap((t) => links(t.row.id, t.startsFrom))],
  ]);
}

