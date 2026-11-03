import { useEffect, useRef, useState } from 'react';
import { navigate } from '../router';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { addressOf, STAGE_LABELS, withStage, type StageName } from '../views/address';
import type { AppRequest } from './types';

// The page's answers to the app bridge (LA-PLT-UC29-R01), for Lathe's MCP tools run by the chat's
// Claude Code: what the Reader is looking at, and opening a record. The focus page tells this module
// what it shows (useViewState); the shell answers the bridge (useAppRequests). The chat panel shows
// the same focus as a chip above its message box and sends it with each message (focusContext,
// LA-PLT-UC19-R12), redrawn whenever the focus page shows something else (useViewChanges).

/** What the focus page shows: its focus, stage and the card. */
export interface ViewState { focus: string; stage: StageName; wikiCard: boolean }

let shown: (() => ViewState) | null = null;
const viewListeners = new Set<() => void>();
const viewChanged = () => { for (const listener of viewListeners) listener(); };

/** The focus page says what it shows, for as long as it is mounted. */
export function useViewState(state: ViewState) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const read = () => latest.current;
    shown = read;
    viewChanged();
    return () => {
      if (shown === read) shown = null;
      viewChanged();
    };
  }, []);
  useEffect(viewChanged, [state.focus, state.stage, state.wikiCard]);
}

/** Calls back each time the focus page shows something else; the number counts the changes, to redraw by. */
export function useViewChanges(): number {
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    const listener = () => setChanges((n) => n + 1);
    viewListeners.add(listener);
    return () => { viewListeners.delete(listener); };
  }, []);
  return changes;
}

interface Named { id: string; kind: string; title: string }
const named = (index: RecordIndex | null, id: string | null): Named | null => {
  const r = id ? index?.byId.get(id) : undefined;
  return r ? { id: r.id, kind: r.kind, title: r.title } : null;
};

/** The record the Owner points at: the focused record; null where nothing is shown. */
export function pointedAt(index: RecordIndex | null): string | null {
  const id = shown?.()?.focus ?? null;
  return id && index?.byId.has(id) ? id : null;
}

/** What the Reader is looking at, as app_focus gives it. */
export function focusAnswer(index: RecordIndex | null, path: string, product: string | null) {
  const view = shown?.() ?? null;
  return {
    connected: true,
    page: {
      path,
      product,
      stage: view?.stage ?? null,
      focus: named(index, view?.focus ?? null) ?? (view ? { id: view.focus, kind: 'group', title: view.focus } : null),
      wikiCard: view?.wikiCard ?? null,
    },
  };
}

/** What the Owner is looking at, as the chip names it and as the context sent with a message (LA-PLT-UC19-R12). */
export interface FocusContext {
  /** The chip's words: "Viewing LA-EXP-UC05 on the Graph". */
  label: string;
  /** The lines Claude gets before the message. */
  context: string;
}

const line = (n: Named) => `${n.id} (${n.kind}): ${n.title}`;

/** The focus as the chat shows and sends it, from app_focus's own answer. */
export function focusContext(index: RecordIndex | null, path: string, product: string | null): FocusContext {
  const { page } = focusAnswer(index, path, product);
  const stage = page.stage ? STAGE_LABELS[page.stage] : null;
  const lines = [
    product && `Product: ${product}`,
    `Page: ${path}`,
    stage && `Stage: ${stage}`,
    page.focus && `Focused record: ${line(page.focus)}`,
    page.wikiCard !== null && `Wiki card: ${page.wikiCard ? 'open' : 'closed'}`,
  ].filter(Boolean);
  const where = page.focus ? `Viewing ${page.focus.id}${stage ? ` on the ${stage}` : ''}` : product ? `Viewing ${path === '/' ? 'the products' : product}` : 'Viewing the products';
  return { label: where, context: lines.join('\n') };
}

/** Opens a record in the window, as app_open asks; refused for a record the workspace does not have. */
export function openAnswer(index: RecordIndex | null, open: { id: string; stage: StageName | null }) {
  const record = index?.byId.get(open.id);
  if (!record) return { ok: false, message: `There is no record ${open.id} in this window's specs.` };
  navigate(open.stage ? withStage(addressOf(open.id), open.stage) : addressOf(open.id));
  return { ok: true, message: `Opened ${record.id} (${record.kind}): ${record.title}${open.stage ? `, on the ${STAGE_LABELS[open.stage]} stage` : ''}.` };
}

/** Answers the app bridge's questions while the shell shows this index. */
export function useAppRequests(index: RecordIndex | null, product: string | null) {
  const latest = useRef({ index, product });
  latest.current = { index, product };
  useEffect(() => {
    const bridge = window.latheDesktop;
    if (!bridge?.isDesktop) return;
    return bridge.onAppRequest((request: AppRequest) => {
      const { index: i, product: p } = latest.current;
      if (request.kind === 'focus') return focusAnswer(i, window.location.pathname, p);
      return openAnswer(i, request.open);
    });
  }, []);
}
