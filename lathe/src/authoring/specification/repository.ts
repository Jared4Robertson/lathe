// SpecificationRepository (LA-AUT-REPO05): loads and saves the Specification aggregate whole, in its own tables only. A
// predicate or a specification test is reached through the specification that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, SPECIFICATION_KINDS, SPECIFICATION_TABLES, specificationRows, specificationsFrom, type Specification, type SpecificationKind } from './model.ts';

export class SpecificationRepository extends AggregateRepository<Specification> {
  constructor(tx: Transaction) {
    super(tx, 'SpecificationRepository', SPECIFICATION_TABLES);
  }

  protected read(rootId: string): Specification | undefined {
    return specificationsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(specification: Specification): InstanceRows {
    return specificationRows(specification);
  }

  /**
   * Loads the specification that holds the record of the kind with this ID: the specification itself, or the one its
   * predicate or test sits under. Undefined when there is no such record.
   */
  loadHolding(kind: SpecificationKind, id: string): Specification | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    const column = SPECIFICATION_KINDS[kind];
    const specification = this.load(column === null ? id : String(row[column]));
    return specification && kindInside(specification, id) === kind ? specification : undefined;
  }
}
