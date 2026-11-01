// Generated from data/ by `npm run generate`. Do not edit.
// SpecificationRepository (LA-AUT-REPO05): Loads a specification whole (its predicate and test, the aggregates it
// reads, and what they meet, use and start from) from the transaction's draft and saves exactly the rows that changed,
// in its aggregate's own tables only; a write to any other table is refused when it is made (`DataFiles`). A predicate
// or test is loaded through the specification that holds it (`loadHolding`), and a removal is refused, naming what
// references it, while anything left references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { SPECIFICATION_TABLES, specificationRows, specificationsFrom, type Specification, type SpecificationKind } from './model.ts';

export class SpecificationRepository extends Repository<Specification> {
  constructor(tx: Transaction) {
    super(tx, 'SpecificationRepository', SPECIFICATION_TABLES);
  }

  protected read(rootId: string): Specification | undefined {
    return specificationsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(specification: Specification): InstanceRows {
    return specificationRows(specification);
  }

  /** Loads the specification that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: SpecificationKind, id: string): Specification | undefined {
    const root = this.rootOf(kind, id);
    const specification = root === undefined ? undefined : this.load(root);
    return specification && holds(specification, kind, id) ? specification : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: SpecificationKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'specification': return id;
      case 'predicate': return this.rootOf('specification', String(row.specification_id));
      case 'specification_test': return this.rootOf('specification', String(row.specification_id));
    }
  }
}

/** Whether the specification holds the record of the kind with this ID. */
function holds(specification: Specification, kind: SpecificationKind, id: string): boolean {
  switch (kind) {
    case 'specification': return specification.root === id;
    case 'predicate': return specification.predicate?.row.id === id;
    case 'specification_test': return specification.test?.row.id === id;
  }
}
