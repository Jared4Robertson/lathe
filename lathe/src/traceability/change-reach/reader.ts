// The Change reach read model's reader (LA-TRC-RM14-RD): the one way the Change reach query reaches the read model's
// storage. The query handler depends only on the ChangeReachReader interface; the query runner injects the reader the
// query's definition makes (`reader`), over the data with the checks' run. Today's implementation reads the
// projection's table, kept in memory and worked out on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { changeReachTableFrom, type ChangeReach, type ChangeReachTable } from './read-model.ts';

/** What the Change reach query reads, and all it reads. */
export interface ChangeReachReader {
  /** The records among the IDs that the data does not hold. */
  missing(ids: readonly string[]): string[];
  /** The reach of a change of the records, every one of which the data holds. */
  reachOf(ids: readonly string[]): ChangeReach;
}

/** The reader over the read model's table in memory. */
export class InMemoryChangeReachReader implements ChangeReachReader {
  private readonly table: ChangeReachTable;

  constructor(table: ChangeReachTable) {
    this.table = table;
  }

  missing(ids: readonly string[]): string[] {
    return this.table.missing(ids);
  }

  reachOf(ids: readonly string[]): ChangeReach {
    return this.table.reachOf(ids);
  }
}

/** The reader the query runner gives the Change reach query: today's, over the projection's table. */
export const changeReachReader = (view: ReadView): ChangeReachReader => new InMemoryChangeReachReader(changeReachTableFrom(view));
