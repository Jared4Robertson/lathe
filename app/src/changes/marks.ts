import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { keptFade, type Fade, type FadeLook } from '../graph/fade';
import { prefersReducedMotion } from '../graph/motion';
import { useChanges, type LiveMark, type RecordChange } from './changes';

// The live marks every stage draws (LA-EXP-UC13, LA-V96): a record added as the data reloaded gets a soft glow that
// fades and a lasting "new" dot; one changed, a brief pulse in its own color and then a lasting "changed" dot; one
// removed, a ghost of its outline where it was, fading over a few seconds. Under reduced motion only the dots show:
// no glow, pulse or ghost. The canvas stages (the Graph and the Trace) draw them through paint.ts; the ERD sets them
// on its boxes as classes the stylesheet draws. The Changes lens fades everything unchanged with the stages' one fade.

/** How long an added record's glow, a changed record's pulse and a removed record's ghost last, in ms. */
export const GLOW_MS = 4000;
export const PULSE_MS = 1400;
export const GHOST_MS = 4000;

/** A removed record's ghost: where it was on the map before the reload, in map units, and when it went. */
export interface Ghost { id: string; x: number; y: number; w: number; h: number; t: number }

/** What a frame draws of the live changes: each record's mark, the ghosts, the time, and whether motion is reduced. */
export interface StageMarks {
  mark: (id: string) => LiveMark | undefined;
  ghosts: readonly Ghost[];
  now: number;
  reduced: boolean;
}

/** Whether a frame drawn now still has a glow, a pulse or a ghost on its way out, so the next frame is needed. */
export function marksMoving(marks: StageMarks | null, ids: Iterable<string>): boolean {
  if (!marks || marks.reduced) return false;
  if (marks.ghosts.some((g) => marks.now - g.t < GHOST_MS)) return true;
  for (const id of ids) {
    const m = marks.mark(id);
    if (m && marks.now - m.t < (m.change === 'added' ? GLOW_MS : PULSE_MS)) return true;
  }
  return false;
}

/** How far along a mark's animation is, 0 to 1, or null once it is over (always null under reduced motion). */
export function markPhase(marks: StageMarks, m: LiveMark): number | null {
  if (marks.reduced) return null;
  const span = m.change === 'added' ? GLOW_MS : m.change === 'changed' ? PULSE_MS : GHOST_MS;
  const t = (marks.now - m.t) / span;
  return t >= 0 && t < 1 ? t : null;
}

/** The live store's version, so a stage draws again as changes land. */
export function useLiveVersion(): number {
  const { live } = useChanges();
  return useSyncExternalStore(live.subscribe, live.version, live.version);
}

/**
 * A stage's live marks: each record's from the live store, and the ghosts of the records removed, placed where the
 * map before the reload had them (`placeOf` reads the map the stage drew last). The result is read fresh each frame
 * through `at(now)`.
 */
export function useStageMarks(placeOf: (id: string) => { x: number; y: number; w: number; h: number } | null): { at: (now: number) => StageMarks; version: number } {
  const { live } = useChanges();
  const version = useLiveVersion();
  const ghosts = useRef<Ghost[]>([]);
  // The places of the maps drawn lately, newest first: a record removed in a reload is in a map drawn before it.
  const maps = useRef<((id: string) => { x: number; y: number; w: number; h: number } | null)[]>([]);
  if (maps.current[0] !== placeOf) maps.current = [placeOf, ...maps.current].slice(0, 3);
  const seen = useRef(version);
  useEffect(() => {
    if (version === seen.current) return;
    seen.current = version;
    const now = performance.now();
    const kept = ghosts.current.filter((g) => now - g.t < GHOST_MS);
    for (const m of live.all()) {
      if (m.change !== 'removed' || now - m.t > 1000 || kept.some((g) => g.id === m.id)) continue;
      const r = maps.current.map((at) => at(m.id)).find((p) => p !== null);
      if (r) kept.push({ id: m.id, ...r, t: m.t });
    }
    ghosts.current = kept;
  }, [version, live]);
  return useMemo(() => ({
    version,
    at: (now: number): StageMarks => ({ mark: live.get, ghosts: ghosts.current, now, reduced: prefersReducedMotion() }),
  }), [version, live]);
}

/** The Changes lens's fade: what changed from the baseline at full strength, everything else faded back (the shared fade). */
export function lensFade(changes: ReadonlyMap<string, RecordChange>, look: Pick<FadeLook, 'focusFade'>, idOf: (place: string) => string = (p) => p): Fade {
  return keptFade((place) => changes.has(idOf(place)), look);
}
