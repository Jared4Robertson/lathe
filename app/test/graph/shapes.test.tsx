import './setup';
import { describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Legend } from '../../src/graph/panel';
import { NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { parentLine } from '../../src/graph/map';
import { MARKS, outlineInset, outlinePolygon, shapeOf, shapeVars, SHAPES, type Shape } from '../../src/graph/shapes';
import { BORDER, LABEL_PAD, LABEL_PAD_BLOCK, labelHeight, wrapLabel } from '../../src/graph/text';
import { openApp, startAtDepth } from '../helpers';
import { testWorkspace } from './workspace';

// A shape for each kind (LA-EXP-DR65), a domain's hexagon among them (LA-EXP-DR61): outlines that
// grow with the box and keep its label clear, and tree lines that meet them.

/** The shapes the brief's table gives each kind, and the marks that tell two kinds of one shape apart. */
const TABLE: Record<string, [Shape, string?]> = {
  product: ['product'], domain: ['hexagon'], capability: ['slice'], aggregate: ['double'], entity: ['box'],
  domain_rule: ['octagon'], pattern_rule: ['octagon'], domain_event: ['flag'], use_case: ['stadium'], requirement: ['page'],
  interaction_requirement: ['page', 'marker'], pattern: ['stack'], flow: ['chevron-bar'], flow_step: ['chevron'],
  design_step: ['chevron'], view: ['window'], endpoint: ['port'], api: ['box', 'port'], integration: ['box', 'port'],
  layer: ['stripes'], component: ['component'], test: ['shield'], design_flow: ['chevron-bar', 'gear'],
  question: ['diamond'], fitness: ['circle'], standard: ['stack', 'ruler'], standard_rule: ['octagon', 'ruler'],
};

describe('a shape for each kind', () => {
  it('LA-EXP-T174 A domain node has the hexagon class and its outline, and the tree lines meet that outline', async () => {
    // The chamfer grows with the box scale, at most a quarter of the width.
    const chamfer = (w: number, h: number, scale: number) => outlineInset({ x: 0, y: 0, w, h }, 'hexagon', scale, 0, 'left');
    expect(chamfer(NODE_WIDTH, NODE_HEIGHT, 1)).toBe(12);
    expect(chamfer(NODE_WIDTH * 3, NODE_HEIGHT * 10, 3)).toBe(36);
    expect(chamfer(40, 4000, 1)).toBe(10);
    expect(outlinePolygon('hexagon', NODE_WIDTH, NODE_HEIGHT, 1)).toBe('polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)');
    // A line out of a domain starts on its outline: at the point's tip in its middle, on the slanted side above and below.
    const domain = { x: 0, y: 0, w: 400, h: 1000 };
    const c = chamfer(400, 1000, 2.1);
    expect(outlineInset(domain, 'hexagon', 2.1, 500, 'right')).toBe(0);
    expect(parentLine(domain, { x: 600, y: 472, w: NODE_WIDTH, h: NODE_HEIGHT }, 'hexagon')[0].x).toBe(400);
    expect(parentLine(domain, { x: 600, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT }, 'hexagon')[0].x).toBeCloseTo(400 - c * (1 - 28 / 500), 6);
    // A line into a domain meets the tip of its point, at its middle.
    expect(parentLine({ x: -500, y: 0, w: 200, h: 4000 }, domain, 'box', 'hexagon')[1]).toEqual({ x: 0, y: 500 });
    // A box's outline is its edge.
    expect(outlineInset(domain, 'box', 1, 0, 'left')).toBe(0);

    // On the page a domain carries the hexagon's class and outline; every node carries its kind's shape.
    cleanup();
    startAtDepth(1);
    await openApp('/P?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="P-D"] .graph-node')).not.toBeNull());
    const domainNode = document.querySelector<HTMLElement>('.react-flow__node[data-id="P-D"] .graph-node')!;
    expect(domainNode).toHaveClass('shape-hexagon', 'is-clipped');
    expect(domainNode.style.getPropertyValue('--outline')).toMatch(/^polygon\(/);
    expect(document.querySelector('.react-flow__node[data-id="P"] .graph-node')).toHaveClass('shape-product');
    expect(document.querySelector('.react-flow__node[data-id="P"] .graph-node')).not.toHaveClass('is-clipped');
    expect(document.querySelectorAll('.graph-node.shape-hexagon')).toHaveLength(document.querySelectorAll('.graph-node.kind-domain').length);
  });

  it('LA-EXP-T201 Every kind is drawn in its own shape, a group as a folder and a kind a product adds as a plain box, each shape keeping its label and badge clear of its notches and corners at every size, and the key shows every shape and mark', () => {
    // Every kind of the meta-model has the shape (and mark) the table gives it.
    for (const { kind } of testWorkspace().kinds) {
      expect(TABLE[kind], `${kind} is in the table`).toBeDefined();
      expect(shapeOf(kind), kind).toEqual(TABLE[kind][1] ? { shape: TABLE[kind][0], mark: TABLE[kind][1] } : { shape: TABLE[kind][0] });
    }
    expect(shapeOf('anything', true)).toEqual({ shape: 'folder' });
    expect(shapeOf('a_kind_a_product_adds')).toEqual({ shape: 'box' });
    // Every shape and mark is used by some kind, or by a group, and named in the key.
    const used = new Set(['folder', ...Object.values(TABLE).map(([s]) => s)]);
    for (const shape of Object.keys(SHAPES)) expect(used.has(shape), shape).toBe(true);
    for (const mark of Object.keys(MARKS)) expect(Object.values(TABLE).some(([, m]) => m === mark), mark).toBe(true);
    const key = render(<Legend />).container;
    for (const shape of Object.keys(SHAPES)) expect(key.querySelector(`.graph-swatch.shape-${shape}`)?.closest('li')?.textContent, shape).toContain(SHAPES[shape as Shape].name);
    for (const mark of Object.keys(MARKS)) expect(key.querySelector(`.graph-swatch.mark-${mark} .graph-mark-icon`), mark).not.toBeNull();
    cleanup();

    // The safe area: a label's lines, where the stylesheet pads them (the padding and the shape's room, at the text
    // scale), and its badge at the top right (a circle's at the end of its kind and ID line), lie inside the outline,
    // on a leaf and on boxes grown with their level. The text scale is never below the box scale.
    const BADGE = { w: 15, h: 15, top: 3, right: 8 };
    // A circle's label is centered and its box made tall enough (an ellipse's corners are no place for text): checked on real labels.
    for (const words of [2, 6, 12, 20, 30]) {
      const label = wrapLabel({ title: Array(words).fill('fitness').join(' '), meta: 'Fitness · LA-F01' }, { shape: 'circle' });
      const h = Math.max(NODE_HEIGHT, labelHeight(label));
      const r = { x: 0, y: 0, w: NODE_WIDTH, h };
      const half = (labelHeight(label) - (label.pad ?? 0)) / 2 - BORDER - LABEL_PAD_BLOCK;
      for (const y of [h / 2 - half, h / 2 + half]) {
        expect(outlineInset(r, 'circle', 1, y, 'left'), `circle with ${words} words at ${y}`).toBeLessThanOrEqual(LABEL_PAD + SHAPES.circle.room.l);
      }
    }
    for (const shape of Object.keys(SHAPES) as Shape[]) {
      const { room } = SHAPES[shape];
      if (shape === 'circle') continue;
      for (const [w, h, scale, text] of [[NODE_WIDTH, NODE_HEIGHT, 1, 1], [NODE_WIDTH, 90, 1, 1], [NODE_WIDTH * 2, NODE_HEIGHT * 2, 2, 2], [NODE_WIDTH * 3, 2000, 3, 3], [NODE_WIDTH * 4, 400, 2, 4]]) {
        const r = { x: 0, y: 0, w, h };
        const inside = (x: number, y: number) => x >= outlineInset(r, shape, scale, y, 'left') - 0.01 && w - x >= outlineInset(r, shape, scale, y, 'right') - 0.01;
        const top = BORDER + (LABEL_PAD_BLOCK + room.t) * text;
        const bottom = h - BORDER - (LABEL_PAD_BLOCK + room.b) * text;
        const left = (LABEL_PAD + room.l) * text;
        const right = w - (LABEL_PAD + room.r) * text;
        // A label as tall as the box allows, at its full width.
        for (let i = 0; i <= 20; i++) {
          const y = top + ((bottom - top) * i) / 20;
          expect(inside(left, y) && inside(right, y), `${shape} ${w}x${h}: its label at ${y.toFixed(1)}`).toBe(true);
        }
        if (shape === 'circle') continue;
        const bx = w - (BADGE.right + room.r) * text;
        for (const y of [BADGE.top + room.t, BADGE.top + room.t + BADGE.h].map((v) => v * text)) {
          expect(inside(bx, y) && inside(bx - BADGE.w * text, y), `${shape} ${w}x${h}: its badge at ${y}`).toBe(true);
        }
      }
      // The outline the page draws: a clipped shape's polygon, its notch for what it draws inside, and its room.
      const vars = shapeVars(shape, NODE_WIDTH, NODE_HEIGHT, 1) ?? {};
      expect(Boolean(vars['--outline']), shape).toBe(SHAPES[shape].draw === 'clipped');
      for (const side of ['l', 'r', 't', 'b'] as const) expect(vars[`--room-${side}`] ?? 0, `${shape} room ${side}`).toBe(room[side]);
    }
  });
});
