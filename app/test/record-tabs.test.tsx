import './graph/setup';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App';
import { navigate } from '../src/router';
import { COMMANDS } from '../src/shell/keymap';
import { workspace } from './fixtures/workspace';
import { desktopBridgeStub, openApp, serve } from './helpers';
import { testWorkspace } from './graph/workspace';
import { boxElement, boxElements, cameraOf } from './graph/scene';
import type { TraceHost } from '../src/trace/TraceCanvas';

// The desktop app's tabs, as a browser's (LA-EXP-UC10): each tab is its own place, a move never leaves it, a new tab
// opens only when asked for, closing and cycling, and each tab's own history, which the window's follows, so a
// reload brings every tab back with its place and history (LA-PAT-APP-UX-R06).

const served = () => ({ data: testWorkspace() });
const host = window as unknown as { latheDesktop?: LatheDesktop };
beforeEach(() => { host.latheDesktop = desktopBridgeStub(); });
afterEach(() => { delete host.latheDesktop; });

const strip = () => screen.getByRole('tablist', { name: 'Open pages' });
/** The tabs by title, "<" marking the active one. */
const tabs = () => within(strip()).getAllByRole('tab').map((t) => `${t.querySelector('.tab-title')!.textContent}${t.getAttribute('aria-selected') === 'true' ? '<' : ''}`);
const tab = (title: string) => within(strip()).getAllByRole('tab').find((t) => t.querySelector('.tab-title')!.textContent === title)!;
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
const address = () => window.location.pathname + window.location.search;
const go = async (to: string, heading: string) => {
  act(() => navigate(to));
  await waitFor(() => expect(title()).toBe(heading));
};
const stageButton = (name: 'Graph' | 'ERD' | 'Trace') => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const key = (init: KeyboardEventInit & { key: string; code?: string }) => fireEvent.keyDown(document.body, init);
/** The new tab command: Alt+Shift+T (Cmd+T is the menu's). */
const newTabKey = () => key({ key: 'T', code: 'KeyT', altKey: true, shiftKey: true });
const closeKey = () => key({ key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
/** The window's Back or Forward, waiting for the page to land. */
const step = async (back: boolean, heading: string) => {
  await act(async () => { if (back) window.history.back(); else window.history.forward(); });
  await waitFor(() => expect(title()).toBe(heading));
};
/** The window catches up with the tab shown (its history is given to it after a tab switch). */
const settled = (to: string) => waitFor(() => expect(address()).toBe(to));
/** Reloads the app where it is: the window's history and the session's storage stay. */
const reload = async () => {
  cleanup();
  serve(served());
  render(<App />);
  await waitFor(() => expect(document.querySelector('.app[data-specs]')?.getAttribute('data-specs')).not.toBe('loading'));
};

/** The use case's page, in the first tab. */
const firstTab = async (at = '/P-D-UC01?stage=graph') => {
  await openApp(at, served());
  await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
  await settled(at);
};

describe('the desktop app\'s tabs', () => {
  it('LA-V96-R16-T01 Each tab shows its record\'s ID and title, a group\'s tab its label, never in italics', async () => {
    await firstTab();
    const first = tab('Lend a thing');
    expect(first).toHaveAccessibleName('P-D-UC01 Lend a thing');
    expect(first.querySelector('.tab-id')).toHaveTextContent('P-D-UC01');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', first.id);
    await go('/P-D/domain-model/term', 'Terms (1)');
    expect(tabs()).toEqual(['Terms (1)<']);
    expect(tab('Terms (1)').querySelector('code, .tab-id')).toBeNull();
    // No tab is a preview: no italic class, no "preview" in its name.
    expect(document.querySelector('.is-preview')).toBeNull();
    expect(tab('Terms (1)')).toHaveAccessibleName('Terms (1)');
  });

  it('LA-V96-R10-T02 Walking onto a record open in another tab stays in the current tab', async () => {
    await firstTab();
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    // Out from the use case: where the walk leads.
    key({ key: 'ArrowUp', code: 'ArrowUp', shiftKey: true });
    await waitFor(() => expect(title()).not.toBe('Lend a thing'));
    const parent = title()!;
    const parentAddress = address();
    // Back on the use case; a second tab holds the parent.
    await step(true, 'Lend a thing');
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go(parentAddress, parent);
    expect(tabs()).toEqual(['Lend a thing', `${parent}<`]);
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    await settled('/P-D-UC01?stage=graph');
    // The walk onto the parent stays in the first tab: both tabs now hold it.
    key({ key: 'ArrowUp', code: 'ArrowUp', shiftKey: true });
    await waitFor(() => expect(title()).toBe(parent));
    expect(tabs()).toEqual([`${parent}<`, parent]);
    expect(tab(parent)).toBe(within(strip()).getAllByRole('tab')[0]);
    // And so does a link to it, or the address.
    await go('/P-V01', 'Loan desk');
    expect(tabs()).toEqual(['Loan desk<', parent]);
  });

  it('LA-V96-R11-T02 Cmd or Ctrl+click and middle-click on a box or link, Cmd+Enter in quick open and the new tab command open a tab after the active one', async () => {
    await firstTab('/P-D-UC01?stage=erd');
    // The new tab command: at the product, on the active tab's stage.
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(tabs()[1].endsWith('<')).toBe(true);
    await settled('/P?stage=erd');
    fireEvent.click(tab('Lend a thing'));
    await settled('/P-D-UC01?stage=erd');
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(1));

    // Cmd+click on a box: a new tab after the active one, active, focused there, on the same stage.
    const other = boxElements().find((b) => b.dataset.id !== 'P-D-UC01' && /^P-/.test(b.dataset.id ?? ''))!;
    const id = other.dataset.id!;
    fireEvent.click(other, { metaKey: true });
    await waitFor(() => expect(tabs()).toHaveLength(3));
    expect(within(strip()).getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    await settled(`/${id}?stage=graph`);
    fireEvent.click(tab('Lend a thing'));
    await settled('/P-D-UC01?stage=graph');

    // A middle-click on a link in the card: a new tab in the background.
    await waitFor(() => expect(screen.getByRole('region', { name: 'Wiki card' })).toHaveAttribute('data-page', 'P-D-UC01'));
    const link = (await within(screen.getByRole('region', { name: 'Wiki card' })).findAllByRole('link', { name: /P-D-UC01-R01/ }))[0];
    const linked = new URL(link.getAttribute('href')!, window.location.href).pathname;
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    await waitFor(() => expect(tabs()).toHaveLength(4));
    expect(tabs()[0]).toBe('Lend a thing<');
    expect(tabs()[1].endsWith('<')).toBe(false);
    // Ctrl+click on a link: a new tab, active.
    fireEvent.click(link, { ctrlKey: true });
    await waitFor(() => expect(tabs()).toHaveLength(5));
    expect(tabs()[1].endsWith('<')).toBe(true);
    await settled(`${linked}?stage=graph`);

    // Cmd/Ctrl+Enter in quick open: a new tab (Ctrl off a Mac, as here).
    key({ key: 'p', code: 'KeyP', ctrlKey: true });
    const box = within(await screen.findByRole('dialog')).getByRole('combobox');
    fireEvent.change(box, { target: { value: 'Loan desk' } });
    await waitFor(() => expect(within(screen.getByRole('listbox', { name: 'Quick find results' })).getAllByRole('option')[0]).toHaveTextContent('P-V01'));
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(tabs()).toHaveLength(6));
    expect(tabs()[2]).toBe('Loan desk<');
    await settled('/P-V01?stage=graph');
  });

  it('LA-V96-R11-T03 Duplicate tab copies the active tab with its history', async () => {
    await firstTab();
    await go('/P-V01?stage=erd', 'Loan desk');
    key({ key: 'D', code: 'KeyD', altKey: true, shiftKey: true });
    await waitFor(() => expect(tabs()).toEqual(['Loan desk', 'Loan desk<']));
    await settled('/P-V01?stage=erd');
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    // Its Back goes where the tab it copies had been.
    await step(true, 'Lend a thing');
    expect(tabs()).toEqual(['Loan desk', 'Lend a thing<']);
  });

  it('LA-V96-R12-T02 Closing by button, middle-click or the close command activates the right neighbor or else the left, and the last tab leaves one on the product', async () => {
    await firstTab();
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go('/P-V01', 'Loan desk');
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(3));
    await go('/P-D-A1', 'Thing');
    expect(tabs()).toEqual(['Lend a thing', 'Loan desk', 'Thing<']);
    // The middle tab, active, closed by the command: its right neighbor becomes active.
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    closeKey();
    await waitFor(() => expect(title()).toBe('Thing'));
    expect(tabs()).toEqual(['Lend a thing', 'Thing<']);
    await settled('/P-D-A1?stage=graph');
    // The rightmost by a middle-click: its left neighbor.
    fireEvent(tab('Thing'), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(tabs()).toEqual(['Lend a thing<']);
    // Its close button names the close command; the last tab closed leaves one tab at the product.
    const close = tab('Lend a thing').closest('.tab')!.querySelector<HTMLElement>('.tab-close[aria-label="Close P-D-UC01 Lend a thing"]')!;
    expect(close).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+W');
    fireEvent.click(close);
    await waitFor(() => expect(within(strip()).getAllByRole('tab')).toHaveLength(1));
    await settled('/P?stage=graph');
    expect(tabs()[0].endsWith('<')).toBe(true);
  });

  it('LA-V96-R13-T01 Ctrl+Tab and Ctrl+Shift+Tab cycle, and on the focused strip the arrow keys move and Delete closes', async () => {
    for (const id of ['newTab', 'closeTab', 'duplicateTab', 'nextTab', 'previousTab']) expect(COMMANDS.find((c) => c.id === id)?.group).toBe('Navigate');
    expect(COMMANDS.some((c) => c.id === 'keepTab')).toBe(false);
    await firstTab();
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go('/P-V01', 'Loan desk');
    expect(tabs()).toEqual(['Lend a thing', 'Loan desk<']);

    key({ key: 'Tab', code: 'Tab', ctrlKey: true });
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    key({ key: 'Tab', code: 'Tab', ctrlKey: true });
    await waitFor(() => expect(title()).toBe('Loan desk'));
    key({ key: 'Tab', code: 'Tab', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(title()).toBe('Lend a thing'));

    // Only the active tab is in the Tab order; the arrows move focus, Enter activates, Delete closes.
    expect(tab('Lend a thing')).toHaveAttribute('tabindex', '0');
    expect(tab('Loan desk')).toHaveAttribute('tabindex', '-1');
    tab('Lend a thing').focus();
    fireEvent.keyDown(tab('Lend a thing'), { key: 'ArrowRight' });
    expect(tab('Loan desk')).toHaveFocus();
    fireEvent.keyDown(tab('Loan desk'), { key: 'Enter' });
    await waitFor(() => expect(title()).toBe('Loan desk'));
    fireEvent.keyDown(tab('Loan desk'), { key: 'Delete' });
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(tabs()).toEqual(['Lend a thing<']);
    await waitFor(() => expect(tab('Lend a thing')).toHaveFocus());
  });

  it('LA-V96-R13-T02 The address follows the active tab, clicked or cycled', async () => {
    await firstTab();
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go('/P-V01', 'Loan desk');
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    await settled('/P-D-UC01?stage=graph');
    key({ key: 'Tab', code: 'Tab', ctrlKey: true });
    await waitFor(() => expect(title()).toBe('Loan desk'));
    await settled('/P-V01?stage=graph');
  });

  it('LA-V96-R14-T01 Each tab keeps its own stage, depth, filters, wiki card and scroll; the layout is the window\'s', async () => {
    await firstTab();
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    const cardScroll = () => document.querySelector<HTMLElement>('.wiki-panel-scroll')!;
    const cardShows = (page: string) => waitFor(() => expect(screen.getByRole('region', { name: 'Wiki card' })).toHaveAttribute('data-page', page));
    // The first tab: depth 2, and the card scrolled.
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await cardShows('P-D-UC01');
    cardScroll().scrollTop = 120;
    fireEvent.scroll(cardScroll());
    await new Promise((r) => setTimeout(r, 260));

    // A new tab copies the stage, depth and filters; there, the ERD, and the card collapsed.
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go('/P-V01', 'Loan desk');
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true'));
    await cardShows('P-V01');
    expect(cardScroll().scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    // The layout is the window's: Nested here is Nested in every tab.
    fireEvent.click(screen.getByRole('button', { name: 'Nested' }));
    fireEvent.click(stageButton('ERD'));
    await settled('/P-V01?stage=erd');
    fireEvent.click(document.querySelector<HTMLElement>('.page-bar .wiki-panel-toggle')!);
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();

    // Back on the first tab: its Graph, its depth, its card, open, where it was scrolled.
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    await settled('/P-D-UC01?stage=graph');
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    await cardShows('P-D-UC01');
    expect(cardScroll().scrollTop).toBe(120);
    expect(screen.getByRole('button', { name: 'Nested' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Tree' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true'));
    // And the second: its ERD, its card collapsed, its depth.
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    await settled('/P-V01?stage=erd');
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true'));
    // The window's settings hold no depth, filters or card state; the tabs hold them.
    const settings = JSON.parse(window.sessionStorage.getItem('lathe:session-settings')!) as Record<string, unknown>;
    expect(Object.keys(settings)).not.toContain('depth');
    expect(Object.keys(settings)).not.toContain('hiddenKinds');
    expect(Object.keys(settings)).not.toContain('cardExpanded');
  });

  it('LA-V96-R14-T02 Each tab keeps its own camera on the Graph and the Trace, taken back at once when it is active again', async () => {
    const traceCamera = () => JSON.stringify((document.querySelector('.trace-flow') as TraceHost).traceScene!().camera);
    /** The camera, once it has stopped moving. */
    const still = async (read: () => string) => {
      let before = read();
      for (;;) {
        await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
        const now = read();
        if (now === before) return now;
        before = now;
      }
    };
    /** A scroll on the stage's canvas: the camera pans by it. */
    const pan = (deltaY: number) => fireEvent.wheel(document.querySelector('.focus-stage canvas')!, { deltaY, clientX: 200, clientY: 200 });
    await firstTab();
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    const framedGraph = await still(cameraOf);
    pan(40);
    const graph = await still(cameraOf);
    expect(graph).not.toBe(framedGraph);
    // A second tab, elsewhere; back on the first, its camera as it was.
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await settled('/P?stage=graph');
    await still(cameraOf);
    await new Promise((r) => setTimeout(r, 200));
    pan(-90);
    expect(await still(cameraOf)).not.toBe(graph);
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(await still(cameraOf)).toBe(graph);
    // The Trace: the first tab's camera there too.
    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(document.querySelector('.trace-flow[data-ready]')).not.toBeNull());
    const framedTrace = await still(traceCamera);
    pan(40);
    const trace = await still(traceCamera);
    expect(trace).not.toBe(framedTrace);
    // The second tab's Trace, zoomed out: its own camera.
    fireEvent.click(tab('Product'));
    await waitFor(() => expect(title()).toBe('Product'));
    fireEvent.click(stageButton('Trace'));
    await waitFor(() => expect(document.querySelector('.trace-flow[data-ready]')).not.toBeNull());
    await still(traceCamera);
    await new Promise((r) => setTimeout(r, 200));
    pan(-90);
    expect(await still(traceCamera)).not.toBe(trace);
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(await still(traceCamera)).toBe(trace);
  });

  it('LA-V96-R15-T04 Reloading brings back every tab with its place and history', async () => {
    await firstTab('/P-D-UC01?stage=trace');
    await go('/P-V01?stage=erd', 'Loan desk');
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go('/P-D-A1', 'Thing');
    fireEvent.click(tab('Loan desk'));
    await settled('/P-V01?stage=erd');
    await reload();
    await screen.findByRole('heading', { level: 1, name: 'Loan desk' });
    expect(tabs()).toEqual(['Loan desk<', 'Thing']);
    expect(screen.getByRole('region', { name: 'ERD stage' })).toBeInTheDocument();
    // Its history came back with it.
    await step(true, 'Lend a thing');
    expect(screen.getByRole('region', { name: 'Trace stage' })).toBeInTheDocument();
    await step(false, 'Loan desk');
    fireEvent.click(tab('Thing'));
    await settled('/P-D-A1?stage=erd');
    await step(true, 'Product');
  });

  it('LA-PAT-APP-UX-R06-T01 LA-PAT-APP-UX-R06-T02 Reloading brings back the same tabs in order, the active tab and each tab\'s stage', async () => {
    await firstTab();
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await go('/P-V01?stage=trace', 'Loan desk');
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(3));
    await go('/P-D-A1', 'Thing');
    fireEvent.click(tab('Lend a thing'));
    await settled('/P-D-UC01?stage=graph');
    const before = tabs();
    expect(before).toEqual(['Lend a thing<', 'Loan desk', 'Thing']);

    await reload();
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(tabs()).toEqual(before);
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    await settled('/P-V01?stage=trace');
    expect(screen.getByRole('region', { name: 'Trace stage' })).toBeInTheDocument();
  });

  it('LA-V96-R31-T02 Back and Forward step through the active tab\'s history, and switching tabs gives the window the new tab\'s history', async () => {
    await firstTab();
    await go('/P-V01', 'Loan desk');
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await settled('/P?stage=graph');
    await go('/P-D-A1', 'Thing');
    // Back and Forward in the second tab: its own entries.
    await step(true, 'Product');
    await step(false, 'Thing');
    expect(tabs()).toEqual(['Loan desk', 'Thing<']);
    // The first tab: the window now holds its history.
    fireEvent.click(tab('Loan desk'));
    await settled('/P-V01?stage=graph');
    await step(true, 'Lend a thing');
    expect(tabs()).toEqual(['Lend a thing<', 'Thing']);
    await step(false, 'Loan desk');
    // And the second tab's history is as it was.
    fireEvent.click(tab('Thing'));
    await settled('/P-D-A1?stage=graph');
    await step(true, 'Product');
    expect(tabs()).toEqual(['Loan desk', 'Product<']);
  });

  it('LA-V96-R15-T01 Each space keeps its own tabs: switching spaces swaps the tab set', async () => {
    await openApp('/DM-SHOP-UC01', { data: workspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    newTabKey();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await waitFor(() => expect(title()).toBe('Demo shop'));
    expect(tabs()).toEqual(['Add an item to the basket', 'Demo shop<']);
    // Another product's page: its own tabs.
    await go('/NF', 'Notebook');
    expect(tabs()).toEqual(['Notebook<']);
    // Back to the first space by its rail icon: its tabs, as they were.
    fireEvent.click(within(screen.getByRole('list', { name: 'Spaces' })).getByRole('link', { name: 'Demo shop' }));
    await waitFor(() => expect(title()).toBe('Demo shop'));
    expect(tabs()).toEqual(['Add an item to the basket', 'Demo shop<']);
    expect(boxElement('DM')).toBeDefined();
  });
});
