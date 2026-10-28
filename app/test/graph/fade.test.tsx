import './setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { graphMap } from '../../src/graph/map';
import { nestedMap } from '../../src/graph/nested';
import { readyVoronoiMap } from '../../src/graph/voronoi';
import { PLAIN_LOOK } from '../../src/graph/look';
import type { FadeMap } from '../../src/graph/fade';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElement, isCenter, scene } from './scene';

// The focus fade (LA-V93-R73, LA-EXP-DS09): in every layout the focus and everything under it are
// drawn at full strength, the ancestors that contain it in Nested and Voronoi as a faint trail, and
// everything else faded well back; the fade follows the focus, and a trace fades nothing.

const LAYOUTS = ['tree', 'nested', 'voronoi'] as const;
const mapOf = (layout: (typeof LAYOUTS)[number]): FadeMap => (layout === 'tree' ? graphMap(testIndex(), 'P') : layout === 'nested' ? nestedMap(testIndex(), 'P') : readyVoronoiMap(testIndex(), 'P')!);

/** Where a box stands to the focus in the map: the focus or under it, an ancestor of it, or elsewhere. */
function placeOf(map: FadeMap, focus: string, id: string): 'subtree' | 'ancestor' | 'other' {
  for (let at: string | null = id; at !== null; at = map.nodes.get(at)?.parent ?? null) if (at === focus) return 'subtree';
  for (let at = map.nodes.get(focus)?.parent ?? null; at !== null; at = map.nodes.get(at)?.parent ?? null) if (at === id) return 'ancestor';
  return 'other';
}

/** Expects every drawn box at its strength for the focus: 1 in its subtree, the trail's for an ancestor in Nested and Voronoi, the fade's for the rest. */
function expectFade(layout: (typeof LAYOUTS)[number], focus: string) {
  const map = mapOf(layout);
  const places = { subtree: 0, ancestor: 0, other: 0 };
  for (const b of scene().boxes) {
    const place = placeOf(map, focus, b.id);
    places[place]++;
    const want = place === 'subtree' ? 1 : place === 'ancestor' && layout !== 'tree' ? PLAIN_LOOK.focusTrail : PLAIN_LOOK.focusFade;
    expect(b.strength, `${layout}: ${b.id} (${place} of ${focus})`).toBeCloseTo(want, 5);
  }
  return places;
}

describe('focus fade', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each(LAYOUTS)('LA-V93-R73-T01 In the %s layout the focus and its subtree are drawn at full strength, the trail at its own, and every other box faded; the fade follows the focus', async (layout) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
    startAtDepth(1, layout);
    await openApp('/P-D-UC01?view=graph', { data: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expectFade(layout, 'P-D-UC01'), { timeout: 3000 });
    const places = expectFade(layout, 'P-D-UC01');
    // The picture has all three: the focus's subtree, the levels above it and other boxes beside it.
    expect(places.subtree).toBeGreaterThan(1);
    expect(places.ancestor).toBeGreaterThan(0);
    expect(places.other).toBeGreaterThan(0);

    // A faded box still answers a click, which makes it the focus: the fade follows, and the old focus fades.
    const map = mapOf(layout);
    const faded = scene().boxes.find((b) => placeOf(map, 'P-D-UC01', b.id) === 'other' && placeOf(map, b.id, 'P-D-UC01') === 'other' && b.id.startsWith('P-') && boxElement(b.id));
    expect(faded, `${layout}: a faded box to click`).toBeDefined();
    fireEvent.click(boxElement(faded!.id)!);
    await waitFor(() => expect(isCenter(faded!.id)).toBe(true));
    await waitFor(() => expectFade(layout, faded!.id), { timeout: 3000 });
    expect(scene().boxes.find((b) => b.id === faded!.id)!.strength).toBe(1);
  });

  it('LA-V93-R73-T01 A trace keeps its own highlighting: every box at full strength', async () => {
    startAtDepth(1);
    await openApp('/P-D-UC01-R01?view=graph', { data: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trace mode' }));
    await waitFor(() => expect(scene().layout).toBe('trace'));
    expect(scene().boxes.length).toBeGreaterThan(1);
    for (const b of scene().boxes) expect(b.strength, b.id).toBe(1);
  });
});
