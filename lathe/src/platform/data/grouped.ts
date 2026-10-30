// Rows grouped by a key, built once per read: the one way an aggregate's builder (`…From`) or a projection reaches an
// instance's rows. Filtering every row once per instance is quadratic, and on a large product it takes seconds
// (LA-PLT-UC03-R05), so a builder groups each table once and reads each instance's rows by its key.
import type { Row } from './rows.ts';

/** The rows by the key each gives, each group in the rows' order (as a filter would keep them). */
export function groupBy<T>(rows: readonly T[], key: (row: T) => unknown): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const at = String(key(row));
    const group = groups.get(at);
    if (group) group.push(row);
    else groups.set(at, [row]);
  }
  return groups;
}

/** The group under the key, or none. */
export const groupOf = <T>(groups: ReadonlyMap<string, T[]>, key: string): T[] => groups.get(key) ?? [];

/** A link table's targets by source, each list sorted. */
export function bySource(links: readonly Row[], source = 'source_id', target = 'target_id'): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const [at, group] of groupBy(links, (l) => l[source])) found.set(at, group.map((l) => String(l[target])).sort());
  return found;
}
