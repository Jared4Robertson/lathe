import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { reloadChanges, type RecordChange } from '../changes/changes';
import { CHANGE_LABEL, ChangeDetails } from '../changes/ChangeDetails';
import { useChanges } from '../changes/changes';
import { compareIds, type RecordIndex } from '../exploring/record-summaries/record-index';
import { navigate } from '../router';
import { useAnnounce } from '../shell/commands';
import { addressOf, withStage } from '../views/address';
import { focusAnswer } from './appRequests';
import type { Turn } from './useChat';
import type { ChatItem } from './types';
import { touchedInOrder, turnChanges, undoTurn } from './undo';

// Claude's changes on the map (LA-EXP-UC109-R01, R02): after a turn that writes, the turn's changed records can be put under
// review: the stage lights them alone (Highlight changes scoped to that turn, changes/ChangesProvider.tsx), and the review
// bar walks through them, next and previous, each with its diff. A turn can also be undone in one click, through the
// aggregates' own commands (undo.ts); the server refuses, with every reason, what something since depends on.

/** The records a turn changed: the server's diff against the rows it kept as the turn began for the latest turn, else the record-level diff of the spec before and after. */
export async function changesOfTurn(turn: Turn, index: RecordIndex): Promise<RecordChange[]> {
  const snapshot = await turn.snapshot;
  const exact = turn.after === null && snapshot ? await turnChanges(snapshot) : null;
  return exact ?? reloadChanges(turn.before, turn.after ?? index);
}

/** The records a turn changed that were changed again since the turn ended: why it cannot be undone as it was. Only the turns that have ended can tell. */
export function changedSince(turn: Turn, index: RecordIndex): string[] {
  if (!turn.after) return [];
  const after = turn.after;
  return reloadChanges(turn.before, after).flatMap((c) => {
    const was = after.byId.get(c.id)?.digest;
    const now = index.byId.get(c.id)?.digest;
    return was === now ? [] : [`${c.id} changed again after this turn, so putting it back would lose that change.`];
  });
}

/** What undoing a turn has come to. */
export type UndoState = 'working' | 'undone' | { refused: string[] };

/** The Review and Undo buttons of one turn's changes, and the reasons an undo was refused. */
export function TurnActions({ turn, number, items, index, idle, state, onState }: {
  turn: Turn;
  number: number;
  items: readonly ChatItem[];
  index: RecordIndex;
  idle: boolean;
  state: UndoState | undefined;
  onState: (state: UndoState | undefined) => void;
}) {
  const { review, setReview } = useChanges();
  const announce = useAnnounce();
  const label = `Claude's changes, turn ${number}`;
  const reviewing = review?.label === label;
  const canUndo = idle && state !== 'working' && state !== 'undone';

  const startReview = async () => {
    const changes = await changesOfTurn(turn, index);
    setReview({ label, changes });
    announce(`Reviewing ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`);
  };
  const undo = async () => {
    const stale = changedSince(turn, index);
    if (stale.length) { onState({ refused: stale }); announce('That turn cannot be undone'); return; }
    const snapshot = await turn.snapshot;
    if (!snapshot) { onState({ refused: ['The server did not keep the data from before this turn, so it cannot be put back.'] }); return; }
    onState('working');
    const outcome = await undoTurn(snapshot, touchedInOrder(items));
    if (outcome.ok) { onState('undone'); if (reviewing) setReview(null); announce("Undid Claude's changes"); }
    else { onState({ refused: outcome.reasons }); announce('That turn cannot be undone'); }
  };

  return (
    <div className="chat-turn-actions">
      <Button className="chat-review-start" aria-pressed={reviewing} onClick={() => (reviewing ? setReview(null) : void startReview())}>
        {reviewing ? 'Stop reviewing' : "Review Claude's changes"}
      </Button>
      {state === 'undone'
        ? <span className="chat-undone">Undone</span>
        : <Button className="chat-undo" icon="undo" disabled={!canUndo} onClick={() => void undo()}>{state === 'working' ? 'Undoing…' : 'Undo this turn'}</Button>}
      {typeof state === 'object' && (
        <div className="chat-undo-refused" role="alert">
          <p>Not undone; nothing changed:</p>
          <ul>{state.refused.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <Button onClick={() => onState(undefined)}>Dismiss</Button>
        </div>
      )}
    </div>
  );
}

/** The review bar above the message box: where the walk is, Previous and Next, the current change's diff, and Done. */
export function ReviewBar({ index }: { index: RecordIndex | null }) {
  const { review, setReview } = useChanges();
  const announce = useAnnounce();
  const walk = useMemo(() => (review ? review.changes.filter((c) => c.change !== 'removed').sort((a, b) => compareIds(a.id, b.id)) : []), [review]);
  const removed = review ? review.changes.length - walk.length : 0;
  const [at, setAt] = useState(0);
  const shownFor = useRef<typeof review>(null);

  const go = useCallback((to: number) => {
    const change = walk[to];
    if (!change) return;
    setAt(to);
    const stage = focusAnswer(index, window.location.pathname, null).page.stage;
    navigate(stage ? withStage(addressOf(change.id), stage) : addressOf(change.id));
    announce(`${CHANGE_LABEL[change.change]}: ${change.title}, ${to + 1} of ${walk.length}`);
  }, [walk, index, announce]);

  // A review begins at its first change.
  useEffect(() => {
    if (!review || shownFor.current === review) return;
    shownFor.current = review;
    go(0);
  }, [review, go]);
  useEffect(() => { if (!review) shownFor.current = null; }, [review]);
  if (!review || !index) return null;

  const current = walk[at];
  return (
    <section className="chat-review" aria-label="Review Claude's changes" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setReview(null); } }}>
      <div className="chat-review-head">
        <strong className="chat-review-title">{review.label}</strong>
        <span className="chat-review-count" aria-live="polite">
          {walk.length === 0 ? 'No record to show' : `${at + 1} of ${walk.length}`}{removed > 0 && ` · ${removed} removed`}
        </span>
      </div>
      {current && (
        <div className="chat-review-current">
          <p className="chat-review-what"><span className={`chat-change-kind is-${current.change}`}>{CHANGE_LABEL[current.change]}</span> <code>{current.id}</code> {current.title}</p>
          <ChangeDetails index={index} change={current} />
        </div>
      )}
      <div className="chat-review-actions">
        <Button disabled={walk.length < 2} onClick={() => go((at - 1 + walk.length) % walk.length)}>Previous change</Button>
        <Button variant="primary" disabled={walk.length < 2} onClick={() => go((at + 1) % walk.length)}>Next change</Button>
        <Button onClick={() => setReview(null)}>Done</Button>
      </div>
    </section>
  );
}
