// The Value object aggregate's read model (LA-AUT-RM29), shaped for its readers: the Value object page reads a value
// object whole (its fields in order, its constraints by ID each with its test, its value type with the standard rules
// it meets and the packages it uses) with the record the page is about, a product's list reads each value object's ID
// and title, and the editor's next ID reads the IDs in use. The projection (valueObjectTableFrom) is the only code that
// reads the source rows and the only code that writes the read model's table; the query handlers read that table only
// through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ConstraintRow, ConstraintTestRow, ValueObjectFieldRow, ValueObjectRow, ValueTypeRow } from '../../platform/data/tables.ts';
import type { ValueObjectKind } from './model.ts';

/** A constraint test as the page shows it: its row and the test data sets it starts from. */
export interface ConstraintTestOnPage {
  test: ConstraintTestRow;
  startsFrom: string[];
}

/** A constraint as the page shows it: its row and its test, if written. */
export interface ConstraintOnPage {
  constraint: ConstraintRow;
  test: ConstraintTestOnPage | null;
}

/** The value type as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface ValueTypeOnPage {
  valueType: ValueTypeRow;
  meets: string[];
  packages: string[];
}

/** A value object whole, as its page shows it. */
export interface ValueObjectTree {
  valueObject: ValueObjectRow;
  /** The product its ID names. */
  product: string;
  /** Its fields, in order. */
  fields: ValueObjectFieldRow[];
  /** Its constraints, by ID. */
  constraints: ConstraintOnPage[];
  /** Its value type in code, if written. */
  valueType: ValueTypeOnPage | null;
}

/** A value object as its page reads it, with the record of it the page is about. */
export interface ValueObjectPage extends ValueObjectTree {
  record: { id: string; kind: ValueObjectKind };
}

/** A value object as a product's list reads it. */
export interface ValueObjectSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface ValueObjectTable {
  /** Each value object whole, by its ID. */
  valueObjects: Map<string, ValueObjectTree>;
  /** Each record inside a value object: the value object that holds it and its kind there. */
  holding: Map<string, { root: string; kind: ValueObjectKind }>;
  /** Each product's value objects, by ID; a product with none has an empty list. */
  products: Map<string, ValueObjectSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's other ends by one column, each list sorted. */
function linked(rows: Row[], by: string, other: string): (id: string) => string[] {
  const found = grouped<Row>(rows, by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function valueObjectTableFrom(view: ReadView): ValueObjectTable {
  const meets = linked(view.rows('meets'), 'source_id', 'target_id');
  const startsFrom = linked(view.rows('starts_from'), 'source_id', 'target_id');
  const packages = linked(view.rows('package_use'), 'record_id', 'package');
  const fields = grouped<ValueObjectFieldRow>(view.rows('value_object_field'), 'value_object_id');
  const constraints = grouped<ConstraintRow>(view.rows('constraint'), 'value_object_id');
  const tests = new Map((view.rows('constraint_test') as unknown as ConstraintTestRow[]).map((t) => [t.constraint_id, t]));
  const valueTypes = new Map((view.rows('value_type') as unknown as ValueTypeRow[]).map((t) => [t.value_object_id, t]));
  // A value object's product is the longest product ID its own ID starts with, and a hyphen.
  const productIds = view.rows('product').map((p) => String(p.id)).sort((a, b) => b.length - a.length);
  const productOf = (id: string) => productIds.find((p) => id.startsWith(`${p}-`)) ?? '';
  const valueObjects = new Map<string, ValueObjectTree>();
  const holding = new Map<string, { root: string; kind: ValueObjectKind }>();
  const products = new Map<string, ValueObjectSummary[]>(productIds.map((p) => [p, []]));
  for (const valueObject of view.rows('value_object') as unknown as ValueObjectRow[]) {
    const root = valueObject.id;
    const valueType = valueTypes.get(root);
    const tree: ValueObjectTree = {
      valueObject,
      product: productOf(root),
      fields: [...(fields.get(root) ?? [])].sort((a, b) => a.position - b.position),
      constraints: [...(constraints.get(root) ?? [])].sort(byId).map((constraint) => {
        const test = tests.get(constraint.id);
        return { constraint, test: test ? { test, startsFrom: startsFrom(test.id) } : null };
      }),
      valueType: valueType ? { valueType, meets: meets(valueType.id), packages: packages(valueType.id) } : null,
    };
    valueObjects.set(root, tree);
    holding.set(root, { root, kind: 'value_object' });
    for (const c of tree.constraints) {
      holding.set(c.constraint.id, { root, kind: 'constraint' });
      if (c.test) holding.set(c.test.test.id, { root, kind: 'constraint_test' });
    }
    if (valueType) holding.set(valueType.id, { root, kind: 'value_type' });
    products.get(tree.product)?.push({ id: root, title: valueObject.title });
  }
  for (const list of products.values()) list.sort(byId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { valueObjects, holding, products, kinds };
}
