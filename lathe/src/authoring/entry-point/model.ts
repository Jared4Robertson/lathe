// The Entry point aggregate (LA-AUT-A20): a start-up file of a domain, with the packages it uses and the standard rules it meets. One instance is one
// entry point, whole: its row, the package_use rows naming it and the meets links it starts, and nothing of another aggregate.
import type { Slice } from '../../platform/commands/definition.ts';
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { EntryPointRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const ENTRY_POINT_AGGREGATE = 'LA-AUT-A20';

/** How the interfaces reach the aggregate's commands: `lathe entry-point`, the entry_point_ tools, /api/entry-point/. */
export const ENTRY_POINT_SLICE: Slice = { aggregate: ENTRY_POINT_AGGREGATE, name: 'entry-point' };

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

/** One entry point, whole. */
export interface EntryPoint {
  /** The entry point's ID: the aggregate's root. */
  readonly root: string;
  entryPoint: EntryPointRow;
  /** The packages it uses (package_use), sorted. */
  packages: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
}

/** The tables the aggregate keeps its rows in: its kind, the package_use rows naming it, and the meets links it starts. */
export const ENTRY_POINT_TABLES = ['entry_point', 'package_use', 'meets'] as const;

/** The entry points in the data, each whole; only the one given, when given. */
export function entryPointsFrom(rows: (table: string) => Row[], only?: string): EntryPoint[] {
  const found = rows('entry_point').filter((r) => only === undefined || r.id === only) as unknown as EntryPointRow[];
  if (!found.length) return [];
  const ids = new Set(found.map((r) => r.id));
  const packages = bySource(rows('package_use').filter((p) => ids.has(String(p.record_id))), 'record_id', 'package');
  const meets = bySource(rows('meets').filter((m) => ids.has(String(m.source_id))));
  return found.map((row) => ({
    root: row.id,
    entryPoint: row,
    packages: groupOf(packages, row.id),
    meets: groupOf(meets, row.id),
  }));
}

/** The instance's rows, by table: only rows it owns, so another record's packages and links stay as they are. */
export function entryPointRows(record: EntryPoint): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['entry_point', [record.entryPoint as unknown as Row]],
    ['package_use', record.packages.map((name) => ({ record_id: record.root, package: name }))],
    ['meets', record.meets.map((target) => ({ source_id: record.root, target_id: target }))],
  ]);
}
