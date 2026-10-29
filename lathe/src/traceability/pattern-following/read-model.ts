// The Pattern following read model (LA-TRC-RM10): a following as its readers see it, with the value it gives each
// setting, and the patterns a domain or use case follows. Its projection builds its table from the rows; it shares no
// type with the aggregate.
import type { ReadView } from '../../platform/data/rules.ts';

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

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface FollowingTable {
  /** Each following whole, by follower, then by pattern. */
  followings: Map<string, Map<string, FollowingPage>>;
  /** Every domain's and use case's ID: who may follow a pattern. */
  followers: Set<string>;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function followingTableFrom(view: ReadView): FollowingTable {
  const followings = new Map<string, Map<string, FollowingPage>>();
  for (const l of view.rows('follows')) {
    const [follower, pattern] = [String(l.source_id), String(l.target_id)];
    if (!followings.has(follower)) followings.set(follower, new Map());
    followings.get(follower)!.set(pattern, { follower, pattern, settings: [] });
  }
  for (const v of view.rows('setting_value')) {
    followings.get(String(v.follower_id))?.get(String(v.pattern_id))?.settings.push({ setting: String(v.setting), value: v.value === undefined ? null : String(v.value), notApplicable: v.not_applicable === undefined ? null : String(v.not_applicable) });
  }
  for (const byPattern of followings.values()) for (const page of byPattern.values()) page.settings.sort((a, b) => a.setting.localeCompare(b.setting));
  return { followings, followers: new Set([...view.rows('domain'), ...view.rows('use_case')].map((r) => String(r.id))) };
}
