import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { followingOf, valueRows, type SettingValueInput } from '../model.ts';
import { PatternFollowingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { FOLLOW_PATTERN_IDENTITY } from './identities.generated.ts';

/** The follower, the pattern and the setting values it gives. */
export type FollowPattern = { follower_id: string; pattern_id: string; setting_values?: SettingValueInput[] };

export const FOLLOW_PATTERN = {
  ...FOLLOW_PATTERN_IDENTITY,
  input: {
    follower_id: column('setting_value', 'follower_id', 'required'),
    pattern_id: column('setting_value', 'pattern_id', 'required'),
    setting_values: parts('setting_value', ['setting', 'value'], "Each of the pattern's settings with its value.", 'optional'),
  },
  handler: followPattern,
} satisfies CommandDefinition<FollowPattern>;

/** Adds the following, new and whole. */
export function followPattern(tx: Transaction, input: FollowPattern): void {
  const followings = new PatternFollowingRepository(tx);
  if (followings.load(followingOf(input.follower_id, input.pattern_id))) tx.refuse('exists', `${input.follower_id} already follows ${input.pattern_id}`);
  const following = followings.create({
    root: followingOf(input.follower_id, input.pattern_id),
    follows: { source_id: input.follower_id, target_id: input.pattern_id },
    values: valueRows(input.follower_id, input.pattern_id, input.setting_values ?? []),
  });
  holdToRules(tx, following);
  followings.save(following);
}
