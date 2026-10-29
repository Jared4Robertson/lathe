// PatternFollowingRepository (LA-TRC-REPO01): loads and saves the Pattern following aggregate whole (the follows link
// and its setting values) in its own tables only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { followingOf, followingRows, followingsFrom, PATTERN_FOLLOWING_TABLES, type PatternFollowing } from './model.ts';

export class PatternFollowingRepository extends AggregateRepository<PatternFollowing> {
  constructor(tx: Transaction) {
    super(tx, 'PatternFollowingRepository', PATTERN_FOLLOWING_TABLES);
  }

  protected read(root: string): PatternFollowing | undefined {
    return followingsFrom((table) => this.files.rows(table), root)[0];
  }

  protected rowsOf(following: PatternFollowing): InstanceRows {
    return followingRows(following);
  }

  /** Loads the following of the pattern by the follower, or undefined when it does not follow it. */
  loadFollowing(follower: string, pattern: string): PatternFollowing | undefined {
    return this.load(followingOf(follower, pattern));
  }
}
