import { useSyncExternalStore } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';

// Point and ask (LA-PLT-UC19-R13): "Ask Claude about this" attaches the box the Owner is pointing at to the message as a chip
// (record ID and title), sent as context beside what the Owner is looking at. The chips are kept outside the panel so a
// command can add one while the chat is hidden; like the draft they are never stored.

let ids: readonly string[] = [];
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };

export const chatChips = {
  read: () => ids,
  /** Attaches a record; one already attached stays once. */
  add(id: string) {
    if (ids.includes(id)) return;
    ids = [...ids, id];
    changed();
  },
  remove(id: string) {
    ids = ids.filter((i) => i !== id);
    changed();
  },
  clear() {
    if (!ids.length) return;
    ids = [];
    changed();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** The attached records, redrawn as they change. */
export const useChatChips = () => useSyncExternalStore(chatChips.subscribe, chatChips.read, chatChips.read);

/** A chip's words: the record's ID and title; the ID alone for a record the index no longer has. */
export function chipLabel(index: RecordIndex | null, id: string): string {
  const record = index?.byId.get(id);
  return record ? `${id} ${record.title}` : id;
}

/** The lines Claude gets for the attached records, before the message (a <lathe-pointed> block). */
export function chipsContext(index: RecordIndex | null, attached: readonly string[]): string | null {
  const lines = attached.flatMap((id) => {
    const r = index?.byId.get(id);
    return r ? [`${r.id} (${r.kind}): ${r.title}`] : [];
  });
  return lines.length ? `The Owner pointed at these records and asks about them (a message saying "this" or "these" means them):\n${lines.join('\n')}` : null;
}
