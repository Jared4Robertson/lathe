import './graph/setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { navigate } from '../src/router';
import { COMMANDS } from '../src/shell/keymap';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';
import { boxElements } from './graph/scene';

// Tabs for open pages, as editors are in VS Code (LA-EXP-UC10): the preview tab, lasting tabs,
// closing and cycling, each tab's own stage and wiki card scroll, and the address following
// the active tab, so a reload brings every tab back (LA-PAT-APP-UX-R06).

const served = () => ({ data: testWorkspace() });
const strip = () => screen.getByRole('tablist', { name: 'Open pages' });
/** The tabs as "name" with "*" for the preview and "<" for the active one. */
const tabs = () => within(strip()).getAllByRole('tab').map((t) => `${t.querySelector('.tab-title')!.textContent}${t.closest('.tab')!.classList.contains('is-preview') ? '*' : ''}${t.getAttribute('aria-selected') === 'true' ? '<' : ''}`);
const tab = (title: string) => within(strip()).getAllByRole('tab').find((t) => t.querySelector('.tab-title')!.textContent === title)!;
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
const address = () => window.location.pathname + window.location.search;
const go = async (to: string, heading: string) => {
  act(() => navigate(to));
  await waitFor(() => expect(title()).toBe(heading));
};
const stageButton = (name: 'Graph' | 'ERD' | 'Trace') => within(screen.getByRole('group', { name: 'Stage' })).getByRole('button', { name });
const key = (init: KeyboardEventInit & { key: string; code?: string }) => fireEvent.keyDown(document.body, init);

