// Send a message to Claude (LA-PLT-CMD27): the Owner's message, with what they are looking at and the pictures they
// added, goes to the chat's session. Refused for a window with no session, or a message that is not text with pictures
// the chat takes.
import { parseImages } from '../../chat.ts';
import type { WindowChatRepository } from '../repository.ts';

export interface SendMessageToClaude {
  folder: string;
  /** What the page sent, checked here: { text, focus, images }. */
  message: unknown;
}

/** Whether the session took the message. */
export function sendMessageToClaude(chats: WindowChatRepository, input: SendMessageToClaude): boolean {
  const { text, focus, images } = (input.message ?? {}) as { text?: unknown; focus?: unknown; images?: unknown };
  const pictures = parseImages(images);
  const session = chats.load().open.get(input.folder)?.session;
  return !!session && pictures !== null && typeof text === 'string' && session.send(text.slice(0, 100_000), typeof focus === 'string' ? focus : null, pictures);
}
