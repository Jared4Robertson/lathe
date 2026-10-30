// Stop Claude's turn (LA-PLT-CMD29): the session's turn ends and its waiting prompts are withdrawn. Refused for a window
// with no session, or one with no turn under way.
import type { WindowChatRepository } from '../repository.ts';

export interface StopClaudesTurn {
  folder: string;
}

/** Whether the turn is stopping. */
export function stopClaudesTurn(chats: WindowChatRepository, input: StopClaudesTurn): boolean {
  const session = chats.load().open.get(input.folder)?.session;
  return !!session && session.stop();
}
