import './setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GRAPH_LAYOUTS } from '../../src/graph/GraphPage';
import { afterEach } from 'vitest';
import { DEFAULT_CARD, DEFAULT_CHANGES, DEFAULT_CHAT, saveSessionSettings, sessionSettings, type GraphLook } from '../../src/graph/settings';
import { DEFAULT_VIEW } from '../../src/views/place';
import { activateTab, closeTab, cycleTab, duplicateTab, emptyTabs, newTab, type TabSet } from '../../src/views/tabs';
import { arrive } from '../../src/views/useTabs';
import { desktopBridgeStub, openApp, startAtDepth } from '../helpers';
import { boxElement, graphHost } from './scene';
import { testWorkspace } from './workspace';

/** The arrow that takes each step in a layout (LA-V93-R19): Tree Left out and Right in, Nested Up out and Down in. */
const stepKey = (layout: string, step: 'out' | 'in' | 'previous' | 'next') => (layout === 'tree' ? { out: 'ArrowLeft', in: 'ArrowRight', previous: 'ArrowUp', next: 'ArrowDown' } : { out: 'ArrowUp', in: 'ArrowDown', previous: 'ArrowLeft', next: 'ArrowRight' })[step];

// Moving through the graph never changes how it is drawn (LA-V93-R72): the arrow steps, a click
// or Enter on a box, a tab and Back keep the layout and minimap (the window's) and the depth (the place's, which a new
// tab copies), whichever tab the page lands in. Only the person's own change in the graph (the toolbar, v, + and -)
// changes them.

const FLOW = 'P-D-UC01-FL01';
const layoutGroup = () => within(screen.getByRole('group', { name: 'Layout' }));
/** The layout and depth the toolbar shows, and the Minimap switch. */
const drawn = () => ({
  layout: layoutGroup().getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent,
  depth: document.querySelector('.graph-depth:not(.graph-layout) button[aria-pressed="true"]')?.textContent,
  minimap: (screen.getByRole('switch', { name: 'Minimap' }) as HTMLInputElement).checked,
});
const strip = () => screen.getByRole('tablist', { name: 'Open pages' });
const host = window as unknown as { latheDesktop?: LatheDesktop };
afterEach(() => { delete host.latheDesktop; });
const at = () => window.location.pathname.slice(1);

async function step(key: string) {
  const from = at();
  fireEvent.keyDown(graphHost()!, { key });
  await waitFor(() => expect(at()).not.toBe(from));
}

describe('moving through the graph keeps how it is drawn', () => {
  it('LA-EXP-INV09-T Opening, activating, cycling and closing tabs never touch the window\'s settings; only the person\'s change does', () => {
    const mine: GraphLook = { layout: 'nested', minimap: true };
    saveSessionSettings({ graph: mine, card: DEFAULT_CARD, chat: DEFAULT_CHAT, changes: DEFAULT_CHANGES });
    const unchanged = (set: TabSet) => {
      expect(sessionSettings().graph).toEqual(mine);
      expect(set.tabs.flatMap((t) => Object.keys(t.place.view))).not.toContain('layout');
    };
    let set = arrive(emptyTabs(), 'P', '/P-D-UC01?stage=graph', 'load', null, DEFAULT_VIEW).set;
    unchanged(set);
    set = arrive(set, 'P', '/P-V01', 'push', null, DEFAULT_VIEW).set;
    unchanged(set);
    set = newTab(set, '/P-D-UC01?stage=graph', DEFAULT_VIEW);
    set = duplicateTab(set, set.active!);
    unchanged(set);
    set = cycleTab(set, 1);
    unchanged(set);
    set = activateTab(set, set.tabs[0].key);
    set = closeTab(set, set.active!, '/P?stage=graph');
    unchanged(set);
    // The person's own change is the only one.
    saveSessionSettings({ graph: { ...mine, layout: 'tree' }, card: DEFAULT_CARD, chat: DEFAULT_CHAT, changes: DEFAULT_CHANGES });
    expect(sessionSettings().graph.layout).toBe('tree');
  });

  for (const { layout, label } of GRAPH_LAYOUTS) {
    it(`LA-V93-R72-T01 In the ${label} layout, the arrows, a click, Enter, a tab and Back keep the layout, depth and minimap, in tabs open or new`, async () => {
      // In the desktop app, whose tabs are the app's.
      host.latheDesktop = desktopBridgeStub();
      startAtDepth(1, 'tree');
      await openApp(`/${FLOW}?stage=graph`, { data: testWorkspace() });
      await waitFor(() => expect(graphHost()).not.toBeNull());
      // The flow's first step, where the person sets the depth, the minimap and the layout.
      await step('ArrowRight');
      const first = at();
      fireEvent.click(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '2' }));
      fireEvent.click(screen.getByRole('switch', { name: 'Minimap' }));
      fireEvent.click(layoutGroup().getByRole('button', { name: label }));
      const set = { layout: label, depth: '2', minimap: true };
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
      // A new tab (a duplicate) and back to the first, and Back.
      fireEvent.keyDown(document.body, { key: 'D', code: 'KeyD', altKey: true, shiftKey: true });
      await waitFor(() => expect(within(strip()).getAllByRole('tab')).toHaveLength(2));
      expect(drawn()).toEqual(set);
      fireEvent.click(within(strip()).getAllByRole('tab')[0]);
      await waitFor(() => expect(within(strip()).getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true'));
      expect(drawn()).toEqual(set);
      // The window has the first tab's history again.
      await waitFor(() => expect((window.history.state as { latheTab?: { tab: string } } | null)?.latheTab?.tab).toBe('t1'));
      await act(async () => {
        window.history.back();
        await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
      });
      expect(drawn()).toEqual(set);
      expect(sessionSettings().graph).toEqual({ layout, minimap: true });

      // The person's own change does change it: v steps to the next layout.
      fireEvent.keyDown(document.body, { key: 'v' });
      await waitFor(() => expect(drawn().layout).not.toBe(label));
    });
  }

  it('LA-V93-R72-T03 The graph\'s settings last the session: the minimap comes back on reload', async () => {
    await openApp('/DM-SHOP-UC01?stage=graph');
    const minimap = await screen.findByRole('switch', { name: 'Minimap' });
    expect(minimap).not.toBeChecked();
    fireEvent.click(minimap);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Minimap' })).toBeChecked());
    await openApp('/DM-SHOP-UC01?stage=graph');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Minimap' })).toBeChecked());
  });
});
