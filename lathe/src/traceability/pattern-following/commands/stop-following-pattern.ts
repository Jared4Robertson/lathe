import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PatternFollowingRepository } from '../repository.ts';
import { STOP_FOLLOWING_PATTERN_IDENTITY } from './identities.generated.ts';

/** The follower and the pattern it stops following. */
export type StopFollowingPattern = { follower_id: string; pattern_id: string };

export const STOP_FOLLOWING_PATTERN = {
  ...STOP_FOLLOWING_PATTERN_IDENTITY,
  input: {
    follower_id: column('setting_value', 'follower_id', 'required'),
    pattern_id: column('setting_value', 'pattern_id', 'required'),
  },
  handler: stopFollowingPattern,
} satisfies CommandDefinition<StopFollowingPattern>;

/** Removes the following whole. */
export function stopFollowingPattern(tx: Transaction, input: StopFollowingPattern): void {
  const followings = new PatternFollowingRepository(tx);
  const following = followings.loadFollowing(input.follower_id, input.pattern_id) ?? tx.refuse('missing', `${input.follower_id} does not follow ${input.pattern_id}`);
  followings.remove(following);
}
