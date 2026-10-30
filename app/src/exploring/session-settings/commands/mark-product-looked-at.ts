// Mark a product looked at (LA-EXP-CMD47): the moment the Reader dismisses the lens or leaves a product is kept as its "since I last looked".
import type { LookMark } from '../../../changes/changes';
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface MarkProductLookedAt { product: string; mark: LookMark }

/** Keeps the moment the Reader last looked at a product. */
export function markProductLookedAt({ product, mark }: MarkProductLookedAt): void {
  const was = sessionSettingsRepository.load();
  const next = { ...was, changes: { ...was.changes, looked: { ...was.changes.looked, [product]: mark } } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
