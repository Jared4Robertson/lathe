// Turn Highlight changes on or off (LA-EXP-CMD44): the Reader shows or dismisses the marks of what changed, for the session.
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface TurnHighlightChangesOnOrOff { on: boolean }

/** Keeps whether Highlight changes is on; no change saves nothing. */
export function turnHighlightChangesOnOrOff({ on }: TurnHighlightChangesOnOrOff): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.highlight === on) return;
  const next = { ...was, changes: { ...was.changes, highlight: on } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
