// AggregateRepository (LA-AUT-REPO06): loads and saves the Aggregate aggregate whole, in its own tables only. A record
// inside an aggregate (an entity, an invariant, a data model, a rule or an invariant test) is reached through the aggregate
// that holds it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { AGGREGATE_KINDS, AGGREGATE_TABLES, aggregateRows, aggregatesFrom, kindInside, type Aggregate, type AggregateKind } from './model.ts';

/** The kind each parent column of the aggregate's kinds names. */
const PARENT_KIND = { aggregate_id: 'aggregate', entity_id: 'entity', invariant_id: 'invariant' } as const;

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

  /**
   * Loads the aggregate that holds the record of the kind with this ID: the aggregate itself, or the aggregate of the
   * entity, invariant, data model, rule or test, found up its parents inside the aggregate. Undefined when there is no such
   * record.
   */
  loadHolding(kind: AggregateKind, id: string): Aggregate | undefined {
    let at: { kind: AggregateKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'aggregate') break;
      const column = AGGREGATE_KINDS[at.kind];
      at = { kind: PARENT_KIND[column], id: String(row[column]) };
    }
    const aggregate = this.load(at.id);
    return aggregate && kindInside(aggregate, id) === kind ? aggregate : undefined;
  }
}
