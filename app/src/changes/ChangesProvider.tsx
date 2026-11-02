import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSessionSettings } from '../exploring/session-settings/use-session-settings';
import { chooseChangesBaseline, turnFollowOnOrOff, turnHighlightChangesOnOrOff } from '../exploring/session-settings/commands/handlers.generated';
import { markProductLookedAt } from '../exploring/session-settings/commands/mark-product-looked-at';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { ChangesContext, createLiveStore, type RecordChange, loadBaseline, markNow, reloadChanges, type Baseline, type ChangesApi, type Review, type Since } from './changes';

/** How long the note saying why Follow went off stays, in ms. */
const FOLLOW_NOTE_MS = 6000;

/**
 * The changes of the product in view (changes.ts), for every part of the app: the stages' marks and Highlight changes, the wiki
 * card's Changes section and the Changes panel. `index` is the space's, as read; `product` the space's product.
 */
export function ChangesProvider({ index, product, children }: { index: RecordIndex | null; product: string | null; children: ReactNode }) {
  const { changes: settings } = useSessionSettings();
  const [live] = useState(createLiveStore);

  // The live changes: each reload against the data before it. A record the baseline lacks (new since it) that is then removed
  // never existed at the baseline: it leaves no mark and no ghost, where one that did exist leaves its ghost.
  const baselineChanges = useRef<ReadonlyMap<string, RecordChange>>(new Map());
  const before = useRef<RecordIndex | null>(null);
  useEffect(() => {
    const was = before.current;
    before.current = index;
    if (!was || !index || was === index) return;
    live.note(reloadChanges(was, index).filter((c) => !(c.change === 'removed' && baselineChanges.current.get(c.id)?.change === 'added')), (id) => index.byId.get(id)?.product ?? was.byId.get(id)?.product ?? null);
  }, [index, live]);

  // The Reader looks at a product: the moment is kept as its "since I last looked", and its live marks go.
  const indexRef = useRef(index);
  indexRef.current = index;
  const look = useCallback((at: string) => {
    const now = indexRef.current;
    if (!now) return;
    live.clear(at);
    void markNow(now, at).then((mark) => markProductLookedAt({ product: at, mark }));
  }, [live]);
  const lookedRef = useRef(settings.looked);
  lookedRef.current = settings.looked;
  // Leaving a product is looking at it; a product entered with no moment of its own takes this one.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!index) return;
    const left = shown.current;
    shown.current = product;
    if (left && left !== product) look(left);
    if (product && product !== left && !lookedRef.current[product]) look(product);
  }, [product, index, look]);

  const setHighlight = useCallback((on: boolean) => {
    // Dismissing Highlight changes is looking at what it showed.
    if (!on && settings.highlight && product) look(product);
    turnHighlightChangesOnOrOff({ on });
  }, [settings.highlight, product, look]);
  const setSince = useCallback((since: Since) => chooseChangesBaseline({ since }), []);
  const [followNote, setFollowNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  const setFollow = useCallback((on: boolean, note?: string) => {
    turnFollowOnOrOff({ on });
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setFollowNote(!on && note ? note : null);
    if (!on && note) noteTimer.current = setTimeout(() => setFollowNote(null), FOLLOW_NOTE_MS);
  }, []);

  // The changes since the baseline, read again with every reload (the data, and the last commit, may have moved).
  const mark = product ? settings.looked[product] : undefined;
  const [baseline, setBaseline] = useState<{ key: string; value: Baseline }>({ key: '', value: { state: 'loading' } });
  const key = `${product}|${settings.since}|${settings.since === 'looked' ? mark?.at ?? '' : ''}`;
  useEffect(() => {
    if (!index || !product) return;
    let live = true;
    loadBaseline(index, product, settings.since, mark).then(
      (value) => { if (live) setBaseline((b) => (b.key === key && sameBaseline(b.value, value) ? b : { key, value })); },
      (e) => { if (live) setBaseline({ key, value: { state: 'none', message: e instanceof Error ? e.message : String(e) } }); },
    );
    return () => { live = false; };
  }, [index, product, settings.since, mark, key]);
  const current: Baseline = baseline.key === key ? baseline.value : { state: 'loading' };
  const changes = useMemo(() => (current.state === 'ok' ? current.changes : []), [current]);
  const byId = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes]);
  baselineChanges.current = byId;

  // Claude's changes under review replace the baseline's changes and the live marks, and light the stage whatever Highlight changes says.
  const [review, setReview] = useState<Review | null>(null);
  const [noLive] = useState(createLiveStore);
  const reviewById = useMemo(() => new Map((review?.changes ?? []).map((c) => [c.id, c])), [review]);
  const reviewBaseline = useMemo<Baseline | null>(() => review && { state: 'ok', changes: [...review.changes], label: "in Claude's turn", detail: review.label }, [review]);

  const api = useMemo<ChangesApi>(() => ({
    product, highlight: review ? true : settings.highlight, setHighlight, since: settings.since, setSince, follow: settings.follow, setFollow, followNote,
    baseline: reviewBaseline ?? current, changes: review ? review.changes : changes, byId: review ? reviewById : byId, live: review ? noLive : live, review, setReview,
  }), [product, settings.highlight, setHighlight, settings.since, setSince, settings.follow, setFollow, followNote, current, changes, byId, live, review, reviewBaseline, reviewById, noLive]);
  return <ChangesContext.Provider value={api}>{children}</ChangesContext.Provider>;
}

/** The same changes read again, so the stages do not draw them twice. */
const sameBaseline = (a: Baseline, b: Baseline) => a.state === 'ok' && b.state === 'ok' ? a.label === b.label && a.detail === b.detail && JSON.stringify(a.changes) === JSON.stringify(b.changes) : a.state === b.state;
