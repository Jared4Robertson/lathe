import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { keptFade, type Fade } from '../graph/fade';
import { prefersReducedMotion } from '../graph/motion';
import { useChanges, type LiveMark, type RecordChange } from './changes';
import { anchorOf, rollUps, type Change, type ChangeCounts } from './rollup';

// The live marks every stage draws (LA-EXP-UC15-R02, LA-V96-R29): a record added as the data reloaded gets a soft glow that
// fades and a lasting "new" dot; one changed, a brief pulse in its own color and then a lasting "changed" dot; one
// removed, a ghost of its outline where it was, fading over a few seconds. Under reduced motion only the dots show:
// no glow, pulse or ghost. The canvas stages (the Graph and the Trace) draw them through paint.ts; the ERD sets them
// on its boxes as classes the stylesheet draws.
//
// Highlight changes (LA-EXP-UC15-R03) is the same marks made plain and lasting: everything unchanged from the baseline
// fades to HIGHLIGHT_DIM with the stages' one fade, each changed record carries a pill (New, Changed or Removed), a thick
// outline in its color and a light tint, a removed record stays as a dashed ghost until it is turned off, and each
// container says how many records under it changed (rollup.ts).

/** How strongly a record unchanged from the baseline is drawn while Highlight changes is on. */
export const HIGHLIGHT_DIM = 0.2;

/** How long an added record's glow, a changed record's pulse and a removed record's ghost last, in ms. */
export const GLOW_MS = 4000;
export const PULSE_MS = 1400;
export const GHOST_MS = 4000;

/** A removed record's ghost: where it was on the map before the reload, in map units, and when it went. */
export interface Ghost { id: string; x: number; y: number; w: number; h: number; t: number }

/** A changed record's box in the map, in map units, with its change: what the edge hints count and the minimap marks. */
export interface ChangedBox { id: string; change: Change; x: number; y: number; w: number; h: number }

/** What a frame draws while Highlight changes is on. */
export interface HighlightMarks {
  /** A record's change from the baseline (or since the page loaded). */
  change: (id: string) => Change | undefined;
  /** Each container's counts, by place (rollup.ts). */
  rolls: ReadonlyMap<string, ChangeCounts>;
  /** The records that changed and are on the map, in reading order (top to bottom, then left to right). */
  boxes: readonly ChangedBox[];
}

/** What a frame draws of the live changes: each record's mark, the ghosts, the time, whether motion is reduced, and Highlight changes' marks (null while it is off). */
export interface StageMarks {
  mark: (id: string) => LiveMark | undefined;
  ghosts: readonly Ghost[];
  now: number;
  reduced: boolean;
  highlight: HighlightMarks | null;
}

/** Whether a frame drawn now still has a glow, a pulse or a ghost on its way out, so the next frame is needed. */
export function marksMoving(marks: StageMarks | null, ids: Iterable<string>): boolean {
  if (!marks || marks.reduced) return false;
  if (!marks.highlight && marks.ghosts.some((g) => marks.now - g.t < GHOST_MS)) return true;
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

/** The map a stage hands the marks, for the roll-ups: its places with their parents, and how a place and a record name each other. */
export interface MarkTree {
  nodes: ReadonlyMap<string, { parent: string | null }>;
  /** The record a place shows (the place itself by default). */
  idOf?: (place: string) => string;
  /** A record's first place in the map, or null (the record itself by default, when it is a place). */
  placeOfId?: (id: string) => string | null;
}

type Rect = { x: number; y: number; w: number; h: number };

/**
 * A stage's live marks: each record's from the live store, and the ghosts of the records removed, placed where the
 * map before the reload had them (`placeOf` reads the map the stage drew last). With Highlight changes on, also each
 * record's change from the baseline, the containers' roll-ups (from `tree`) and the changed boxes. The result is read
 * fresh each frame through `at(now)`.
 */
export function useStageMarks(placeOf: (id: string) => Rect | null, tree?: MarkTree): { at: (now: number) => StageMarks; version: number; highlight: HighlightMarks | null } {
  const { live, highlight: on, byId } = useChanges();
  const version = useLiveVersion();
  const ghosts = useRef<Ghost[]>([]);
  // The places of the maps drawn lately, newest first: a record removed in a reload is in a map drawn before it.
  const maps = useRef<((id: string) => Rect | null)[]>([]);
  if (maps.current[0] !== placeOf) maps.current = [placeOf, ...maps.current].slice(0, 3);
  const seen = useRef(version);
  useEffect(() => {
    if (version === seen.current) return;
    seen.current = version;
    const now = performance.now();
    // A ghost lasts until the Reader looks, so Highlight changes can keep it; it is drawn fading when that is off.
    const kept = ghosts.current.filter((g) => now - g.t < GHOST_MS || live.get(g.id)?.change === 'removed');
    for (const m of live.all()) {
      if (m.change !== 'removed' || now - m.t > 1000 || kept.some((g) => g.id === m.id)) continue;
      const r = maps.current.map((at) => at(m.id)).find((p) => p !== null);
      if (r) kept.push({ id: m.id, ...r, t: m.t });
    }
    ghosts.current = kept;
  }, [version, live]);
  const highlight = useMemo<HighlightMarks | null>(() => {
    if (!on) return null;
    const change = (id: string): Change | undefined => byId.get(id)?.change ?? live.get(id)?.change;
    const boxes: ChangedBox[] = [];
    const seenIds = new Set<string>();
    for (const id of [...byId.keys(), ...live.all().map((m) => m.id)]) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const c = change(id);
      const r = c && c !== 'removed' ? placeOf(id) : null;
      if (c && r) boxes.push({ id, change: c, ...r });
    }
    boxes.sort((a, b) => a.y - b.y || a.x - b.x);
    const removed = [...seenIds].filter((id) => change(id) === 'removed');
    const nodes = tree?.nodes;
    const rolls = nodes
      ? rollUps(
        nodes,
        (place) => change(tree.idOf ? tree.idOf(place) : place),
        removed.map((id) => { const up = anchorOf(id, (x) => (tree.placeOfId ? tree.placeOfId(x) !== null : nodes.has(x))); return up === null ? null : tree.placeOfId ? tree.placeOfId(up) : up; }),
      )
      : new Map<string, ChangeCounts>();
    return { change, rolls, boxes };
  }, [on, byId, live, version, placeOf, tree]);
  return useMemo(() => ({
    version,
    highlight,
    at: (now: number): StageMarks => ({ mark: live.get, ghosts: ghosts.current, now, reduced: prefersReducedMotion(), highlight }),
  }), [version, live, highlight]);
}

/** Highlight changes' fade: what changed from the baseline at full strength, everything else dimmed to HIGHLIGHT_DIM (the shared fade). */
export function highlightFade(changes: ReadonlyMap<string, RecordChange>, idOf: (place: string) => string = (p) => p): Fade {
  return keptFade((place) => changes.has(idOf(place)), { focusFade: HIGHLIGHT_DIM });
}
