import { useCallback, useEffect, useRef, useState } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import type { ChatBridge, ChatItem, ChatMode, ChatPatch, ChatStatus, LatheTools, PromptAnswer } from './types';

// The window's chat as the page keeps it (LA-PLT-UC19): the items and status the shell sends as
// patches, and the turns, each with the spec as it was when the turn began, so the panel can show
// the records each turn changed (the engine's record diff, changes/changes.ts). A turn's spec after is the one current when the next
// turn begins; the last turn's is the live one.

export interface Turn {
  /** The position of the turn's first item (the Owner's message). */
  start: number;
  before: RecordIndex;
  /** The spec when the next turn began; null for the last turn, which compares with the live spec. */
  after: RecordIndex | null;
}

export interface ChatView {
  sessionId: string | null;
  status: ChatStatus;
  items: ChatItem[];
  turns: Turn[];
  /** Whether the window has a chat open at all (a session picked). */
  open: boolean;
  /** The open chat's permission mode; null with none open. */
  mode: ChatMode | null;
  /** The Lathe tools the open chat has; null with none open. */
  lathe: LatheTools | null;
}

const EMPTY: ChatView = { sessionId: null, status: 'closed', items: [], turns: [], open: false, mode: null, lathe: null };

/** Applies a patch to the items: a reset replaces them, otherwise each item lands at its position. */
export function applyPatch(items: ChatItem[], patch: ChatPatch): ChatItem[] {
  if (patch.reset) return patch.items.map((i) => i.item);
  const next = items.slice();
  for (const { at, item } of patch.items) next[at] = item;
  return next;
}

const busy = (s: ChatStatus) => s === 'running' || s === 'stopping';

export function useChat(bridge: ChatBridge, index: RecordIndex | null) {
  const [view, setView] = useState<ChatView>(EMPTY);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => bridge.onPatch((patch) => {
    setView((was) => {
      const items = applyPatch(was.items, patch);
      let turns = patch.reset ? [] : was.turns;
      // A turn begins when the chat becomes busy: it starts at the Owner's message.
      const now = indexRef.current;
      if (busy(patch.status) && !busy(was.status) && now) {
        const start = Math.max(0, items.findLastIndex((i) => i.kind === 'user'));
        turns = [...turns.map((t, n) => (n === turns.length - 1 && t.after === null ? { ...t, after: now } : t)), { start, before: now, after: null }];
      }
      return { sessionId: patch.sessionId, status: patch.status, items, turns, open: true, mode: patch.mode, lathe: patch.lathe };
    });
  }), [bridge]);

  const send = useCallback((text: string, focus: string | null) => bridge.send(text, focus), [bridge]);
  const answer = useCallback((id: string, reply: PromptAnswer) => bridge.answer(id, reply), [bridge]);
  const stop = useCallback(() => bridge.stop(), [bridge]);
  const setMode = useCallback((mode: ChatMode) => bridge.setMode(mode), [bridge]);
  return { view, send, answer, stop, setMode };
}
