import { describe, expect, it } from 'vitest';
import { indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';
import { gap } from '../fixtures/workspace';
import { traceMap, type TraceMap } from '../../src/trace/tree';
import { nodeWords, traceTarget } from '../../src/trace/walk';
import type { Move } from '../../src/views/levels';

// The Trace stage's walk (app/src/trace/walk.ts): the arrow keys move over the tree as on the Graph's Tree, Left out to
// the parent, Right in to the first child, Up and Down across the siblings and on past the last; each copy of a record a
// node of its own, so the walk stays in the chain it arrived in.

/** Walks a run of moves from a node; each step's node key. */
function walk(map: TraceMap, from: string, moves: Move[]): string[] {
  const keys: string[] = [];
  let at: string | null = from;
  for (const move of moves) {
    at = at && traceTarget(map, at, move);
    keys.push(at ?? '-');
  }
  return keys;
}

describe('the Trace stage\'s walk', () => {
  it('LA-V61-R49-T05 On the Trace stage the arrows walk the tree as the Graph\'s Tree: Left out, Right in, Up and Down across, a shared record keeping its copy', () => {
    const data = modelWorkspace();
    data.coverage[0].gaps.push(gap('P-D-SP01', 'specification', 'built'));
    const index = indexOf(data);
    const map = traceMap(index, 'P');

    // Right in to the first child, along the chain; Left back out; Out and In as Left and Right.
    expect(walk(map, 'P-D-UC01-R01', ['right', 'right', 'right', 'left', 'left', 'left'])).toEqual([
      'P-D-UC01-R01|P-D-UC01-FL01', 'P-D-UC01-R01|P-D-UC01-FL01-S01', 'P-D-UC01-R01|P-D-CMD01',
      'P-D-UC01-R01|P-D-UC01-FL01-S01', 'P-D-UC01-R01|P-D-UC01-FL01', 'P-D-UC01-R01',
    ]);
    expect(walk(map, 'P-D-UC01-R01', ['out', 'in'])).toEqual(['P-D-UC01', 'P-D-UC01-R01']);
    // Up and Down across the siblings, and on past the last to the next parent's first child at that level (a gap first).
    expect(walk(map, 'P-D-UC01-R01', ['down', 'up'])).toEqual(['P-D-UC01-R02', 'P-D-UC01-R01']);
    expect(walk(map, 'P-D-UC01-R01|P-D-UC01-FL01', ['down', 'down'])).toEqual(['P-D-UC01-R01|P-D-UC01-R01-T01', 'gap:P-D-UC01-R02:tests']);
    // A copy's walk stays in its chain: Left from the command in the requirement's chain goes back to that chain's step.
    expect(walk(map, 'P-D-SP01|P-D-CMD01', ['left'])).toEqual(['P-D-SP01']);
    expect(walk(map, 'P-D-UC01-R01|P-D-CMD01', ['left'])).toEqual(['P-D-UC01-R01|P-D-UC01-FL01-S01']);
    // A gap, a file and the Untraced mark are nodes too, each said in words.
    expect(walk(map, 'P-D-SP01', ['right'])).toEqual(['gap:P-D-SP01:build']);
    expect(nodeWords(index, map, map.nodes.get('gap:P-D-SP01:build')!)).toBe(`Not built, a gap of ${index.byId.get('P-D-SP01')!.title}`);
    expect(nodeWords(index, map, map.nodes.get('P-D-UC01-R01|file:test/lend.test.ts')!)).toBe('File test/lend.test.ts');
    expect(nodeWords(index, map, map.nodes.get('untraced')!)).toMatch(/^Untraced, \d+ records no chain reaches$/);
    // From the product an arrow goes in.
    expect(walk(map, 'P', ['right'])[0]).toBe(map.map.nodes.get('P')!.children[0]);
  });
});
