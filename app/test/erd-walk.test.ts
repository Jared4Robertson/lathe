import { describe, expect, it } from 'vitest';
import type { ErdBox, ErdFocus, ErdMap, Rect } from '../src/erd/erd';
import { erdStep, nearestBox, type Direction } from '../src/erd/walk';

// The ERD stage's walk by the picture (LA-V61-R49): each arrow moves to the nearest box that way on
// the map, staying inside an aggregate before leaving it and crossing a region's edge into the next.
//
//   D1 (0,0 600x400)                         D2 (700,0 400x300)
//   ┌─────────────────────────────────┐      ┌───────────────────┐
//   │ A1             A2               │      │ A4                │
//   │ ┌─────────┐    ┌─────────┐      │      │ ┌─────────┐       │
//   │ │ E1      │    │ E3      │      │      │ │ E4      │       │
//   │ │ E2      │    └─────────┘      │      │ └─────────┘       │
//   │ └─────────┘    A3 (closed)      │      └───────────────────┘
//   └─────────────────────────────────┘
//   D3 (closed, 0,500)

const box = (id: string, kind: ErdBox['kind'], parent?: string, empty = false): ErdBox => ({ id, kind, title: id, root: false, fields: [], parent, empty });
const MAP: ErdMap = {
  product: 'P',
  boxes: [
    box('D1', 'domain'), box('A1', 'aggregate', 'D1'), box('E1', 'entity', 'A1'), box('E2', 'entity', 'A1'),
    box('A2', 'aggregate', 'D1'), box('E3', 'entity', 'A2'), box('A3', 'aggregate', 'D1', true),
    box('D2', 'domain'), box('A4', 'aggregate', 'D2'), box('E4', 'entity', 'A4'),
    box('D3', 'domain', undefined, true),
  ],
  lines: [],
};
const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const RECTS = new Map<string, Rect>([
  ['D1', r(0, 0, 600, 400)], ['A1', r(20, 40, 260, 220)], ['E1', r(34, 80, 210, 60)], ['E2', r(34, 180, 210, 60)],
  ['A2', r(320, 40, 260, 200)], ['E3', r(334, 80, 210, 60)], ['A3', r(320, 280, 210, 52)],
  ['D2', r(700, 0, 400, 300)], ['A4', r(720, 40, 240, 200)], ['E4', r(734, 90, 210, 60)],
  ['D3', r(0, 500, 210, 52)],
]);
const scopeOf = (id: string) => (id.startsWith('E') ? MAP.boxes.find((b) => b.id === id)!.parent! : id);
const from = (pick: string): ErdFocus => ({ product: 'P', scope: scopeOf(pick), pick });
const step = (pick: string, direction: Direction) => erdStep(MAP, RECTS, from(pick), direction);

describe('the ERD walk', () => {
  it('LA-V61-R49-T04 The ERD arrows move to the nearest box that way on the map, inside an aggregate first, across a region edge into the next', () => {
    // Inside an aggregate's area it stays inside: E1 Down is E2, and nothing lies above E1 inside it, nor anywhere.
    expect(step('E1', 'down')).toBe('E2');
    expect(step('E2', 'up')).toBe('E1');
    expect(step('E1', 'up')).toBeNull();
    // Leaving the aggregate, it stays in the region: E1 Right is E3, in its row in the next aggregate.
    expect(step('E1', 'right')).toBe('E3');
    // With nothing in its row, the nearest center that way: from E2, the closed aggregate A3 is nearer than E3.
    expect(step('E2', 'right')).toBe('A3');
    // At a region's edge it continues into the neighboring region, both ways.
    expect(step('E3', 'right')).toBe('E4');
    expect(step('E4', 'left')).toBe('E3');
    expect(step('E4', 'right')).toBeNull();
    // Down across the region's edge: from the closed aggregate into the closed region below.
    expect(step('A3', 'down')).toBe('D3');
    // An aggregate walks among aggregates, a region among regions.
    expect(step('A1', 'right')).toBe('A2');
    expect(step('A2', 'right')).toBe('A4');
    expect(step('D1', 'right')).toBe('D2');
    expect(step('D1', 'down')).toBe('D3');
    expect(step('D3', 'up')).toBe('D1');
    // A focus that picks out no box walks from its scope's region; the product enters at the corner the arrow comes from.
    expect(erdStep(MAP, RECTS, { product: 'P', scope: 'D2', pick: null }, 'left')).toBe('D1');
    expect(erdStep(MAP, RECTS, { product: 'P', scope: 'P', pick: null }, 'right')).toBe('D1');
    expect(erdStep(MAP, RECTS, { product: 'P', scope: 'P', pick: null }, 'up')).toBe('D2');
  });

  it('LA-V61-R49-T04 The nearest box prefers one in the row or column, then the shortest distance between centers', () => {
    const at = r(0, 0, 100, 40);
    // Far but in the row beats near but off it; among those in the row, the nearer.
    const row = [{ id: 'off', rect: r(120, 60, 100, 40) }, { id: 'far', rect: r(400, 10, 100, 40) }, { id: 'near', rect: r(200, 20, 100, 40) }];
    expect(nearestBox(at, row, 'right')).toBe('near');
    expect(nearestBox(at, row.slice(0, 2), 'right')).toBe('far');
    // Nothing that way: none; a box behind never counts.
    expect(nearestBox(at, row, 'left')).toBeNull();
    // Up and Down by the column.
    const column = [{ id: 'diagonal', rect: r(150, 60, 100, 40) }, { id: 'below', rect: r(50, 300, 100, 40) }];
    expect(nearestBox(at, column, 'down')).toBe('below');
  });
});
