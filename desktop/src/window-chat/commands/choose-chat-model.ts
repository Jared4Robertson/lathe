// Choose the chat's model and effort (LA-PLT-CMD65, LA-PLT-UC46-R01): the session starts again with them. Refused for a
// window with no session, while a turn is under way, or for a model or effort Lathe does not know.
import { isChatEffort, isChatModel, type ChatEffort, type ChatModel } from '../../chat.ts';
import type { WindowChatRepository } from '../repository.ts';

export interface ChooseChatModel {
  folder: string;
  /** What the page sent, checked here: { model, effort }, either null for Claude Code's own default. */
  choice: unknown;
}

/** Whether the session now runs with the choice. */
export function chooseChatModel(chats: WindowChatRepository, input: ChooseChatModel): boolean {
  const { model, effort } = (input.choice ?? {}) as { model?: unknown; effort?: unknown };
  const session = chats.load().open.get(input.folder)?.session;
  if (!session || (model !== null && !isChatModel(model)) || (effort !== null && !isChatEffort(effort))) return false;
  return session.setChoice({ model: model as ChatModel | null, effort: effort as ChatEffort | null });
}
