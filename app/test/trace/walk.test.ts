import { describe, expect, it } from 'vitest';
import { indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { traceFocus, traceMap, type TraceMap } from '../../src/trace/lanes';
import { boxWords, focusOf, startOf, traceStep, type TraceAt } from '../../src/trace/walk';

// The Trace stage's walk (app/src/trace/walk.ts): the arrow keys move over the map as drawn, Right along a lane and
// Left back into the why tree, Up and Down in a column; a "+N more" opened by Right; a shared record keeping its lane.

/** The model product with test/lend.test.ts and eight more files under P-D-UC01-R01's test: its files column capped. */
function withFiles(extra = 8) {
  const data = modelWorkspace();
  const chain = data.chains.find((c) => c.obligation === 'P-D-UC01-R01')!;
  for (let n = 1; n <= extra; n++) chain.files.push({ path: `test/lend-${n}.test.ts`, named_by: ['P-D-UC01-R01-T01'] });
  return indexOf(data);
}

/** Walks a run of keys from a box, the map drawn with `open` open; each step's box id. */
function walk(map: TraceMap, from: TraceAt, keys: string[], open: number | null): string[] {
  const ids: string[] = [];
  let at: TraceAt | null = from;
  for (const key of keys) {
    at = at && traceStep(map, at, key, open);
    ids.push(at ? map.byKey.get(at.key)!.id : '-');
  }
  return ids;
}

describe('the Trace stage\'s walk', () => {
  it('LA-V61-R49-T05 On the Trace stage the arrows move over the map: Right along the lane, Left back into the why tree, Up and Down in the column, Right opening a "+N more", a shared record keeping its lane', () => {
    const index = withFiles();
    const map = traceMap(index, 'P');
    const lane = map.lanesOf.get('P-D-UC01-R01')![0];
    const here = traceFocus(map, index, 'P-D-UC01-R01');
    expect(here.open).toBe(lane);
    const start = { key: here.box!.key, lane };

    // Right one step along the lane, following its arrows; Left back, and past the obligation into the why tree.
    expect(walk(map, start, ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft'], lane)).toEqual(['P-D-UC01-FL01', 'P-D-UC01-FL01-S01', 'P-D-UC01-FL01', 'P-D-UC01-R01']);
    expect(walk(map, start, ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight'], lane)).toEqual(['P-D-UC01', 'P-D-CAP01', '-', '-', '-']);
    // A tree box's Right goes back down to the lane the walk came from.
    const up = traceStep(map, traceStep(map, start, 'ArrowLeft', lane)!, 'ArrowLeft', lane)!;
    expect(walk(map, up, ['ArrowRight', 'ArrowRight'], lane)).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    expect(map.byKey.get(traceStep(map, traceStep(map, up, 'ArrowRight', lane)!, 'ArrowRight', lane)!.key)!.lane).toBe(lane);

    // Up and Down: the next box down the column, then the same column in the next lane drawn: the lanes the open lane
    // covers are not, so Down from it goes past them.
    const obligationOf = (i: number) => map.lanes[i].boxes.find((b) => b.column === 'obligation')!.id;
    expect(walk(map, start, ['ArrowDown'], null)).toEqual([obligationOf(lane + 1)]);
    const below = map.lanes.findIndex((l, i) => i > lane && l.top > map.lanes[lane].open!.bottom);
    expect(below).toBeGreaterThan(lane + 1);
    expect(walk(map, start, ['ArrowDown'], lane)).toEqual([obligationOf(below)]);
    expect(walk(map, start, ['ArrowUp'], lane)).toEqual([lane > 0 ? obligationOf(lane - 1) : '-']);

    // The lane open: its files column holds every file, Down walks them all. Not open (the walk on a lane above), the
    // fifth box is "+N more", and Right on it lands on the first file it hides, its lane opening by its naming record.
    const files = map.lanes[lane].open!.boxes.filter((b) => b.column === 'files');
    expect(files.length).toBeGreaterThan(8);
    const firstFile = { key: files[0].key, lane };
    expect(walk(map, firstFile, Array(files.length - 1).fill('ArrowDown'), lane)).toEqual(files.slice(1).map((b) => b.id));
    const shut = walk(map, firstFile, ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown'], null);
    expect(shut.at(-1)).toBe(`more:${lane}:files`);
    const more = { key: map.lanes[lane].boxes.find((b) => b.role === 'more')!.key, lane };
    expect(boxWords(index, map.byKey.get(more.key)!)).toBe(`+${files.length - 4} more in Files: Right or Enter shows them`);
    const opened = traceStep(map, more, 'ArrowRight', null)!;
    expect(opened.key).toBe(files[4].key);
    expect(focusOf(map, opened, null)).toBe('P-D-UC01-R01-T01');
    expect(traceFocus(map, index, 'P-D-UC01-R01-T01', lane).open).toBe(lane);
    // A box that is no record moves the ring alone; a record moves the focus.
    expect(focusOf(map, more, null)).toBeNull();
    expect(focusOf(map, start, lane)).toBe('P-D-UC01-R01');

    // A record several lanes hold keeps the lane the walk arrived on: focusing it there frames and opens that lane.
    const copies = map.copies.get('P-D-CMD01')!.filter((b) => b.lane >= 0);
    expect(new Set(copies.map((b) => b.lane)).size).toBeGreaterThan(1);
    const last = copies.at(-1)!;
    const arrived = traceFocus(map, index, 'P-D-CMD01', last.lane);
    expect(arrived.box).toBe(last);
    expect(arrived.anchor).toMatchObject({ x: last.x, y: last.y });
    expect(walk(map, { key: last.key, lane: last.lane }, ['ArrowLeft'], arrived.open).every((id) => map.copies.get(id)!.some((b) => b.lane === last.lane))).toBe(true);

    // A focus with no box of its own (the product, a domain) starts the walk at its first lane's obligation.
    expect(map.byKey.get(startOf(map, traceFocus(map, index, 'P-D').lanes)!.key)!.column).toBe('obligation');
  });
});
