import { describe, expect, it } from 'vitest';
import type { ErdBox, ErdFocus, ErdMap, Rect } from '../src/erd/erd';
import { erdTarget } from '../src/erd/walk';
import { nearestBox, readingOrder, type Move } from '../src/views/levels';

// The ERD stage's walk by the picture (LA-V61-R49): the levels product › region › aggregate area › entity, each arrow
// to the nearest sibling that way, going on to the next area's first box at an area's edge; Out and In between levels.
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
  lines: [] };
const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const RECTS = new Map<string, Rect>([
  ['D1', r(0, 0, 600, 400)], ['A1', r(20, 40, 260, 220)], ['E1', r(34, 80, 210, 60)], ['E2', r(34, 180, 210, 60)],
  ['A2', r(320, 40, 260, 200)], ['E3', r(334, 80, 210, 60)], ['A3', r(320, 280, 210, 52)],
  ['D2', r(700, 0, 400, 300)], ['A4', r(720, 40, 240, 200)], ['E4', r(734, 90, 210, 60)],
  ['D3', r(0, 500, 210, 52)],
]);
const scopeOf = (id: string) => (id.startsWith('E') ? MAP.boxes.find((b) => b.id === id)!.parent! : id);
const from = (pick: string): ErdFocus => ({ product: 'P', scope: scopeOf(pick), pick });
const step = (pick: string, move: Move) => erdTarget(MAP, RECTS, from(pick), move);

describe('the ERD walk', () => {
  it('LA-V61-R49-T04 The ERD arrows move among a box\'s siblings by the picture, going on to the next area at its edge; Out and In move between the levels', () => {
    // Inside an aggregate's area: E1 Down is E2, Up back.
    expect(step('E1', 'down')).toBe('E2');
    expect(step('E2', 'up')).toBe('E1');
    // At the area's edge it goes on to the next area's first entity in reading order (Right and Down), or the previous
    // area's last (Left and Up): E1 Right is E3 in A2, E3 Right is E4 in the next region's area, E4 Left back to E3.
    expect(step('E1', 'right')).toBe('E3');
    expect(step('E2', 'right')).toBe('E3');
    expect(step('E3', 'right')).toBe('E4');
    expect(step('E4', 'left')).toBe('E3');
    expect(step('E3', 'left')).toBe('E2');
    expect(step('E1', 'up')).toBeNull();
    expect(step('E4', 'right')).toBeNull();
    // An aggregate walks among the aggregates of its region, then on to the next region's.
    expect(step('A1', 'right')).toBe('A2');
    expect(step('A2', 'down')).toBe('A3');
    expect(step('A2', 'right')).toBe('A4');
    expect(step('A4', 'left')).toBe('A3');
    // A region among regions.
    expect(step('D1', 'right')).toBe('D2');
    expect(step('D1', 'down')).toBe('D3');
    expect(step('D3', 'up')).toBe('D1');
    // Out to the box around, In to the first box inside in reading order; a closed box holds nothing.
    expect(step('E2', 'out')).toBe('A1');
    expect(step('A1', 'out')).toBe('D1');
    expect(step('D1', 'out')).toBe('P');
    expect(step('D1', 'in')).toBe('A1');
    expect(step('A1', 'in')).toBe('E1');
    expect(step('A3', 'in')).toBeNull();
    expect(step('E1', 'in')).toBeNull();
    // A focus that picks out no box walks from its scope's region; from the product an arrow goes in: Right and Down to
    // the first region, Left and Up to the last, and In to the first.
    expect(erdTarget(MAP, RECTS, { product: 'P', scope: 'D2', pick: null }, 'left')).toBe('D1');
    expect(erdTarget(MAP, RECTS, { product: 'P', scope: 'P', pick: null }, 'right')).toBe('D1');
    expect(erdTarget(MAP, RECTS, { product: 'P', scope: 'P', pick: null }, 'up')).toBe('D3');
    expect(erdTarget(MAP, RECTS, { product: 'P', scope: 'P', pick: null }, 'in')).toBe('D1');
    expect(erdTarget(MAP, RECTS, { product: 'P', scope: 'P', pick: null }, 'out')).toBeNull();
  });

  it('LA-V61-R49-T04 The nearest box prefers one in the row or column, then the shortest distance between centers; reading order runs in rows', () => {
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
    // Reading order: rows top to bottom, a box a little lower still in the row, each row left to right.
    const boxes = [{ id: 'c', rect: r(0, 200, 50, 50) }, { id: 'b', rect: r(300, 10, 50, 50) }, { id: 'a', rect: r(0, 0, 50, 50) }];
    expect(readingOrder(boxes).map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });
});
