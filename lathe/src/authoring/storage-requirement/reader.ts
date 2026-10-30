// The Storage requirement read model's reader (LA-AUT-RM42-RD): the one way the Storage requirement queries reach the
// read model's storage. The query handlers depend only on the StorageRequirementReader interface; the query runner
// injects the reader each query's definition makes (`reader`), so keeping the read model elsewhere is a new
// implementation of this interface and nothing more. Today's implementation reads the projection's table, kept in memory
// and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { storageRequirementTableFrom, type StorageRequirementPage, type StorageRequirementSummary, type StorageRequirementTable } from './read-model.ts';

/** What the Storage requirement queries read, and all they read. */
export interface StorageRequirementReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a storage requirement, or undefined when no storage requirement holds it. */
  page(id: string): StorageRequirementPage | undefined;
  /** An aggregate's or read model's storage requirements, by ID, or undefined when there is no such record. */
  requirementsOf(parentId: string): StorageRequirementSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryStorageRequirementReader implements StorageRequirementReader {
  private readonly table: StorageRequirementTable;

  constructor(table: StorageRequirementTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): StorageRequirementPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.requirements.get(holding.root)! };
  }

  requirementsOf(parentId: string): StorageRequirementSummary[] | undefined {
    return this.table.parents.get(parentId);
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

/** The reader the query runner gives each Storage requirement query: today's, over the projection's table built from the data. */
export const storageRequirementReader = (view: ReadView): StorageRequirementReader => new InMemoryStorageRequirementReader(storageRequirementTableFrom(view));
