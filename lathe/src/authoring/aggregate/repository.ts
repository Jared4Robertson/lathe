// Generated from data/ by `npm run generate`. Do not edit.
// AggregateRepository (LA-AUT-REPO06): Loads an aggregate whole from the transaction's draft (its entities with their
// fields and the entities they hold, their data models with the standard rules they meet and the packages they use, and
// its invariants with their tests) and saves exactly the rows that changed, in the Aggregate aggregate's own tables
// only; a write to any other table is refused when it is made (`DataFiles`). A record inside one is loaded through the
// root that holds it (`loadHolding`), and a removal is refused, naming the referrers, while anything outside what goes
// references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { AGGREGATE_TABLES, aggregateRows, aggregatesFrom, type Aggregate, type AggregateKind } from './model.ts';

export class AggregateRepository extends Repository<Aggregate> {
  constructor(tx: Transaction) {
    super(tx, 'AggregateRepository', AGGREGATE_TABLES);
  }

  protected read(rootId: string): Aggregate | undefined {
    return aggregatesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(aggregate: Aggregate): InstanceRows {
    return aggregateRows(aggregate);
  }

  /** Loads the aggregate that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: AggregateKind, id: string): Aggregate | undefined {
    const root = this.rootOf(kind, id);
    const aggregate = root === undefined ? undefined : this.load(root);
    return aggregate && holds(aggregate, kind, id) ? aggregate : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: AggregateKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'aggregate': return id;
      case 'entity': return this.rootOf('aggregate', String(row.aggregate_id));
      case 'invariant': return this.rootOf('aggregate', String(row.aggregate_id));
      case 'data_model': return this.rootOf('entity', String(row.entity_id));
      case 'rule': return this.rootOf('invariant', String(row.invariant_id));
      case 'invariant_test': return this.rootOf('invariant', String(row.invariant_id));
    }
  }
}

/** Whether the aggregate holds the record of the kind with this ID. */
function holds(aggregate: Aggregate, kind: AggregateKind, id: string): boolean {
  switch (kind) {
    case 'aggregate': return aggregate.root === id;
    case 'entity': return aggregate.entities.some((x) => x.row.id === id);
    case 'invariant': return aggregate.invariants.some((x) => x.id === id);
    case 'data_model': return aggregate.dataModels.some((x) => x.row.id === id);
    case 'rule': return aggregate.rules.some((x) => x.row.id === id);
    case 'invariant_test': return aggregate.invariantTests.some((x) => x.row.id === id);
  }
}
