// The View aggregate (LA-AUT-A12): a view with its view requirements and their view tests (with the test data sets
// each starts from). A view has no owner: its product follows from its ID. One instance is one view, whole; it holds
// only the links its own records start.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { ViewRequirementRow, ViewRow, ViewTestRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const VIEW_AGGREGATE = 'LA-AUT-A12';

/** How the interfaces reach the aggregate's commands: `lathe view`, the view_ tools, /api/view/. */
export const VIEW_SLICE: Slice = { aggregate: VIEW_AGGREGATE, name: 'view' };

/**
 * The row with the changes applied: a value sets its column, null clears it, and a column left out keeps its value.
 * Only the columns named in `columns` are taken from the changes.
 */
export function changed<R extends object>(row: R, changes: object, columns: readonly string[]): R {
  const next = { ...row } as Record<string, unknown>;
  for (const [column, value] of Object.entries(changes)) {
    if (!columns.includes(column) || value === undefined) continue;
    if (value === null) delete next[column];
    else next[column] = value as Value;
  }
  return next as R;
}

/** A test with the test data sets it starts from. */
export interface Tested<T> {
  row: T;
  startsFrom: string[];
}

/** One view, whole. */
export interface View {
  /** The view's ID: the instance's root. */
  readonly root: string;
  view: ViewRow;
  requirements: ViewRequirementRow[];
  tests: Tested<ViewTestRow>[];
}

/** The tables the View aggregate keeps its rows in: its kinds and the relation its tests start. */
export const VIEW_TABLES = ['view', 'view_requirement', 'view_test', 'starts_from'] as const;

/** The kinds of the aggregate's records. */
export type ViewKind = 'view' | 'view_requirement' | 'view_test';

/** A new view, with nothing under it yet. */
export function newView(view: ViewRow): View {
  return { root: view.id, view, requirements: [], tests: [] };
}

/** The views in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function viewsFrom(rows: (table: string) => Row[], only?: string): View[] {
  const views = rows('view').filter((r) => only === undefined || r.id === only) as unknown as ViewRow[];
  if (!views.length) return [];
  const ids = new Set(views.map((v) => v.id));
  const requirements = (rows('view_requirement') as unknown as ViewRequirementRow[]).filter((r) => ids.has(r.view_id));
  const viewOf = new Map(requirements.map((r) => [r.id, r.view_id]));
  const requirementsOf = groupBy(requirements, (r) => r.view_id);
  const testsOf = groupBy((rows('view_test') as unknown as ViewTestRow[]).filter((t) => viewOf.has(t.view_requirement_id)), (t) => viewOf.get(t.view_requirement_id));
  const startsFrom = bySource(rows('starts_from'));
  return views.map((view) => ({
    root: view.id,
    view,
    requirements: groupOf(requirementsOf, view.id),
    tests: groupOf(testsOf, view.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

/** The instance's rows, by table. */
export function viewRows(view: View): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['view', [asRow(view.view)]],
    ['view_requirement', view.requirements.map(asRow)],
    ['view_test', view.tests.map((t) => asRow(t.row))],
    ['starts_from', view.tests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

/** The kind of the record with this ID inside the view, or undefined. */
export function kindInside(view: View, id: string): ViewKind | undefined {
  if (view.root === id) return 'view';
  if (view.requirements.some((r) => r.id === id)) return 'view_requirement';
  if (view.tests.some((t) => t.row.id === id)) return 'view_test';
  return undefined;
}
