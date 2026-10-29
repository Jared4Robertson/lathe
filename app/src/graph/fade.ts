// The focus fade (LA-EXP-DS09): in every layout the focus and everything under it are drawn at
// full strength, and everything else (its siblings, other branches, the levels above) faded well
// back, at `--focus-fade`. In the Nested layout, where the focus's ancestors contain
// it, each ancestor keeps a faint outline and name as a trail, at `--focus-trail`; their other
// contents fade. The fade follows the focus and eases with the camera's glide to it.

/** A map's tree as the fade reads it: its layout and each node's parent. */
export interface FadeMap {
  view: string;
  nodes: ReadonlyMap<string, { parent: string | null }>;
}

/** How strongly a faded box and a trail ancestor are drawn, 0 to 1. */
export interface FadeLook { focusFade: number; focusTrail: number }

/** For a focus, how strongly each box is drawn: 1 for the focus and what lies under it, the trail's strength for an ancestor in Nested, the fade's for the rest. */
export function focusStrength(map: FadeMap, focus: string, look: FadeLook): (id: string) => number {
  const ancestors = new Set<string>();
  for (let at = map.nodes.get(focus)?.parent ?? null; at !== null; at = map.nodes.get(at)?.parent ?? null) ancestors.add(at);
  const known = new Map<string, number>();
  const trail = map.view === 'tree' ? look.focusFade : look.focusTrail;
  return (id) => {
    const seen = known.get(id);
    if (seen !== undefined) return seen;
    let strength = look.focusFade;
    if (ancestors.has(id)) strength = trail;
    else for (let at: string | null = id; at !== null; at = map.nodes.get(at)?.parent ?? null) if (at === focus) { strength = 1; break; }
    known.set(id, strength);
    return strength;
  };
}

// ---------- The one way a stage's map shows less (LA-PAT-APP-UX-R19) ----------
//
// Every canvas stage is one map, laid out once (one-map.ts): a filter, the depth or a focus that
// shows only part of it never takes boxes out or moves them; it fades the rest back to the focus
// fade's strength. A fade is by place (a placed box's key; on the graph a record's ID, each record
// having one place there), so a record a map draws twice can be faded in one place and not the other.

/** How strongly each place of a map is drawn, 0 to 1. */
export type Fade = (place: string) => number;

/** Draws what `keeps` keeps at full strength and every other place faded back, at the focus fade's strength. */
export function keptFade(keeps: (place: string) => boolean, look: Pick<FadeLook, 'focusFade'>): Fade {
  return (place) => (keeps(place) ? 1 : look.focusFade);
}

/** Several fades at once (a focus's and a filter's): each place as faint as the faintest of them draws it. */
export function faintest(...fades: readonly Fade[]): Fade {
  return (place) => fades.reduce((s, f) => Math.min(s, f(place)), 1);
}

/** A fade `t` of the way (0 to 1, eased) from one fade to another. */
export function blendFade(from: Fade, to: Fade, t: number): Fade {
  return t >= 1 ? to : (place) => from(place) + (to(place) - from(place)) * t;
}

/**
 * A fade that eases to each new one it is sent over a time (the camera's glide to a new focus, the spotlight's
 * fade for a filter): `now` is the fade to draw this frame, and whether it has arrived.
 */
export function fadeTween(ease: (t: number) => number) {
  let from: Fade | null = null;
  let to: Fade | null = null;
  let start = 0;
  let duration = 0;
  const now = (): { at: Fade; done: boolean } => {
    if (!to) return { at: () => 1, done: true };
    const t = !from || duration <= 0 ? 1 : Math.min(1, (performance.now() - start) / duration);
    return t >= 1 ? { at: to, done: true } : { at: blendFade(from!, to, ease(t)), done: false };
  };
  return {
    now,
    /** Eases to a new fade over `ms`: at once for 0, and for the first fade sent. */
    send(next: Fade, ms: number) {
      if (next === to) return;
      from = to ? now().at : null;
      to = next;
      start = performance.now();
      duration = ms;
    },
  };
}
