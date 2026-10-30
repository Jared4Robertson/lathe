import { useEffect, useRef } from 'react';
import { navigate } from '../router';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { addressOf, STAGE_LABELS, withStage, type StageName } from '../views/address';
import type { AppRequest } from './types';

// The page's answers to the app bridge (LA-PLT-UC19-R06), for Lathe's MCP tools run by the chat's
// Claude Code: what the Reader is looking at, and opening a record. The focus page tells this module
// what it shows (useViewState); the shell answers the bridge (useAppRequests).

/** What the focus page shows: its focus, stage, the node selected on the stage or in the wiki card, and the card. */
export interface ViewState { focus: string; stage: StageName; selected: string | null; wikiCard: boolean }

let shown: (() => ViewState) | null = null;

/** The focus page says what it shows, for as long as it is mounted. */
export function useViewState(state: ViewState, selected: () => string | null) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const read = () => ({ ...latest.current, selected: selected() });
    shown = read;
    return () => { if (shown === read) shown = null; };
  }, [selected]);
}

interface Named { id: string; kind: string; title: string }
const named = (index: RecordIndex | null, id: string | null): Named | null => {
  const r = id ? index?.byId.get(id) : undefined;
  return r ? { id: r.id, kind: r.kind, title: r.title } : null;
};

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
      selected: named(index, view?.selected ?? null),
      wikiCard: view?.wikiCard ?? null,
    },
  };
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
