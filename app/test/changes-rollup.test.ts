import { describe, expect, it } from 'vitest';
import { changedInReadingOrder, stepChange } from '../src/changes/jump';
import { anchorOf, navChanges, rollUps, rollupShort, rollupText, type Change } from '../src/changes/rollup';
import { changesPastEdges } from '../src/graph/paint';

// Highlight changes (LA-EXP-UC15): the roll-ups on every container and in the nav, the hints for changes past the canvas's
// edges, and the walk Next change and Previous change make through the changed records.

/** A small tree: a domain holding two folders, one of them holding two records. */
const NODES = new Map<string, { parent: string | null }>([
  ['D', { parent: null }],
  ['D-A', { parent: 'D' }],
  ['D-B', { parent: 'D' }],
  ['D-A-1', { parent: 'D-A' }],
  ['D-A-2', { parent: 'D-A' }],
]);

describe('LA-EXP-UC15-R07 every container rolls up its changes', () => {
  it('LA-EXP-UC15-R07-T01 counts the changes strictly under each container, writes them with the zeros left out, and counts the same for the nav', () => {
    const changes: Record<string, Change> = { 'D-A-1': 'added', 'D-A-2': 'changed', 'D-B': 'changed', 'D-A-3': 'removed' };
    // A removed record has no place: it counts under the nearest container its ID names.
    const up = anchorOf('D-A-3', (id) => NODES.has(id));
    expect(up).toBe('D-A');
    const rolls = rollUps(NODES, (place) => changes[place], [up]);
    expect(rolls.get('D-A')).toEqual({ added: 1, changed: 1, removed: 1 });
    expect(rolls.get('D')).toEqual({ added: 1, changed: 2, removed: 1 });
    // Nothing under a leaf or a place with no change under it.
    expect(rolls.has('D-A-1')).toBe(false);
    expect(rolls.has('D-B')).toBe(false);
    expect(rollupText(rolls.get('D')!)).toBe('1 new · 2 changed · 1 removed');
    expect(rollupText({ added: 0, changed: 5, removed: 0 })).toBe('5 changed');
    expect(rollupShort({ added: 3, changed: 5, removed: 1 })).toBe('+3 ~5 −1');
    expect(anchorOf('X', () => true)).toBeNull();
    expect(anchorOf('D-A-1-Q-7', (id) => id === 'D-A')).toBe('D-A');

    const index = { byId: new Map([['D', { domain: null }], ['D-A', { domain: 'D' }], ['D-B', { domain: 'D' }], ['D-A-1', { domain: 'D' }], ['D-A-2', { domain: 'D' }]]) };
    const nav = navChanges(index, new Map(Object.entries(changes).map(([id, change]) => [id, { change }])));
    expect(nav.ofRecords(['D-A-1', 'D-A-2'])).toEqual({ added: 1, changed: 1, removed: 0 });
    expect(nav.ofRecords(['D-A'])).toEqual({ added: 0, changed: 0, removed: 1 });
    expect(nav.ofRecords(['D-B'])).toEqual({ added: 0, changed: 1, removed: 0 });
    expect(nav.ofRecords([])).toBeUndefined();
    expect(nav.ofDomain('D')).toEqual({ added: 1, changed: 2, removed: 1 });
    expect(nav.ofDomain('Z')).toBeUndefined();
  });
});

describe('LA-EXP-UC15-R08 changes out of view are pointed to', () => {
  it('LA-EXP-UC15-R08-T01 counts the changed boxes past each edge of the open canvas by their centers', () => {
    const cam = { cx: 100, cy: 100, zoom: 1, w: 200, h: 200 };
    const open = { left: 0, top: 0, right: 200, bottom: 200 };
    const box = (x: number, y: number) => ({ x, y, w: 10, h: 10 });
    const past = changesPastEdges([box(100, 100), box(-50, 100), box(-60, 90), box(300, 100), box(100, 400), box(-50, -50)], cam, open);
    // The first lies inside; two lie left; one right; one below; one up and left.
    expect(past).toEqual({ left: 3, right: 1, up: 1, down: 1 });
    expect(changesPastEdges([box(100, 100)], cam, open)).toEqual({ left: 0, right: 0, up: 0, down: 0 });
    // A floating panel over the left of the canvas moves its edge in: a box under it counts as past the left.
    expect(changesPastEdges([box(10, 100)], cam, { ...open, left: 120 }).left).toBe(1);
  });
});

describe('LA-EXP-UC15-R09 Next change and Previous change walk the changes', () => {
  it('LA-EXP-UC15-R09-T01 steps through the changed records in ID order from the focus, around at the ends, with numbers compared by value', () => {
    const walk = changedInReadingOrder(['T-UC10', 'T-UC2', 'T-UC10', 'T-UC1']);
    expect(walk).toEqual(['T-UC1', 'T-UC2', 'T-UC10']);
    expect(stepChange(walk, 'T-UC1', 1)).toEqual({ id: 'T-UC2', at: 1 });
    expect(stepChange(walk, 'T-UC10', 1)).toEqual({ id: 'T-UC1', at: 0 });
    expect(stepChange(walk, 'T-UC1', -1)).toEqual({ id: 'T-UC10', at: 2 });
    expect(stepChange(walk, 'T-UC2', -1)).toEqual({ id: 'T-UC1', at: 0 });
    // From a focus that is no change: the next one after it in the order, the previous one before it.
    expect(stepChange(walk, 'T-UC3', 1)).toEqual({ id: 'T-UC10', at: 2 });
    expect(stepChange(walk, 'T-UC3', -1)).toEqual({ id: 'T-UC2', at: 1 });
    expect(stepChange(walk, 'T', 1)).toEqual({ id: 'T-UC1', at: 0 });
    expect(stepChange(walk, 'T', -1)).toEqual({ id: 'T-UC10', at: 2 });
    expect(stepChange(walk, 'Z', 1)).toEqual({ id: 'T-UC1', at: 0 });
    expect(stepChange([], 'T-UC1', 1)).toBeNull();
  });
});
