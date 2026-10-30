// Choose the chat's permission mode (LA-PLT-CMD60, LA-PLT-UC19-R09): Ask, Accept reads, Auto, Bypass or View only. The
// window's chat, when it has one, starts again on its session in that mode, and the folder keeps it for its next chat.
// Refused while a turn is under way, for a window that is not open, or for a mode Lathe does not know.
import { isChatMode } from '../../chat.ts';
import { chooseMode } from '../model.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface ChooseChatMode {
  folder: string;
  /** What the page sent, checked here. */
  mode: unknown;
}

/** Whether the chat is now in the mode asked for. */
export function chooseChatMode(windows: ProductWindowRepository, input: ChooseChatMode): boolean {
  if (!isChatMode(input.mode)) return false;
  const now = windows.load();
  const window = now.open.get(input.folder);
  if (!window || (window.chat && !window.chat.setMode(input.mode))) return false;
  const next = { ...now, modes: chooseMode(now.modes, input.folder, input.mode) };
  holdToRules(next);
  windows.save(next);
  return true;
}
