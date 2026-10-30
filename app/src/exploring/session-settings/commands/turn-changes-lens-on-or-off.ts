// Turn the Changes lens on or off (LA-EXP-CMD44): the Reader shows or dismisses the marks of what changed, for the session.
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnChangesLensOnOrOff { on: boolean }

/** Keeps whether the Changes lens is on; no change saves nothing. */
export function turnChangesLensOnOrOff({ on }: TurnChangesLensOnOrOff): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.lens === on) return;
  const next = { ...was, changes: { ...was.changes, lens: on } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
