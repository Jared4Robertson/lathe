// The View aggregate's read model (LA-AUT-RM32), shaped for its readers: the View page reads a view whole (the commands
// and queries it presents, its requirements by ID, each with its tests and the test data sets they start from) with the record the page is about, a
// product's list reads each view's ID and title, and the editor's next ID reads the IDs in use. The projection
// (viewTableFrom) is the only code that reads the source rows and the only code that writes the read model's table;
// the query handlers read that table only through the reader (reader.ts). Nothing here is the aggregate's own
// instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ViewRequirementRow, ViewRow, ViewTestRow } from '../../platform/data/tables.ts';
import type { ViewKind } from './model.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A view test as the page shows it: its row and the test data sets it starts from. */
export interface ViewTestOnPage {
  test: ViewTestRow;
  startsFrom: string[];
}

/** A view requirement as the page shows it: its row and its tests by ID. */
export interface ViewRequirementOnPage {
  requirement: ViewRequirementRow;
  tests: ViewTestOnPage[];
}

/** A view whole, as its page shows it: its row, what it presents and its requirements by ID. */
export interface ViewTree {
  view: ViewRow;
  /** The commands and queries it presents, by ID. */
  presents: string[];
  requirements: ViewRequirementOnPage[];
}

/** A view as its page reads it, with the record of it the page is about. */
export interface ViewPage extends ViewTree {
  record: { id: string; kind: ViewKind };
}

/** A view as a product's list reads it. */
export interface ViewSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface ViewTable {
  /** Each view whole, by its ID. */
  views: Map<string, ViewTree>;
  /** Each record inside a view: the view that holds it and its kind there. */
  holding: Map<string, { root: string; kind: ViewKind }>;
  /** Each product's views, by ID; a product with none has an empty list. A view's product is its ID's prefix. */
  products: Map<string, ViewSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's ends by one end, each list sorted. */
function linked(view: ReadView, table: string, by: 'source_id' | 'target_id'): (id: string) => string[] {
  const other = by === 'source_id' ? 'target_id' : 'source_id';
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function viewTableFrom(view: ReadView): ViewTable {
  const startsFrom = linked(view, 'starts_from', 'source_id');
  const presents = linked(view, 'presents', 'source_id');
  const requirements = grouped<ViewRequirementRow>(view.rows('view_requirement'), 'view_id');
  const tests = grouped<ViewTestRow>(view.rows('view_test'), 'view_requirement_id');
  const views = new Map<string, ViewTree>();
  const holding = new Map<string, { root: string; kind: ViewKind }>();
  const products = new Map<string, ViewSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const row of view.rows('view') as unknown as ViewRow[]) {
    const root = row.id;
    holding.set(root, { root, kind: 'view' });
    const tree: ViewTree = {
      view: row,
      presents: presents(root),
      requirements: [...(requirements.get(root) ?? [])].sort(byRecordId).map((requirement) => ({
        requirement,
        tests: [...(tests.get(requirement.id) ?? [])].sort(byRecordId).map((test) => ({ test, startsFrom: startsFrom(test.id) })),
      })),
    };
    for (const r of tree.requirements) {
      holding.set(r.requirement.id, { root, kind: 'view_requirement' });
      for (const t of r.tests) holding.set(t.test.id, { root, kind: 'view_test' });
    }
    views.set(root, tree);
    products.get(root.replace(/-V\d+$/, ''))?.push({ id: root, title: row.title });
  }
  for (const list of products.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { views, holding, products, kinds };
}