describe('tabs for open pages', () => {
  /** A use case's page in its preview tab. */
  const firstTab = async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
  };
  /** From the use case, a wiki link opened in the preview tab. */
  const linkOpened = async () => {
    await firstTab();
    fireEvent.click(within(screen.getByRole('region', { name: 'Wiki card' })).getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    await waitFor(() => expect(title()).toBe('The loan is recorded'));
  };

  it('LA-V96-R16-T01 Each tab shows its record\'s ID and title, a group\'s tab its label', async () => {
    await firstTab();
    const first = tab('Lend a thing');
    expect(first).toHaveAccessibleName('P-D-UC01 Lend a thing, preview');
    expect(first.querySelector('.tab-id')).toHaveTextContent('P-D-UC01');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', first.id);
    await go('/P-D/domain-model/term', 'Terms (1)');
    expect(tab('Terms (1)').querySelector('code')).toBeNull();
  });

  it('LA-V96-R10-T02 A plain open replaces the italic preview tab, and a page already open activates its tab', async () => {
    await firstTab();
    expect(tabs()).toEqual(['Lend a thing*<']);
    await linkOpened();
    expect(tabs()).toEqual(['The loan is recorded*<']);
    fireEvent.doubleClick(tab('The loan is recorded'));
    await go('/P-V01', 'Loan desk');
    await go('/P-D-UC01-R01', 'The loan is recorded');
    expect(tabs()).toEqual(['The loan is recorded<', 'Loan desk*']);
  });

  it('LA-V96-R11-T01 A double-click keeps the preview tab, and the next open adds a preview after it', async () => {
    await linkOpened();
    fireEvent.doubleClick(tab('The loan is recorded'));
    expect(tabs()).toEqual(['The loan is recorded<']);
    await go('/P-V01', 'Loan desk');
    expect(tabs()).toEqual(['The loan is recorded', 'Loan desk*<']);
  });

  it('LA-V96-R10-T03 A page opened shows in a tab: a link to an open page activates it, and Back reopens a closed page as the preview', async () => {
    await firstTab();
    const first = tab('Lend a thing');
    // The active preview tab's tooltip names the keep command; its close button, the close command.
    expect(first.closest('.tab')!.querySelector('.tab-close[aria-label="Close P-D-UC01 Lend a thing"]')).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+W');
    await linkOpened();
    expect(tabs()).toEqual(['The loan is recorded*<']);

    // Double-click keeps it; the next open adds a preview after it.
    fireEvent.doubleClick(tab('The loan is recorded'));
    expect(tabs()).toEqual(['The loan is recorded<']);
    await go('/P-V01', 'Loan desk');
    expect(tabs()).toEqual(['The loan is recorded', 'Loan desk*<']);
    // A group tab shows its label.
    await go('/P-D/domain-model/term', 'Terms (1)');
    expect(tabs()).toEqual(['The loan is recorded', 'Terms (1)*<']);
    expect(tab('Terms (1)').querySelector('code')).toBeNull();

    // A link to a page already open activates its tab.
    await go('/P-D-UC01-R01', 'The loan is recorded');
    expect(tabs()).toEqual(['The loan is recorded<', 'Terms (1)*']);

    // Clicking a tab activates it and the address follows.
    fireEvent.click(tab('Terms (1)'));
    await waitFor(() => expect(title()).toBe('Terms (1)'));
    expect(window.location.pathname).toBe('/P-D/domain-model/term');

    // Close the group tab; Back to it reopens it, as the preview.
    fireEvent.click(tab('Terms (1)').closest('.tab')!.querySelector('.tab-close[aria-label="Close Terms (1)"]')!);
    await waitFor(() => expect(title()).toBe('The loan is recorded'));
    expect(tabs()).toEqual(['The loan is recorded<']);
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    await waitFor(() => expect(title()).toBe('Terms (1)'));
    expect(tabs()).toEqual(['The loan is recorded', 'Terms (1)*<']);
  });

  it('LA-V96-R13-T02 The address follows the active tab, clicked or cycled', async () => {
    await firstTab();
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-V01', 'Loan desk');
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(window.location.pathname).toBe('/P-D-UC01');
    key({ key: 'Tab', code: 'Tab', ctrlKey: true });
    await waitFor(() => expect(title()).toBe('Loan desk'));
    expect(window.location.pathname).toBe('/P-V01');
  });

  it('LA-V96-R12-T02 Closing by button, middle-click or Alt+Shift+W activates the right neighbor or else the left, and the last tab stays as the preview', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-V01', 'Loan desk');
    fireEvent.doubleClick(tab('Loan desk'));
    await go('/P-D-A1', 'Thing');
    fireEvent.doubleClick(tab('Thing'));
    // Back to the middle tab, then close it: its right neighbor becomes active.
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    key({ key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    await waitFor(() => expect(title()).toBe('Thing'));
    expect(tabs()).toEqual(['Lend a thing', 'Thing<']);
    expect(window.location.pathname).toBe('/P-D-A1');
    // The rightmost closes: its left neighbor becomes active.
    fireEvent(tab('Thing'), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(tabs()).toEqual(['Lend a thing<']);
    // The last tab stays open, as a preview.
    key({ key: 'W', code: 'KeyW', altKey: true, shiftKey: true });
    expect(tabs()).toEqual(['Lend a thing*<']);
    expect(title()).toBe('Lend a thing');
  });

  it('LA-V96-R11-T02 The keep command keeps the preview tab', async () => {
    await firstTab();
    // Off a Mac the keep command is Alt+K then Enter (Ctrl+K is quick open there).
    key({ key: 'k', code: 'KeyK', altKey: true });
    key({ key: 'Enter', code: 'Enter' });
    expect(tabs()).toEqual(['Lend a thing<']);
  });

  it('LA-V96-R13-T01 Ctrl+Tab and Ctrl+Shift+Tab cycle, and on the focused strip the arrow keys move and Delete closes', async () => {
    for (const id of ['keepTab', 'closeTab', 'nextTab', 'previousTab']) expect(COMMANDS.find((c) => c.id === id)?.group).toBe('Navigate');
    await firstTab();
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-V01', 'Loan desk');
    expect(tabs()).toEqual(['Lend a thing', 'Loan desk*<']);

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

  it('LA-V96-R11-T03 Switching a preview tab\'s stage keeps it open', async () => {
    await firstTab();
    fireEvent.click(stageButton('ERD'));
    expect(tabs()).toEqual(['Lend a thing<']);
    expect(address()).toBe('/P-D-UC01?stage=erd');
  });

  it('LA-V96-R14-T01 Each tab keeps its own stage, side bar and wiki card scroll, and the graph\'s settings are the session\'s, whatever the tab', async () => {
    await firstTab();
    // The graph's depth, set here, is the session's.
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    const cardScroll = () => document.querySelector<HTMLElement>('.wiki-panel-scroll')!;
    // The card follows the focus once it settles, and its scroll is the page's from the moment it shows it.
    const cardShows = (page: string) => waitFor(() => expect(screen.getByRole('region', { name: 'Wiki card' })).toHaveAttribute('data-page', page));
    cardScroll().scrollTop = 120;
    fireEvent.scroll(cardScroll());
    // The ERD for this tab, its side bar hidden there.
    fireEvent.click(stageButton('ERD'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide the side bar' })[0]);

    // A new tab starts from the active one's stage; change it there, with the side bar left open.
    await go('/P-V01', 'Loan desk');
    expect(address()).toBe('/P-V01');
    expect(stageButton('ERD')).toHaveAttribute('aria-pressed', 'true');
    await cardShows('P-V01');
    expect(cardScroll().scrollTop).toBe(0);
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByRole('complementary', { name: 'Side bar' })).toBeInTheDocument();
    expect(tabs()).toEqual(['Lend a thing', 'Loan desk<']);

    // Back on the first tab: its ERD, its side bar hidden and its scroll.
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(address()).toBe('/P-D-UC01?stage=erd');
    expect(screen.getByRole('region', { name: 'ERD stage' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    await cardShows('P-D-UC01');
    expect(cardScroll().scrollTop).toBe(120);
    // The depth is the one last set, in any tab.
    fireEvent.click(stageButton('Graph'));
    await waitFor(() => expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(stageButton('ERD'));
    // And the second: the graph.
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    expect(address()).toBe('/P-V01?stage=graph');
    // A link naming another stage to a page open in a tab shows the tab as it was, and the address says so.
    await go('/P-D-UC01?stage=trace', 'Lend a thing');
    await waitFor(() => expect(address()).toBe('/P-D-UC01?stage=erd'));
    // A tab stores no graph or card settings.
    const stored = JSON.parse(window.sessionStorage.getItem('lathe:tabs')!) as Record<string, { tabs: { state: object }[] }>;
    const keys = Object.values(stored).flatMap((set) => set.tabs.map((t) => Object.keys(t.state))).flat();
    expect(keys).not.toContain('graph');
    expect(keys).not.toContain('card');
  });

  it('LA-V96-R15-T04 Reloading brings back each tab\'s stage', async () => {
    await openApp('/P-D-UC01?stage=trace', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-V01?stage=erd', 'Loan desk');
    fireEvent.doubleClick(tab('Loan desk'));
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    await openApp(address(), served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(screen.getByRole('region', { name: 'Trace stage' })).toBeInTheDocument();
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    expect(address()).toBe('/P-V01?stage=erd');
  });

  it('LA-PAT-APP-UX-R06-T01 LA-PAT-APP-UX-R06-T02 Reloading brings back the same tabs, the preview, the active tab and each tab\'s stage', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-V01?stage=trace', 'Loan desk');
    fireEvent.doubleClick(tab('Loan desk'));
    await go('/P-D-A1', 'Thing');
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    const before = { tabs: tabs(), address: address() };
    expect(before).toEqual({ tabs: ['Lend a thing<', 'Loan desk', 'Thing*'], address: '/P-D-UC01?stage=graph' });

    // Reload at the same address.
    await openApp(address(), served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(tabs()).toEqual(before.tabs);
    expect(screen.getByRole('region', { name: 'Graph stage' })).toBeInTheDocument();
    fireEvent.click(tab('Loan desk'));
    await waitFor(() => expect(title()).toBe('Loan desk'));
    expect(address()).toBe('/P-V01?stage=trace');
    expect(screen.getByRole('region', { name: 'Trace stage' })).toBeInTheDocument();
  });

  it('LA-V96-R15-T01 Each space keeps its own tabs: switching spaces swaps the tab set', async () => {
    await openApp('/DM-SHOP-UC01', { data: workspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    fireEvent.doubleClick(tab('Add an item to the basket'));
    await go('/DM', 'Demo shop');
    expect(tabs()).toEqual(['Add an item to the basket', 'Demo shop*<']);
    // Another product's page: its own tabs.
    await go('/NF', 'Notebook');
    expect(tabs()).toEqual(['Notebook*<']);
    // Back to the first space by its rail icon: the last page there, in its tab set.
    fireEvent.click(within(screen.getByRole('list', { name: 'Spaces' })).getByRole('link', { name: 'Demo shop' }));
    await waitFor(() => expect(title()).toBe('Demo shop'));
    expect(tabs()).toEqual(['Add an item to the basket', 'Demo shop*<']);
  });
});
