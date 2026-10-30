// The UI component read model (LA-AUT-RM35): a UI component as its readers see it, with the views it renders and the view requirements it builds, and the
// UI components of a product in a list. Its projection builds them from the rows; it shares no type with the
// aggregate.
import type { ReadView } from '../../platform/data/rules.ts';

/** One UI component, whole. */
export interface UiComponentPage {
  id: string;
  title: string;
  file: string | null;
  description: string;
  /** The views it renders, or part of. */
  renders: string[];
  /** The view requirements its code builds. */
  builds: string[];
  meets: string[];
  packages: string[];
}

/** A UI component in a list. */
export interface UiComponentSummary {
  id: string;
  title: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface UiComponentTable {
  /** Each UI component whole, by its ID, in ID order. */
  components: Map<string, UiComponentPage>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function uiComponentTableFrom(view: ReadView): UiComponentTable {
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const r of view.rows(kind)) kinds.set(String(r.id), kind);
  const linked = (table: string, source: string, target: string) => {
    const found = new Map<string, string[]>();
    for (const l of view.rows(table)) found.set(String(l[source]), [...(found.get(String(l[source])) ?? []), String(l[target])]);
    return (id: string) => [...(found.get(id) ?? [])].sort();
  };
  const [renders, builds, meets, packages] = [linked('renders', 'source_id', 'target_id'), linked('builds', 'source_id', 'target_id'), linked('meets', 'source_id', 'target_id'), linked('package_use', 'record_id', 'package')];
  const components = new Map<string, UiComponentPage>();
  for (const c of [...view.rows('ui_component')].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }))) {
    const id = String(c.id);
    components.set(id, { id, title: String(c.title), file: c.file === undefined ? null : String(c.file), description: String(c.description), renders: renders(id), builds: builds(id), meets: meets(id), packages: packages(id) });
  }
  return { components, kinds };
}
