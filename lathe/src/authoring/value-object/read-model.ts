// The Value object read model (LA-AUT-RM29): what the Value object aggregate's queries answer with, shaped for their
// readers and built from rows by its projection. It shares no types with the aggregate's model.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { ConstraintRow, ConstraintTestRow, ValueObjectFieldRow, ValueObjectRow, ValueTypeRow } from '../../platform/data/tables.ts';

/** One value object's page: its row, its fields in order, its constraints each with its test, and its value type. */
export interface ValueObjectPage {
  valueObject: ValueObjectRow;
  fields: ValueObjectFieldRow[];
  constraints: (ConstraintRow & { test: (ConstraintTestRow & { startsFrom: string[] }) | null })[];
  valueType: (ValueTypeRow & { meets: string[]; packages: string[] }) | null;
}

/** One line of a list of value objects. */
export interface ValueObjectSummary {
  id: string;
  title: string;
}

/** The column naming each record's parent inside the value object: none for the value object itself. */
export const PARENT_OF = { value_object: null, constraint: 'value_object_id', value_type: 'value_object_id', constraint_test: 'constraint_id' } as const;

// A link table's targets by source, each list sorted.
function bySource(links: Row[], source = 'source_id', target = 'target_id'): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const l of links) found.set(String(l[source]), [...(found.get(String(l[source])) ?? []), String(l[target])]);
  for (const list of found.values()) list.sort();
  return found;
}

/** The projection: each value object's page, from the rows; only the one given, when given. */
export function valueObjectPagesFrom(view: ReadView, only?: string): ValueObjectPage[] {
  const valueObjects = (view.rows('value_object') as unknown as ValueObjectRow[]).filter((v) => only === undefined || v.id === only);
  if (!valueObjects.length) return [];
  const [meets, startsFrom] = ['meets', 'starts_from'].map((table) => bySource(view.rows(table)));
  const packages = bySource(view.rows('package_use'), 'record_id', 'package');
  const fields = view.rows('value_object_field') as unknown as ValueObjectFieldRow[];
  const constraints = view.rows('constraint') as unknown as ConstraintRow[];
  const tests = view.rows('constraint_test') as unknown as ConstraintTestRow[];
  const valueTypes = view.rows('value_type') as unknown as ValueTypeRow[];
  return valueObjects.map((valueObject) => {
    const valueType = valueTypes.find((t) => t.value_object_id === valueObject.id);
    return {
      valueObject,
      fields: fields.filter((f) => f.value_object_id === valueObject.id).sort((a, b) => a.position - b.position),
      constraints: constraints
        .filter((c) => c.value_object_id === valueObject.id)
        .map((c) => {
          const test = tests.find((t) => t.constraint_id === c.id);
          return { ...c, test: test ? { ...test, startsFrom: startsFrom.get(test.id) ?? [] } : null };
        }),
      valueType: valueType ? { ...valueType, meets: meets.get(valueType.id) ?? [], packages: packages.get(valueType.id) ?? [] } : null,
    };
  });
}
