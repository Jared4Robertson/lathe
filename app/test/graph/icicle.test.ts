import { describe, expect, it } from 'vitest';
import { COLUMN_GAP, contentScale, drawnTree, layoutNeighborhood, NODE_HEIGHT, NODE_WIDTH, ROW_GAP } from '../../src/graph/layout';
import { edgePoints, tweenEdge } from '../../src/graph/motion';
import { MORE_KIND, neighborhood, traceChain, type Neighborhood } from '../../src/graph/model';
import { indexWorkspace } from '../../src/specs/data';
import { manyOfOneKindWorkspace, testIndex } from './workspace';

// The hierarchy is an icicle (LA-BRW-DR330): each parent exactly as tall as its children stacked,
// each child right beside it, joined by a short level line; a tall node's content grows with it as
// far as the column allows (LA-BRW-DR331).

const index = testIndex();

/** Every picture the tests lay out: a domain, a stage, a record and a folder, depths 1 to 3, Links off and on. */
function pictures(): Neighborhood[] {
  const crowded = indexWorkspace(manyOfOneKindWorkspace());
  const out: Neighborhood[] = [];
  for (const depth of [1, 2, 3]) {
    for (const links of [false, true]) {
      for (const focus of ['P-D', 'P-D/define', 'P-D-UC01', 'P-D-UC01-R01']) out.push(neighborhood(index, focus, depth, undefined, undefined, { links }));
      for (const focus of [...crowded.byId.keys()].slice(0, 3)) out.push(neighborhood(crowded, focus, depth, undefined, undefined, { links }));
    }
  }
  return out;
}

