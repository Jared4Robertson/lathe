// The Test data set aggregate's read model (LA-AUT-RM37), shaped for its readers: the Test data set page reads one set
// whole with the tests that start from it, a domain's list reads each set's ID and title, and the editor's next ID
// reads the IDs in use. The projection (testDataSetTableFrom) is the only code that reads the source rows and the only
// code that writes the read model's table; the query handlers read that table only through the reader (reader.ts).
// Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { TestDataSetRow } from '../../platform/data/tables.ts';

/** A test data set as its page reads it: its row, the tests that start from it, and the record the page is about. */
export interface TestDataSetPage {
  record: { id: string; kind: 'test_data_set' };
  testDataSet: TestDataSetRow;
  /** The tests that start from it, by ID. */
  startedFromBy: string[];
}

/** A test data set as a domain's list reads it. */
export interface TestDataSetSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface TestDataSetTable {
  /** Each test data set's page, by its ID. */
  sets: Map<string, TestDataSetPage>;
  /** Each domain's test data sets, by ID; a domain with none has an empty list. */
  domains: Map<string, TestDataSetSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function testDataSetTableFrom(view: ReadView): TestDataSetTable {
  const startedFromBy = new Map<string, string[]>();
  for (const l of view.rows('starts_from')) startedFromBy.set(String(l.target_id), [...(startedFromBy.get(String(l.target_id)) ?? []), String(l.source_id)]);
  const domains = new Map<string, TestDataSetSummary[]>(view.rows('domain').map((d) => [String(d.id), []]));
  const sets = new Map<string, TestDataSetPage>();
  for (const testDataSet of view.rows('test_data_set') as unknown as TestDataSetRow[]) {
    sets.set(testDataSet.id, { record: { id: testDataSet.id, kind: 'test_data_set' }, testDataSet, startedFromBy: [...(startedFromBy.get(testDataSet.id) ?? [])].sort() });
    domains.get(testDataSet.domain_id)?.push({ id: testDataSet.id, title: testDataSet.title });
  }
  for (const list of domains.values()) list.sort(byId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { sets, domains, kinds };
}
