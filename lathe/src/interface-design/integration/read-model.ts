// The Integration aggregate's read model (LA-IXD-RM34), shaped for its readers: the Integration page reads an
// integration whole (its adapter with the standard rules it meets and the packages it uses, its integration tests by
// ID and the use cases it performs) with the record the page is about, a product's list reads each of its
// integrations, and the editor's next ID reads the IDs in use. The projection (integrationTableFrom) is the only code that reads the source rows and the only
// code that writes the read model's table; the query handlers read that table only through the reader (reader.ts).
// Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { AdapterRow, IntegrationRow, IntegrationTestRow } from '../../platform/data/tables.ts';
import type { IntegrationKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** An integration test as the page shows it: its row and the test data sets it starts from. */
export interface IntegrationTestOnPage {
  test: IntegrationTestRow;
  startsFrom: string[];
}

/** The integration's adapter as the page shows it: its row, the standard rules it meets and the packages it uses. */
export interface AdapterOnPage {
  adapter: AdapterRow;
  meets: string[];
  packages: string[];
}

/** An integration whole, as its page shows it: its row, the use cases it performs, its adapter when it has one, and its tests by ID. */
export interface IntegrationTree {
  integration: IntegrationRow;
  /** The use cases of its product it performs on its own, by ID. */
  performs: string[];
  adapter: AdapterOnPage | null;
  tests: IntegrationTestOnPage[];
}

/** An integration as its page reads it, with the record of it the page is about. */
export interface IntegrationPage extends IntegrationTree {
  record: { id: string; kind: IntegrationKind };
}

/** An integration as a product's list reads it. */
export interface IntegrationSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface IntegrationTable {
  /** Each integration whole, by its ID. */
  integrations: Map<string, IntegrationTree>;
  /** Each record inside an integration: the integration that holds it and its kind there. */
  holding: Map<string, { root: string; kind: IntegrationKind }>;
  /** Each product's integrations (those whose ID begins with the product's), by ID; a product with none has an empty list. */
  products: Map<string, IntegrationSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's other ends by one end, each list sorted. */
function linked(view: ReadView, table: string, by: string, other: string): (id: string) => string[] {
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function integrationTableFrom(view: ReadView): IntegrationTable {
  const startsFrom = linked(view, 'starts_from', 'source_id', 'target_id');
  const meets = linked(view, 'meets', 'source_id', 'target_id');
  const packages = linked(view, 'package_use', 'record_id', 'package');
  const performs = linked(view, 'performs', 'source_id', 'target_id');
  const adapters = grouped<AdapterRow>(view.rows('adapter'), 'integration_id');
  const tests = grouped<IntegrationTestRow>(view.rows('integration_test'), 'integration_id');
  const integrations = new Map<string, IntegrationTree>();
  const holding = new Map<string, { root: string; kind: IntegrationKind }>();
  const products = new Map<string, IntegrationSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  // The longest product ID first, so an integration belongs to the product whose ID begins its own the most.
  const productIds = [...products.keys()].sort((a, b) => b.length - a.length);
  for (const integration of view.rows('integration') as unknown as IntegrationRow[]) {
    const root = integration.id;
    holding.set(root, { root, kind: 'integration' });
    const adapter = adapters.get(root)?.[0];
    const tree: IntegrationTree = {
      integration,
      performs: performs(root),
      adapter: adapter ? { adapter, meets: meets(adapter.id), packages: packages(adapter.id) } : null,
      tests: [...(tests.get(root) ?? [])].sort(byRecordId).map((test) => ({ test, startsFrom: startsFrom(test.id) })),
    };
    if (adapter) holding.set(adapter.id, { root, kind: 'adapter' });
    for (const t of tree.tests) holding.set(t.test.id, { root, kind: 'integration_test' });
    integrations.set(root, tree);
    const product = productIds.find((p) => root.startsWith(`${p}-`));
    if (product) products.get(product)!.push({ id: integration.id, title: integration.title });
  }
  for (const list of products.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { integrations, holding, products, kinds };
}
