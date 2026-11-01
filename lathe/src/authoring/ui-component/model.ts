// The UI component aggregate (LA-AUT-A15): a UI component with the views it renders, the view requirements it builds,
// the standard rules it meets and the packages it uses. A UI component has no owner: its product follows from its ID. One instance is one UI
// component, whole; it holds only the links it starts.
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { UiComponentRow } from '../../platform/data/tables.ts';

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

/** One UI component, whole. */
export interface UiComponent {
  /** The UI component's ID: the instance's root. */
  readonly root: string;
  component: UiComponentRow;
  /** The views it renders, or part of. */
  renders: string[];
  /** The view requirements its code builds. */
  builds: string[];
  /** The standard rules it meets. */
  meets: string[];
  /** The packages it uses. */
  packages: string[];
}

/** The tables the UI component aggregate keeps its rows in: its kind and the relations it starts. */
export const UI_COMPONENT_TABLES = ['ui_component', 'renders', 'builds', 'meets', 'package_use'] as const;

/** The UI components in the data, each whole, built from the aggregate's tables; only the one given, when given. */
export function uiComponentsFrom(rows: (table: string) => Row[], only?: string): UiComponent[] {
  const components = rows('ui_component').filter((r) => only === undefined || r.id === only) as unknown as UiComponentRow[];
  if (!components.length) return [];
  const renders = bySource(rows('renders'), 'source_id', 'target_id');
  const builds = bySource(rows('builds'), 'source_id', 'target_id');
  const meets = bySource(rows('meets'), 'source_id', 'target_id');
  const packages = bySource(rows('package_use'), 'record_id', 'package');
  return components.map((component) => ({
    root: component.id,
    component,
    renders: groupOf(renders, component.id),
    builds: groupOf(builds, component.id),
    meets: groupOf(meets, component.id),
    packages: groupOf(packages, component.id),
  }));
}

/** The instance's rows, by table. */
export function uiComponentRows(component: UiComponent): Map<string, Row[]> {
  const links = (targets: string[]) => targets.map((target) => ({ source_id: component.root, target_id: target }));
  return new Map<string, Row[]>([
    ['ui_component', [component.component as unknown as Row]],
    ['renders', links(component.renders)],
    ['builds', links(component.builds)],
    ['meets', links(component.meets)],
    ['package_use', component.packages.map((p) => ({ record_id: component.root, package: p }))],
  ]);
}
