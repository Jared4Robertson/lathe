// The View read model (LA-AUT-RM32): a view as its readers see it, with its requirements, each holding its tests, and
// the views of a product in a list. Its projection builds them from the rows; it shares no type with the aggregate.
import type { Row } from '../../platform/data/rows.ts';

/** A view test, as a reader sees it. */
export interface ViewTestLine {
  id: string;
  title: string;
  level: string;
  state: string;
  file: string | null;
  /** The test data sets it starts from. */
  startsFrom: string[];
}

/** A view requirement with its tests. */
export interface ViewRequirementLine {
  id: string;
  title: string;
  statement: string;
  group: string | null;
  tests: ViewTestLine[];
}

/** One view, whole. */
export interface ViewPage {
  id: string;
  title: string;
  route: string | null;
  description: string;
  notes: string | null;
  requirements: ViewRequirementLine[];
}

/** A view in a list. */
export interface ViewSummary {
  id: string;
  title: string;
}

const text = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, undefined, { numeric: true });

/** The page of the view with the ID, from the rows (the projection, LA-AUT-RM32-PJ); undefined when there is none. */
export function viewPageFrom(rows: (table: string) => Row[], id: string): ViewPage | undefined {
  const view = rows('view').find((r) => r.id === id);
  if (!view) return undefined;
  const startsFrom = rows('starts_from');
  const tests = rows('view_test');
  return {
    id,
    title: String(view.title),
    route: text(view.route),
    description: String(view.description),
    notes: text(view.notes),
    requirements: rows('view_requirement')
      .filter((r) => r.view_id === id)
      .map((r) => ({
        id: String(r.id),
        title: String(r.title),
        statement: String(r.statement),
        group: text(r.group_name),
        tests: tests
          .filter((t) => t.view_requirement_id === r.id)
          .map((t) => ({ id: String(t.id), title: String(t.title), level: String(t.level), state: String(t.state), file: text(t.file), startsFrom: startsFrom.filter((l) => l.source_id === t.id).map((l) => String(l.target_id)).sort() }))
          .sort(byId),
      }))
      .sort(byId),
  };
}

/** The views of the product, by ID: those whose ID starts with the product's. */
export function viewSummariesFrom(rows: (table: string) => Row[], productId: string): ViewSummary[] {
  return rows('view')
    .filter((v) => String(v.id).startsWith(`${productId}-`))
    .map((v) => ({ id: String(v.id), title: String(v.title) }))
    .sort(byId);
}
