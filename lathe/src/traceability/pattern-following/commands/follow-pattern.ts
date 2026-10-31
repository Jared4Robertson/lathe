import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { followingOf, PATTERN_FOLLOWING_SLICE, valueRows, type SettingValueInput } from '../model.ts';
import { PatternFollowingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The follower, the pattern and the setting values it gives. */
export type FollowPattern = { follower_id: string; pattern_id: string; setting_values?: SettingValueInput[] };

export const FOLLOW_PATTERN: CommandDefinition<FollowPattern> = {
  id: 'LA-TRC-CMD01',
  slice: PATTERN_FOLLOWING_SLICE,
  name: 'follow-pattern',
  description: "Makes a domain or use case follow a pattern, with the value it gives each of the pattern's settings.",
  method: 'POST',
  route: '/api/pattern-following/follow-pattern',
  input: {
    follower_id: column('setting_value', 'follower_id', 'required'),
    pattern_id: column('setting_value', 'pattern_id', 'required'),
    setting_values: parts('setting_value', ['setting', 'value'], "Each of the pattern's settings with its value.", 'optional'),
  },
  handler: followPattern,
};

/** Adds the following, new and whole. */
export function followPattern(tx: Transaction, input: FollowPattern): void {
  const followings = new PatternFollowingRepository(tx);
  if (followings.loadFollowing(input.follower_id, input.pattern_id)) tx.refuse('exists', `${input.follower_id} already follows ${input.pattern_id}`);
  const following = followings.create({
    root: followingOf(input.follower_id, input.pattern_id),
    follower: input.follower_id,
    pattern: input.pattern_id,
    values: valueRows(input.follower_id, input.pattern_id, input.setting_values ?? []),
  });
  holdToRules(tx, following);
  followings.save(following);
}
