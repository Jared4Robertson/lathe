// The UI component read model (LA-AUT-RM35): a UI component as its readers see it, with the views it renders, and the
// UI components of a product in a list. Its projection builds them from the rows; it shares no type with the
// aggregate.
import type { Row } from '../../platform/data/rows.ts';

/** One UI component, whole. */
export interface UiComponentPage {
  id: string;
  title: string;
  file: string | null;
  description: string;
  /** The views it renders, or part of. */
  renders: string[];
  meets: string[];
  packages: string[];
}

/** A UI component in a list. */
export interface UiComponentSummary {
  id: string;
  title: string;
}

const targets = (links: Row[], from: string, source: string, target: string) => links.filter((l) => l[source] === from).map((l) => String(l[target])).sort();

/** The page of the UI component with the ID, from the rows (the projection, LA-AUT-RM35-PJ); undefined when there is none. */
export function uiComponentPageFrom(rows: (table: string) => Row[], id: string): UiComponentPage | undefined {
  const component = rows('ui_component').find((r) => r.id === id);
  if (!component) return undefined;
  return {
    id,
    title: String(component.title),
    file: component.file === undefined ? null : String(component.file),
    description: String(component.description),
    renders: targets(rows('renders'), id, 'source_id', 'target_id'),
    meets: targets(rows('meets'), id, 'source_id', 'target_id'),
    packages: targets(rows('package_use'), id, 'record_id', 'package'),
  };
}

/** The UI components of the product, by ID: those whose ID starts with the product's. */
export function uiComponentSummariesFrom(rows: (table: string) => Row[], productId: string): UiComponentSummary[] {
  return rows('ui_component')
    .filter((c) => String(c.id).startsWith(`${productId}-`))
    .map((c) => ({ id: String(c.id), title: String(c.title) }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}
