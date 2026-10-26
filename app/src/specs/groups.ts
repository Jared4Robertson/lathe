import type { SpecRecord } from './data';

// Groups (FORMAT.md section 23): a requirement, interaction requirement, pattern rule or standard rule may name a
// short heading in `group`, such as Validation or Paging. The wiki shows the ungrouped records first,
// without a heading, then each group under its heading in the order the groups first appear. Groups
// are compared trimmed and in any letter case, and headed as first written. Pure logic, tested directly.

export interface RecordGroup {
  /** The group compared: trimmed and lower case; empty for the ungrouped records. */
  key: string;
  /** The heading as first written, or null for the ungrouped records. */
  heading: string | null;
  records: SpecRecord[];
}

/** Records sorted into their groups: the ungrouped first (when there are any), then each group in the order it first appears. */
export function groupRecords<T extends SpecRecord>(records: readonly T[]): (RecordGroup & { records: T[] })[] {
  const groups = new Map<string, RecordGroup & { records: T[] }>();
  const ungrouped: T[] = [];
  for (const r of records) {
    const heading = r.fields.group?.trim() ?? '';
    if (heading === '') { ungrouped.push(r); continue; }
    const key = heading.toLowerCase();
    const group = groups.get(key) ?? { key, heading, records: [] };
    group.records.push(r);
    groups.set(key, group);
  }
  return [...(ungrouped.length > 0 ? [{ key: '', heading: null, records: ungrouped }] : []), ...groups.values()];
}
