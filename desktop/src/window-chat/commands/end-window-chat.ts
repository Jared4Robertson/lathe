// End a window's chat (LA-PLT-CMD69): its session and its listening stop and it leaves the chats; each stop is kept
// until it settles, so quitting can wait for it. The folder's chat mode stays for its next chat.
import type { WindowChatRepository } from '../repository.ts';

export interface EndWindowChat {
  folder: string;
}

export function endWindowChat(chats: WindowChatRepository, input: EndWindowChat): Promise<void> {
  const now = chats.load();
  const chat = now.open.get(input.folder);
  if (!chat) return Promise.resolve();
  clearTimeout(chat.timer);
  const stop = Promise.all([chat.session?.close(), chat.voice?.close()]).then(() => undefined);
  const left = new Map(now.open);
  left.delete(input.folder);
  chats.save({ ...now, open: left, stopping: new Set(now.stopping).add(stop) });
  void stop.finally(() => {
    const after = chats.load();
    const stopping = new Set(after.stopping);
    stopping.delete(stop);
    chats.save({ ...after, stopping });
  });
  return stop;
}
