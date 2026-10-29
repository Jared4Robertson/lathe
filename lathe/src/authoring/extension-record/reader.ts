// The Extension record read model's reader (LA-AUT-RM39-RD): the one way the Extension record queries reach the read
// model's storage. The query handlers depend only on the ExtensionRecordReader interface; the query runner injects the
// reader each query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this
// interface and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import type { KindDescription } from '../../platform/data/schema.ts';
import { domainIn, extensionRecordTableFrom, listKey, productIn, type ExtensionRecordPage, type ExtensionRecordSummary, type ExtensionRecordTable } from './read-model.ts';

/** What the Extension record queries read, and all they read. */
export interface ExtensionRecordReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The kinds the products declare, by name. */
  productKinds(): KindDescription[];
  /** The page of the record with this ID, or undefined when it is no record of a product kind. */
  page(id: string): ExtensionRecordPage | undefined;
  /** The records of the product kind under the parent, by ID. */
  list(kind: string, parent: string): ExtensionRecordSummary[];
  /** The product the record sits in, or null. */
  productOf(id: string): string | null;
  /** The domain the record sits in, or undefined. */
  domainOf(id: string): string | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryExtensionRecordReader implements ExtensionRecordReader {
  private readonly table: ExtensionRecordTable;

  constructor(table: ExtensionRecordTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.places.get(id)?.kind;
  }

  productKinds(): KindDescription[] {
    return this.table.productKinds;
  }

  page(id: string): ExtensionRecordPage | undefined {
    return this.table.pages.get(id);
  }

  list(kind: string, parent: string): ExtensionRecordSummary[] {
    return this.table.lists.get(listKey(kind, parent)) ?? [];
  }

  productOf(id: string): string | null {
    return productIn(this.table, id);
  }

  domainOf(id: string): string | undefined {
    return domainIn(this.table, id);
  }

  highestAfter(prefix: string): number {
    const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
    let highest = 0;
    for (const id of this.table.places.keys()) {
      const m = shape.exec(id);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    return highest;
  }
}

/** The reader the query runner gives each Extension record query: today's, over the projection's table built from the data. */
export const extensionRecordReader = (view: ReadView): ExtensionRecordReader => new InMemoryExtensionRecordReader(extensionRecordTableFrom(view));
