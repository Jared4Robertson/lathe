// The Tooling aggregate (LA-AUT-A21): a dev script or config file of a domain, with the packages it uses, the standard rules it meets and the technical records it
// generates. One instance is one tooling record, whole: its row, the package_use rows naming it and the meets and
// generates links it starts, and nothing of another aggregate.
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { ToolingRow } from '../../platform/data/tables.ts';

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

/** One tooling record, whole. */
export interface Tooling {
  /** The tooling record's ID: the aggregate's root. */
  readonly root: string;
  tooling: ToolingRow;
  /** The packages it uses (package_use), sorted. */
  packages: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
  /** The technical records it generates, sorted: derived, never written by hand. */
  generates: string[];
}

/** The tables the aggregate keeps its rows in: its kind, the package_use rows naming it, and the links it starts. */
export const TOOLING_TABLES = ['tooling', 'package_use', 'meets', 'generates'] as const;

/** The tooling records in the data, each whole; only the one given, when given. */
export function toolingsFrom(rows: (table: string) => Row[], only?: string): Tooling[] {
  const found = rows('tooling').filter((r) => only === undefined || r.id === only) as unknown as ToolingRow[];
  if (!found.length) return [];
  const ids = new Set(found.map((r) => r.id));
  const packages = bySource(rows('package_use').filter((p) => ids.has(String(p.record_id))), 'record_id', 'package');
  const meets = bySource(rows('meets').filter((m) => ids.has(String(m.source_id))));
  const generates = bySource(rows('generates').filter((g) => ids.has(String(g.source_id))));
  return found.map((row) => ({
    root: row.id,
    tooling: row,
    packages: groupOf(packages, row.id),
    meets: groupOf(meets, row.id),
    generates: groupOf(generates, row.id),
  }));
}

/** The instance's rows, by table: only rows it owns, so another record's packages and links stay as they are. */
export function toolingRows(record: Tooling): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['tooling', [record.tooling as unknown as Row]],
    ['package_use', record.packages.map((name) => ({ record_id: record.root, package: name }))],
    ['meets', record.meets.map((target) => ({ source_id: record.root, target_id: target }))],
    ['generates', record.generates.map((target) => ({ source_id: record.root, target_id: target }))],
  ]);
}
