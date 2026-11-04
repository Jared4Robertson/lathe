import { useCallback, useEffect, useRef, useState } from 'react';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { takeSnapshot } from './undo';
import type { ChatBridge, ChatImage, ChatItem, ChatMode, ChatModel, ChatEffort, ChatPatch, ChatStatus, LatheTools, ModelChoice, PromptAnswer, QueuedMessage } from './types';

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
  /** The server's token for the product's rows as the turn began, for Undo (undo.ts); null when it could not keep them. */
  snapshot: Promise<string | null>;
  /** The product the turn worked in. */
  product: string | null;
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
  /** The model and effort the open chat runs with. */
  choice: ModelChoice;
  /** The messages typed while Claude worked, sent in order. */
  queue: QueuedMessage[];
  /** The Lathe tools the open chat has; null with none open. */
  lathe: LatheTools | null;
  /** A turn found Claude Code not signed in. */
  signedOut: boolean;
}

const EMPTY: ChatView = { sessionId: null, status: 'closed', items: [], turns: [], open: false, mode: null, choice: { model: null, effort: null }, queue: [], lathe: null, signedOut: false };

/** Applies a patch to the items: a reset replaces them, otherwise each item lands at its position. */
export function applyPatch(items: ChatItem[], patch: ChatPatch): ChatItem[] {
  if (patch.reset) return patch.items.map((i) => i.item);
  const next = items.slice();
  for (const { at, item } of patch.items) next[at] = item;
  return next;
}

const busy = (s: ChatStatus) => s === 'running' || s === 'stopping';

export function useChat(bridge: ChatBridge, index: RecordIndex | null, product: string | null) {
  const [view, setView] = useState<ChatView>(EMPTY);
  const indexRef = useRef(index);
  indexRef.current = index;
  const productRef = useRef(product);
  productRef.current = product;

  useEffect(() => bridge.onPatch((patch) => {
    setView((was) => {
      const items = applyPatch(was.items, patch);
      let turns = patch.reset ? [] : was.turns;
      // A turn begins when the chat becomes busy: it starts at the Owner's message.
      const now = indexRef.current;
      if (busy(patch.status) && !busy(was.status) && now) {
        const start = Math.max(0, items.findLastIndex((i) => i.kind === 'user'));
        turns = [...turns.map((t, n) => (n === turns.length - 1 && t.after === null ? { ...t, after: now } : t)), { start, before: now, after: null, product: productRef.current, snapshot: productRef.current ? takeSnapshot(productRef.current) : Promise.resolve(null) }];
      }
      return { sessionId: patch.sessionId, status: patch.status, items, turns, open: true, mode: patch.mode, choice: patch.choice, queue: patch.queue, lathe: patch.lathe, signedOut: patch.signedOut };
    });
  }), [bridge]);

  const send = useCallback((text: string, focus: string | null, images: ChatImage[]) => bridge.send(text, focus, images), [bridge]);
  const unqueue = useCallback((id: string) => bridge.unqueue(id), [bridge]);
  const setModel = useCallback((model: ChatModel | null, effort: ChatEffort | null) => bridge.setModel(model, effort), [bridge]);
  const answer = useCallback((id: string, reply: PromptAnswer) => bridge.answer(id, reply), [bridge]);
  const stop = useCallback(() => bridge.stop(), [bridge]);
  const setMode = useCallback((mode: ChatMode) => bridge.setMode(mode), [bridge]);
  return { view, send, answer, stop, setMode, setModel, unqueue };
}
