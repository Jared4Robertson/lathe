// The Pattern following read model (LA-TRC-RM10), shaped for its readers: a following whole (the value its follower
// gives each setting of its pattern), the patterns a domain or use case follows, and a
// pattern's followers by domain, as the Pattern page's Followed by reads them (whether the domain itself follows it,
// and each of its use cases that does, each with its setting values). The projection (followingTableFrom) is the only
// code that reads the source rows and the only code that writes the read model's table; the query handlers read that
// table only through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { CapabilityRow, SettingValueRow, UseCaseRow } from '../../platform/data/tables.ts';
import { compareIds } from '../../platform/data/ids.ts';
import { domainOrder } from '../../platform/data/domain-order.ts';

/** The value a follower gives one setting. */
export interface SettingLine {
  setting: string;
  value: string;
}

/** One following, whole: its follower, its pattern and the value it gives each setting, by setting name. */
export interface FollowingPage {
  follower: string;
  pattern: string;
  settings: SettingLine[];
}

/** A domain that follows a pattern: its own following, when it follows the pattern itself, and its use cases' that do. */
export interface FollowingDomain {
  domain: string;
  /** The domain's own following, or null when only its use cases follow the pattern. */
  itself: FollowingPage | null;
  /** Each of its use cases that follows the pattern, by ID. */
  useCases: FollowingPage[];
}

/** A pattern's followers, by domain in position order. */
export interface PatternFollowers {
  pattern: string;
  domains: FollowingDomain[];
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface FollowingTable {
  /** Each following whole, by follower, then by pattern. */
  followings: Map<string, Map<string, FollowingPage>>;
  /** Every domain's and use case's ID: who may follow a pattern. */
  followers: Set<string>;
  /** Each pattern's followers by domain, in position order; a pattern nobody follows has an empty list. */
  patterns: Map<string, FollowingDomain[]>;
}

/** Rows by the values of their columns, each list in the table's order. */
function grouped<T>(rows: Row[], ...columns: string[]): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const r of rows) {
    const key = columns.map((c) => String(r[c])).join(' ');
    found.set(key, [...(found.get(key) ?? []), r as unknown as T]);
  }
  return found;
}

const lineOf = (v: SettingValueRow): SettingLine => ({ setting: v.setting, value: v.value });

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function followingTableFrom(view: ReadView): FollowingTable {
  const values = grouped<SettingValueRow>(view.rows('setting_value'), 'follower_id', 'pattern_id');
  const capabilityDomain = new Map((view.rows('capability') as unknown as CapabilityRow[]).map((c) => [c.id, c.domain_id]));
  // The domain each follower sits in: a domain is its own, a use case its capability's.
  const domainOf = new Map<string, string>(view.rows('domain').map((d) => [String(d.id), String(d.id)]));
  const domainRank = domainOrder(view.rows('domain'));
  const domains = new Set(domainOf.keys());
  const followers = new Set(domains);
  for (const uc of view.rows('use_case') as unknown as UseCaseRow[]) {
    followers.add(uc.id);
    const domain = capabilityDomain.get(uc.capability_id);
    if (domain) domainOf.set(uc.id, domain);
  }
  const followings = new Map<string, Map<string, FollowingPage>>();
  const patterns = new Map<string, Map<string, FollowingDomain>>(view.rows('pattern').map((p) => [String(p.id), new Map()]));
  for (const l of view.rows('follows')) {
    const [follower, pattern] = [String(l.source_id), String(l.target_id)];
    const settings = (values.get(`${follower} ${pattern}`) ?? []).map(lineOf).sort((a, b) => a.setting.localeCompare(b.setting));
    const page: FollowingPage = { follower, pattern, settings };
    if (!followings.has(follower)) followings.set(follower, new Map());
    followings.get(follower)!.set(pattern, page);
    const domain = domainOf.get(follower);
    const byDomain = patterns.get(pattern);
    if (!domain || !byDomain) continue;
    const entry = byDomain.get(domain) ?? { domain, itself: null, useCases: [] };
    if (domains.has(follower)) entry.itself = page;
    else entry.useCases.push(page);
    byDomain.set(domain, entry);
  }
  return {
    followings,
    followers,
    patterns: new Map(
      [...patterns].map(([pattern, byDomain]) => [
        pattern,
        [...byDomain.values()].sort((a, b) => domainRank.get(a.domain)! - domainRank.get(b.domain)!).map((d) => ({ ...d, useCases: d.useCases.sort((a, b) => compareIds(a.follower, b.follower)) })),
      ]),
    ),
  };
}
