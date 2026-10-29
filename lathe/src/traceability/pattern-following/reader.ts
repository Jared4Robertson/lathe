// The Pattern following read model's reader (LA-TRC-RM10-RD): the one way the Pattern following queries reach the
// read model's storage. The query handlers depend only on the FollowingReader interface; the query runner injects the
// reader each query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this
// interface and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { followingTableFrom, type FollowingPage, type FollowingTable } from './read-model.ts';

/** What the Pattern following queries read, and all they read. */
export interface FollowingReader {
  /** The following of the pattern by the follower, or undefined when it does not follow it. */
  following(follower: string, pattern: string): FollowingPage | undefined;
  /** The patterns the domain or use case follows, by ID; undefined when there is no such domain or use case. */
  patternsOf(follower: string): string[] | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryFollowingReader implements FollowingReader {
  private readonly table: FollowingTable;

  constructor(table: FollowingTable) {
    this.table = table;
  }

  following(follower: string, pattern: string): FollowingPage | undefined {
    return this.table.followings.get(follower)?.get(pattern);
  }

  patternsOf(follower: string): string[] | undefined {
    if (!this.table.followers.has(follower)) return undefined;
    return [...(this.table.followings.get(follower)?.keys() ?? [])].sort();
  }
}

/** The reader the query runner gives each Pattern following query: today's, over the projection's table built from the data. */
export const followingReader = (view: ReadView): FollowingReader => new InMemoryFollowingReader(followingTableFrom(view));
