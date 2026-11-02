// The View aggregate (LA-IXD-A12): a view with the commands and queries it presents, its view requirements and their
// view tests (with the test data sets each starts from). A view has no owner: its product follows from its ID. One instance is one view, whole; it holds
// only the links its own records start.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { ViewRequirementRow, ViewRow, ViewTestRow } from '../../platform/data/tables.ts';

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
  /** The commands and queries it presents, sorted. */
  presents: string[];
  requirements: ViewRequirementRow[];
  tests: Tested<ViewTestRow>[];
}

/** The tables the View aggregate keeps its rows in: its kinds and the relations it and its tests start. */
export const VIEW_TABLES = ['view', 'presents', 'view_requirement', 'view_test', 'starts_from'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const VIEW_SHAPE = {
  view: { at: 'view', lists: { presents: 'presents' } },
  view_requirement: { at: 'requirements' },
  view_test: { at: 'tests', lists: { starts_from: 'startsFrom' } },
} as const satisfies AggregateShape;

/** The kinds of the aggregate's records. */
export type ViewKind = keyof typeof VIEW_SHAPE;

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
  const presents = bySource(rows('presents'));
  return views.map((view) => ({
    root: view.id,
    view,
    presents: groupOf(presents, view.id),
    requirements: groupOf(requirementsOf, view.id),
    tests: groupOf(testsOf, view.id).map((row) => ({ row, startsFrom: groupOf(startsFrom, row.id) })),
  }));
}

/** The instance's rows, by table. */
export function viewRows(view: View): Map<string, Row[]> {
  const asRow = <T extends object>(row: T) => row as unknown as Row;
  return new Map<string, Row[]>([
    ['view', [asRow(view.view)]],
    ['presents', view.presents.map((target) => ({ source_id: view.root, target_id: target }))],
    ['view_requirement', view.requirements.map(asRow)],
    ['view_test', view.tests.map((t) => asRow(t.row))],
    ['starts_from', view.tests.flatMap((t) => t.startsFrom.map((target) => ({ source_id: t.row.id, target_id: target })))],
  ]);
}

