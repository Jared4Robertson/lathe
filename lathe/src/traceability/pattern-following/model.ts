// The Pattern following aggregate (LA-TRC-A3): a domain or use case that follows one pattern (a follows link), with
// the value it gives each of the pattern's settings. One instance is one following, whole, named by its follower and
// its pattern.
import type { Slice } from '../../platform/commands/definition.ts';
import { groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { SettingValueRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const PATTERN_FOLLOWING_AGGREGATE = 'LA-TRC-A3';

/** How the interfaces reach the aggregate's commands: `lathe pattern-following`, the pattern_following_ tools, /api/pattern-following/. */
export const PATTERN_FOLLOWING_SLICE: Slice = { aggregate: PATTERN_FOLLOWING_AGGREGATE, name: 'pattern-following' };

/** A setting value as a command gives it: its follower and pattern come from the following. */
export type SettingValueInput = Omit<SettingValueRow, 'follower_id' | 'pattern_id'>;

/** One following, whole. */
export interface PatternFollowing {
  /** The follower and the pattern, as "<follower> follows <pattern>": the instance's root. */
  readonly root: string;
  /** The domain or use case that follows the pattern. */
  follower: string;
  pattern: string;
  /** The value it gives each setting of the pattern, by setting name. */
  values: SettingValueRow[];
}

/** The tables the Pattern following aggregate keeps its rows in: the link and its part. */
export const PATTERN_FOLLOWING_TABLES = ['follows', 'setting_value'] as const;

/** The root of the following of the pattern by the follower. */
export const followingOf = (follower: string, pattern: string): string => `${follower} follows ${pattern}`;

/** The setting values as rows of the following, sorted by setting. */
export function valueRows(follower: string, pattern: string, values: SettingValueInput[]): SettingValueRow[] {
  return values.map((v) => ({ follower_id: follower, pattern_id: pattern, ...v })).sort((a, b) => a.setting.localeCompare(b.setting));
}

/** The followings in the data, each whole; only the one whose root is given, when given. */
export function followingsFrom(rows: (table: string) => Row[], only?: string): PatternFollowing[] {
  const valuesOf = groupBy(rows('setting_value') as unknown as SettingValueRow[], (v) => followingOf(v.follower_id, v.pattern_id));
  return rows('follows')
    .map((l) => ({ follower: String(l.source_id), pattern: String(l.target_id) }))
    .filter((f) => only === undefined || followingOf(f.follower, f.pattern) === only)
    .map((f) => ({
      root: followingOf(f.follower, f.pattern),
      ...f,
      values: [...groupOf(valuesOf, followingOf(f.follower, f.pattern))].sort((a, b) => a.setting.localeCompare(b.setting)),
    }));
}

/** The instance's rows, by table. */
export function followingRows(following: PatternFollowing): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['follows', [{ source_id: following.follower, target_id: following.pattern }]],
    ['setting_value', following.values as unknown as Row[]],
  ]);
}
