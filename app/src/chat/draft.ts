import { useSyncExternalStore } from 'react';

// The chat's message box draft, kept outside the panel: dictation writes it while the panel opens (voice activation
// wakes a hidden chat), and the panel reads and edits it. Never stored: a reload starts with an empty box.

let text = '';
const listeners = new Set<() => void>();

export const chatDraft = {
  read: () => text,
  write(next: string) {
    if (next === text) return;
    text = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** The draft, read again after each change. */
export const useChatDraft = () => useSyncExternalStore(chatDraft.subscribe, chatDraft.read, chatDraft.read);
