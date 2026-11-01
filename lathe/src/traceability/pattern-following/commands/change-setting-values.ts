import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { followingOf, valueRows, type SettingValueInput } from '../model.ts';
import { PatternFollowingRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_SETTING_VALUES_IDENTITY } from './identities.generated.ts';

/** The following and its setting values, the whole list. */
export type ChangeSettingValues = { follower_id: string; pattern_id: string; setting_values: SettingValueInput[] };

export const CHANGE_SETTING_VALUES = {
  ...CHANGE_SETTING_VALUES_IDENTITY,
  input: {
    follower_id: column('setting_value', 'follower_id', 'required'),
    pattern_id: column('setting_value', 'pattern_id', 'required'),
    setting_values: parts('setting_value', ['setting', 'value'], "Each of the pattern's settings with its value. Replaces the list.", 'required'),
  },
  handler: changeSettingValues,
} satisfies CommandDefinition<ChangeSettingValues>;

/** Replaces the following's setting values. */
export function changeSettingValues(tx: Transaction, input: ChangeSettingValues): void {
  const followings = new PatternFollowingRepository(tx);
  const following = followings.load(followingOf(input.follower_id, input.pattern_id)) ?? tx.refuse('missing', `${input.follower_id} does not follow ${input.pattern_id}`);
  following.values = valueRows(input.follower_id, input.pattern_id, input.setting_values);
  holdToRules(tx, following);
  followings.save(following);
}
