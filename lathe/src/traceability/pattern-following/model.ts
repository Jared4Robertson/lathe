// The Pattern following aggregate (LA-TRC-A3): a domain or use case that follows one pattern (a follows link), with
// the value it gives each of the pattern's settings. One instance is one following, whole, named by its follower and
// its pattern.
import { groupBy, groupOf } from '../../platform/data/grouped.ts';
import type { AggregateShape } from '../../platform/data/repository.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FollowsRow, SettingValueRow } from '../../platform/data/tables.ts';

/** The aggregate's record ID in Lathe's own spec. */
export const PATTERN_FOLLOWING_AGGREGATE = 'LA-TRC-A3';

/** A setting value as a command gives it: its follower and pattern come from the following. */
export type SettingValueInput = Omit<SettingValueRow, 'follower_id' | 'pattern_id'>;

/** One following, whole. */
export interface PatternFollowing {
  /** The follower and the pattern, as "<follower> follows <pattern>": the instance's root. */
  readonly root: string;
  /** The follows link: its source is the domain or use case that follows the pattern, its target the pattern. */
  follows: FollowsRow;
  /** The value it gives each setting of the pattern, by setting name. */
  values: SettingValueRow[];
}

/** The tables the Pattern following aggregate keeps its rows in: the link and its part. */
export const PATTERN_FOLLOWING_TABLES = ['follows', 'setting_value'] as const;

/** How the aggregate's kinds sit in an instance: the follows link, and the setting values its commands give whole. */
export const PATTERN_FOLLOWING_SHAPE = {
  follows: { at: 'follows', given: { setting_values: 'values' } },
} as const satisfies AggregateShape;

/** The root of the following of the pattern by the follower. */
export const followingOf = (follower: string, pattern: string): string => `${follower} follows ${pattern}`;

/** The setting values as rows of the following, sorted by setting. */
export function valueRows(follower: string, pattern: string, values: SettingValueInput[]): SettingValueRow[] {
  return values.map((v) => ({ follower_id: follower, pattern_id: pattern, ...v })).sort((a, b) => a.setting.localeCompare(b.setting));
}

/** The followings in the data, each whole; only the one whose root is given, when given. */
export function patternFollowingsFrom(rows: (table: string) => Row[], only?: string): PatternFollowing[] {
  const valuesOf = groupBy(rows('setting_value') as unknown as SettingValueRow[], (v) => followingOf(v.follower_id, v.pattern_id));
  return (rows('follows') as unknown as FollowsRow[])
    .map((l) => ({ root: followingOf(l.source_id, l.target_id), follows: { source_id: l.source_id, target_id: l.target_id } }))
    .filter((f) => only === undefined || f.root === only)
    .map((f) => ({ ...f, values: [...groupOf(valuesOf, f.root)].sort((a, b) => a.setting.localeCompare(b.setting)) }));
}

/** The instance's rows, by table. */
export function patternFollowingRows(following: PatternFollowing): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['follows', [following.follows as unknown as Row]],
    ['setting_value', following.values as unknown as Row[]],
  ]);
}
