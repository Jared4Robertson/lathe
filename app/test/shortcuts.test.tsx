import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';
import { COMMANDS } from '../src/shell/keymap';
import { boxElement, isCenter } from './graph/scene';

// Shortcuts end to end: each key press goes to the window's listener, as in the browser. The test
// browser is not a Mac, so Mod is Ctrl.

const press = (target: Element, key: string, code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  fireEvent.keyDown(target, { key, code, ...mods });
const active = () => (document.activeElement ?? document.body) as HTMLElement;
const nav = () => screen.getByRole('navigation', { name: 'Main' });
const quickFind = () => within(screen.getByRole('dialog', { name: 'Quick find' })).getByRole('combobox', { name: 'Quick find' });
const announcer = () => screen.getByTestId('announcer');
const node = (id: string) => boxElement(id);

describe('keyboard shortcuts', () => {
  it('LA-V61-R08-T01 Ctrl+P (or Ctrl+K) opens quick find, from anywhere', async () => {
    await openApp('/DM?panel=checks');
    await screen.findByRole('region', { name: 'Checks' });
    press(document.body, 'p', 'KeyP', { ctrlKey: true });
    await waitFor(() => expect(quickFind()).toHaveFocus());
    fireEvent.keyDown(quickFind(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    // From a collapsed nav too: it opens over the page, and the nav stays collapsed.
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    press(document.body, 'k', 'KeyK', { ctrlKey: true });
    await waitFor(() => expect(quickFind()).toHaveFocus());
    expect(nav().className).toContain('is-rail');
  });

  it('LA-V61-R09-T02 Ctrl+P keeps the browser from printing, and a key nobody handles is left to the browser', async () => {
    await openApp('/DM?panel=checks');
    await screen.findByRole('region', { name: 'Checks' });
    const event = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    const other = new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('LA-V61-R08-T02 Ctrl+B hides and shows the nav', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, 'b', 'KeyB', { ctrlKey: true });
    expect(nav().className).toContain('is-rail');
    press(document.body, 'b', 'KeyB', { ctrlKey: true });
    expect(nav().className).not.toContain('is-rail');
    // Ctrl+Alt+B toggles nothing any more: the page keeps its panels.
    const event = new KeyboardEvent('keydown', { key: '∫', code: 'KeyB', ctrlKey: true, altKey: true, bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(nav().className).not.toContain('is-rail');
  });

  it('LA-V61-R11-T01 Hiding or showing the nav by keyboard is announced', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, 'b', 'KeyB', { ctrlKey: true });
    await waitFor(() => expect(announcer()).toHaveTextContent('Navigation collapsed'));
    press(document.body, 'b', 'KeyB', { ctrlKey: true });
    await waitFor(() => expect(announcer()).toHaveTextContent('Navigation expanded'));
  });

  it('LA-V61-R08-T03 Alt+G, Alt+E and Alt+T (or Ctrl+1, 2 and 3) switch the stage off a Mac, on every focus; Enter and Alt+W collapse and show the wiki card', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    // A use case has every stage too (LA-PAT-APP-UX-R17).
    press(document.body, '2', 'Digit2', { ctrlKey: true });
    expect(window.location.search).toBe('?stage=erd');
    press(document.body, 't', 'KeyT', { altKey: true });
    expect(window.location.search).toBe('?stage=trace');
    press(document.body, '1', 'Digit1', { ctrlKey: true });
    expect(window.location.search).toBe('?stage=graph');
    press(document.body, 'e', 'KeyE', { altKey: true });
    expect(window.location.search).toBe('?stage=erd');
    press(document.body, '3', 'Digit3', { ctrlKey: true });
    expect(window.location.search).toBe('?stage=trace');
    press(document.body, 'g', 'KeyG', { altKey: true });
    expect(window.location.search).toBe('?stage=graph');

    // Enter, and Alt+W off a Mac, collapse and show the wiki card.
    expect(screen.getByRole('region', { name: 'Wiki card' })).toBeInTheDocument();
    press(document.body, 'Enter', 'Enter');
    expect(screen.queryByRole('region', { name: 'Wiki card' })).toBeNull();
    press(document.body, 'w', 'KeyW', { altKey: true });
    expect(screen.getByRole('region', { name: 'Wiki card' })).toBeInTheDocument();
    // There are no panes to maximize: the old keys do nothing.
    press(document.body, 'Enter', 'Enter', { ctrlKey: true, shiftKey: true });
    expect(document.querySelector('.is-fullscreen, .pane')).toBeNull();
  });

  it('LA-V61-R11-T02 A stage switched by a key is announced, and so is the wiki card collapsed or shown', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, '2', 'Digit2', { ctrlKey: true });
    await waitFor(() => expect(announcer()).toHaveTextContent('ERD stage'));
    press(document.body, 'Enter', 'Enter');
    await waitFor(() => expect(announcer()).toHaveTextContent('Wiki card collapsed'));
    press(document.body, 'Enter', 'Enter');
    await waitFor(() => expect(announcer()).toHaveTextContent('Wiki card shown'));
  });

  it('LA-V61-R11-T03 F8 says which problem it moved to', async () => {
    await openApp('/DM?panel=checks');
    await screen.findByRole('region', { name: 'Checks' });
    const problems = [...document.querySelectorAll<HTMLElement>('#main li.problem, .tool-panel li.problem')];
    press(document.body, 'F8', 'F8');
    await waitFor(() => expect(announcer()).toHaveTextContent(`Problem 1 of ${problems.length}`));
  });

  it('LA-V61-R08-T04 F8 and Shift+F8 move through the problems on the page', async () => {
    await openApp('/DM?panel=checks');
    await screen.findByRole('region', { name: 'Checks' });
    const problems = [...document.querySelectorAll<HTMLElement>('#main li.problem, .tool-panel li.problem')];
    expect(problems.length).toBeGreaterThan(1);
    press(document.body, 'F8', 'F8');
    expect(active()).toBe(problems[0]);
    press(active(), 'F8', 'F8');
    expect(active()).toBe(problems[1]);
    press(active(), 'F8', 'F8', { shiftKey: true });
    expect(active()).toBe(problems[0]);
    press(active(), 'F8', 'F8', { shiftKey: true });
    expect(active()).toBe(problems[problems.length - 1]);
  });

  /** Opens the shortcuts sheet on a use case's page, as ? does. */
  const openSheet = async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, '?', 'Slash', { shiftKey: true });
    return screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
  };
  const row = (sheet: HTMLElement, title: string) => within(sheet).getByRole('rowheader', { name: title }).closest('tr')!;
  /** The prompt a refusal shows, in its own row under the shortcut's. */
  const offerOf = (sheet: HTMLElement, title: string) => within(row(sheet, title).nextElementSibling as HTMLElement).getByRole('alert');
  const keysIn = (tr: HTMLElement) => [...tr.querySelectorAll('.shortcut-key-list kbd')].map((k) => k.textContent);

  it('LA-V61-R10-T02 In the shortcuts sheet a person changes a key, adds one, removes one, and resets the shortcut and then all', async () => {
    const sheet = await openSheet();
    const nav = row(sheet, 'Show or hide the navigation');
    // Change Ctrl+B: the recorder takes the next key, and every hint follows at once.
    fireEvent.click(within(nav).getByRole('button', { name: 'Change Ctrl+B of Show or hide the navigation' }));
    const recorder = within(nav).getByRole('button', { name: 'Press a key for Show or hide the navigation, in place of Ctrl+B. Escape cancels.' });
    await waitFor(() => expect(recorder).toHaveFocus());
    fireEvent.keyDown(recorder, { key: 'j', code: 'KeyJ', ctrlKey: true });
    expect(keysIn(row(sheet, 'Show or hide the navigation'))).toEqual(['Ctrl+J']);
    await waitFor(() => expect(announcer()).toHaveTextContent('Show or hide the navigation: Ctrl+J'));
    await waitFor(() => expect(within(row(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Add a key to Show or hide the navigation' })).toHaveFocus());
    // Add a second key, then remove it.
    fireEvent.click(within(row(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Add a key to Show or hide the navigation' }));
    fireEvent.keyDown(within(sheet).getByRole('button', { name: 'Press a key for Show or hide the navigation. Escape cancels.' }), { key: 'n', code: 'KeyN', ctrlKey: true, altKey: true });
    expect(keysIn(row(sheet, 'Show or hide the navigation'))).toEqual(['Ctrl+J', 'Ctrl+Alt+N']);
    fireEvent.click(within(row(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Remove Ctrl+Alt+N from Show or hide the navigation' }));
    expect(keysIn(row(sheet, 'Show or hide the navigation'))).toEqual(['Ctrl+J']);
    // A changed shortcut shows Reset; Reset puts its own keys back.
    expect(row(sheet, 'Show or hide the navigation')).toHaveAttribute('data-changed');
    fireEvent.click(within(row(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Reset Show or hide the navigation' }));
    expect(keysIn(row(sheet, 'Show or hide the navigation'))).toEqual(['Ctrl+B']);
    expect(within(row(sheet, 'Show or hide the navigation')).queryByRole('button', { name: /^Reset/ })).toBeNull();
    // Reset all asks first, then gives every shortcut its own keys again.
    expect(within(sheet).getByRole('button', { name: 'Reset all' })).toBeDisabled();
    fireEvent.click(within(row(sheet, 'Go home (all products)')).getByRole('button', { name: 'Remove g then h from Go home (all products)' }));
    expect(offerOf(sheet, 'Go home (all products)')).toHaveTextContent('“Go home (all products)” would have no key.');
    fireEvent.click(within(offerOf(sheet, 'Go home (all products)')).getByRole('button', { name: 'Leave without a key' }));
    expect(within(row(sheet, 'Go home (all products)')).getByText('No key')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Reset all' }));
    fireEvent.click(within(within(sheet).getByRole('alert')).getByRole('button', { name: 'Reset all' }));
    expect(keysIn(row(sheet, 'Go home (all products)'))).toEqual(['g then h']);
    expect(window.localStorage.getItem('lathe:keybindings')).toBe('{}');
  });

  it('LA-V61-R51-T01 A key another shortcut has shows at once, naming it, with Swap and Cancel', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(row(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Change Ctrl+B of Show or hide the navigation' }));
    fireEvent.keyDown(within(sheet).getByRole('button', { name: /^Press a key for Show or hide the navigation/ }), { key: 'M', code: 'KeyM', ctrlKey: true, shiftKey: true });
    const offer = offerOf(sheet, 'Show or hide the navigation');
    expect(offer).toHaveTextContent('Ctrl+Shift+M is already “Open Checks”.');
    await waitFor(() => expect(within(offer).getByRole('button', { name: 'Swap' })).toHaveFocus());
    // Cancel leaves both as they were.
    fireEvent.click(within(offer).getByRole('button', { name: 'Cancel' }));
    expect(keysIn(row(sheet, 'Show or hide the navigation'))).toEqual(['Ctrl+B']);
    // Swap: the navigation takes Ctrl+Shift+M, Open Checks gets Ctrl+B.
    fireEvent.click(within(row(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Change Ctrl+B of Show or hide the navigation' }));
    fireEvent.keyDown(within(sheet).getByRole('button', { name: /^Press a key for Show or hide the navigation/ }), { key: 'M', code: 'KeyM', ctrlKey: true, shiftKey: true });
    fireEvent.click(within(offerOf(sheet, 'Show or hide the navigation')).getByRole('button', { name: 'Swap' }));
    expect(keysIn(row(sheet, 'Show or hide the navigation'))).toEqual(['Ctrl+Shift+M']);
    expect(keysIn(row(sheet, 'Open Checks'))).toEqual(['Ctrl+B']);
    // A key the browser keeps is refused with its reason.
    fireEvent.click(within(row(sheet, 'Open Checks')).getByRole('button', { name: 'Add a key to Open Checks' }));
    fireEvent.keyDown(within(sheet).getByRole('button', { name: /^Press a key for Open Checks/ }), { key: 'w', code: 'KeyW', ctrlKey: true });
    expect(offerOf(sheet, 'Open Checks')).toHaveTextContent('Ctrl+W belongs to the browser or the system, so "Open Checks" cannot take it.');
  });

  it('LA-V61-R52-T01 Recording a key works from the keyboard: Escape cancels without closing the sheet, and the key pressed reaches no command', async () => {
    const sheet = await openSheet();
    const add = within(row(sheet, 'Step left')).getByRole('button', { name: 'Add a key to Step left' });
    fireEvent.click(add);
    const recorder = within(sheet).getByRole('button', { name: 'Press a key for Step left. Escape cancels.' });
    // Modifiers alone wait for the key; ? would open the sheet, Ctrl+B hide the navigation: here they are only recorded.
    fireEvent.keyDown(recorder, { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    expect(recorder).toBeInTheDocument();
    fireEvent.keyDown(recorder, { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /^Press a key/ })).toBeNull();
    fireEvent.click(within(row(sheet, 'Step left')).getByRole('button', { name: 'Add a key to Step left' }));
    fireEvent.keyDown(within(sheet).getByRole('button', { name: /^Press a key for Step left/ }), { key: 'y', code: 'KeyY' });
    expect(keysIn(row(sheet, 'Step left'))).toEqual(['←', 'a', 'h', 'y']);
    expect(nav()).not.toHaveClass('is-rail');
    // The ARIA tree's own keys and the browser's are shown, fixed.
    expect(within(row(sheet, 'Expand the row (or move into it)')).queryByRole('button', { name: /^Add a key/ })).toBeNull();
    expect(row(sheet, 'Expand the row (or move into it)')).toHaveTextContent('Fixed');
  });

  it('LA-V61-R09-T04 A letter a person binds never fires while typing in a field, and does outside one', async () => {
    const sheet = await openSheet();
    fireEvent.click(within(row(sheet, 'Command palette')).getByRole('button', { name: 'Add a key to Command palette' }));
    fireEvent.keyDown(within(sheet).getByRole('button', { name: /^Press a key for Command palette/ }), { key: 'u', code: 'KeyU' });
    expect(keysIn(row(sheet, 'Command palette'))).toEqual(['Ctrl+Shift+P', 'u']);
    fireEvent.keyDown(within(sheet).getByRole('searchbox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    // In quick find's field, u is text.
    press(document.body, 'p', 'KeyP', { ctrlKey: true });
    const user = userEvent.setup();
    await user.type(quickFind(), 'u');
    expect(quickFind()).toHaveValue('u');
    expect(screen.getByRole('dialog', { name: 'Quick find' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // Outside one, u opens the palette.
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    press(document.body, 'u', 'KeyU');
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
  });

  it('LA-V64-R01-T01 ? opens the shortcuts sheet and Ctrl+Shift+P the command palette, both searchable; the palette runs a command', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, '?', 'Slash', { shiftKey: true });
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const group of ['Navigate', 'View', 'Graph', 'Lists']) expect(within(sheet).getByRole('heading', { name: group })).toBeInTheDocument();
    expect(within(sheet).getByRole('rowheader', { name: 'Command palette' }).nextElementSibling).toHaveTextContent('Ctrl+Shift+P');
    const user = userEvent.setup();
    await user.type(within(sheet).getByRole('searchbox', { name: 'Search shortcuts' }), 'hide the navigation');
    expect(within(sheet).queryByRole('heading', { name: 'Graph' })).toBeNull();
    expect(within(sheet).getByRole('rowheader', { name: 'Show or hide the navigation' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    // Typing "?" in a search box types it.
    press(document.body, 'p', 'KeyP', { ctrlKey: true });
    await user.type(quickFind(), '?');
    expect(quickFind()).toHaveValue('?');
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    press(document.body, 'P', 'KeyP', { ctrlKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    const input = within(palette).getByRole('combobox', { name: 'Type a command' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue('>');
    await user.type(input, 'trace stage');
    const options = within(palette).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Trace stage');
    expect(options[0]).toHaveTextContent('Alt+T');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(window.location.search).toBe('?stage=trace'));
    // The palette has Expand all and Collapse all.
    press(document.body, 'P', 'KeyP', { ctrlKey: true, shiftKey: true });
    await user.type(within(screen.getByRole('dialog', { name: 'Command palette' })).getByRole('combobox'), 'all rows');
    expect(within(screen.getByRole('dialog')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Expand all rows on this page', 'Collapse all rows on this page']);
  });

  it('LA-V61-R08-T05 g then c, f or h jumps to Checks, the format or home, with a hint while it waits', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    press(document.body, 'g', 'KeyG');
    expect(document.querySelector('.key-pending')).toHaveTextContent('G…');
    press(document.body, 'c', 'KeyC');
    expect(window.location.pathname + window.location.search).toBe('/DM?panel=checks');
    expect(document.querySelector('.key-pending')).toBeNull();
    press(document.body, 'g', 'KeyG');
    press(document.body, 'f', 'KeyF');
    expect(window.location.pathname + window.location.search).toBe('/DM?panel=checks&page=format');
    press(document.body, 'g', 'KeyG');
    press(document.body, 'h', 'KeyH');
    expect(window.location.pathname).toBe('/');
  });

  it('LA-V61-R09-T03 g then c does nothing while typing', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    press(document.body, 'g', 'KeyG');
    press(document.body, 'h', 'KeyH');
    expect(window.location.pathname).toBe('/');
    press(document.body, 'p', 'KeyP', { ctrlKey: true });
    const find = quickFind();
    press(find, 'g', 'KeyG');
    press(find, 'c', 'KeyC');
    expect(window.location.pathname).toBe('/');
  });

  it('LA-V61-R08-T06 In the graph, + and - change the depth and . frames the focus again, and no key turns a trace on', async () => {
    await openApp('/P-D?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(node('P-D/question')).not.toBeNull());
    press(document.body, '+', 'Equal', { shiftKey: true });
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    press(document.body, '-', 'Minus');
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    // . frames the focus again, and there is no command to open or fold a group in place: every child is in the map.
    press(document.body, '.', 'Period');
    expect(isCenter('P-D')).toBe(true);
    expect(COMMANDS.some((c) => c.id === 'graphToggleGroup')).toBe(false);
    // An obligation's chain is the Trace view's: the graph has no trace command.
    expect(COMMANDS.filter((c) => c.group === 'Graph' && /trace/i.test(`${c.id} ${c.title}`))).toEqual([]);
  });

  it('LA-V61-R08-T07 F12, Shift+F12, Ctrl+Shift+E, / and Ctrl+- move focus and history', async () => {
    await openApp('/P-D-UC01', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const card = () => screen.getByRole('region', { name: 'Wiki card' });

    // F12 on a focused link opens its record.
    const link = within(card()).getAllByRole('link').find((a) => a.getAttribute('href') === '/P-D-CMD01')!;
    link.focus();
    press(link, 'F12', 'F12');
    expect(window.location.pathname).toBe('/P-D-CMD01');
    await screen.findByRole('heading', { level: 1, name: 'Open loan' });

    // Shift+F12 opens the wiki card's whole page at what links to the record.
    press(document.body, 'F12', 'F12', { shiftKey: true });
    await waitFor(() => expect(within(card()).getByRole('heading', { name: 'Links in' })).toHaveFocus());
    expect(card()).toHaveClass('is-expanded');

    // Ctrl+Shift+E: the nav.
    press(document.body, 'E', 'KeyE', { ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(nav().contains(document.activeElement)).toBe(true));

    // / focuses the nearest search box: the page's, or opens quick find.
    press(document.body, '/', 'Slash');
    await waitFor(() => expect(quickFind()).toHaveFocus());
    fireEvent.keyDown(quickFind(), { key: 'Escape' });
    await openApp('/P-D', { data: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    press(document.body, '/', 'Slash');
    expect(screen.getByRole('searchbox', { name: 'Filter records' })).toHaveFocus();

    // Ctrl+- goes back.
    fireEvent.click(within(nav()).getByRole('link', { name: /^Checks \d+ (errors?|warnings?|problems)/ }));
    expect(window.location.pathname + window.location.search).toBe('/P-D?panel=checks');
    await act(async () => {
      press(document.body, '-', 'Minus', { ctrlKey: true });
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(window.location.pathname + window.location.search).toBe('/P-D');
  });
});
