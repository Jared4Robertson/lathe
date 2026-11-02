import './setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp, startAtDepth } from '../helpers';
import { testWorkspace } from './workspace';
import { boxElements, graphHost } from './scene';

// On a phone the walk is a bar of four buttons along the foot of the stage (LA-V93-R76, views/StageChrome.tsx): Out,
// Previous, Next and In, each one tap, never behind the toolbar's More. The ERD walks by the same bar; the arrows it
// does not carry stay in More.

/** A phone: narrow, with a finger for a pointer (every media query matches). */
const phone = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
const bar = () => screen.getByRole('group', { name: 'Walk the stage' });
const toolbar = () => document.querySelector<HTMLElement>('.focus-stage .stage-toolbar')!;

// From a stage, which has a parent, a first child and a sibling either side.
const FROM = 'P-D/use-cases';
const TARGETS = { Out: 'P-D', Previous: 'P-D/domain-model', Next: 'P-D/interaction-design', In: 'P-D-CAP01' };
const NAMES = ['Out to the parent', 'Step to the previous sibling', 'Step to the next sibling', 'In to the first child'];

describe('the walk on a phone', () => {
  for (const layout of ['tree', 'nested', 'map'] as const) {
    it(`LA-V93-R76-T01 In the ${layout} view on a phone, Out, Previous, Next and In are buttons in a bar, one tap each, never in More`, async () => {
      phone();
      startAtDepth(1, layout);
      await openApp(`/${FROM}?stage=graph`, { data: testWorkspace() });
      await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
      expect(graphHost()).toHaveAttribute('data-layout', layout);
      // The bar: four buttons in order, each its icon and word, named by the step it takes in this view.
      const buttons = within(bar()).getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Out', 'Previous', 'Next', 'In']);
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(NAMES);
      for (const b of buttons) expect(b.querySelector('svg.icon')).not.toBeNull();
      expect(bar()).toHaveAttribute('data-floating', 'bottom');
      // No step button in the toolbar's row, nor in its More menu.
      expect(toolbar().querySelector('.stage-steps, .stage-step')).toBeNull();
      if (layout === 'map') return;
      // Each button steps where its word says, in one tap; Back returns to the stage.
      for (const [i, [word, to]] of Object.entries(TARGETS).entries()) {
        fireEvent.click(within(bar()).getByRole('button', { name: NAMES[i] }));
        await waitFor(() => expect(window.location.pathname, `${layout}: ${word}`).toBe(`/${to}`));
        await act(async () => {
          window.history.back();
          await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
        });
        await waitFor(() => expect(window.location.pathname).toBe(`/${FROM}`));
      }
    });
  }

  it('LA-V93-R76-T01 A step that goes nowhere is disabled, not hidden, so the bar never shifts', async () => {
    phone();
    startAtDepth(1);
    await openApp('/P?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    const buttons = within(bar()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Out', 'Previous', 'Next', 'In']);
    // The product is the root: nothing to step out to.
    expect(buttons[0]).toBeDisabled();
    expect(buttons[3]).toBeEnabled();
  });

  it('LA-V93-R76-T01 The ERD walks by the same bar on a phone, its Up and Down left in More', async () => {
    phone();
    await openApp('/P-D-UC01?stage=erd', { data: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.focus-stage .erd-node')).not.toBeNull());
    expect(within(bar()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Out', 'Previous', 'Next', 'In']);
    const more = toolbar().querySelector<HTMLElement>('.stage-more-body')!;
    expect(within(more).getByRole('group', { name: 'More steps' })).toBeInTheDocument();
    expect([...more.querySelectorAll('.stage-step')].map((b) => b.className.match(/is-(\w+)/)![1])).toEqual(['up', 'down']);
  });
});
