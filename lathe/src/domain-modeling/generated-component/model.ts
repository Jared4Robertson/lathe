// The Generated component aggregate (LA-MOD-A25): a unit of code the product's generator emits into code outside the repo, with the business outcomes it serves. It is the maker of the
// guarantees it makes to the outside consumers they name; the guarantees are the Guarantee aggregate's. One instance is
// one generated component, whole: its row and the serves links it starts, and nothing of another aggregate.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { GeneratedComponentRow } from '../../platform/data/tables.ts';

/** One generated component, whole. */
export interface GeneratedComponent {
  /** The generated component's ID: the aggregate's root. */
  readonly root: string;
  generatedComponent: GeneratedComponentRow;
  /** The business outcomes it serves, sorted. */
  serves: string[];
}

/** The tables the aggregate keeps its rows in: its kind and the links it starts. */
export const GENERATED_COMPONENT_TABLES = ['generated_component', 'serves'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const GENERATED_COMPONENT_SHAPE = {
  generated_component: { at: 'generatedComponent', lists: { serves: 'serves' } },
} as const satisfies AggregateShape;

/** The generated components in the data, each whole; only the one given, when given. */
export function generatedComponentsFrom(rows: (table: string) => Row[], only?: string): GeneratedComponent[] {
  const found = rows('generated_component').filter((r) => only === undefined || r.id === only) as unknown as GeneratedComponentRow[];
  if (!found.length) return [];
  const ids = new Set(found.map((r) => r.id));
  const serves = bySource(rows('serves').filter((s) => ids.has(String(s.source_id))));
  return found.map((row) => ({ root: row.id, generatedComponent: row, serves: groupOf(serves, row.id) }));
}

/** The instance's rows, by table: only rows it owns, so another record's links stay as they are. */
export function generatedComponentRows(record: GeneratedComponent): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['generated_component', [record.generatedComponent as unknown as Row]],
    ['serves', record.serves.map((target) => ({ source_id: record.root, target_id: target }))],
  ]);
}
