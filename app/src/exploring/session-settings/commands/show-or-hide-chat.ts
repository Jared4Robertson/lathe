// Show or hide the chat (LA-EXP-CMD42): the Reader opens or closes the desktop app's chat panel, for the session.
import { sessionSettingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ShowOrHideChat { shown: boolean }

/** Keeps whether the chat panel is open; no change saves nothing. */
export function showOrHideChat({ shown }: ShowOrHideChat): void {
  const was = sessionSettingsRepository.load();
  if (was.chat.open === shown) return;
  const next = { ...was, chat: { ...was.chat, open: shown } };
  holdToRules(next);
  sessionSettingsRepository.save(next);
}
