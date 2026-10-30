import { describe, expect, it } from 'vitest';
import type { ErdBox, ErdLine, ErdMap, Rect } from '../src/erd/erd';
import { keepPlaces, layoutErd, readyErdLayout, erdLayout, tidyErdLayout } from '../src/erd/layout';
import { morphFrom } from '../src/graph/morph';
import { modelWorkspace } from './fixtures/model';
import { erdOf } from './erd-of';

// A change on the ERD moves only its aggregate's boundary or its domain's region (LA-PAT-APP-UX-R22): laid out after the
// product's layout before, each region and the product keep their boxes where they were; a box that grew pushes right or
// down only what it now overlaps; a new box goes beside the rest. Tidy up lays the whole map out afresh.

const modelMap = () => erdOf(modelWorkspace(), 'P');

const entity = (id: string, parent: string, title: string, fields = 1): ErdBox => ({
  id, parent, kind: 'entity', title, root: false, empty: false,
  fields: Array.from({ length: fields }, (_, i) => ({ field: `field${i}`, kind: 'string' })),
}) as ErdBox;
const line = (source: string, target: string, relation: ErdLine['relation']): ErdLine => ({
  id: `${source}-${relation}-${target}`, source, target, relation, sourceEnd: 'one', targetEnd: relation === 'has_many' ? 'many' : 'one', dashed: false, via: [],
}) as ErdLine;

/** Each change to the map, and the aggregates (or domains) whose insides it changes. */
const CHANGES: { name: string; edit: (m: ErdMap) => ErdMap; changed: string[]; still?: boolean }[] = [
  {
    name: 'adding an entity', changed: ['P-D-A3'],
    edit: (m) => ({ ...m, boxes: [...m.boxes, entity('P-D-EN07', 'P-D-A3', 'Fee', 3)], lines: [...m.lines, line('P-D-EN03', 'P-D-EN07', 'has_many')] }),
  },
  {
    name: 'removing an entity', changed: ['P-D-A3'], still: true,
    edit: (m) => ({ ...m, boxes: m.boxes.filter((b) => b.id !== 'P-D-EN05'), lines: m.lines.filter((l) => l.source !== 'P-D-EN05' && l.target !== 'P-D-EN05') }),
  },
  {
    name: 'renaming an entity to a title that wraps', changed: ['P-D-A4'],
    edit: (m) => ({ ...m, boxes: m.boxes.map((b) => (b.id === 'P-D-EN06' ? { ...b, title: 'Shelf in the back room by the long wall' } : b)) }),
  },
  {
    name: 'moving an entity to another aggregate', changed: ['P-D-A3', 'P-D-A2'],
    edit: (m) => ({ ...m, boxes: m.boxes.map((b) => (b.id === 'P-D-EN05' ? { ...b, parent: 'P-D-A2' } : b)) }),
  },
  {
    name: 'adding an aggregate to a region', changed: ['P-E-A2'],
    edit: (m) => ({ ...m, boxes: [...m.boxes, { ...m.boxes.find((b) => b.id === 'P-E-A1')!, id: 'P-E-A2', title: 'Ledger' }, entity('P-E-EN02', 'P-E-A2', 'Ledger', 2)] }),
  },
];

/** A box's place inside its parent. */
const inside = (rects: ReadonlyMap<string, Rect>, map: ErdMap, id: string) => {
  const r = rects.get(id)!;
  const parent = map.boxes.find((b) => b.id === id)?.parent;
  const p = parent ? rects.get(parent)! : { x: 0, y: 0 };
  return { x: r.x - p.x, y: r.y - p.y };
};
const overlaps = (a: Rect, b: Rect, gap: number) => a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;

/**
 * The boxes outside the changed boundaries that moved or changed size without cause: every box keeps its size but the
 * changed ones' holders, and its place inside its parent unless a sibling that changed or moved now overlaps where it was
 * (pushed, then only right or down).
 */
function movedWithoutCause(before: Map<string, Rect>, after: Map<string, Rect>, map: ErdMap, next: ErdMap, changed: readonly string[]): string[] {
  const parentOf = new Map([...map.boxes, ...next.boxes].map((b) => [b.id, b.parent]));
  const under = (id: string, of: string) => { for (let at: string | undefined = id; at; at = parentOf.get(at)) if (at === of) return true; return false; };
  const inChange = (id: string) => changed.some((c) => under(id, c));
  const holds = (id: string) => changed.some((c) => under(c, id));
  const wrong: string[] = [];
  const moved = new Set<string>();
  for (const b of next.boxes) {
    const [was, now] = [before.get(b.id), after.get(b.id)!];
    if (!was || inChange(b.id)) continue;
    if (!holds(b.id) && (was.width !== now.width || was.height !== now.height)) wrong.push(`${b.id} resized`);
    const [a, z] = [inside(before, map, b.id), inside(after, next, b.id)];
    if (a.x !== z.x || a.y !== z.y) moved.add(b.id);
  }
  for (const id of moved) {
    const parent = parentOf.get(id);
    const siblings = next.boxes.filter((b) => b.parent === parent && b.id !== id && (moved.has(b.id) || inChange(b.id) || holds(b.id) || !before.has(b.id)));
    const pushedBy = siblings.some((s) => overlaps(before.get(id)!, after.get(s.id)!, 40));
    const [a, z] = [inside(before, map, id), inside(after, next, id)];
    if (!pushedBy || z.x < a.x || z.y < a.y) wrong.push(`${id} moved`);
  }
  return wrong;
}

