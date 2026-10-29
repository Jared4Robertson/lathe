// The Pattern following read model (LA-TRC-RM10): a following as its readers see it, with the value it gives each
// setting, and the patterns a domain or use case follows. Its projection builds them from the rows; it shares no type
// with the aggregate.
import type { Row } from '../../platform/data/rows.ts';

/** The value a follower gives one setting, or why it does not apply. */
export interface SettingLine {
  setting: string;
  value: string | null;
  notApplicable: string | null;
}

/** One following, whole. */
export interface FollowingPage {
  follower: string;
  pattern: string;
  settings: SettingLine[];
}

/** The following of the pattern by the follower, from the rows (the projection, LA-TRC-RM10-PJ); undefined when it does not follow it. */
export function followingPageFrom(rows: (table: string) => Row[], follower: string, pattern: string): FollowingPage | undefined {
  if (!rows('follows').some((l) => l.source_id === follower && l.target_id === pattern)) return undefined;
  return {
    follower,
    pattern,
    settings: rows('setting_value')
      .filter((v) => v.follower_id === follower && v.pattern_id === pattern)
      .map((v) => ({ setting: String(v.setting), value: v.value === undefined ? null : String(v.value), notApplicable: v.not_applicable === undefined ? null : String(v.not_applicable) }))
      .sort((a, b) => a.setting.localeCompare(b.setting)),
  };
}

/** The patterns the follower follows, by ID. */
export function followedPatternsFrom(rows: (table: string) => Row[], follower: string): string[] {
  return rows('follows')
    .filter((l) => l.source_id === follower)
    .map((l) => String(l.target_id))
    .sort();
}
