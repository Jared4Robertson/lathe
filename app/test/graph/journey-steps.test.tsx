import { recordIndexOf, type ServedData } from '../read-view';
import './setup';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { addRows } from '../fixtures/load';
import { openApp, startAtDepth } from '../helpers';
import { groundChildren } from '../../src/graph/ground';
import { nodeChildren } from '../../src/graph/model';
import { graphLevels } from '../../src/graph/steps';
import { thenPairs } from '../../src/graph/sequence';
import { boxElements, graphHost, isCenter, scene } from './scene';
import { testWorkspace } from './workspace';

// A journey's steps in the graph (LA-V93-R75): nested in it on the Map and listed under it in the Tree, path by path,
// the main path first, each by position, never by ID; a "then" arrow from each step to the next on its path; and,
// framing the journey, a line from each step to what it carries out.

/** The test workspace with a journey whose last step was moved first (S03 at position 1), and an alternate path of two steps. */
function journeyWorkspace(): ServedData {
  const w = testWorkspace();
  addRows(w, 'journey', { id: 'P-JR01', title: 'Get a damaged tool back in lending', product_id: 'P', trigger: 'A tool is found damaged.', result: 'The tool is available to borrow again.' });
  addRows(w, 'journey_step',
    { id: 'P-JR01-S01', title: 'Take the tool back needing repair', journey_id: 'P-JR01', path: 'main', position: 2 },
    { id: 'P-JR01-S02', title: 'Put it back in lending', journey_id: 'P-JR01', path: 'main', position: 3 },
    { id: 'P-JR01-S03', title: 'Borrow the tool', journey_id: 'P-JR01', path: 'main', position: 1 },
    { id: 'P-JR01-S04', title: 'Report the damage', journey_id: 'P-JR01', path: 'found outside a return', position: 1 },
    { id: 'P-JR01-S05', title: 'Put it back in lending', journey_id: 'P-JR01', path: 'found outside a return', position: 2 },
  );
  addRows(w, 'carries_out', { source_id: 'P-JR01-S03', target_id: 'P-D-UC01' }, { source_id: 'P-JR01-S01', target_id: 'P-D-PO02' });
  return w;
}

const ORDER = ['P-JR01-S03', 'P-JR01-S01', 'P-JR01-S02', 'P-JR01-S04', 'P-JR01-S05'];

describe('a journey\'s steps in the graph', () => {
  it('LA-V93-R75-T01 A journey\'s steps sit under it in path and position order, joined by then arrows, and framing it draws each step\'s line to what it carries out', async () => {
    const index = recordIndexOf(journeyWorkspace());
    // In order in the Tree and the Map, and the walk visits them so.
    expect(nodeChildren(index, 'P-JR01')).toEqual(ORDER);
    expect(groundChildren(index, 'P-JR01')).toEqual(ORDER);
    expect(graphLevels(index, 'P', 'map').children('P-JR01')).toEqual(ORDER);
    // A then arrow between consecutive steps of each path, none from one path into the next.
    expect(thenPairs(index, ORDER)).toEqual([['P-JR01-S03', 'P-JR01-S01'], ['P-JR01-S01', 'P-JR01-S02'], ['P-JR01-S04', 'P-JR01-S05']]);

    // On the canvas: framing the journey on the Map draws the then arrows and its steps' carries-out lines.
    startAtDepth(1);
    await openApp('/P-JR01?stage=graph', { data: journeyWorkspace() });
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    fireEvent.click(within(screen.getByRole('group', { name: 'Layout' })).getByRole('button', { name: 'Map' }));
    await waitFor(() => expect(graphHost()).toHaveAttribute('data-layout', 'map'));
    await waitFor(() => expect(isCenter('P-JR01')).toBe(true));
    await waitFor(() => expect(scene().lines.filter((l) => l.id.includes('|then|')).map((l) => `${l.source}>${l.target}`).sort()).toEqual(['P-JR01-S01>P-JR01-S02', 'P-JR01-S03>P-JR01-S01', 'P-JR01-S04>P-JR01-S05']));
    expect(scene().lines.filter((l) => l.id.includes('|carries_out|')).map((l) => `${l.source}>${l.target}`).sort()).toEqual(['P-JR01-S01>P-D-PO02', 'P-JR01-S03>P-D-UC01']);
  });
});
