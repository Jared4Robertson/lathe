// Open a Claude Code session (LA-PLT-CMD26): the window's chat starts on a new session, a saved one resumed or a fork of
// one, in the mode the folder's last chat had and with the model and effort the Owner chose; the session it ran ends
// first. Refused for a request that names no such way to open, or when the session cannot start.
import type { ChatItem, ChatModelChoice, ChatMode, StartOptions } from '../../chat.ts';
import type { ChatSession } from '../../chatSession.ts';
import { chatOf, startingMode } from '../model.ts';
import type { WindowChatRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** How the page asks to open: a new session, or a saved one (by its ID) resumed or forked. */
export type Opening = { mode: 'new' } | { mode: 'resume' | 'fork'; id: string };

export interface OpenChatSession {
  folder: string;
  /** What the page sent, checked here. */
  request: unknown;
  /**
   * Makes the session, not yet started (main.ts: finds the user's `claude`, reads the saved transcript, gives the CLI the
   * window's app bridge), with the history to show first; null when it cannot.
   */
  create: (opening: Opening, setup: { mode: ChatMode; choice: ChatModelChoice | undefined }) => Promise<{ session: ChatSession; history: ChatItem[] } | null>;
}

/** Whether the chat now runs the session asked for. */
export async function openChatSession(chats: WindowChatRepository, input: OpenChatSession): Promise<boolean> {
  const { mode, id } = (input.request && typeof input.request === 'object' ? input.request : {}) as { mode?: unknown; id?: unknown };
  const opening: Opening | null = mode === 'new' ? { mode } : (mode === 'resume' || mode === 'fork') && typeof id === 'string' ? { mode, id } : null;
  if (!opening) return false;
  const before = chats.load();
  const made = await input.create(opening, { mode: startingMode(before.modes, input.folder), choice: chatOf(before, input.folder).session?.state.choice });
  if (!made) return false;
  // Each session gets a CLI of its own; the last one's ends first.
  const was = chatOf(chats.load(), input.folder);
  clearTimeout(was.timer);
  await was.session?.close();
  const now = chats.load();
  const chat = { ...chatOf(now, input.folder), session: made.session, sent: null, timer: undefined };
  const next = { ...now, open: new Map(now.open).set(input.folder, chat) };
  holdToRules(next);
  chats.save(next);
  const start: StartOptions = opening.mode === 'new' ? {} : { resume: opening.id, fork: opening.mode === 'fork' };
  made.session.open(start, made.history);
  return true;
}
