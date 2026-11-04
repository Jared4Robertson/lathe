// The UI component aggregate's read model (LA-IXD-RM35), shaped for its readers: the UI component page reads a UI
// component whole (its row, the views it renders, the view requirements it builds, the standard rules it meets and the packages it uses) with the
// record the page is about, a product's list reads each UI component's ID and title, and the editor's next ID reads
// the IDs in use. The projection (uiComponentTableFrom) is the only code that reads the source rows and the only code
// that writes the read model's table; the query handlers read that table only through the reader (reader.ts). Nothing
// here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { UiComponentRow } from '../../platform/data/tables.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** The kind of the aggregate's one record. */
type UiComponentKind = 'ui_component';

/** A UI component whole, as its page shows it: its row and the links it starts, each list sorted. */
export interface UiComponentTree {
  component: UiComponentRow;
  /** The views it renders, or part of. */
  renders: string[];
  /** The view requirements its code builds. */
  builds: string[];
  /** The standard rules it meets. */
  meets: string[];
  /** The packages it uses. */
  packages: string[];
  /** Its helper files, sorted. */
  helpers: string[];
}

/** A UI component as its page reads it, with the record of it the page is about. */
export interface UiComponentPage extends UiComponentTree {
  record: { id: string; kind: UiComponentKind };
}

/** A UI component as a product's list reads it. */
export interface UiComponentSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface UiComponentTable {
  /** Each UI component whole, by its ID. */
  components: Map<string, UiComponentTree>;
  /** Each record inside a UI component (the component itself): the component that holds it and its kind there. */
  holding: Map<string, { root: string; kind: UiComponentKind }>;
  /** Each product's UI components, by ID; a product with none has an empty list. A component's product is its ID's prefix. */
  products: Map<string, UiComponentSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** Rows by a column's value, each list in the table's order. */
function grouped<T>(rows: Row[], column: string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) found.set(String(r[column]), [...(found.get(String(r[column])) ?? []), r as unknown as T]);
  return found;
}

/** A link table's other ends by one end's column, each list sorted. */
function linked(view: ReadView, table: string, by: string, other: string): (id: string) => string[] {
  const found = grouped<Row>(view.rows(table), by);
  return (id) => (found.get(id) ?? []).map((l) => String(l[other])).sort();
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function uiComponentTableFrom(view: ReadView): UiComponentTable {
  const renders = linked(view, 'renders', 'source_id', 'target_id');
  const builds = linked(view, 'builds', 'source_id', 'target_id');
  const meets = linked(view, 'meets', 'source_id', 'target_id');
  const packages = linked(view, 'package_use', 'record_id', 'package');
  const helpers = linked(view, 'helper_file', 'record_id', 'file');
  const components = new Map<string, UiComponentTree>();
  const holding = new Map<string, { root: string; kind: UiComponentKind }>();
  const products = new Map<string, UiComponentSummary[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const component of view.rows('ui_component') as unknown as UiComponentRow[]) {
    const root = component.id;
    holding.set(root, { root, kind: 'ui_component' });
    components.set(root, { component, renders: renders(root), builds: builds(root), meets: meets(root), packages: packages(root), helpers: helpers(root) });
    products.get(root.replace(/-UI\d+$/, ''))?.push({ id: root, title: component.title });
  }
  for (const list of products.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { components, holding, products, kinds };
}
