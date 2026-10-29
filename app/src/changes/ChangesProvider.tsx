import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSessionSettings } from '../graph/settings';
import type { SpecIndex } from '../specs/data';
import { changesSince, ChangesContext, createLiveStore, loadBaseline, markNow, reloadChanges, type Baseline, type ChangesApi, type Since } from './changes';

/** How long the note saying why Follow went off stays, in ms. */
const FOLLOW_NOTE_MS = 6000;

/**
 * The changes of the product in view (changes.ts), for every part of the app: the stages' marks and lens, the wiki
 * card's Changes section and the Changes panel. `index` is the whole workspace's, as loaded; `product` the space's.
 */
export function ChangesProvider({ index, product, children }: { index: SpecIndex | null; product: string | null; children: ReactNode }) {
  const { changes: settings, setChanges } = useSessionSettings();
  const [live] = useState(createLiveStore);

  // The live changes: each reload against the data before it.
  const before = useRef<SpecIndex | null>(null);
  useEffect(() => {
    const was = before.current;
    before.current = index;
    if (!was || !index || was === index) return;
    live.note(reloadChanges(was, index), (id) => index.byId.get(id)?.product ?? was.byId.get(id)?.product ?? null);
  }, [index, live]);

  // The Reader looks at a product: the moment is kept as its "since I last looked", and its live marks go.
  const indexRef = useRef(index);
  indexRef.current = index;
  const look = useCallback((at: string) => {
    const now = indexRef.current;
    if (!now) return;
    live.clear(at);
    void markNow(now, at).then((mark) => {
      if (mark) setChanges({ looked: { ...readLooked(), [at]: mark } });
    });
  }, [live, setChanges]);
  const lookedRef = useRef(settings.looked);
  lookedRef.current = settings.looked;
  const readLooked = () => lookedRef.current;
  // Leaving a product is looking at it; a product entered with no moment of its own takes this one.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!index) return;
    const left = shown.current;
    shown.current = product;
    if (left && left !== product) look(left);
    if (product && product !== left && !lookedRef.current[product]) look(product);
  }, [product, index, look]);

  const setLens = useCallback((on: boolean) => {
    // Dismissing the lens is looking at what it showed.
    if (!on && settings.lens && product) look(product);
    setChanges({ lens: on });
  }, [settings.lens, product, look, setChanges]);
  const setSince = useCallback((since: Since) => setChanges({ since }), [setChanges]);
  const [followNote, setFollowNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  const setFollow = useCallback((on: boolean, note?: string) => {
    setChanges({ follow: on });
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setFollowNote(!on && note ? note : null);
    if (!on && note) noteTimer.current = setTimeout(() => setFollowNote(null), FOLLOW_NOTE_MS);
  }, [setChanges]);

  // The baseline's rows, read again with every reload (the last commit may have moved), and the diff against them.
  const mark = product ? settings.looked[product] : undefined;
  const [baseline, setBaseline] = useState<{ key: string; value: Baseline }>({ key: '', value: { state: 'loading' } });
  const key = `${product}|${settings.since}|${settings.since === 'looked' ? mark?.at ?? '' : ''}`;
  const loads = useRef(0);
  useEffect(() => {
    if (!index || !product) return;
    let live = true;
    const fresh = loads.current++ > 0;
    loadBaseline(index, product, settings.since, mark, fresh).then(
      (value) => { if (live) setBaseline((b) => (b.key === key && sameBaseline(b.value, value) ? b : { key, value })); },
      (e) => { if (live) setBaseline({ key, value: { state: 'none', message: e instanceof Error ? e.message : String(e) } }); },
    );
    return () => { live = false; };
  }, [index, product, settings.since, mark, key]);
  const current: Baseline = baseline.key === key ? baseline.value : { state: 'loading' };
  const changes = useMemo(() => (index && product && current.state === 'ok' ? changesSince(index, product, current.tables) : []), [index, product, current]);
  const byId = useMemo(() => new Map(changes.map((c) => [c.id, c])), [changes]);

  const api = useMemo<ChangesApi>(() => ({
    product, lens: settings.lens, setLens, since: settings.since, setSince, follow: settings.follow, setFollow, followNote,
    baseline: current, changes, byId, live,
  }), [product, settings.lens, setLens, settings.since, setSince, settings.follow, setFollow, followNote, current, changes, byId, live]);
  return <ChangesContext.Provider value={api}>{children}</ChangesContext.Provider>;
}

/** The same baseline read again: the same rows object from the cache, so the diff is not worked out twice. */
const sameBaseline = (a: Baseline, b: Baseline) => a.state === 'ok' && b.state === 'ok' ? a.tables === b.tables && a.label === b.label && a.detail === b.detail : a.state === b.state;
