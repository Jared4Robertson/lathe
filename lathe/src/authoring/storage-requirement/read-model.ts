// The Storage requirement aggregate's read model (LA-AUT-RM42), shaped for its readers: the Storage requirement page
// reads a requirement whole (the aggregate or read model it is about, what builds it, its storage requirement tests with the test
// data sets each starts from) with the record the page is about, an aggregate's or read model's list reads each
// requirement's ID and title, and the editor's next ID reads the IDs in use. The projection
// (storageRequirementTableFrom) is the only code that reads the source rows and the only code that writes the read
// model's table; the query handlers read that table only through the reader (reader.ts). Nothing here is the
// aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { StorageRequirementRow, StorageRequirementTestRow } from '../../platform/data/tables.ts';
import type { StorageRequirementKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** The aggregate or read model a storage requirement is about. */
export interface StoredParent {
  id: string;
  kind: 'aggregate' | 'read_model';
  title: string;
}

/** What builds a storage requirement: its aggregate's repository or its read model's reader, and the data store it names. */
export interface StorageBuilder {
  id: string;
  kind: 'repository' | 'reader';
  title: string;
  file: string | null;
  /** The data store it is stored in, once it names one. */
  storedIn: { id: string; title: string; kind: string } | null;
}

/** A storage requirement test as the page shows it: its row and the test data sets it starts from. */
export interface StorageRequirementTestOnPage {
  test: StorageRequirementTestRow;
  startsFrom: string[];
}

/** A storage requirement whole, as its page shows it. */
export interface StorageRequirementTree {
  requirement: StorageRequirementRow;
  parent: StoredParent;
  /** The repository or reader that builds it, if its parent has one. */
  builder: StorageBuilder | null;
  /** Its storage requirement tests, by ID. */
  tests: StorageRequirementTestOnPage[];
}

/** A storage requirement as its page reads it, with the record of it the page is about. */
export interface StorageRequirementPage extends StorageRequirementTree {
  record: { id: string; kind: StorageRequirementKind };
}

/** A storage requirement as its parent's list reads it. */
export interface StorageRequirementSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface StorageRequirementTable {
  /** Each storage requirement whole, by its ID. */
  requirements: Map<string, StorageRequirementTree>;
  /** Each record inside a storage requirement: the requirement that holds it and its kind there. */
  holding: Map<string, { root: string; kind: StorageRequirementKind }>;
  /** Each aggregate's and read model's storage requirements, by ID; one with none has an empty list. */
  parents: Map<string, StorageRequirementSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** A link table's other ends by one column, each list sorted. */
function linked(rows: Row[], by: string, other: string): (id: string) => string[] {
  const found = new Map<string, string[]>();
  for (const r of rows) found.set(String(r[by]), [...(found.get(String(r[by])) ?? []), String(r[other])]);
  return (id) => [...(found.get(id) ?? [])].sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function storageRequirementTableFrom(view: ReadView): StorageRequirementTable {
  const startsFrom = linked(view.rows('starts_from'), 'source_id', 'target_id');
  const storedIn = linked(view.rows('stored_in'), 'source_id', 'target_id');
  const persistedBy = linked(view.rows('persists'), 'target_id', 'source_id');
  const titles = new Map<string, string>();
  for (const kind of ['aggregate', 'read_model', 'repository', 'reader']) for (const r of view.rows(kind)) titles.set(String(r.id), String(r.title));
  const stores = new Map(view.rows('data_store').map((r) => [String(r.id), { id: String(r.id), title: String(r.title), kind: String(r.kind) }]));
  const repositories = new Map(view.rows('repository').map((r) => [String(r.id), r]));
  const readers = new Map(view.rows('reader').map((r) => [String(r.read_model_id), r]));
  const builder = (row: Row | undefined, kind: StorageBuilder['kind']): StorageBuilder | null => {
    if (!row) return null;
    const id = String(row.id);
    const store = storedIn(id)[0];
    return { id, kind, title: String(row.title), file: row.file === undefined ? null : String(row.file), storedIn: (store === undefined ? undefined : stores.get(store)) ?? null };
  };
  const testsOf = new Map<string, StorageRequirementTestOnPage[]>();
  for (const test of view.rows('storage_requirement_test') as unknown as StorageRequirementTestRow[]) {
    testsOf.set(test.storage_requirement_id, [...(testsOf.get(test.storage_requirement_id) ?? []), { test, startsFrom: startsFrom(test.id) }]);
  }
  const requirements = new Map<string, StorageRequirementTree>();
  const holding = new Map<string, { root: string; kind: StorageRequirementKind }>();
  const parents = new Map<string, StorageRequirementSummary[]>();
  for (const kind of ['aggregate', 'read_model']) for (const r of view.rows(kind)) parents.set(String(r.id), []);
  for (const requirement of view.rows('storage_requirement') as unknown as StorageRequirementRow[]) {
    const root = requirement.id;
    const parentId = requirement.aggregate_id ?? requirement.read_model_id!;
    const parentKind = requirement.aggregate_id !== undefined ? 'aggregate' : 'read_model';
    const tests = (testsOf.get(root) ?? []).sort((a, b) => byRecordId(a.test, b.test));
    requirements.set(root, {
      requirement,
      parent: { id: parentId, kind: parentKind, title: titles.get(parentId) ?? parentId },
      builder: parentKind === 'aggregate' ? builder(repositories.get(persistedBy(parentId)[0] ?? ''), 'repository') : builder(readers.get(parentId), 'reader'),
      tests,
    });
    holding.set(root, { root, kind: 'storage_requirement' });
    for (const t of tests) holding.set(t.test.id, { root, kind: 'storage_requirement_test' });
    parents.get(parentId)?.push({ id: root, title: requirement.title });
  }
  for (const list of parents.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { requirements, holding, parents, kinds };
}
