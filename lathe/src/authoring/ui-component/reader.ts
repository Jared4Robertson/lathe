// The UI component read model's reader (LA-AUT-RM35-RD): the one way the UI component queries reach the read model's
// storage. The query handlers depend only on the UiComponentReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { uiComponentTableFrom, type UiComponentPage, type UiComponentSummary, type UiComponentTable } from './read-model.ts';

/** What the UI component queries read, and all they read. */
export interface UiComponentReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a UI component (the component itself), or undefined when no UI component holds it. */
  page(id: string): UiComponentPage | undefined;
  /** A product's UI components, by ID, or undefined when there is no such product. */
  componentsOf(productId: string): UiComponentSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryUiComponentReader implements UiComponentReader {
  private readonly table: UiComponentTable;

  constructor(table: UiComponentTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): UiComponentPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.components.get(holding.root)! };
  }

  componentsOf(productId: string): UiComponentSummary[] | undefined {
    return this.table.products.get(productId);
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

/** The reader the query runner gives each UI component query: today's, over the projection's table built from the data. */
export const uiComponentReader = (view: ReadView): UiComponentReader => new InMemoryUiComponentReader(uiComponentTableFrom(view));
