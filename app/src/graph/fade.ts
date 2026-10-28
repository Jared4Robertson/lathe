// The focus fade (LA-EXP-DS09): in every layout the focus and everything under it are drawn at
// full strength, and everything else (its siblings, other branches, the levels above) faded well
// back, at `--focus-fade`. In the Nested and Voronoi layouts, where the focus's ancestors contain
// it, each ancestor keeps a faint outline and name as a trail, at `--focus-trail`; their other
// contents fade. The fade follows the focus and eases with the camera's glide to it. A trace keeps
// its own highlighting and fades nothing.

/** A map's tree as the fade reads it: its layout and each node's parent. */
export interface FadeMap {
  view: string;
  nodes: ReadonlyMap<string, { parent: string | null }>;
}

/** How strongly a faded box and a trail ancestor are drawn, 0 to 1. */
export interface FadeLook { focusFade: number; focusTrail: number }

/** For a focus, how strongly each box is drawn: 1 for the focus and what lies under it, the trail's strength for an ancestor in Nested and Voronoi, the fade's for the rest. */
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

/** Every box at full strength: a trace, or a map without its focus. */
export const FULL_STRENGTH = (): number => 1;
