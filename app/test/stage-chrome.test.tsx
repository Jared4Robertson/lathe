import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TOOLBAR_FORMS, TOOLBAR_TIERS } from '../src/views/StageChrome';
import { graphDrawn, graphKeyEntries } from '../src/graph/key';
import { NO_FILTERS, neighborhood } from '../src/graph/model';
import { changesKeyEntries } from '../src/changes/ChangesKey';
import { recordIndexOf } from './read-view';
import { modelWorkspace } from './fixtures/model';
import { openApp } from './helpers';

/** A step button as drawn: its text, then its key letter, which the stylesheet draws from data-letter. */
const shown = (b: Element) => `${b.textContent}${b.querySelector('.stage-step-letter')?.getAttribute('data-letter') ?? ''}`;

// One stage chrome (LA-PAT-APP-UX-R21): every stage has the same controls in the same places, from one component each
// (views/StageChrome.tsx): the toolbar at the top of the open space, the shared controls first in a fixed order (the
// Changes controls, changes/ChangesTools.tsx, among them), then the
// stage's own; the camera's zoom in, zoom out and fit at the bottom left corner of the frame; and the stage's key as a
// bar along the bottom (LA-V96-R30).

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
    if (el.matches('.changes-tools')) return `changes: ${[...el.querySelectorAll('button')].map((b) => b.className.match(/changes-(\w+)/)![1]).join(' ')}`;
    if (el.matches('.stage-toolbar-end')) return `end: ${[...el.children].map((c) => c.className).join(' ') || '-'}`;
    return 'own';
  };
  const order = [...toolbar.children].map(shared).filter((c, i, all) => c !== 'own' || all[i - 1] !== 'own');
  const camera = [...stage().querySelectorAll('.stage-camera')];
  return {
    order,
    camera: camera.map((c) => within(c as HTMLElement).getAllByRole('button').map((b) => b.getAttribute('aria-label'))) };
}

const SHARED = ['steps: left right up down out in', 'frame', 'changes: highlight follow open'];
const CAMERA = [['Zoom in', 'Zoom out', 'Fit the whole map']];

describe('one stage chrome', () => {
  it('LA-PAT-APP-UX-R21-T01 The Graph, ERD and Trace stages show the same controls in the same order and places: steps, Out, In and Frame, then the stage\'s own; zoom in, zoom out and fit in the corner', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(stage().querySelector('.graph-box')).not.toBeNull());
    const graph = chrome();
    expect(graph.order).toEqual([...SHARED, 'own', 'end: -']);
    expect(graph.camera).toEqual(CAMERA);

    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(stage().querySelector('.erd-node')).not.toBeNull());
    const erd = chrome();
    // The ERD's own: Tidy up; its camera's buttons are the shared ones, and no others.
    expect(erd.order).toEqual([...SHARED, 'own', 'end: -']);
    expect(within(stage().querySelector<HTMLElement>('.stage-toolbar')!).getByRole('button', { name: 'Tidy up' })).toBeInTheDocument();
    expect(erd.camera).toEqual(CAMERA);

    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(stage().querySelector('.trace-flow[data-ready]')).not.toBeNull());
    const trace = chrome();
    // The Trace's own: Gaps only.
    expect(trace.order).toEqual([...SHARED, 'own', 'end: -']);
    expect(within(stage().querySelector<HTMLElement>('.stage-toolbar')!).getByRole('checkbox', { name: 'Gaps only' })).toBeInTheDocument();
    expect(trace.camera).toEqual(CAMERA);

    // Each step button shows its arrow and letter, the same on every stage, and Out and In their names.
    const steps = [...stage().querySelectorAll('.stage-steps button')].map(shown);
    expect(steps).toEqual(['←A', '→D', '↑W', '↓S', 'Out', 'In']);
    // The letter is the key, announced as the button's shortcut.
    expect(stage().querySelector('.stage-steps .is-up')?.getAttribute('aria-keyshortcuts')?.split(' ')).toContain('W');
  });
});

