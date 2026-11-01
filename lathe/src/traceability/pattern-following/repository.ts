// Generated from data/ by `npm run generate`. Do not edit.
// PatternFollowingRepository (LA-TRC-REPO01): Loads a following whole from the transaction's draft (the follows link
// and the setting values it gives) and saves exactly the rows that changed, in the follows and setting_value tables
// only.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PATTERN_FOLLOWING_TABLES, patternFollowingRows, patternFollowingsFrom, type PatternFollowing } from './model.ts';

export class PatternFollowingRepository extends Repository<PatternFollowing> {
  constructor(tx: Transaction) {
    super(tx, 'PatternFollowingRepository', PATTERN_FOLLOWING_TABLES);
  }

  protected read(rootId: string): PatternFollowing | undefined {
    return patternFollowingsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(patternFollowing: PatternFollowing): InstanceRows {
    return patternFollowingRows(patternFollowing);
  }
}
