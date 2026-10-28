import './setup';
import { indexOf } from '../fixtures/load';
import { describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Legend } from '../../src/graph/panel';
import { NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { parentLine } from '../../src/graph/map';
import { MARKS, outlineInset, outlineOf, shapeOf, SHAPES, type Shape } from '../../src/graph/shapes';
import { BORDER, LABEL_PAD, LABEL_PAD_BLOCK } from '../../src/graph/text';
import { openApp, startAtDepth } from '../helpers';
import { testWorkspace } from './workspace';
import { drawnBox, scene } from './scene';

// A shape for each kind (LA-V93-R06), a domain's hexagon among them (LA-V93-R05): outlines that
// grow with the box and keep its label clear, and tree lines that meet them.

/** The shapes the brief's table gives each kind, and the marks that tell two kinds of one shape apart. */
const TABLE: Record<string, [Shape, string?]> = {
  product: ['product'], business_outcome: ['box', 'target'], test_data_set: ['box', 'data'], domain: ['hexagon'], aggregate: ['double'], entity: ['box'], value_object: ['box', 'value'],
  constraint: ['octagon'], invariant: ['octagon'], specification: ['octagon'], domain_event: ['flag'], command: ['parallelogram'],
  read_model: ['box', 'lens'], query: ['parallelogram', 'lens'], policy: ['octagon', 'gear'], domain_service: ['box', 'gear'],
  term: ['box', 'marker'], capability: ['slice'], use_case: ['stadium'], uc_requirement: ['page'], pattern: ['stack'],
  pattern_rule: ['octagon'], interface: ['window', 'plug'], flow: ['chevron-bar'], flow_step: ['chevron'], view: ['window'], view_requirement: ['page'],
  endpoint: ['port'], api_requirement: ['page'], integration: ['box', 'port'], repository: ['component'], data_model: ['component'],
  table: ['stripes'], value_type: ['component'], predicate: ['component'], event_type: ['component'], projection: ['component'],
  command_handler: ['component'], query_handler: ['component'], event_handler: ['component'], service: ['component'],
  ui_component: ['component'], endpoint_handler: ['component'], adapter: ['component'], standard: ['stack', 'ruler'],
  standard_rule: ['octagon', 'ruler'], constraint_test: ['shield'], invariant_test: ['shield'], specification_test: ['shield'],
  policy_test: ['shield'], domain_service_test: ['shield'], use_case_test: ['shield'], view_test: ['shield'], endpoint_test: ['shield'],
  flow_test: ['shield'], integration_test: ['shield'], pattern_rule_test: ['shield'], standard_rule_test: ['shield'], question: ['diamond'],
};

describe('a shape for each kind', () => {
  it.each(['LA-V93-R12-T02', 'LA-V93-R05-T01'])('%s A domain node has the hexagon class and its outline, and the tree lines meet that outline', async () => {
    // The chamfer grows with the box scale, at most a quarter of the width.
    const chamfer = (w: number, h: number, scale: number) => outlineInset({ x: 0, y: 0, w, h }, 'hexagon', scale, 0, 'left');
    expect(chamfer(NODE_WIDTH, NODE_HEIGHT, 1)).toBe(12);
    expect(chamfer(NODE_WIDTH * 3, NODE_HEIGHT * 10, 3)).toBe(36);
    expect(chamfer(40, 4000, 1)).toBe(10);
    expect(outlineOf('hexagon', { x: 0, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT }, 1)).toEqual({ kind: 'polygon', points: [[12, 0], [NODE_WIDTH - 12, 0], [NODE_WIDTH, NODE_HEIGHT / 2], [NODE_WIDTH - 12, NODE_HEIGHT], [12, NODE_HEIGHT], [0, NODE_HEIGHT / 2]] });
    // A line out of a domain starts on its outline: at the point's tip in its middle, on the slanted side above and below.
    // A box's outline grows with its text scale (LA-EXP-DS06).
    const domain = { x: 0, y: 0, w: 400, h: 1000, text: 2.1 };
    const c = chamfer(400, 1000, 2.1);
    expect(outlineInset(domain, 'hexagon', 2.1, 500, 'right')).toBe(0);
    expect(parentLine(domain, { x: 600, y: 472, w: NODE_WIDTH, h: NODE_HEIGHT, text: 1 }, 'hexagon')[0].x).toBe(400);
    expect(parentLine(domain, { x: 600, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT, text: 1 }, 'hexagon')[0].x).toBeCloseTo(400 - c * (1 - 28 / 500), 6);
    // A line into a domain meets the tip of its point, at its middle.
    expect(parentLine({ x: -500, y: 0, w: 200, h: 4000, text: 1 }, domain, 'box', 'hexagon')[1]).toEqual({ x: 0, y: 500 });
    // A box's outline is its edge.
    expect(outlineInset(domain, 'box', 1, 0, 'left')).toBe(0);

    // On the canvas a domain is drawn as the hexagon, its outline the polygon; every node in its kind's shape.
    cleanup();
    startAtDepth(1);
    await openApp('/P?view=graph', { data: testWorkspace() });
    await waitFor(() => expect(drawnBox('P-D')).toBeDefined());
    expect(drawnBox('P-D')!.shape).toBe('hexagon');
    expect(drawnBox('P-D')!.polygon).toHaveLength(6);
    expect(drawnBox('P')!.shape).toBe('product');
    expect(drawnBox('P')!.polygon).toBeNull();
    const boxes = scene().boxes;
    expect(boxes.filter((b) => b.shape === 'hexagon')).toHaveLength(boxes.filter((b) => b.kind === 'domain').length);
  });

  it.each(['LA-V93-R12-T04', 'LA-V93-R06-T01'])('%s Every kind is drawn in its own shape, a group as a folder and a kind a product adds as a plain box, each shape keeping its label and badge clear of its notches and corners at every size, and the key shows every shape and mark', () => {
    // Every kind of the meta-model has the shape (and mark) the table gives it.
    for (const { kind } of indexOf(testWorkspace()).workspace.kinds) {
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
    // scale), and its badge at the top right, lie inside the outline,
    // on a leaf and on boxes grown with their level. The text scale is never below the box scale.
    const BADGE = { w: 15, h: 15, top: 3, right: 8 };
    for (const shape of Object.keys(SHAPES) as Shape[]) {
      const { room } = SHAPES[shape];
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
        const bx = w - (BADGE.right + room.r) * text;
        for (const y of [BADGE.top + room.t, BADGE.top + room.t + BADGE.h].map((v) => v * text)) {
          expect(inside(bx, y) && inside(bx - BADGE.w * text, y), `${shape} ${w}x${h}: its badge at ${y}`).toBe(true);
        }
      }
      // The outline the canvas draws: a polygon for a clipped shape, rounded corners for every other.
      expect(outlineOf(shape, { x: 0, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT }, 1).kind, shape).toBe(SHAPES[shape].draw === 'clipped' ? 'polygon' : 'round');
    }
  });
});
