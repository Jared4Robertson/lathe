import './setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GRAPH_LAYOUTS } from '../../src/graph/GraphPage';
import { stepKey } from '../../src/graph/steps';
import { DEFAULT_CARD, DEFAULT_CHAT, DEFAULT_GRAPH_SETTINGS, saveSessionSettings, sessionSettings } from '../../src/graph/settings';
import { activateTab, closeTab, cycleTab, emptyTabs, keepTab } from '../../src/views/tabs';
import { arrive, type PageTabs } from '../../src/views/useTabs';
import type { GraphSettings } from '../../src/graph/GraphPage';
import { openApp, startAtDepth } from '../helpers';
import { boxElement, graphHost } from './scene';
import { testWorkspace } from './workspace';

// Moving through the graph never changes how it is drawn (LA-V93-R72): the arrow steps, a click
// or Enter on a box, a tab and Back keep the layout, depth and Links, whichever tab the page lands
// in (one already open, the preview, or a new one). Only the person's own change in the graph
// (the toolbar, v, + and -) changes them.

const FLOW = 'P-D-UC01-FL01';
const layoutGroup = () => within(screen.getByRole('group', { name: 'Layout' }));
/** The layout and depth the toolbar shows, and the Links switch. */
const drawn = () => ({
  layout: layoutGroup().getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent,
  depth: document.querySelector('.graph-depth:not(.graph-layout) button[aria-pressed="true"]')?.textContent,
  links: screen.getByRole('button', { name: /^Links/ }).getAttribute('aria-pressed'),
});
const strip = () => screen.getByRole('tablist', { name: 'Open pages' });
const at = () => window.location.pathname.slice(1);

async function step(key: string) {
  const from = at();
  fireEvent.keyDown(graphHost()!, { key });
  await waitFor(() => expect(at()).not.toBe(from));
}

describe('moving through the graph keeps how it is drawn', () => {
  it('LA-EXP-INV09-T Opening, activating, cycling and closing tabs never touch the graph settings; only the person\'s change does', () => {
    const mine: GraphSettings = { ...DEFAULT_GRAPH_SETTINGS, layout: 'nested', depth: 2, links: true };
    saveSessionSettings({ graph: mine, card: DEFAULT_CARD, chat: DEFAULT_CHAT });
    const unchanged = (set: PageTabs) => {
      expect(sessionSettings().graph).toEqual(mine);
      expect(set.tabs.flatMap((t) => Object.keys(t.state))).not.toContain('graph');
    };
    let set = arrive(emptyTabs(), '/P-D-UC01', 'graph', true);
    unchanged(set);
    set = keepTab(set, set.active!);
    set = arrive(set, '/P-V01', null, false);
    unchanged(set);
    set = arrive(set, '/P-D-UC01', null, false);
    unchanged(set);
    set = cycleTab(set, 1);
    unchanged(set);
    set = activateTab(set, set.tabs[0].key);
    set = closeTab(set, set.active!);
    unchanged(set);
    // The person's own change is the only one.
    saveSessionSettings({ graph: { ...mine, layout: 'voronoi' }, card: DEFAULT_CARD, chat: DEFAULT_CHAT });
    expect(sessionSettings().graph.layout).toBe('voronoi');
  });

  for (const { layout, label } of GRAPH_LAYOUTS) {
    it(`LA-V93-R72-T01 In the ${label} layout, the arrows, a click, Enter, a tab and Back keep the layout, depth and Links, in tabs open or new`, async () => {
      startAtDepth(1, 'tree');
      await openApp(`/${FLOW}?stage=graph`, { data: testWorkspace() });
      await waitFor(() => expect(graphHost()).not.toBeNull());
      // A lasting tab on the flow, drawn as it starts; and one on its first step, where the person sets
      // the depth, the Links switch and the layout: the two tabs were drawn differently.
      fireEvent.doubleClick(within(strip()).getAllByRole('tab')[0]);
      await step('ArrowRight');
      const first = at();
      fireEvent.doubleClick(within(strip()).getAllByRole('tab')[1]);
      fireEvent.click(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('button', { name: /^Links/ }));
      fireEvent.click(layoutGroup().getByRole('button', { name: label }));
      const set = { layout: label, depth: '2', links: 'true' };
      expect(drawn()).toEqual(set);

      // Every arrow, into pages open in a tab and pages that are not: out, in, next, previous, next and out, each by the
      // arrow that takes that step in this layout (LA-V93-R19).
      for (const key of (['out', 'in', 'next', 'previous', 'next', 'out'] as const).map((s) => stepKey(layout, s))) {
        await step(key);
        expect(drawn(), `${key} to ${at()}`).toEqual(set);
      }
      expect(at()).toBe(FLOW);
      // A click on a box, and Enter on one.
      await waitFor(() => expect(boxElement(first)).not.toBeNull());
      fireEvent.click(boxElement(first)!);
      await waitFor(() => expect(at()).toBe(first));
      expect(drawn()).toEqual(set);
      await waitFor(() => expect(boxElement(FLOW)).not.toBeNull());
      boxElement(FLOW)!.focus();
      fireEvent.keyDown(boxElement(FLOW)!, { key: 'Enter' });
      await waitFor(() => expect(at()).toBe(FLOW));
      expect(drawn()).toEqual(set);
      // A tab, and Back.
      fireEvent.click(within(strip()).getAllByRole('tab').find((t) => t.textContent?.includes(first))!);
      await waitFor(() => expect(at()).toBe(first));
      expect(drawn()).toEqual(set);
      await act(async () => {
        window.history.back();
        await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
      });
      expect(drawn()).toEqual(set);
      expect(sessionSettings().graph).toMatchObject({ layout, depth: 2, links: true });

      // The person's own change does change it: v steps to the next layout.
      fireEvent.keyDown(document.body, { key: 'v' });
      await waitFor(() => expect(drawn().layout).not.toBe(label));
    });
  }

  it('LA-V93-R72-T03 The graph\'s settings last the session: the Links switch comes back on reload', async () => {
    await openApp('/DM-SHOP-UC01?stage=graph');
    const links = await screen.findByRole('button', { name: /^Links/ });
    expect(links).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(links);
    await waitFor(() => expect(screen.getByRole('button', { name: /^Links/ })).toHaveAttribute('aria-pressed', 'true'));
    await openApp('/DM-SHOP-UC01?stage=graph');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Links/ })).toHaveAttribute('aria-pressed', 'true'));
  });
});
