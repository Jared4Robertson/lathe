import './graph/setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { COMMANDS, OVERRIDES_KEY, ariaKeyShortcuts, formatBinding, resolveCommands } from '../src/shell/keymap';
import { TOOLTIP_DELAY } from '../src/shell/Tooltip';
import { openApp, openSideBar } from './helpers';
import { testWorkspace } from './graph/workspace';

// Shortcut hints the standard way: tooltips that name a control and its keys, the palette's
// right-aligned keys, and aria-keyshortcuts, all read from the one keymap with its overrides.

const nav = () => screen.getByRole('navigation', { name: 'Main' });
const tooltip = () => screen.getByRole('tooltip');
const asMac = () => Object.defineProperty(window.navigator, 'platform', { value: 'MacIntel', configurable: true });
afterEach(() => { delete (window.navigator as unknown as Record<string, unknown>).platform; });

/** Focus as the keyboard does: a key is pressed first (Tab), then the control takes focus. */
const keyFocus = (el: HTMLElement) => act(() => { fireEvent.keyDown(document.body, { key: 'Tab', code: 'Tab' }); el.focus(); });
const openPalette = () => fireEvent.keyDown(document.body, { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true });

describe('shortcut hints', () => {
  const proveLaV61R13T01 = async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const collapse = within(nav()).getByRole('button', { name: 'Collapse the navigation' });
    expect(collapse).not.toHaveAttribute('title');

    // Hover: nothing at once, then the tooltip after the delay.
    fireEvent.mouseEnter(collapse);
    expect(screen.queryByRole('tooltip')?.textContent ?? null).toBeNull();
    await waitFor(() => expect(tooltip()).toHaveTextContent('Collapse the navigation Ctrl+B'), { timeout: TOOLTIP_DELAY + 1000 });
    expect(collapse).toHaveAttribute('aria-describedby', tooltip().id);
    expect(tooltip().querySelector('kbd')).toHaveTextContent('Ctrl+B');
    fireEvent.mouseLeave(collapse);
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Keyboard focus: at once; Escape closes it.
    const graphToggle = within(await screen.findByRole('group', { name: 'View' })).getByRole('button', { name: 'Graph', pressed: false });
    keyFocus(graphToggle);
    expect(tooltip()).toHaveTextContent('Graph view Alt+G');
    fireEvent.keyDown(graphToggle, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => graphToggle.blur());

    // A click focuses without a tooltip.
    fireEvent.pointerDown(graphToggle);
    fireEvent.mouseDown(graphToggle);
    act(() => graphToggle.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
  };
  it('LA-V61-R13-T01 A tooltip names the control and its keys after a short hover or at once on keyboard focus, not on a click, and Escape or leaving closes it', proveLaV61R13T01);
  it('LA-V61-R16-T01 A tooltip never gets in the way: one at a time, none on a click, and Escape closes it', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const view = await screen.findByRole('group', { name: 'View' });
    const graphToggle = within(view).getByRole('button', { name: 'Graph', pressed: false });
    keyFocus(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    keyFocus(graphToggle);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
    fireEvent.keyDown(graphToggle, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => graphToggle.blur());
    fireEvent.pointerDown(graphToggle);
    fireEvent.mouseDown(graphToggle);
    act(() => graphToggle.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  const proveLaPltDs01T01 = async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    // In Apple's order: ⌃ ⌥ ⇧ ⌘.
    expect(formatBinding('Mod+Shift+P', true)).toBe('⇧⌘P');
    expect(formatBinding('Mod+Alt+B', true)).toBe('⌥⌘B');
    expect(formatBinding('Ctrl+-', true)).toBe('⌃-');
    expect(formatBinding('Alt+1', true)).toBe('⌥1');
    expect(formatBinding('Mod+Shift+P', false)).toBe('Ctrl+Shift+P');
    expect(formatBinding('Alt+1', false)).toBe('Alt+1');

    asMac();
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    keyFocus(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    expect(tooltip()).toHaveTextContent('Collapse the navigation ⌘B');
    keyFocus(screen.getByRole('button', { name: 'Hide the side bar', expanded: true }));
    expect(tooltip()).toHaveTextContent('the side bar ⌥⌘B');
    keyFocus(within(within(nav()).getByRole('list', { name: 'Spaces' })).getAllByRole('link')[0]);
    expect(tooltip().querySelector('kbd')).toHaveTextContent('⌥1');
    expect(within(nav()).getByRole('combobox', { name: 'Quick find' })).toHaveAttribute('placeholder', 'Go to… ⌘P');

    fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', metaKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    await userEvent.setup().type(within(palette).getByRole('combobox'), 'graph view');
    expect(within(palette).getAllByRole('option')[0].querySelector('kbd')).toHaveTextContent('⌃G');
    fireEvent.keyDown(within(palette).getByRole('combobox'), { key: 'Escape' });
    // On a Mac the view toggles show Ctrl+W, Ctrl+G and Ctrl+M (Cmd+W stays the browser's).
    for (const [name, keys, shown] of [['Wiki', 'Control+W Control+1', '⌃W'], ['Graph', 'Control+G Control+2', '⌃G']]) {
      const toggle = within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name });
      expect(toggle).toHaveAttribute('aria-keyshortcuts', keys);
      keyFocus(toggle);
      expect(tooltip().querySelector('kbd')).toHaveTextContent(shown);
    }
  };
  it('LA-PLT-DS01-T01 Tooltips and palette rows show the keys for the platform: ⌃ ⌥ ⇧ ⌘ on a Mac, Ctrl+ elsewhere', proveLaPltDs01T01);
  it('LA-V61-R13-T02 Tooltips and palette rows show the keys as the platform shows them', proveLaPltDs01T01);

  it('LA-V64-R02-T01 The command palette lists each command with its shortcut right-aligned in kbd styling', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    openPalette();
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    const options = within(palette).getAllByRole('option');
    const nav = options.find((o) => o.textContent!.startsWith('Show or hide the navigation'))!;
    const keys = nav.lastElementChild!;
    expect(keys.tagName).toBe('KBD');
    expect(keys).toHaveClass('kbd', 'kbd-hint');
    expect(keys).toHaveTextContent('Ctrl+B');
    expect(nav).toHaveAttribute('aria-keyshortcuts', 'Control+B');
    // A command without keys shows none.
    const expand = options.find((o) => o.textContent === 'Expand all rows on this page')!;
    expect(expand.querySelector('kbd')).toBeNull();
    const css = (await import('node:fs')).readFileSync((await import('node:path')).resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(css).toMatch(/\.kbd-hint\s*\{[^}]*margin-left:\s*auto/);
    expect(css).toMatch(/\.palette-list li\s*\{[^}]*justify-content:\s*space-between/);
  });

  it('LA-V61-R15-T01 A rebinding in local storage changes the tooltip, the palette, the sheet and aria-keyshortcuts', async () => {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ toggleNav: 'Mod+J', viewGraph: ['Alt+G'] }));
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const collapse = within(nav()).getByRole('button', { name: 'Collapse the navigation' });
    expect(collapse).toHaveAttribute('aria-keyshortcuts', 'Control+J');
    keyFocus(collapse);
    expect(tooltip()).toHaveTextContent('Collapse the navigation Ctrl+J');
    const graph = within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name: 'Graph' });
    expect(graph).toHaveAttribute('aria-keyshortcuts', 'Alt+G');
    keyFocus(graph);
    expect(tooltip()).toHaveTextContent('Graph view Alt+G');

    openPalette();
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    expect(within(palette).getAllByRole('option').find((o) => o.textContent!.startsWith('Show or hide the navigation'))!.querySelector('kbd')).toHaveTextContent('Ctrl+J');
    fireEvent.keyDown(within(palette).getByRole('combobox'), { key: 'Escape' });

    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(sheet).getByRole('rowheader', { name: 'Show or hide the navigation' }).nextElementSibling).toHaveTextContent('Ctrl+J');
    expect(within(sheet).getByRole('rowheader', { name: 'Graph view on or off' }).nextElementSibling).toHaveTextContent('Alt+G');
  });

  const proveLaPltDs01T02 = async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    expect(ariaKeyShortcuts(['Mod+P', 'Mod+K'], false)).toBe('Control+P Control+K');
    expect(ariaKeyShortcuts(['Mod+P'], true)).toBe('Meta+P');
    expect(ariaKeyShortcuts(['g c'], false)).toBe('');
    expect(ariaKeyShortcuts(['+', '='], false)).toBe('Plus =');
    expect(ariaKeyShortcuts(['Mod+Alt+B'], false)).toBe('Control+Alt+B');

    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    expect(within(nav()).getByRole('button', { name: 'Collapse the navigation' })).toHaveAttribute('aria-keyshortcuts', 'Control+B');
    expect(within(nav()).getByRole('combobox', { name: 'Quick find' })).toHaveAttribute('aria-keyshortcuts', 'Control+P Control+K');
    expect(within(within(nav()).getByRole('list', { name: 'Spaces' })).getAllByRole('link')[0]).toHaveAttribute('aria-keyshortcuts', 'Alt+1');
    expect(within(nav()).getByRole('link', { name: /^Checks \d+/ })).toHaveAttribute('aria-keyshortcuts', 'Control+Shift+M');
    // Off a Mac: Alt+W and Alt+G first, as Ctrl+W closes the tab and Ctrl+G finds the next match.
    for (const [name, keys] of [['Wiki', 'Alt+W Control+1'], ['Graph', 'Alt+G Control+2']]) {
      expect(within(screen.getByRole('group', { name: 'View' })).getByRole('button', { name })).toHaveAttribute('aria-keyshortcuts', keys);
    }
    expect(screen.getByRole('button', { name: 'Full screen: Wiki' })).toHaveAttribute('aria-keyshortcuts', 'Control+3');
    // The corner toggle and the side bar's own close button.
    expect(screen.getByRole('button', { name: 'Hide the side bar', expanded: true })).toHaveAttribute('aria-keyshortcuts', 'Control+Alt+B');
    expect(within(screen.getByRole('complementary', { name: 'Side bar' })).getByRole('button', { name: 'Hide the side bar' })).toHaveAttribute('aria-keyshortcuts', 'Control+Alt+B');

    // In the graph: the depth buttons and full screen.
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2', ctrlKey: true });
    await waitFor(() => expect(screen.getByRole('group', { name: 'Depth' })).toBeInTheDocument());
    expect(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '2' })).toHaveAttribute('aria-keyshortcuts', 'Plus =');
    // At depth 1 nothing is below it; one step up, - leads back to 1.
    expect(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '1' })).not.toHaveAttribute('aria-keyshortcuts');
    fireEvent.click(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '2' }));
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '1' })).toHaveAttribute('aria-keyshortcuts', '-'));
    expect(within(screen.getByRole('group', { name: 'Depth' })).getByRole('button', { name: '3' })).toHaveAttribute('aria-keyshortcuts', 'Plus =');
    expect(screen.getByRole('button', { name: 'Full screen: Graph' })).toHaveAttribute('aria-keyshortcuts', 'Control+3');
  };
  it('LA-PLT-DS01-T02 Every control with a shortcut carries aria-keyshortcuts from the keymap', proveLaPltDs01T02);
  it('LA-V61-R12-T01 Every control with a shortcut names the platform\'s keys in aria-keyshortcuts', proveLaPltDs01T02);
  it('LA-V61-R14-T01 Every control with a shortcut carries aria-keyshortcuts', proveLaPltDs01T02);

  it('LA-V65-R01-T01 The shortcuts sheet matches the hints: one Switch to row per product, with the same keys', async () => {
    const resolved = resolveCommands({}, false);
    expect(resolved.filter((c) => c.id.startsWith('switchSpace')).map((c) => c.keys[0])).toEqual(['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6', 'Alt+7', 'Alt+8', 'Alt+9']);
    expect(COMMANDS.filter((c) => c.dynamic).length).toBe(9);

    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true });
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const rows = within(sheet).getAllByRole('rowheader').filter((r) => r.textContent!.startsWith('Switch to'));
    expect(rows.map((r) => [r.textContent, r.nextElementSibling!.textContent])).toEqual([
      ['Switch to Demo shop', 'Alt+1'],
      ['Switch to Notebook', 'Alt+2'],
    ]);
    fireEvent.keyDown(within(sheet).getByRole('searchbox'), { key: 'Escape' });
    keyFocus(within(within(nav()).getByRole('list', { name: 'Spaces' })).getByRole('link', { name: 'Notebook' }));
    expect(tooltip()).toHaveTextContent('Notebook Alt+2');
  });
});