describe('LA-PAT-APP-UX-R22-T02 a change on the ERD moves only its aggregate\'s boundary or its domain\'s region', () => {
  it.each(CHANGES)('$name keeps every other box where it was, pushing only what it overlaps', async ({ edit, changed, still }) => {
    const map = modelMap();
    const before = await layoutErd(map);
    const next = edit(map);
    const after = await layoutErd(next, before);
    expect(movedWithoutCause(before, after, map, next, changed)).toEqual([]);
    // Every box of the new map is placed, and no two siblings overlap.
    for (const b of next.boxes) expect(after.get(b.id), b.id).toBeDefined();
    for (const a of next.boxes) for (const b of next.boxes) {
      if (a.id < b.id && a.parent === b.parent) expect(overlaps(after.get(a.id)!, after.get(b.id)!, 0), `${a.id} ${b.id}`).toBe(false);
    }
    // A box that shrank or left pushes nothing: every box outside the change keeps its exact place inside its parent.
    if (still) for (const b of next.boxes) if (!changed.some((c) => b.parent === c)) expect(inside(after, next, b.id), b.id).toEqual(inside(before, map, b.id));
  });

  it('LA-V94-R09-T01 new data that changes nothing it reads keeps every box exactly, and Tidy up lays the whole map out afresh', async () => {
    const map = modelMap();
    const fresh = await layoutErd(map);
    expect(await layoutErd(map, fresh)).toEqual(fresh);
    // After a change, Tidy up gives the picture a first layout gives.
    const next = CHANGES[0].edit(map);
    const tidied = await tidyErdLayout(next);
    expect(tidied).toEqual(await layoutErd(next));
    expect(readyErdLayout(next)).toBe(tidied);
  });

  it('LA-V94-R09-T01 a product laid out again keeps its places from the layout before', async () => {
    const map = { ...modelMap(), product: 'P-R22' };
    const first = await tidyErdLayout(map);
    const next = { ...CHANGES[2].edit(map), product: 'P-R22' };
    const after = await erdLayout(next);
    expect(movedWithoutCause(first, after, map, next, ['P-D-A4'])).toEqual([]);
  });

  it('keepPlaces keeps each box, pushes what a grown box overlaps, and puts a new box beside the rest', () => {
    const was: Record<string, Rect> = { a: { x: 0, y: 0, width: 100, height: 100 }, b: { x: 120, y: 0, width: 100, height: 100 }, c: { x: 0, y: 300, width: 100, height: 100 } };
    const laid = keepPlaces([{ id: 'a', width: 150, height: 100 }, { id: 'b', width: 100, height: 100 }, { id: 'c', width: 100, height: 100 }, { id: 'n', width: 50, height: 50 }], (id) => was[id], 20)!;
    const at = Object.fromEntries((laid.children ?? []).map((c) => [c.id, { x: c.x, y: c.y }]));
    expect(at.a).toEqual({ x: 0, y: 0 });
    expect(at.b).toEqual({ x: 170, y: 0 });
    expect(at.c).toEqual({ x: 0, y: 300 });
    expect(at.n).toEqual({ x: 290, y: 0 });
    expect(keepPlaces([{ id: 'z', width: 10, height: 10 }], () => undefined, 20)).toBeNull();
  });

  it('a box and its lines glide on the shared morph (graph/morph.ts): from where it was drawn to its new place, a new box at its place', () => {
    const at = (boxes: [string, number, number, number, number][]) => ({ view: 'erd', roots: ['P'], nodes: new Map(boxes.map(([id, x, y, w, h]) => [id, { x, y, w, h }])) });
    const before = morphFrom(null, at([['a', 0, 0, 100, 50]]), 0, 100, (t) => t);
    const after = morphFrom(before, at([['a', 100, 40, 120, 50], ['b', 0, 0, 10, 10]]), 0, 100, (t) => t);
    expect(after.from.get('a')).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(after.from.has('b')).toBe(false);
  });
});
