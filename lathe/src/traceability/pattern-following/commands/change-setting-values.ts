// Change the setting values (LA-TRC-CMD02): Gives a followed pattern's settings their values, or the reasons they do not apply: the list replaces the follower's values for that pattern.
import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { PATTERN_FOLLOWING_SLICE, valueRows, type SettingValueInput } from '../model.ts';
import { PatternFollowingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The following and its setting values, the whole list. */
export type ChangeSettingValues = { follower_id: string; pattern_id: string; setting_values: SettingValueInput[] };

/** Change the setting values (LA-TRC-CMD02). */
export const CHANGE_SETTING_VALUES: CommandDefinition<ChangeSettingValues> = {
  id: 'LA-TRC-CMD02',
  slice: PATTERN_FOLLOWING_SLICE,
  name: 'change-setting-values',
  description: "Gives a followed pattern's settings their values, or the reasons they do not apply: the list replaces the follower's values for that pattern.",
  method: 'POST',
  route: '/api/pattern-following/change-setting-values',
  input: {
    follower_id: column('setting_value', 'follower_id', 'required'),
    pattern_id: column('setting_value', 'pattern_id', 'required'),
    setting_values: parts('setting_value', ['setting', 'value', 'not_applicable'], "Each of the pattern's settings with its value, or the reason it does not apply (not_applicable). Replaces the list.", 'required'),
  },
  handler: changeSettingValues,
};

/** Replaces the following's setting values. */
export function changeSettingValues(tx: Transaction, input: ChangeSettingValues): void {
  const followings = new PatternFollowingRepository(tx);
  const following = followings.loadFollowing(input.follower_id, input.pattern_id) ?? tx.refuse('missing', `${input.follower_id} does not follow ${input.pattern_id}`);
  following.values = valueRows(input.follower_id, input.pattern_id, input.setting_values);
  holdToRules(tx, following);
  followings.save(following);
}
