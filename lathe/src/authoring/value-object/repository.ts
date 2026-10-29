// ValueObjectRepository (LA-AUT-REPO09): loads and saves the Value object aggregate whole, in its own tables only. A
// constraint, the value type or a constraint test is reached through the value object that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, VALUE_OBJECT_KINDS, VALUE_OBJECT_TABLES, valueObjectRows, valueObjectsFrom, type ValueObject, type ValueObjectKind } from './model.ts';

export class ValueObjectRepository extends AggregateRepository<ValueObject> {
  constructor(tx: Transaction) {
    super(tx, 'ValueObjectRepository', VALUE_OBJECT_TABLES);
  }

  protected read(rootId: string): ValueObject | undefined {
    return valueObjectsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(valueObject: ValueObject): InstanceRows {
    return valueObjectRows(valueObject);
  }

  /**
   * Loads the value object that holds the record of the kind with this ID: the value object itself, or the one its
   * record sits under, found up its parents inside the aggregate. Undefined when there is no such record.
   */
  loadHolding(kind: ValueObjectKind, id: string): ValueObject | undefined {
    let at: { kind: ValueObjectKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'value_object') break;
      const column = VALUE_OBJECT_KINDS[at.kind];
      at = { kind: column === 'constraint_id' ? 'constraint' : 'value_object', id: String(row[column]) };
    }
    const valueObject = this.load(at.id);
    return valueObject && kindInside(valueObject, id) === kind ? valueObject : undefined;
  }
}
