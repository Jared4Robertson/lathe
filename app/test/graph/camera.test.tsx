import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { NODE_HEIGHT, NODE_WIDTH, layoutNeighborhood } from '../../src/graph/layout';
import { anchorLayout, fadeSets, frameFocus, translate } from '../../src/graph/camera';
import { neighborhood } from '../../src/graph/model';
import { MOTION_SPEED_MS } from '../../src/graph/motion';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';

// Re-centering moves the camera, not the picture (LA-BRW-UC20-R09): the new layout is anchored on
// the clicked node (LA-BRW-DR180), the viewport glides to frame it on the shared motion
// (LA-BRW-DR181), records new to the picture fade in and leaving ones fade out, and under reduced
// motion nothing animates.

const calls = vi.hoisted(() => [] as { viewport: { x: number; y: number; zoom: number }; options?: { duration?: number; ease?: unknown; interpolate?: string } }[]);

// The page's viewport moves, recorded on their way to React Flow.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  const wrapped = new WeakMap<object, unknown>();
  return {
    ...actual,
    useReactFlow: () => {
      const flow = actual.useReactFlow();
      if (!wrapped.has(flow.setViewport)) {
        wrapped.set(flow.setViewport, (viewport: (typeof calls)[number]['viewport'], options?: (typeof calls)[number]['options']) => {
          calls.push({ viewport, options });
          return flow.setViewport(viewport, options as never);
        });
      }
      return { ...flow, setViewport: wrapped.get(flow.setViewport) };
    },
  };
});

const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const isCenter = (id: string) => !!node(id)?.querySelector('.graph-node.is-focus');
const at = (id: string) => node(id)!.style.transform;
const reducedMotion = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion: reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));

