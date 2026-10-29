// The View read model's reader (LA-AUT-RM32-RD): the one way the View queries reach the read model's storage. The
// query handlers depend only on the ViewReader interface; the query runner injects the reader each query's definition
// makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and nothing more.
// Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { viewTableFrom, type ViewPage, type ViewSummary, type ViewTable } from './read-model.ts';

/** What the View queries read, and all they read. */
export interface ViewReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of the view that holds the record, or undefined when no view holds it. */
  page(id: string): ViewPage | undefined;
  /** A product's views, by ID. */
  viewsOf(product: string): ViewSummary[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryViewReader implements ViewReader {
  private readonly table: ViewTable;

  constructor(table: ViewTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): ViewPage | undefined {
    const root = this.table.holding.get(id);
    return root === undefined ? undefined : this.table.views.get(root);
  }

  viewsOf(product: string): ViewSummary[] {
    return [...this.table.views.values()].filter((v) => v.id.startsWith(`${product}-`)).map((v) => ({ id: v.id, title: v.title }));
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

/** The reader the query runner gives each View query: today's, over the projection's table built from the data. */
export const viewReader = (view: ReadView): ViewReader => new InMemoryViewReader(viewTableFrom(view));
