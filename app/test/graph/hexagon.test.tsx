import './setup';
import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { hexChamfer, outlineInset, parentLine } from '../../src/graph/map';
import { openApp, startAtDepth } from '../helpers';
import { testWorkspace } from './workspace';

// A domain is drawn as a hexagon (LA-BRW-DR394): flat top and bottom, pointed ends whose chamfer
// grows with the node's content scale, and tree lines that meet its outline.

describe('a domain is a hexagon', () => {
  it('LA-BRW-T745 A domain node has the hexagon class and its outline, and the tree lines meet that outline', async () => {
    // The chamfer grows with the content scale, at most a quarter of the width.
    expect(hexChamfer({ w: NODE_WIDTH, h: NODE_HEIGHT })).toBe(12);
    expect(hexChamfer({ w: NODE_WIDTH * 3, h: NODE_HEIGHT * 10 })).toBe(36);
    expect(hexChamfer({ w: 40, h: 4000 })).toBe(10);
    // A line out of a domain starts on its outline: at the point's tip in its middle, on the slanted side above and below.
    const domain = { x: 0, y: 0, w: 400, h: 1000 };
    const c = hexChamfer(domain);
    expect(outlineInset(domain, 'hexagon', 500)).toBe(0);
    expect(parentLine(domain, { x: 600, y: 472, w: NODE_WIDTH, h: NODE_HEIGHT }, 'hexagon')[0].x).toBe(400);
    expect(parentLine(domain, { x: 600, y: 0, w: NODE_WIDTH, h: NODE_HEIGHT }, 'hexagon')[0].x).toBeCloseTo(400 - c * (1 - 28 / 500), 6);
    // A line into a domain meets the tip of its point, at its middle.
    expect(parentLine({ x: -500, y: 0, w: 200, h: 4000 }, domain, 'box', 'hexagon')[1]).toEqual({ x: 0, y: 500 });
    // A box's outline is its edge.
    expect(outlineInset(domain, 'box', 0)).toBe(0);

    // On the page a domain carries the hexagon class; every other kind keeps its shape.
    startAtDepth(1);
    await openApp('/P?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="P-D"] .graph-node')).not.toBeNull());
    expect(document.querySelector('.react-flow__node[data-id="P-D"] .graph-node')).toHaveClass('is-hexagon');
    expect(document.querySelector('.react-flow__node[data-id="P"] .graph-node')).not.toHaveClass('is-hexagon');
    expect(document.querySelectorAll('.graph-node.is-hexagon')).toHaveLength(document.querySelectorAll('.graph-node.kind-domain').length);
  });
});
