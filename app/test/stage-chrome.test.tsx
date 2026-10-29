import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { modelWorkspace } from './fixtures/model';
import { openApp } from './helpers';

// One stage chrome (LA-PAT-APP-UX-R21): every stage has the same controls in the same places, from one component each
// (views/StageChrome.tsx): the toolbar at the top of the open space, the shared controls first in a fixed order, then the
// stage's own, then the Key; the camera's zoom in, zoom out and fit at the bottom left corner of the frame.

const stage = () => document.querySelector<HTMLElement>('.focus-stage')!;
const stageButton = (name: string) => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });

/** What a stage shows of the chrome: the toolbar's controls in order (the shared ones by class, the stage's own as "own"), and the camera's buttons. */
function chrome() {
  const tools = stage().querySelectorAll('.stage-tools');
  expect(tools).toHaveLength(1);
  expect(tools[0]).toHaveAttribute('data-stage-tools', 'top');
  const toolbar = tools[0].querySelector(':scope > .stage-toolbar')!;
  const shared = (el: Element): string => {
    if (el.matches('.stage-steps')) return `steps: ${[...el.querySelectorAll('button')].map((b) => b.className.match(/is-(\w+)/)![1]).join(' ')}`;
    if (el.matches('.stage-frame')) return 'frame';
    if (el.matches('.stage-toolbar-end')) return `end: ${[...el.children].map((c) => c.className).join(' ')}`;
    return 'own';
  };
  const order = [...toolbar.children].map(shared).filter((c, i, all) => c !== 'own' || all[i - 1] !== 'own');
  const camera = [...stage().querySelectorAll('.stage-camera')];
  return {
    order,
    camera: camera.map((c) => within(c as HTMLElement).getAllByRole('button').map((b) => b.getAttribute('aria-label'))),
    reactFlowControls: stage().querySelectorAll('.react-flow__controls').length,
  };
}

const SHARED = ['steps: left right up down out in', 'frame'];
const CAMERA = [['Zoom in', 'Zoom out', 'Fit the whole map']];

describe('one stage chrome', () => {
  it('LA-PAT-APP-UX-R21-T01 The Graph, ERD and Trace stages show the same controls in the same order and places: steps, Out, In and Frame, the stage\'s own, the Key; zoom in, zoom out and fit in the corner', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(stage().querySelector('.graph-box')).not.toBeNull());
    const graph = chrome();
    expect(graph.order).toEqual([...SHARED, 'own', 'end: stage-key']);
    expect(graph.camera).toEqual(CAMERA);

    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(stage().querySelector('.react-flow__node')).not.toBeNull());
    const erd = chrome();
    // The ERD has no controls of its own; React Flow's own buttons give way to the shared ones.
    expect(erd.order).toEqual([...SHARED, 'end: stage-key']);
    expect(erd.camera).toEqual(CAMERA);
    expect(erd.reactFlowControls).toBe(0);

    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(stage().querySelector('.trace-flow[data-ready]')).not.toBeNull());
    const trace = chrome();
    // The Trace's own: Gaps only.
    expect(trace.order).toEqual([...SHARED, 'own', 'end: stage-key']);
    expect(within(stage().querySelector<HTMLElement>('.stage-toolbar')!).getByRole('checkbox', { name: 'Gaps only' })).toBeInTheDocument();
    expect(trace.camera).toEqual(CAMERA);

    // Each step button shows its arrow and letter, the same on every stage, and Out and In their names.
    const steps = [...stage().querySelectorAll('.stage-steps button')].map((b) => b.textContent);
    expect(steps).toEqual(['←A', '→D', '↑W', '↓S', 'Out', 'In']);
  });
});
