// Stop following a pattern (LA-TRC-CMD10): Ends a domain's or use case's following of a pattern, with the setting values it gave it.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PATTERN_FOLLOWING_SLICE } from '../model.ts';
import { PatternFollowingRepository } from '../repository.ts';

/** The follower and the pattern it stops following. */
export type StopFollowingPattern = { follower_id: string; pattern_id: string };

/** Stop following a pattern (LA-TRC-CMD10). */
export const STOP_FOLLOWING_PATTERN: CommandDefinition<StopFollowingPattern> = {
  id: 'LA-TRC-CMD10',
  slice: PATTERN_FOLLOWING_SLICE,
  name: 'stop-following-pattern',
  description: "Ends a domain's or use case's following of a pattern, with the setting values it gave it.",
  method: 'POST',
  route: '/api/pattern-following/stop-following-pattern',
  input: {
    follower_id: column('setting_value', 'follower_id', 'required'),
    pattern_id: column('setting_value', 'pattern_id', 'required'),
  },
  handler: stopFollowingPattern,
};

/** Removes the following whole. */
export function stopFollowingPattern(tx: Transaction, input: StopFollowingPattern): void {
  const followings = new PatternFollowingRepository(tx);
  const following = followings.loadFollowing(input.follower_id, input.pattern_id) ?? tx.refuse('missing', `${input.follower_id} does not follow ${input.pattern_id}`);
  followings.remove(following);
}
