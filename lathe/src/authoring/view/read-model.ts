// The View read model (LA-AUT-RM32): a view as its readers see it, with its requirements, each holding its tests, and
// the views of a product in a list. Its projection builds its table from the rows; it shares no type with the
// aggregate.
import type { ReadView } from '../../platform/data/rules.ts';

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

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface ViewTable {
  /** Each view whole, by its ID, in ID order. */
  views: Map<string, ViewPage>;
  /** Each record inside a view: the view that holds it. */
  holding: Map<string, string>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

const text = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id, 'en', { numeric: true });

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function viewTableFrom(view: ReadView): ViewTable {
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const r of view.rows(kind)) kinds.set(String(r.id), kind);
  const startsFrom = view.rows('starts_from');
  const tests = view.rows('view_test');
  const requirements = view.rows('view_requirement');
  const views = new Map<string, ViewPage>();
  const holding = new Map<string, string>();
  for (const v of [...view.rows('view')].sort((a, b) => byId({ id: String(a.id) }, { id: String(b.id) }))) {
    const id = String(v.id);
    holding.set(id, id);
    const own = requirements.filter((r) => r.view_id === id);
    views.set(id, {
      id,
      title: String(v.title),
      route: text(v.route),
      description: String(v.description),
      notes: text(v.notes),
      requirements: own
        .map((r) => {
          holding.set(String(r.id), id);
          return {
            id: String(r.id),
            title: String(r.title),
            statement: String(r.statement),
            group: text(r.group_name),
            tests: tests
              .filter((t) => t.view_requirement_id === r.id)
              .map((t) => {
                holding.set(String(t.id), id);
                return { id: String(t.id), title: String(t.title), level: String(t.level), state: String(t.state), file: text(t.file), startsFrom: startsFrom.filter((l) => l.source_id === t.id).map((l) => String(l.target_id)).sort() };
              })
              .sort(byId),
          };
        })
        .sort(byId),
    });
  }
  return { views, holding, kinds };
}
