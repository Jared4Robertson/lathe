// The Test data set aggregate's own reads, each answered from its read model (LA-AUT-RM37) through its reader
// (reader.ts), which the query runner gives each handler: a test data set whole as its page reads it, the test data
// sets of a domain, and the next free ID for one. A handler never sees the data, a repository or the aggregate's
// model; each changes nothing.
import { id, type QueryDefinition } from '../../platform/commands/definition.ts';
import { onePast } from '../../platform/data/id-shape.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { TestDataSetPage, TestDataSetSummary } from './read-model.ts';
import { testDataSetReader, type TestDataSetReader } from './reader.ts';
import { GET_TEST_DATA_SET_IDENTITY, LIST_TEST_DATA_SETS_IDENTITY, NEXT_TEST_DATA_SET_ID_IDENTITY } from './queries.generated.ts';

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
  ...GET_TEST_DATA_SET_IDENTITY,
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
  ...LIST_TEST_DATA_SETS_IDENTITY,
  input: { domain_id: id('The domain.', 'required') },
  reader: testDataSetReader,
  run: listTestDataSets,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No test data sets.'),
};

/** The next free ID for a test data set of the domain: its domain's ID, TD and one past the highest number in use. */
export function nextTestDataSetId(reader: TestDataSetReader, input: { domain_id: string }): string {
  const shape = reader.idShape('test_data_set');
  if (reader.kindOf(input.domain_id) !== shape.parents[0]) refuse('parent', `a test data set sits under a domain, and ${input.domain_id} is not one`);
  return onePast(reader, `${input.domain_id}-${shape.letters}`, shape);
}

/** Get the next ID for a test data set (LA-AUT-QRY137). */
export const NEXT_TEST_DATA_SET_ID: QueryDefinition<{ domain_id: string }, string, TestDataSetReader> = {
  ...NEXT_TEST_DATA_SET_ID_IDENTITY,
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
