// Choose the chat's permission mode (LA-PLT-CMD60, LA-PLT-UC45-R01): Ask, Accept reads, Auto, Bypass or View only. The
// chat's session, when it has one, starts again in that mode, and the folder keeps it for its next chat. Refused while
// a turn is under way, or for a mode Lathe does not know.
import { isChatMode } from '../../chat.ts';
import { chooseMode } from '../model.ts';
import type { WindowChatRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface ChooseChatMode {
  folder: string;
  /** What the page sent, checked here. */
  mode: unknown;
}

/** Whether the chat is now in the mode asked for. */
export function chooseChatMode(chats: WindowChatRepository, input: ChooseChatMode): boolean {
  if (!isChatMode(input.mode)) return false;
  const now = chats.load();
  const session = now.open.get(input.folder)?.session;
  if (session && !session.setMode(input.mode)) return false;
  const next = { ...now, modes: chooseMode(now.modes, input.folder, input.mode) };
  holdToRules(next);
  chats.save(next);
  return true;
}
