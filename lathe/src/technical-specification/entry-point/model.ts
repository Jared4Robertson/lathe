// The Entry point aggregate (LA-TEC-A20): a start-up file of a domain, with the packages it uses and the standard rules it meets. One instance is one
// entry point, whole: its row, the package_use rows naming it and the meets links it starts, and nothing of another aggregate.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { EntryPointRow } from '../../platform/data/tables.ts';

/** One entry point, whole. */
export interface EntryPoint {
  /** The entry point's ID: the aggregate's root. */
  readonly root: string;
  entryPoint: EntryPointRow;
  /** The packages it uses (package_use), sorted. */
  packages: string[];
  /** Its helper files (helper_file), sorted. */
  helpers: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
}

/** The tables the aggregate keeps its rows in: its kind, the package_use rows naming it, and the meets links it starts. */
export const ENTRY_POINT_TABLES = ['entry_point', 'package_use', 'helper_file', 'meets'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const ENTRY_POINT_SHAPE = {
  entry_point: { at: 'entryPoint', lists: { meets: 'meets', packages: 'packages', helpers: 'helpers' } },
} as const satisfies AggregateShape;

/** The entry points in the data, each whole; only the one given, when given. */
export function entryPointsFrom(rows: (table: string) => Row[], only?: string): EntryPoint[] {
  const found = rows('entry_point').filter((r) => only === undefined || r.id === only) as unknown as EntryPointRow[];
  if (!found.length) return [];
  const ids = new Set(found.map((r) => r.id));
  const packages = bySource(rows('package_use').filter((p) => ids.has(String(p.record_id))), 'record_id', 'package');
  const helpers = bySource(rows('helper_file').filter((p) => ids.has(String(p.record_id))), 'record_id', 'file');
  const meets = bySource(rows('meets').filter((m) => ids.has(String(m.source_id))));
  return found.map((row) => ({
    root: row.id,
    entryPoint: row,
    packages: groupOf(packages, row.id),
    helpers: groupOf(helpers, row.id),
    meets: groupOf(meets, row.id),
  }));
}

/** The instance's rows, by table: only rows it owns, so another record's packages and links stay as they are. */
export function entryPointRows(record: EntryPoint): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['entry_point', [record.entryPoint as unknown as Row]],
    ['package_use', record.packages.map((name) => ({ record_id: record.root, package: name }))],
    ['helper_file', record.helpers.map((name) => ({ record_id: record.root, file: name }))],
    ['meets', record.meets.map((target) => ({ source_id: record.root, target_id: target }))],
  ]);
}
