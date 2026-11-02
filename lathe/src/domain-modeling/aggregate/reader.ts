// The Aggregate read model's reader (LA-MOD-RM26-RD): the one way the Aggregate queries reach the read model's
// storage. The query handlers depend only on the AggregateReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { aggregateTableFrom, type AggregatePage, type AggregateSummary, type AggregateTable } from './read-model.ts';

/** What the Aggregate queries read, and all they read. */
export interface AggregateReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside an aggregate, or undefined when no aggregate holds it. */
  page(id: string): AggregatePage | undefined;
  /** A domain's aggregates, by ID, or undefined when there is no such domain. */
  aggregatesOf(domainId: string): AggregateSummary[] | undefined;
  /** The domain an aggregate sits under, or undefined when there is no such aggregate. */
  domainOf(aggregateId: string): string | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryAggregateReader implements AggregateReader {
  private readonly table: AggregateTable;
  private readonly schema: SchemaDescription;

  constructor(table: AggregateTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): AggregatePage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.aggregates.get(holding.root)! };
  }

  aggregatesOf(domainId: string): AggregateSummary[] | undefined {
    return this.table.domains.get(domainId);
  }

  domainOf(aggregateId: string): string | undefined {
    return this.table.aggregates.get(aggregateId)?.aggregate.domain_id;
  }

  idShape(kind: string): IdShape {
    return idShapeOf(this.schema, kind);
  }

  highestAfter(prefix: string): number {
    const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
    let highest = 0;
    for (const id of this.table.kinds.keys()) {
      const m = shape.exec(id);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    return highest;
  }
}

/** The reader the query runner gives each Aggregate query: today's, over the projection's table built from the data. */
export const aggregateReader = (view: ReadView): AggregateReader => new InMemoryAggregateReader(aggregateTableFrom(view), view.schema);
