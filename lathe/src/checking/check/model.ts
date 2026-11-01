// The Check aggregate (LA-CHK-A1): one check row, Lathe's or a product's own, named by its name. One instance is one
// check, whole. Lathe's own checks are loaded beside a product's data as read-only rows, so a product's write never
// changes or removes them, and a product's check takes a name none of them has.
import type { Row } from '../../platform/data/rows.ts';
import type { CheckRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const CHECK_AGGREGATE = 'LA-CHK-A1';

/** One check, whole. */
export interface Check {
  /** The check's name: the instance's root. */
  readonly root: string;
  check: CheckRow;
  /** Whether it is one of Lathe's own, loaded from lathe/data/check.jsonl and so read-only. */
  readonly lathes: boolean;
}

/** The tables the Check aggregate keeps its rows in. */
export const CHECK_TABLES = ['check'] as const;

/**
 * The checks in the data, each whole; only the one named, when given. `isLathes` says which rows are Lathe's own (the
 * repository knows it from where each row was loaded; the data alone does not say, so none are by default).
 */
export function checksFrom(rows: (table: string) => Row[], only?: string, isLathes: (row: Row) => boolean = () => false): Check[] {
  return (rows('check') as unknown as CheckRow[])
    .filter((c) => only === undefined || c.name === only)
    .map((check) => ({ root: check.name, check, lathes: isLathes(check as unknown as Row) }));
}

/** The instance's rows, by table. */
export function checkRows(check: Check): Map<string, Row[]> {
  return new Map<string, Row[]>([['check', [check.check as unknown as Row]]]);
}
