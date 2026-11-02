// The Test data set aggregate (LA-TST-A17): what some tests start from, in one domain: its environment, accounts and
// records, how to prepare and reset it, and the file that builds it. One instance is one test data set; tests link to
// it with starts_from, a link their own aggregates start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { TestDataSetRow } from '../../platform/data/tables.ts';

/** One test data set, whole. */
export interface TestDataSet {
  /** The test data set's ID: the aggregate's root. */
  readonly root: string;
  testDataSet: TestDataSetRow;
}

/** The tables the Test data set aggregate keeps its rows in: its one kind. */
export const TEST_DATA_SET_TABLES = ['test_data_set'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const TEST_DATA_SET_SHAPE = {
  test_data_set: { at: 'testDataSet' },
} as const satisfies AggregateShape;

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
