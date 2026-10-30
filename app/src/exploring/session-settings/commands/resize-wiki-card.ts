// Resize the wiki card (LA-EXP-CMD41): the Reader drags the card's edge, or resets it to its default (null), for every tab.
import { cardWidthWithin } from '../model';
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ResizeWikiCard { width: number | null }

/** Keeps the card's width, brought within its limits; the same width changes nothing. */
export function resizeWikiCard({ width }: ResizeWikiCard): void {
  const was = sessionSettingsRepository.load();
  const card = { width: cardWidthWithin(width) };
  if (card.width === was.card.width) return;
  const next = { ...was, card };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
