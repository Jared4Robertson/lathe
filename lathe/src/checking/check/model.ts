// The Check aggregate (LA-CHK-A1): one check row, Lathe's or a product's own, named by its name. One instance is one
// check, whole. Lathe's own checks are loaded beside a product's data as read-only rows, so a product's write never
// changes or removes them, and a product's check takes a name none of them has.
import type { Slice } from '../../platform/commands/definition.ts';
import type { Row, Value } from '../../platform/data/rows.ts';
import type { CheckRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const CHECK_AGGREGATE = 'LA-CHK-A1';

/** How the interfaces reach the aggregate's commands: `lathe check <command>`, the check_ tools, /api/check/. */
export const CHECK_SLICE: Slice = { aggregate: CHECK_AGGREGATE, name: 'check' };

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

/** One check, whole. */
export interface Check {
  /** The check's name: the instance's root. */
  readonly root: string;
  check: CheckRow;
}

/** The tables the Check aggregate keeps its rows in. */
export const CHECK_TABLES = ['check'] as const;

/** The checks in the data, each whole; only the one named, when given. */
export function checksFrom(rows: (table: string) => Row[], only?: string): Check[] {
  return (rows('check') as unknown as CheckRow[]).filter((c) => only === undefined || c.name === only).map((check) => ({ root: check.name, check }));
}

/** The instance's rows, by table. */
export function checkRows(check: Check): Map<string, Row[]> {
  return new Map<string, Row[]>([['check', [check.check as unknown as Row]]]);
}
