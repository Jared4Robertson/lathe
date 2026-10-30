// Resize the chat (LA-EXP-CMD43): the Reader drags the chat panel's edge, or resets it to its default (null).
import { chatWidthWithin } from '../model';
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ResizeChat { width: number | null }

/** Keeps the chat's width, brought within its limits; the same width changes nothing. */
export function resizeChat({ width }: ResizeChat): void {
  const was = sessionSettingsRepository.load();
  const w = chatWidthWithin(width);
  if (w === was.chat.width) return;
  const next = { ...was, chat: { ...was.chat, width: w } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
