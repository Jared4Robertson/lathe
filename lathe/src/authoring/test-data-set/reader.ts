// The Test data set read model's reader (LA-AUT-RM37-RD): the one way the Test data set queries reach the read model's
// storage. The query handlers depend only on the TestDataSetReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { testDataSetTableFrom, type TestDataSetPage, type TestDataSetSummary, type TestDataSetTable } from './read-model.ts';

/** What the Test data set queries read, and all they read. */
export interface TestDataSetReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a test data set, or undefined when no test data set has the ID. */
  page(id: string): TestDataSetPage | undefined;
  /** A domain's test data sets, by ID, or undefined when there is no such domain. */
  testDataSetsOf(domainId: string): TestDataSetSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryTestDataSetReader implements TestDataSetReader {
  private readonly table: TestDataSetTable;
  private readonly schema: SchemaDescription;

  constructor(table: TestDataSetTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): TestDataSetPage | undefined {
    return this.table.sets.get(id);
  }

  testDataSetsOf(domainId: string): TestDataSetSummary[] | undefined {
    return this.table.domains.get(domainId);
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

/** The reader the query runner gives each Test data set query: today's, over the projection's table built from the data. */
export const testDataSetReader = (view: ReadView): TestDataSetReader => new InMemoryTestDataSetReader(testDataSetTableFrom(view), view.schema);
