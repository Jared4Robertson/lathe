// The Test data set aggregate (LA-AUT-A17): what some tests start from, in one domain: its environment, accounts and
// records, how to prepare and reset it, and the file that builds it. One instance is one test data set; tests link to
// it with starts_from, a link their own aggregates start.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { TestDataSetRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const TEST_DATA_SET_AGGREGATE = 'LA-AUT-A17';

/** How the interfaces reach the aggregate's commands: `lathe test-data-set`, the test_data_set_ tools, /api/test-data-set/. */
export const TEST_DATA_SET_SLICE: Slice = { aggregate: TEST_DATA_SET_AGGREGATE, name: 'test-data-set' };

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** One test data set, whole. */
export interface TestDataSet {
  /** The test data set's ID: the aggregate's root. */
  readonly root: string;
  testDataSet: TestDataSetRow;
}

/** The tables the Test data set aggregate keeps its rows in: its one kind. */
export const TEST_DATA_SET_TABLES = ['test_data_set'] as const;

/** A new test data set. */
export function newTestDataSet(testDataSet: TestDataSetRow): TestDataSet {
  return { root: testDataSet.id, testDataSet };
}

/** The test data sets in the data, each whole; only the one given, when given. */
export function testDataSetsFrom(rows: (table: string) => Row[], only?: string): TestDataSet[] {
  return (rows('test_data_set') as unknown as TestDataSetRow[]).filter((r) => only === undefined || r.id === only).map(newTestDataSet);
}

/** The instance's rows, by table. */
export function testDataSetRows(testDataSet: TestDataSet): Map<string, Row[]> {
  return new Map<string, Row[]>([['test_data_set', [testDataSet.testDataSet as unknown as Row]]]);
}
