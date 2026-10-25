import type { SpecIndex, SpecRecord } from './data';
import { addressOf } from '../views/address';
import type { FolderGroup } from './folders';
import { RecordTree, Section, levelBelow, recordText, type SectionLevel } from './parts';

// A folder's groups as headings on a page (the domain page, a group page): a layer's components
// under the layer's title, which links to its page, and the test plan's groups (acceptance tests by
// capability and use case, domain rule, pattern and interaction tests, engineering checks). Each
// group's records are rows whose own children fold under them, as everywhere on a wiki page.

/** Whether a record, or one of its children, matches the filter. */
const matchesNear = (index: SpecIndex, r: SpecRecord, q: string) =>
  [r, ...(index.children.get(r.id) ?? [])].some((x) => recordText(x).toLowerCase().includes(q));

/** Whether a group holds anything the filter matches (an empty filter matches every group). */
export function groupMatches(index: SpecIndex, group: FolderGroup, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (group.record && recordText(group.record).toLowerCase().includes(q)) return true;
  return group.records.some((r) => matchesNear(index, r, q)) || group.groups.some((g) => groupMatches(index, g, query));
}

export function GroupSections({ index, groups, level, query = '' }: { index: SpecIndex; groups: readonly FolderGroup[]; level: SectionLevel; query?: string }) {
  return (
    <>
      {groups.filter((g) => groupMatches(index, g, query)).map((g) => (
        <Section
          key={g.key}
          level={level}
          title={g.label}
          titleTo={g.record ? addressOf(g.record.id) : undefined}
          count={g.count}
          className="folder-group"
        >
          {g.groups.length > 0 && <GroupSections index={index} groups={g.groups} level={levelBelow(level)} query={query} />}
          {/* A layer whose own title matches shows all its components. */}
          {g.records.length > 0 && <RecordTree index={index} records={g.records} label={g.label} query={g.record && recordText(g.record).toLowerCase().includes(query.trim().toLowerCase()) ? '' : query} />}
          {g.records.length === 0 && g.groups.length === 0 && <p className="hint">None yet.</p>}
        </Section>
      ))}
    </>
  );
}
