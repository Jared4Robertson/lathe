// The Test data set aggregate's own reads, each answered from its read model (LA-AUT-RM37) through its reader
// (reader.ts), which the query runner gives each handler: a test data set whole as its page reads it, the test data
// sets of a domain, and the next free ID for one. A handler never sees the data, a repository or the aggregate's
// model; each changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { TEST_DATA_SET_SLICE } from './model.ts';
import type { TestDataSetPage, TestDataSetSummary } from './read-model.ts';
import { testDataSetReader, type TestDataSetReader } from './reader.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The test data set with this ID, as its page reads it. */
export function getTestDataSet(reader: TestDataSetReader, input: { id: string }): TestDataSetPage {
  const kind = reader.kindOf(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  return reader.page(input.id) ?? refuse('kind', `${input.id} is ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}, not a test data set`);
}

/** GET a test data set whole (LA-AUT-QRY135). */
export const GET_TEST_DATA_SET: QueryDefinition<{ id: string }, TestDataSetPage, TestDataSetReader> = {
  id: 'LA-AUT-QRY135',
  slice: TEST_DATA_SET_SLICE,
  name: 'get-test-data-set',
  description: 'Reads a test data set whole as its page shows it, by its ID: its environment, accounts and records, how to prepare and reset it, the file that builds it, and the tests that start from it.',
  method: 'GET',
  route: '/api/test-data-set/get-test-data-set',
  input: { id: id('The test data set.', 'required') },
  reader: testDataSetReader,
  run: getTestDataSet,
  text: testDataSetText,
};

/** The test data sets of a domain, by ID. */
export function listTestDataSets(reader: TestDataSetReader, input: { domain_id: string }): TestDataSetSummary[] {
  return reader.testDataSetsOf(input.domain_id) ?? refuse('missing', `there is no domain ${input.domain_id}`);
}

/** List the test data sets of a domain (LA-AUT-QRY136). */
export const LIST_TEST_DATA_SETS: QueryDefinition<{ domain_id: string }, TestDataSetSummary[], TestDataSetReader> = {
  id: 'LA-AUT-QRY136',
  slice: TEST_DATA_SET_SLICE,
  name: 'list-test-data-sets',
  description: 'Lists the test data sets of a domain, by ID, with their titles.',
  method: 'GET',
  route: '/api/test-data-set/list-test-data-sets',
  input: { domain_id: id('The domain.', 'required') },
  reader: testDataSetReader,
  run: listTestDataSets,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No test data sets.'),
};

/** The next free ID for a test data set of the domain: its domain's ID, TD and one past the highest number in use. */
export function nextTestDataSetId(reader: TestDataSetReader, input: { domain_id: string }): string {
  if (reader.kindOf(input.domain_id) !== 'domain') refuse('parent', `a test data set sits under a domain, and ${input.domain_id} is not one`);
  const prefix = `${input.domain_id}-TD`;
  return `${prefix}${String(reader.highestAfter(prefix) + 1).padStart(2, '0')}`;
}

/** Get the next ID for a test data set (LA-AUT-QRY137). */
export const NEXT_TEST_DATA_SET_ID: QueryDefinition<{ domain_id: string }, string, TestDataSetReader> = {
  id: 'LA-AUT-QRY137',
  slice: TEST_DATA_SET_SLICE,
  name: 'next-id',
  description: 'The next free ID for a test data set of a domain: one past the highest in use.',
  method: 'GET',
  route: '/api/test-data-set/next-id',
  input: { domain_id: id('The domain it will sit under.', 'required') },
  reader: testDataSetReader,
  run: nextTestDataSetId,
  text: (next) => next,
};

/** A test data set as text: its row, one column a line. */
function testDataSetText({ testDataSet: row, startedFromBy }: TestDataSetPage): string {
  const lines = [`Test data set ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  environment: ${row.environment}`];
  if (row.accounts) lines.push(`  accounts: ${row.accounts}`);
  lines.push(`  records: ${row.records}`, `  prepare: ${row.prepare}`, `  reset: ${row.reset}`);
  if (row.file) lines.push(`  file: ${row.file}`);
  lines.push(`  description: ${row.description}`);
  if (startedFromBy.length) lines.push(`  started from by: ${startedFromBy.join(', ')}`);
  return lines.join('\n');
}

/** The Test data set aggregate's queries, as the CLI and the MCP server register them. */
export const TEST_DATA_SET_QUERIES: readonly AnyQuery[] = [GET_TEST_DATA_SET, LIST_TEST_DATA_SETS, NEXT_TEST_DATA_SET_ID];
