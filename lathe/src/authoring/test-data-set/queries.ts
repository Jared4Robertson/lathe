// The Test data set aggregate's own reads (read model LA-AUT-RM37): a test data set whole, the test data sets of a
// domain, and the next free ID for one. Each reads the current data and changes nothing.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { TEST_DATA_SET_SLICE, testDataSetsFrom, type TestDataSet } from './model.ts';

const refuse = (rule: string, message: string): never => {
  throw new StoreError([{ rule, message }]);
};

/** The test data set with this ID. */
export function getTestDataSet(view: ReadView, input: { id: string }): TestDataSet {
  const record = view.record(input.id) ?? refuse('missing', `no record has the ID ${input.id}`);
  if (record.kind !== 'test_data_set') refuse('kind', `${input.id} is a ${record.kind}, not a test data set`);
  return testDataSetsFrom((table) => view.rows(table), input.id)[0];
}

/** GET a test data set whole (LA-AUT-QRY135). */
export const GET_TEST_DATA_SET: QueryDefinition<{ id: string }, TestDataSet> = {
  id: 'LA-AUT-QRY135',
  slice: TEST_DATA_SET_SLICE,
  name: 'get-test-data-set',
  description: 'Reads a test data set whole, by its ID: its environment, accounts and records, how to prepare and reset it, and the file that builds it.',
  input: { id: id('The test data set.', 'required') },
  run: getTestDataSet,
  text: testDataSetText,
};

/** The test data sets of a domain, by ID. */
export function listTestDataSets(view: ReadView, input: { domain_id: string }): { id: string; title: string }[] {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('missing', `there is no domain ${input.domain_id}`);
  return view
    .rows('test_data_set')
    .filter((t) => t.domain_id === input.domain_id)
    .map((t) => ({ id: String(t.id), title: String(t.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** List the test data sets of a domain (LA-AUT-QRY136). */
export const LIST_TEST_DATA_SETS: QueryDefinition<{ domain_id: string }, { id: string; title: string }[]> = {
  id: 'LA-AUT-QRY136',
  slice: TEST_DATA_SET_SLICE,
  name: 'list-test-data-sets',
  description: 'Lists the test data sets of a domain, by ID, with their titles.',
  input: { domain_id: id('The domain.', 'required') },
  run: listTestDataSets,
  text: (rows) => (rows.length ? rows.map((r) => `${r.id}  ${r.title}`).join('\n') : 'No test data sets.'),
};

/** The next free ID for a test data set of the domain: its domain's ID, TD and one past the highest number in use. */
export function nextTestDataSetId(view: ReadView, input: { domain_id: string }): string {
  if (view.record(input.domain_id)?.kind !== 'domain') refuse('parent', `a test data set sits under a domain, and ${input.domain_id} is not one`);
  const prefix = `${input.domain_id}-TD`;
  const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  let highest = 0;
  for (const row of view.rows('test_data_set')) {
    const m = shape.exec(String(row.id));
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return `${prefix}${String(highest + 1).padStart(2, '0')}`;
}

/** Get the next ID for a test data set (LA-AUT-QRY137). */
export const NEXT_TEST_DATA_SET_ID: QueryDefinition<{ domain_id: string }, string> = {
  id: 'LA-AUT-QRY137',
  slice: TEST_DATA_SET_SLICE,
  name: 'next-id',
  description: 'The next free ID for a test data set of a domain: one past the highest in use.',
  input: { domain_id: id('The domain it will sit under.', 'required') },
  run: nextTestDataSetId,
  text: (next) => next,
};

/** A test data set as text: its row, one column a line. */
function testDataSetText({ testDataSet: row }: TestDataSet): string {
  const lines = [`Test data set ${row.id}: ${row.title}`, `  domain: ${row.domain_id}`, `  environment: ${row.environment}`];
  if (row.accounts) lines.push(`  accounts: ${row.accounts}`);
  lines.push(`  records: ${row.records}`, `  prepare: ${row.prepare}`, `  reset: ${row.reset}`);
  if (row.file) lines.push(`  file: ${row.file}`);
  lines.push(`  description: ${row.description}`);
  return lines.join('\n');
}

/** The Test data set aggregate's queries, as the CLI and the MCP server register them. */
export const TEST_DATA_SET_QUERIES: readonly AnyQuery[] = [GET_TEST_DATA_SET, LIST_TEST_DATA_SETS, NEXT_TEST_DATA_SET_ID];
