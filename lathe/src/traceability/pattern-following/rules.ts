// The Pattern following aggregate's rules, written once: each command's handler runs them on the following before it
// saves it, and every load and commit runs them over all data (patternFollowingRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { SettingValueRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { PATTERN_FOLLOWING_AGGREGATE, followingOf, patternFollowingsFrom, type PatternFollowing } from './model.ts';

const given = (text: string | null | undefined) => text !== null && text !== undefined;

const problem = ({ rule }: { rule: string }, value: SettingValueRow, message: string): RuleProblem => ({ rule, table: 'setting_value', row: value as unknown as Row, message });

/** Every setting value that breaks LA-TRC-INV01: it gives a value, and the value is not blank. */
function valueGiven(values: readonly SettingValueRow[]): RuleProblem[] {
  return values.flatMap((v) =>
    given(v.value) && String(v.value).trim()
      ? []
      : [problem({ rule: 'setting-value-given' }, v, `${v.follower_id} gives setting ${v.setting} of ${v.pattern_id} no value; give it one`)],
  );
}

/**
 * Every setting value that breaks LA-TRC-INV03: it names a setting its pattern has, for a pattern its follower
 * follows. Read over the setting values given, whatever following they belong to, against the view's settings and
 * the followings given, by root.
 */
function ofFollowedSetting(values: readonly SettingValueRow[], view: ReadView, follows: ReadonlySet<string>): RuleProblem[] {
  const settings = new Set(view.rows('pattern_setting').map((s) => `${String(s.pattern_id)} ${String(s.name)}`));
  return values.flatMap((v) => {
    if (!settings.has(`${v.pattern_id} ${v.setting}`)) {
      return [problem({ rule: 'setting-value-of-followed-setting' }, v, `${v.pattern_id} has no setting ${v.setting}, so ${v.follower_id} cannot give it a value`)];
    }
    if (!follows.has(followingOf(v.follower_id, v.pattern_id))) {
      return [problem({ rule: 'setting-value-of-followed-setting' }, v, `${v.follower_id} does not follow ${v.pattern_id}, so it cannot give its setting ${v.setting} a value`)];
    }
    return [];
  });
}

/**
 * Every rule the following breaks (LA-TRC-INV01 a value; LA-TRC-INV02 each followed pattern's settings
 * take their own values: every value names the following's own follower and pattern, one per setting; LA-TRC-INV03 a
 * value answers a setting of the pattern its follower follows). The view gives the pattern's settings and the follows
 * links.
 */
export function patternFollowingProblems(following: PatternFollowing, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const seen = new Set<string>();
  const { source_id: follower, target_id: pattern } = following.follows;
  for (const v of following.values) {
    if (v.follower_id !== follower || v.pattern_id !== pattern) {
      problems.push(problem({ rule: 'setting-value-own-pattern' }, v, `the value ${v.follower_id} gives setting ${v.setting} of ${v.pattern_id} cannot answer ${pattern} for ${follower}: each followed pattern's settings take their own values`));
    } else if (seen.has(v.setting)) {
      problems.push(problem({ rule: 'setting-value-own-pattern' }, v, `${follower} gives setting ${v.setting} of ${pattern} a second value: a setting takes one value from each follower`));
    }
    seen.add(v.setting);
  }
  problems.push(...valueGiven(following.values));
  // A following's values are checked against the following itself: it is being saved, so it is followed.
  problems.push(...ofFollowedSetting(following.values, view, new Set([following.root])));
  return problems;
}

/**
 * The rules over all data: every following, whole, and every setting value read directly, since a value whose
 * following is gone belongs to no instance.
 */
export const patternFollowingRules: AggregateRules = {
  aggregate: PATTERN_FOLLOWING_AGGREGATE,
  check: (view) => {
    const values = view.rows('setting_value') as unknown as SettingValueRow[];
    return [
      ...patternFollowingsFrom((table) => view.rows(table)).flatMap((following) =>
        patternFollowingProblems(following, view).filter((p) => p.rule === 'setting-value-own-pattern'),
      ),
      ...valueGiven(values),
      ...ofFollowedSetting(values, view, new Set(view.rows('follows').map((l) => followingOf(String(l.source_id), String(l.target_id))))),
    ];
  },
};

/** Refuses the command, with every reason, when the following as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, following: PatternFollowing): void {
  const problems = patternFollowingProblems(following, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
