// Answer a permission prompt (LA-PLT-CMD28): allow once, allow always in this chat, or deny. Refused for a window with
// no session, an answer Lathe does not know, or a prompt that is not waiting.
import type { WindowChatRepository } from '../repository.ts';

export interface AnswerPermissionPrompt {
  folder: string;
  /** What the page sent, checked here: { id, answer }. */
  reply: unknown;
}

/** Whether the prompt was answered. */
export function answerPermissionPrompt(chats: WindowChatRepository, input: AnswerPermissionPrompt): boolean {
  const { id, answer } = (input.reply ?? {}) as { id?: unknown; answer?: unknown };
  const session = chats.load().open.get(input.folder)?.session;
  return !!session && typeof id === 'string' && (answer === 'once' || answer === 'always' || answer === 'deny') && session.answer(id, answer);
}