describe('graph camera', () => {
  it('LA-BRW-T380 The new layout is shifted so the clicked node keeps its world position, and is otherwise the layout as laid out', async () => {
    const index = testIndex();
    const before = (layoutNeighborhood(neighborhood(index, 'P-D-UC01', 1, undefined, undefined, { links: true }))).positions;
    const laid = (layoutNeighborhood(neighborhood(index, 'P-D-UC01-R01', 1, undefined, undefined, { links: true }))).positions;
    // The layout puts its focus at the origin; the clicked node was elsewhere.
    expect(laid.get('P-D-UC01-R01')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
    expect(before.get('P-D-UC01-R01')).not.toEqual(laid.get('P-D-UC01-R01'));
    const anchored = anchorLayout(laid, 'P-D-UC01-R01', before);
    expect(anchored.get('P-D-UC01-R01')).toEqual(before.get('P-D-UC01-R01'));
    // Every other node moves by the same offset: the picture is the same, translated.
    const dx = anchored.get('P-D-UC01-R01')!.x - laid.get('P-D-UC01-R01')!.x;
    const dy = anchored.get('P-D-UC01-R01')!.y - laid.get('P-D-UC01-R01')!.y;
    expect(anchored).toEqual(translate(laid, dx, dy));
    expect([...anchored.keys()]).toEqual([...laid.keys()]);
    // The same graph and anchor always give the same positions, and anchoring a picture on itself changes nothing.
    expect(anchorLayout((layoutNeighborhood(neighborhood(index, 'P-D-UC01-R01', 1, undefined, undefined, { links: true }))).positions, 'P-D-UC01-R01', before)).toEqual(anchored);
    expect(anchorLayout(anchored, 'P-D-UC01-R01', anchored)).toEqual(anchored);
    // With no last picture, or a focus that wasn't in it, the layout is kept as it is.
    expect(anchorLayout(laid, 'P-D-UC01-R01', null)).toEqual(laid);
    expect(anchorLayout(laid, 'P-D-UC01-R01', new Map([['P-D-V01', { x: 500, y: 500 }]]))).toEqual(laid);
  });

  it('LA-BRW-T381 Records new to the picture fade in and records leaving fade out; the first picture has neither', () => {
    expect(fadeSets(['A', 'B', 'C'], ['B', 'C', 'D', 'E'])).toEqual({ entering: new Set(['D', 'E']), leaving: new Set(['A']) });
    expect(fadeSets(['A', 'B'], ['B', 'A'])).toEqual({ entering: new Set(), leaving: new Set() });
    expect(fadeSets(null, ['A', 'B'])).toEqual({ entering: new Set(), leaving: new Set() });
  });

  it('LA-BRW-T382 The camera frames the focus: the whole picture fits, the focus is centered as far as the picture allows', () => {
    const box = (x: number, y: number) => ({ x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 });
    // A picture balanced around its focus: the focus lands in the middle of the canvas, at zoom 1.
    const balanced = new Map([['L', box(-300, 0)], ['F', box(0, 0)], ['R', box(300, 0)]]);
    expect(frameFocus(balanced, 'F', 1000, 800)).toEqual({ x: 500, y: 400, zoom: 1 });
    // A focus at the picture's left edge: centered vertically, and moved only as far as keeps the picture in view.
    const lopsided = new Map([['F', box(0, 0)], ['R', box(300, 0)], ['S', box(600, 0)]]);
    const view = frameFocus(lopsided, 'F', 1000, 800);
    expect(view.zoom).toBe(1);
    expect(view.y).toBe(400);
    expect(view.x + 600 + NODE_WIDTH / 2).toBe(1000 - 40); // the picture's right edge at the padding
    expect(view.x).toBeLessThan(500); // the focus as near the middle as that allows
    // A picture wider than the canvas zooms out to fit.
    expect(frameFocus(balanced, 'F', 400, 800).zoom).toBeLessThan(1);
  });
});

describe('graph camera on the page', () => {
  beforeEach(() => {
    calls.length = 0;
    // jsdom lays nothing out; the canvas is 1000 by 800.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Opens Lend a thing's graph at depth 1; with `links`, turns Links on and waits for the rule it applies. */
  async function open(links = true) {
    startAtDepth(1);
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    if (!links) return;
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-D-DR01')).not.toBeNull());
    await waitFor(() => expect(document.querySelector('.react-flow__node.is-leaving')).toBeNull());
  }

  it('LA-BRW-T383 A re-center keeps the clicked node in place, glides the camera with the shared duration, and fades records in and out', async () => {
    await open(false);
    // The first picture appears at once.
    expect(calls.every((c) => c.options?.duration === 0)).toBe(true);
    expect(document.querySelectorAll('.react-flow__node.is-entering')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Links' }));
    await waitFor(() => expect(node('P-D-DR01')).not.toBeNull());
    // The use case's folder is in focus, its stage faded beyond it.
    expect(node('P-D/define/use-cases')!.className).not.toContain('is-context');
    expect(node('P-D/define')!.className).toContain('is-context');
    const clickedAt = at('P-D-UC01-R01');
    const first = calls.length;

    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    // The world stays put: the clicked node is where it was.
    expect(at('P-D-UC01-R01')).toBe(clickedAt);
    // One camera move, from the view as it is, on the shared motion.
    await waitFor(() => expect(calls.length).toBe(first + 1));
    const move = calls[first];
    expect(move.options).toMatchObject({ duration: MOTION_SPEED_MS, interpolate: 'linear' });
    expect(typeof move.options!.ease).toBe('function');
    // The view and the test that link to the requirement are new; they fade in.
    expect(node('P-D-V01')!.className).toContain('is-entering');
    expect(node('P-D-T01')!.className).toContain('is-entering');
    expect(node('P-D-UC01')!.className).not.toContain('is-entering');
    // A hand-off: the use case's folder goes from focus to the faded ring, the same box, fading down as the camera moves.
    expect(node('P-D/define/use-cases')!.className).toContain('is-context');
    expect(node('P-D/define/use-cases')!.className).not.toContain('is-entering');
    // The stage that was the ring leaves, faded as it was.
    expect(node('P-D/define')?.className).toContain('is-context');
    expect(node('P-D/define')?.className).toContain('is-leaving');
    // The domain rule the use case applies leaves: it fades out where it was, the same box marked as leaving, and is then dropped.
    const leaving = node('P-D-DR01');
    expect(leaving).not.toBeNull();
    expect(leaving!.className).toContain('is-leaving');
    expect(leaving!.getAttribute('aria-hidden')).toBe('true');
    await waitFor(() => expect(document.querySelector('.react-flow__node.is-leaving')).toBeNull());
    expect(node('P-D-DR01')).toBeNull();
    expect(calls.length).toBe(first + 1);
  });

  it('LA-BRW-T384 Under reduced motion a re-center frames the new focus at once, and nothing fades', async () => {
    reducedMotion();
    await open();
    const first = calls.length;
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(calls.length).toBe(first + 1));
    expect(calls[first].options).toEqual({ duration: 0 });
    expect(document.querySelectorAll('.react-flow__node.is-entering, .react-flow__node.is-leaving')).toHaveLength(0);
  });
});
