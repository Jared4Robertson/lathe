import { describe, expect, it } from 'vitest';
import { panToward, pastEdges } from '../../src/graph/hints';

// The edge hints' arithmetic (hints.tsx), which the ERD stage's chips count and pan with.

describe('edge hints', () => {
  it('LA-V94-R06-T03 A box whose center lies past an edge counts for that edge, and a chip pans half the canvas that way', () => {
    const view = { x: 0, y: 0, zoom: 1 };
    expect(pastEdges([{ x: -10, y: 50 }, { x: 1200, y: -5 }, { x: 500, y: 900 }, { x: 500, y: 400 }], view, 1000, 800)).toEqual({ up: 1, down: 1, left: 1, right: 1 });
    // Seen through a zoomed and panned camera, the same box can lie inside.
    expect(pastEdges([{ x: -10, y: 50 }], { x: 100, y: 0, zoom: 2 }, 1000, 800)).toEqual({ up: 0, down: 0, left: 0, right: 0 });
    expect(panToward(view, 'right', 1000, 800)).toEqual({ x: -500, y: 0, zoom: 1 });
    expect(panToward(view, 'up', 1000, 800)).toEqual({ x: 0, y: 400, zoom: 1 });
  });
});
