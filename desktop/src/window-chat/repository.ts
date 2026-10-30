// The Window chat's repository (LA-PLT-REPO26): the chats and the stops in memory, as a chat lives only while its
// window is open, and each folder's chat mode in chat-modes.json in the shell's user data folder, read on the first
// load and rewritten when a save changes it. Each load gives a copy of the whole, and each save replaces it.
import { readJson, writeJson } from '../store.ts';
import { parseChatModes, type ChatModes, type WindowChat, type WindowChats } from './model.ts';

export class WindowChatRepository {
  private readonly modesFile: () => string;
  private open = new Map<string, WindowChat>();
  private stopping = new Set<Promise<void>>();
  private modes: ChatModes | null = null;
  constructor(files: { modes: () => string }) {
    this.modesFile = files.modes;
  }

  load(): WindowChats {
    this.modes ??= parseChatModes(readJson(this.modesFile()));
    return { open: new Map(this.open), stopping: new Set(this.stopping), modes: this.modes };
  }

  save(chats: WindowChats): void {
    const was = this.modes;
    this.open = new Map(chats.open);
    this.stopping = new Set(chats.stopping);
    this.modes = chats.modes;
    if (JSON.stringify(was) !== JSON.stringify(chats.modes)) writeJson(this.modesFile(), chats.modes);
  }
}
