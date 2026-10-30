// Choose the Changes baseline (LA-EXP-CMD45): the Reader compares with the last commit, the branch's start or the last look.
import type { Since } from '../../../changes/changes';
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ChooseChangesBaseline { since: Since }

/** Keeps the baseline Highlight changes compares with; the same baseline changes nothing. */
export function chooseChangesBaseline({ since }: ChooseChangesBaseline): void {
  const was = sessionSettingsRepository.load();
  if (was.changes.since === since) return;
  const next = { ...was, changes: { ...was.changes, since } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
