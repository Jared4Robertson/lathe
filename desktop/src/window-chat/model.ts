// Window chat (LA-PLT-A16): each product window's chat with Claude Code, by folder, while the shell runs: the session
// it runs (chatSession.ts), the chat state its page last got and the timer that sends the next patch, and its listening
// for the voice (voice.ts); the stops in progress, which quitting waits for; and each folder's chat permission mode
// (LA-PLT-UC45-R01), kept across launches, so a new chat there starts in the mode its last one had.
import path from 'node:path';
import { DEFAULT_MODE, isChatMode, type ChatMode, type ChatState } from '../chat.ts';
import type { ChatSession } from '../chatSession.ts';
import type { VoiceListener } from '../voice.ts';

/** One window's chat, kept by its window's folder. */
export interface WindowChat {
  folder: string;
  /** The Claude Code session it runs, once one is opened. */
  session?: ChatSession;
  /** The chat state the page last got, and the timer that sends the next patch. */
  sent: ChatState | null;
  timer?: NodeJS.Timeout;
  /** The window's listening for the chat's voice, once the page has asked. */
  voice?: VoiceListener;
}

/** The whole aggregate: the windows' chats by folder, the stops in progress, and the chat modes by folder. */
export interface WindowChats {
  open: ReadonlyMap<string, WindowChat>;
  stopping: ReadonlySet<Promise<void>>;
  modes: ChatModes;
}

/** Each folder's chat mode, by full path; a folder not listed starts in the default mode, which is never kept. */
export type ChatModes = Readonly<Record<string, ChatMode>>;

/** Reads the saved chat modes, keeping only full paths with a mode Lathe knows, other than the default. */
export function parseChatModes(raw: unknown): ChatModes {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const modes: Record<string, ChatMode> = {};
  for (const [folder, mode] of Object.entries(raw as Record<string, unknown>)) {
    if (path.isAbsolute(folder) && isChatMode(mode) && mode !== DEFAULT_MODE) modes[path.resolve(folder)] = mode;
  }
  return modes;
}

/** The modes with this folder's chat mode chosen. */
export function chooseMode(modes: ChatModes, folder: string, mode: ChatMode): ChatModes {
  const full = path.resolve(folder);
  const { [full]: _was, ...rest } = modes;
  return mode === DEFAULT_MODE ? rest : { ...rest, [full]: mode };
}

/** The mode a folder's chat starts in: its last chat's, else the default. */
export const startingMode = (modes: ChatModes, folder: string): ChatMode => modes[path.resolve(folder)] ?? DEFAULT_MODE;

/** The window's chat: the one it has, or a new one with nothing in it yet. */
export const chatOf = (chats: WindowChats, folder: string): WindowChat => chats.open.get(folder) ?? { folder, sent: null };
