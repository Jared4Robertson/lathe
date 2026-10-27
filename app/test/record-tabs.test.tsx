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
// closing and cycling, each tab's own views, scroll and graph settings, and the address following
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
const viewToggle = (name: 'Wiki' | 'Graph') => within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name });
const key = (init: KeyboardEventInit & { key: string; code?: string }) => fireEvent.keyDown(document.body, init);

describe('tabs for open pages', () => {
  it('LA-EXP-T115 A plain open replaces the italic preview tab, a double-click keeps it, a page already open activates its tab, and Back reopens a closed page as the preview', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(tabs()).toEqual(['Lend a thing*<']);
    const first = tab('Lend a thing');
    expect(first).toHaveAccessibleName('P-D-UC01 Lend a thing, preview');
    expect(first.querySelector('.tab-id')).toHaveTextContent('P-D-UC01');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', first.id);
    // The active preview tab's tooltip names the keep command; its close button, the close command.
    expect(first.closest('.tab')!.querySelector('.tab-close[aria-label="Close P-D-UC01 Lend a thing"]')).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+W');

    // A wiki link opens in the preview tab, replacing it.
    fireEvent.click(within(screen.getByRole('region', { name: 'Wiki pane' })).getAllByRole('link', { name: /P-D-UC01-R01/ })[0]);
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    expect(tabs()).toEqual(['The owner is shown*<']);

    // Double-click keeps it; the next open adds a preview after it.
    fireEvent.doubleClick(tab('The owner is shown'));
    expect(tabs()).toEqual(['The owner is shown<']);
    await go('/P-D-V01', 'Thing page');
    expect(tabs()).toEqual(['The owner is shown', 'Thing page*<']);
    // A group tab shows its label.
    await go('/P-D/design/interaction-design/view', 'Views (1)');
    expect(tabs()).toEqual(['The owner is shown', 'Views (1)*<']);
    expect(tab('Views (1)').querySelector('code')).toBeNull();

    // A link to a page already open activates its tab.
    await go('/P-D-UC01-R01', 'The owner is shown');
    expect(tabs()).toEqual(['The owner is shown<', 'Views (1)*']);

    // Clicking a tab activates it and the address follows.
    fireEvent.click(tab('Views (1)'));
    await waitFor(() => expect(title()).toBe('Views (1)'));
    expect(window.location.pathname).toBe('/P-D/design/interaction-design/view');

    // Close the group tab; Back to it reopens it, as the preview.
    fireEvent.click(tab('Views (1)').closest('.tab')!.querySelector('.tab-close[aria-label="Close Views (1)"]')!);
    await waitFor(() => expect(title()).toBe('The owner is shown'));
    expect(tabs()).toEqual(['The owner is shown<']);
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    await waitFor(() => expect(title()).toBe('Views (1)'));
    expect(tabs()).toEqual(['The owner is shown', 'Views (1)*<']);
  });

  it('LA-EXP-T116 Closing by button, middle-click or Alt+Shift+W activates the right neighbor or else the left, and the last tab stays as the preview', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-D-V01', 'Thing page');
    fireEvent.doubleClick(tab('Thing page'));
    await go('/P-D-A1', 'Thing');
    fireEvent.doubleClick(tab('Thing'));
    // Back to the middle tab, then close it: its right neighbor becomes active.
    fireEvent.click(tab('Thing page'));
    await waitFor(() => expect(title()).toBe('Thing page'));
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

  it('LA-EXP-T117 Ctrl+Tab and Ctrl+Shift+Tab cycle, the keep command keeps the preview, and on the focused strip the arrow keys move and Delete closes', async () => {
    for (const id of ['keepTab', 'closeTab', 'nextTab', 'previousTab']) expect(COMMANDS.find((c) => c.id === id)?.group).toBe('Navigate');
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // Off a Mac the keep command is Alt+K then Enter (Ctrl+K is quick open there).
    key({ key: 'k', code: 'KeyK', altKey: true });
    key({ key: 'Enter', code: 'Enter' });
    expect(tabs()).toEqual(['Lend a thing<']);
    await go('/P-D-V01', 'Thing page');
    expect(tabs()).toEqual(['Lend a thing', 'Thing page*<']);

    key({ key: 'Tab', code: 'Tab', ctrlKey: true });
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    key({ key: 'Tab', code: 'Tab', ctrlKey: true });
    await waitFor(() => expect(title()).toBe('Thing page'));
    key({ key: 'Tab', code: 'Tab', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(title()).toBe('Lend a thing'));

    // Only the active tab is in the Tab order; the arrows move focus, Enter activates, Delete closes.
    expect(tab('Lend a thing')).toHaveAttribute('tabindex', '0');
    expect(tab('Thing page')).toHaveAttribute('tabindex', '-1');
    tab('Lend a thing').focus();
    fireEvent.keyDown(tab('Lend a thing'), { key: 'ArrowRight' });
    expect(tab('Thing page')).toHaveFocus();
    fireEvent.keyDown(tab('Thing page'), { key: 'Enter' });
    await waitFor(() => expect(title()).toBe('Thing page'));
    fireEvent.keyDown(tab('Thing page'), { key: 'Delete' });
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(tabs()).toEqual(['Lend a thing<']);
    await waitFor(() => expect(tab('Lend a thing')).toHaveFocus());
  });

  it('LA-EXP-T118 Each tab keeps its own views, wiki scroll and graph settings, and switching its views keeps it open', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // Opening the graph keeps the preview tab, and sets its depth.
    fireEvent.click(viewToggle('Graph'));
    expect(tabs()).toEqual(['Lend a thing<']);
    expect(address()).toBe('/P-D-UC01?view=wiki,graph');
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    const wiki = () => document.querySelector<HTMLElement>('.pane-wiki > .pane-scroll')!;
    wiki().scrollTop = 120;
    fireEvent.scroll(wiki());

    // A new tab starts from the active one's views and settings; change them there.
    await go('/P-D-V01', 'Thing page');
    expect(address()).toBe('/P-D-V01');
    expect(viewToggle('Graph')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    expect(wiki().scrollTop).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close the graph pane' }));
    expect(tabs()).toEqual(['Lend a thing', 'Thing page<']);

    // Back on the first tab: its two panes, its depth and its scroll.
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    expect(address()).toBe('/P-D-UC01?view=wiki,graph');
    expect(screen.getByRole('region', { name: 'Graph pane' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true'));
    expect(wiki().scrollTop).toBe(120);
    // And the second: the wiki alone.
    fireEvent.click(tab('Thing page'));
    await waitFor(() => expect(title()).toBe('Thing page'));
    expect(address()).toBe('/P-D-V01?view=wiki');
    expect(screen.queryByRole('region', { name: 'Graph pane' })).toBeNull();
    // A link naming other views to a page open in a tab shows the tab as it was, and the address says so.
    await go('/P-D-UC01?view=wiki', 'Lend a thing');
    await waitFor(() => expect(address()).toBe('/P-D-UC01?view=wiki,graph'));
  });

  it('LA-PLT-T48 Reloading brings back the same tabs, the preview, the active tab and each tab\'s views', async () => {
    await openApp('/P-D-UC01?view=wiki,graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    fireEvent.doubleClick(tab('Lend a thing'));
    await go('/P-D-V01?view=wiki', 'Thing page');
    fireEvent.doubleClick(tab('Thing page'));
    await go('/P-D-A1', 'Thing');
    fireEvent.click(tab('Lend a thing'));
    await waitFor(() => expect(title()).toBe('Lend a thing'));
    const before = { tabs: tabs(), address: address() };
    expect(before).toEqual({ tabs: ['Lend a thing<', 'Thing page', 'Thing*'], address: '/P-D-UC01?view=wiki,graph' });

    // Reload at the same address.
    await openApp(address(), served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(tabs()).toEqual(before.tabs);
    expect(screen.getByRole('region', { name: 'Graph pane' })).toBeInTheDocument();
    fireEvent.click(tab('Thing page'));
    await waitFor(() => expect(title()).toBe('Thing page'));
    expect(address()).toBe('/P-D-V01?view=wiki');
    expect(screen.queryByRole('region', { name: 'Graph pane' })).toBeNull();
  });

  it('LA-EXP-T119 Each space keeps its own tabs: switching spaces swaps the tab set', async () => {
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
