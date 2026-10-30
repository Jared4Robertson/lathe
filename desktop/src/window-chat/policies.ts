// The Window chat's policy: when a window closes, end its chat (LA-PLT-PO04).
import type { ProductWindowClosed } from '../product-window/events.ts';
import { endWindowChat } from './commands/end-window-chat.ts';
import type { WindowChatRepository } from './repository.ts';

export function onWindowClosedEndChat(event: ProductWindowClosed, chats: WindowChatRepository): Promise<void> {
  return endWindowChat(chats, { folder: event.folder });
}