describe('the toolbar\'s fold order', () => {
  it('LA-PAT-APP-UX-R21-T01 The toolbar folds the Changes controls first, then the secondary controls, then drops the step letters; the walk, Frame and the stage\'s primary controls stay in the row until the phone\'s form', () => {
    expect(Object.keys(TOOLBAR_FORMS)).toEqual([...TOOLBAR_TIERS]);
    const folded = TOOLBAR_TIERS.map((t) => `${t}: ${TOOLBAR_FORMS[t].folded.join(' ') || '-'}`);
    expect(folded).toEqual([
      'full: -',
      'compact: -',
      'changes: changes',
      'secondary: changes secondary',
      'narrow: changes secondary',
      'menu: steps changes secondary',
    ]);
    // Each tier only gives way more: what one folds or hides stays folded or hidden in every narrower one.
    TOOLBAR_TIERS.slice(1).forEach((t, i) => {
      const [wider, now] = [TOOLBAR_FORMS[TOOLBAR_TIERS[i]], TOOLBAR_FORMS[t]];
      for (const g of wider.folded) expect(now.folded).toContain(g);
      for (const flag of ['names', 'picker', 'letters'] as const) if (!wider[flag]) expect(now[flag]).toBe(false);
      if (wider.narrow) expect(now.narrow).toBe(true);
    });
    // Names and the baseline picker go first, the step letters before the steps fold; Frame and the primary controls never fold.
    const first = (test: (t: (typeof TOOLBAR_TIERS)[number]) => boolean) => TOOLBAR_TIERS.findIndex(test);
    expect(first((t) => !TOOLBAR_FORMS[t].names)).toBe(1);
    expect(first((t) => !TOOLBAR_FORMS[t].picker)).toBe(1);
    expect(first((t) => !TOOLBAR_FORMS[t].letters)).toBeLessThan(first((t) => TOOLBAR_FORMS[t].folded.includes('steps')));
    expect(first((t) => TOOLBAR_FORMS[t].folded.includes('steps'))).toBe(TOOLBAR_TIERS.length - 1);
    for (const t of TOOLBAR_TIERS) expect(TOOLBAR_FORMS[t].folded).not.toContain('frame');
    for (const t of TOOLBAR_TIERS) expect(TOOLBAR_FORMS[t].folded).not.toContain('primary');
  });

  it('LA-PAT-APP-UX-R21-T01 Too narrow for the Changes controls and the secondary controls, the Graph\'s toolbar keeps its walk, Frame, layouts and filters in the row and the rest in More', async () => {
    // The row overflows until depth has folded (jsdom lays nothing out).
    const fits = TOOLBAR_TIERS.indexOf('secondary');
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('stage-toolbar') && TOOLBAR_TIERS.indexOf(this.dataset.tier as (typeof TOOLBAR_TIERS)[number]) < fits ? 900 : 0;
    });
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
    try {
      await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
      await waitFor(() => expect(stage().querySelector('.graph-box')).not.toBeNull());
      const toolbar = stage().querySelector<HTMLElement>('.stage-toolbar')!;
      await waitFor(() => expect(toolbar).toHaveAttribute('data-tier', 'secondary'));
      const more = toolbar.querySelector<HTMLElement>('.stage-more-body')!;
      const row = (el: Element) => toolbar.contains(el) && !more.contains(el);
      // In the row: the steps with their letters, Out, In, Frame, the layouts and the filters; More is at the end.
      expect([...toolbar.querySelectorAll('.stage-steps button')].map(shown)).toEqual(['←A', '→D', '↑W', '↓S', 'Out', 'In']);
      for (const el of [toolbar.querySelector('.stage-steps')!, toolbar.querySelector('.stage-frame')!, toolbar.querySelector('.graph-layout')!, toolbar.querySelector('.graph-filters')!]) expect(row(el)).toBe(true);
      expect(toolbar.querySelector('.stage-toolbar-end > .stage-more')).not.toBeNull();
      // In More, in order: the Changes controls with the baseline picker, then depth.
      expect([...more.children].map((c) => c.className.split(' ')[0])).toEqual(['changes-tools', 'graph-depth']);
      expect(within(more).getByRole('combobox')).toBeInTheDocument();
    } finally {
      scroll.mockRestore();
      client.mockRestore();
    }
  });
});

