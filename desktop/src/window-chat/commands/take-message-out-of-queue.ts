// Take a message out of the queue (LA-PLT-CMD66, LA-PLT-UC47-R01): a message sent while Claude worked is dropped before
// it goes. Refused for a window with no session, or a message that has already gone.
import type { WindowChatRepository } from '../repository.ts';

export interface TakeMessageOutOfQueue {
  folder: string;
  /** What the page sent, checked here: the queued message's ID. */
  id: unknown;
}

/** Whether the message left the queue. */
export function takeMessageOutOfQueue(chats: WindowChatRepository, input: TakeMessageOutOfQueue): boolean {
  const session = chats.load().open.get(input.folder)?.session;
  return !!session && typeof input.id === 'string' && session.unqueue(input.id);
}