describe('the icicle', () => {
  it('LA-BRW-T640 A parent is as tall as its children stacked, starting at its top, each child beside it, nothing overlapping', () => {
    for (const n of pictures()) {
      const { positions, heights } = layoutNeighborhood(n);
      expect(positions.size).toBe(n.nodes.length);
      const { childrenOf } = drawnTree(n);
      for (const node of n.nodes) {
        const kids = childrenOf.get(node.id) ?? [];
        const p = positions.get(node.id)!;
        if (kids.length === 0) {
          // A leaf, a chip, and a node whose children are not drawn: one node high.
          expect(heights.get(node.id)).toBe(NODE_HEIGHT);
          continue;
        }
        expect(heights.get(node.id)).toBe(kids.reduce((s, k) => s + heights.get(k)!, 0) + ROW_GAP * (kids.length - 1));
        // The stack starts at the parent's top edge, in the tree's order, one column to the right.
        let y = p.y;
        for (const k of kids) {
          expect(positions.get(k)).toEqual({ x: p.x + NODE_WIDTH + COLUMN_GAP, y });
          y += heights.get(k)! + ROW_GAP;
        }
      }
      for (const chip of n.nodes.filter((x) => x.kind === MORE_KIND)) expect(heights.get(chip.id)).toBe(NODE_HEIGHT);
      // The center's middle is at the origin.
      expect(positions.get(n.focus)).toEqual({ x: -NODE_WIDTH / 2, y: -heights.get(n.focus)! / 2 });
      // One x per column, a column apart.
      for (const node of n.nodes) expect(positions.get(node.id)!.x - positions.get(n.focus)!.x).toBe((node.column - n.nodes.find((x) => x.id === n.focus)!.column) * (NODE_WIDTH + COLUMN_GAP));
      // No two boxes overlap, records the Links switch brings included.
      const boxes = [...positions].map(([id, b]) => ({ id, ...b, h: heights.get(id)! }));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        if (a.x !== b.x) continue;
        expect(a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} and ${b.id} overlap`).toBe(true);
      }
      // The same picture always gives the same layout.
      expect(layoutNeighborhood(n)).toEqual({ positions, heights });
    }
  });

  it('LA-BRW-T640 At depth 1 the parent spans only the center; a domain spans its stages', () => {
    const n = neighborhood(index, 'P-D-UC01-R01', 1, undefined, undefined, { context: false });
    const { heights } = layoutNeighborhood(n);
    expect(heights.get('P-D-UC01')).toBe(heights.get('P-D-UC01-R01'));
    const domain = neighborhood(index, 'P-D', 2);
    const laid = layoutNeighborhood(domain);
    for (const s of ['P-D/define', 'P-D/design']) expect(laid.heights.get(s)!).toBeGreaterThan(NODE_HEIGHT);
    expect(laid.heights.get('P-D')).toBeGreaterThan(laid.heights.get('P-D/define')! + laid.heights.get('P-D/design')!);
  });

  it("LA-BRW-T640 A trace's columns stay stacks of leaf-high boxes", () => {
    const { heights, positions } = layoutNeighborhood(traceChain(index, 'P-D-UC01-R01'));
    expect(new Set(heights.values())).toEqual(new Set([NODE_HEIGHT]));
    expect(positions.get('P-D-UC01-R01')).toEqual({ x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
  });
});

describe("a tall node's content", () => {
  it('LA-BRW-T641 grows with its height, as far as the column allows, never below 1', () => {
    const domain = ['Domain', '· LA-BRW'];
    expect(contentScale(NODE_HEIGHT, 'Browsing', domain)).toBe(1);
    expect(contentScale(NODE_HEIGHT / 2, 'Browsing', domain)).toBe(1);
    // Short text grows in step with the height, until the column's width stops it.
    const short = (h: number) => contentScale(h, 'Use', ['UC']);
    expect(short(NODE_HEIGHT * 1.5)).toBe(1.5);
    expect(short(NODE_HEIGHT * 1.5)).toBeLessThan(short(NODE_HEIGHT * 2));
    const capped = short(NODE_HEIGHT * 50);
    expect(capped).toBeLessThan(50);
    expect(short(NODE_HEIGHT * 100)).toBe(capped);
    // A long kind-and-ID line, a long title or a long word stops it sooner.
    const tall = NODE_HEIGHT * 10;
    expect(contentScale(tall, 'Use', ['Requirement · LA-BRW-UC20-R15'])).toBeLessThan(capped);
    expect(contentScale(tall, 'The graph is laid out in columns that follow the tree', ['UC'])).toBeLessThan(capped);
    expect(contentScale(tall, 'Supercalifragilistic', ['UC'])).toBeLessThan(capped);
    // Never below 1, however long.
    expect(contentScale(tall, 'x'.repeat(400), ['y'.repeat(200)])).toBe(1);
    // The kind-and-ID line fits the column at its scale (6.4 px a character, 50 px of padding and
    // marks): on one line, or, in a node tall enough for the extra line, broken between its parts,
    // so a record whose line is cut at a scale of 1 still grows.
    const meta = ['Use case', '· LA-BRW-UC20'];
    const s = contentScale(tall, 'Walk the model as a graph', meta);
    expect(s).toBeGreaterThan(1);
    expect(s * (Math.max(...meta.map((m) => m.length)) * 6.4 + 50)).toBeLessThanOrEqual(NODE_WIDTH);
    // Too short for the extra line, it grows only as far as the whole line fits on one.
    expect(contentScale(NODE_HEIGHT + 10, 'Walk the model as a graph', meta)).toBe(1);
  });
});

describe('a parent line', () => {
  it("LA-BRW-T642 runs level from the parent's right edge to the child's left edge, at the child's middle", () => {
    const parent = { x: 0, y: 0 };
    const child = { x: NODE_WIDTH + COLUMN_GAP, y: -150 };
    const ends = { source: parent, target: child, sourceHeight: 500, targetHeight: NODE_HEIGHT, tree: true };
    expect(edgePoints(ends)).toEqual([{ x: NODE_WIDTH / 2, y: -150 }, { x: NODE_WIDTH / 2 + COLUMN_GAP, y: -150 }]);
    // Level all through a tween, as the parent grows and the child moves.
    const to = { ...ends, source: { x: 0, y: 40 }, sourceHeight: 200, target: { x: NODE_WIDTH + COLUMN_GAP, y: 10 } };
    for (const t of [0, 0.3, 0.7, 1]) {
      const [a, b] = tweenEdge({ ends, opacity: 1 }, { ends: to, opacity: 1 }, t).points;
      expect(a.y).toBe(b.y);
      expect(b.x - a.x).toBe(COLUMN_GAP);
    }
    // A cross-link runs between the boxes' edges, their heights included: it leaves a tall box at its bottom edge.
    const [out] = edgePoints({ source: { x: 0, y: 0 }, target: { x: 10, y: 1000 }, sourceHeight: 400 });
    expect(out.y).toBe(200);
  });
});
