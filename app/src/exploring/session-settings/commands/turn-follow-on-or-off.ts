// Turn Follow on or off (LA-EXP-CMD46): the Reader has the stage follow each change as it lands, or stops it.
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnFollowOnOrOff { on: boolean }

/** Keeps whether Follow is on; no change saves nothing. */
export function turnFollowOnOrOff({ on }: TurnFollowOnOrOff): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.follow === on) return;
  const next = { ...was, changes: { ...was.changes, follow: on } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
