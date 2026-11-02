// Generated from data/ by `npm run generate`. Do not edit.
// ValueObjectRepository (LA-MOD-REPO09): Loads a value object whole (its fields, constraints with their tests, and its
// value type, with what they meet, use and start from) from the transaction's draft and saves exactly the rows that
// changed, in its aggregate's own tables only; a write to any other table is refused when it is made (`DataFiles`). A
// record inside a value object is loaded through the value object that holds it (`loadHolding`), and a removal is
// refused, naming what references it, while anything left references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { VALUE_OBJECT_TABLES, valueObjectRows, valueObjectsFrom, type ValueObject, type ValueObjectKind } from './model.ts';

export class ValueObjectRepository extends Repository<ValueObject> {
  constructor(tx: Transaction) {
    super(tx, 'ValueObjectRepository', VALUE_OBJECT_TABLES);
  }

  protected read(rootId: string): ValueObject | undefined {
    return valueObjectsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(valueObject: ValueObject): InstanceRows {
    return valueObjectRows(valueObject);
  }

  /** Loads the value object that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: ValueObjectKind, id: string): ValueObject | undefined {
    const root = this.rootOf(kind, id);
    const valueObject = root === undefined ? undefined : this.load(root);
    return valueObject && holds(valueObject, kind, id) ? valueObject : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: ValueObjectKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'value_object': return id;
      case 'constraint': return this.rootOf('value_object', String(row.value_object_id));
      case 'value_type': return this.rootOf('value_object', String(row.value_object_id));
      case 'constraint_test': return this.rootOf('constraint', String(row.constraint_id));
    }
  }
}

/** Whether the value object holds the record of the kind with this ID. */
function holds(valueObject: ValueObject, kind: ValueObjectKind, id: string): boolean {
  switch (kind) {
    case 'value_object': return valueObject.root === id;
    case 'constraint': return valueObject.constraints.some((x) => x.id === id);
    case 'value_type': return valueObject.valueType?.row.id === id;
    case 'constraint_test': return valueObject.constraintTests.some((x) => x.row.id === id);
  }
}
