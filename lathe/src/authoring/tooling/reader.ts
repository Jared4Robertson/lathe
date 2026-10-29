// The Tooling read model's reader (LA-AUT-RM41-RD): the one way the Tooling queries reach the read model's storage.
// The query handlers depend only on the ToolingReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { toolingTableFrom, type ToolingPage, type ToolingSummary, type ToolingTable } from './read-model.ts';

/** What the Tooling queries read, and all they read. */
export interface ToolingReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of the record with this ID, or undefined when there is none. */
  page(id: string): ToolingPage | undefined;
  /** The records under the domain, by ID. */
  list(domain: string): ToolingSummary[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryToolingReader implements ToolingReader {
  private readonly table: ToolingTable;

  constructor(table: ToolingTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): ToolingPage | undefined {
    return this.table.pages.get(id);
  }

  list(domain: string): ToolingSummary[] {
    return this.table.lists.get(domain) ?? [];
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

/** The reader the query runner gives each Tooling query: today's, over the projection's table built from the data. */
export const toolingReader = (view: ReadView): ToolingReader => new InMemoryToolingReader(toolingTableFrom(view));