describe('the stage key bar', () => {
  /** The stage's key: one named region, its entries by what they stand for. */
  const key = () => {
    const regions = stage().querySelectorAll('[role="region"][aria-label="Key"]');
    expect(regions).toHaveLength(1);
    return regions[0] as HTMLElement;
  };
  const entries = () => [...key().querySelectorAll<HTMLElement>('[data-key-entry]')].map((li) => li.dataset.keyEntry);

  it('LA-V96-R30-T01 Every stage shows its key as one bar along the bottom, a floating panel in the tab order, with what the stage draws and no Key button in the toolbar', async () => {
    await openApp('/P-D-UC01?stage=graph', { data: modelWorkspace() });
    await waitFor(() => expect(stage().querySelector('.graph-box')).not.toBeNull());
    // A floating panel at the bottom, so the camera frames above it; one tab stop, outside the toolbar.
    expect(key()).toHaveAttribute('data-floating', 'bottom');
    expect(key()).toHaveAttribute('tabindex', '0');
    expect(key().closest('.stage-tools')).toBeNull();
    expect(stage().querySelector('.stage-tools details.stage-key, .stage-tools [aria-label="Key"]')).toBeNull();
    // Each entry a sample and a word or two, its whole meaning in its tooltip.
    // Only what the graph draws around the focus: a capability, the use case and its requirements, in the use cases' color.
    expect(entries()).toEqual(['stage-use-cases', 'focus', 'shape-slice', 'shape-stadium', 'shape-page', 'line', 'bar', 'badge-gap', 'scroll']);
    const useCase = key().querySelector('[data-key-entry="shape-stadium"]')!;
    expect(useCase).toHaveTextContent('Use case');
    expect(useCase).toHaveAttribute('title', expect.stringMatching(/^Use case: a stadium$/));

    fireEvent.click(stageButton('ERD'));
    await waitFor(() => expect(stage().querySelector('.erd-node')).not.toBeNull());
    expect(key()).toHaveAttribute('data-floating', 'bottom');
    expect(entries()).toEqual(expect.arrayContaining(['domain', 'aggregate', 'entity', 'line-has_many']));

    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(stage().querySelector('.trace-flow[data-ready]')).not.toBeNull());
    expect(key()).toHaveAttribute('data-floating', 'bottom');
    // The Trace's All-at-once view (LA-V98-R02): its columns, its links and the focus, its path lit and the rest faded.
    expect(entries()).toEqual(expect.arrayContaining(['columns', 'link-reaches', 'focus', 'faded']));
    // Every stage's bar ends with what scroll does: it pans, Scroll to zoom being off.
    expect(entries().at(-1)).toBe('scroll');
    expect(key().querySelector('[data-key-entry="scroll"]')).toHaveTextContent('Scroll pans');
  });

  it('LA-V96-R30-T01 A kind the filters hide leaves the Graph\'s key, and the live marks show only while there are any', () => {
    const index = recordIndexOf(modelWorkspace());
    const ids = (focus: string, hidden: string[]) => graphKeyEntries(graphDrawn(index, neighborhood(index, focus, 3, hidden.length ? { hiddenKinds: new Set(hidden) } : NO_FILTERS), 'tree')).map((e) => e.id);
    expect(ids('P-D-CAP01', [])).toContain('shape-stadium');
    expect(ids('P-D-CAP01', ['use_case'])).not.toContain('shape-stadium');
    // The focus is never hidden, so its entries stay.
    expect(ids('P-D-UC01', ['use_case'])).toContain('shape-stadium');
    expect(changesKeyEntries(new Set())).toEqual([]);
    expect(changesKeyEntries(new Set(['is-changed', 'is-dimmed'])).map((e) => e.words)).toEqual(['Changed', 'Unchanged']);
  });
});
