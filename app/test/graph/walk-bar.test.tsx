import './setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
const TARGETS = { Previous: 'P-D/domain-model', Out: 'P-D', In: 'P-D-CAP01', Next: 'P-D/interface-design' };
const NAMES = ['Step to the previous sibling', 'Out to the parent', 'In to the first child', 'Step to the next sibling'];

describe('the walk on a phone', () => {
  for (const layout of ['tree', 'nested', 'map'] as const) {
    it(`LA-V93-R76-T01 In the ${layout} view on a phone, Previous, Out, In and Next are buttons in a bar, one tap each, never in More`, async () => {
      phone();
      startAtDepth(1, layout);
      await openApp(`/${FROM}?stage=graph`, { data: testWorkspace() });
      await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
      expect(graphHost()).toHaveAttribute('data-layout', layout);
      // The bar: four buttons in order, each its icon and word, named by the step it takes in this view.
      const buttons = within(bar()).getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Previous', 'Out', 'In', 'Next']);
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
    expect(buttons.map((b) => b.textContent)).toEqual(['Previous', 'Out', 'In', 'Next']);
    // The product is the root: nothing to step out to.
    expect(buttons[1]).toBeDisabled();
    expect(buttons[3]).toBeEnabled();
  });

  it('LA-V93-R76-T01 The ERD walks by the same bar on a phone, its Up and Down left in More', async () => {
    phone();
    await openApp('/P-D-UC01?stage=erd', { data: testWorkspace() });
    await waitFor(() => expect(document.querySelector('.focus-stage .erd-node')).not.toBeNull());
    expect(within(bar()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Previous', 'Out', 'In', 'Next']);
    const more = toolbar().querySelector<HTMLElement>('.stage-more-body')!;
    expect(within(more).getByRole('group', { name: 'More steps' })).toBeInTheDocument();
    expect([...more.querySelectorAll('.stage-step')].map((b) => b.className.match(/is-(\w+)/)![1])).toEqual(['up', 'down']);
  });

  it('LA-V93-R76-T01 The Key chip sits in the bar\'s row, at its end, in a slot its buttons leave, so it never covers node text', async () => {
    phone();
    await openApp(`/${FROM}?stage=graph`, { data: testWorkspace() });
    await waitFor(() => expect(bar()).toBeInTheDocument());
    // The chip keeps its word as its name; upright, the word is hidden but for assistive technology.
    const chip = screen.getByRole('button', { name: 'Key' });
    expect(chip.querySelector('.stage-key-word')).toHaveTextContent('Key');
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    // In every orientation, not only on its side: the bar leaves the slot, and the chip sits in it, in the bar's row.
    expect(outside).toMatch(/\.stage-layout\.is-phone > \.focus-stage \.stage-walk-bar \{ padding-right: calc\([^;]*var\(--key-slot\)/);
    expect(outside).toMatch(/\.stage-layout\.is-phone > \.focus-stage \.stage-key-chip \{[^}]*right: max\(8px, env\(safe-area-inset-right\)\);[^}]*bottom: calc\(6px \+ env\(safe-area-inset-bottom\)\);[^}]*width: var\(--key-slot\)/);
    expect(outside).toMatch(/\.stage-layout\.is-phone > \.focus-stage \{ --key-slot: var\(--touch-target\); \}/);
    expect(css).toMatch(/@media \(orientation: portrait\) \{\s*\.stage-layout\.is-phone > \.focus-stage \.stage-key-word \{[^}]*clip-path: inset\(50%\)/);
  });

  it('LA-V93-R76-T03 Nothing in the bar touches: 8 px between its targets and before the Key chip, each 44 px, and narrower than 360 px each button is its icon alone, its word kept as its name', async () => {
    phone();
    await openApp(`/${FROM}?stage=graph`, { data: testWorkspace() });
    await waitFor(() => expect(bar()).toBeInTheDocument());
    // Each button keeps its word in the page, so its name and the word it shows from 360 px up agree (LA-V61-R44).
    for (const b of within(bar()).getAllByRole('button')) expect(b.getAttribute('aria-label')).toMatch(new RegExp(b.querySelector('.stage-walk-word')!.textContent!, 'i'));
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const outside = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    // The buttons share the bar's width, 8 px apart, each at least a touch target, and 8 px clear of the Key chip's slot.
    expect(outside).toMatch(/\.stage-walk-bar \{[^}]*display: flex; gap: 8px;/);
    expect(outside).toMatch(/\.stage-walk-step \{[^}]*flex: 1 1 auto; min-width: var\(--touch-target\); min-height: var\(--touch-target\);/);
    expect(outside).toMatch(/\.stage-layout\.is-phone > \.focus-stage \.stage-walk-bar \{ padding-right: calc\(max\(8px, env\(safe-area-inset-right\)\) \+ var\(--key-slot\) \+ 8px\); \}/);
    // Narrower than 360 px the word is hidden but for assistive technology, never squeezed.
    expect(css).toMatch(/@media \(max-width: 359\.98px\) \{\s*\.stage-walk-word \{[^}]*clip-path: inset\(50%\)/);
  });
});
