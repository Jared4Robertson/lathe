import './graph/setup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp, openSideBar } from './helpers';
import { testWorkspace } from './graph/workspace';

// Shortcuts end to end: each key press goes to the window's listener, as in the browser. The test
// browser is not a Mac, so Mod is Ctrl.

const press = (target: Element, key: string, code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  fireEvent.keyDown(target, { key, code, ...mods });
const active = () => (document.activeElement ?? document.body) as HTMLElement;
const nav = () => screen.getByRole('navigation', { name: 'Main' });
const announcer = () => screen.getByTestId('announcer');
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);

describe('keyboard shortcuts', () => {
  it('LA-BRW-T144 Ctrl+P (or Ctrl+K) opens quick find, from anywhere, and the browser does not print', async () => {
    await openApp('/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    const event = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => { document.body.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(within(nav()).getByRole('combobox', { name: 'Quick find' })).toHaveFocus());

    // From a collapsed nav too: it opens.
    fireEvent.click(within(nav()).getByRole('button', { name: 'Collapse the navigation' }));
    press(document.body, 'k', 'KeyK', { ctrlKey: true });
    await waitFor(() => expect(within(nav()).getByRole('combobox', { name: 'Quick find' })).toHaveFocus());
    // A key nobody handles is left alone.
    const other = new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
  });

  it('LA-BRW-T145 Ctrl+B hides and shows the nav, Ctrl+Alt+B the inspector, each announced', async () => {
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, 'b', 'KeyB', { ctrlKey: true });
    expect(nav().className).toContain('is-rail');
    await waitFor(() => expect(announcer()).toHaveTextContent('Navigation collapsed'));
    press(document.body, 'b', 'KeyB', { ctrlKey: true });
    expect(nav().className).not.toContain('is-rail');

    // In the Wiki view the inspector (the side bar) starts closed (brief 64).
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    press(document.body, '∫', 'KeyB', { ctrlKey: true, altKey: true });
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    await waitFor(() => expect(announcer()).toHaveTextContent('Inspector shown'));
    press(document.body, '∫', 'KeyB', { ctrlKey: true, altKey: true });
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    await waitFor(() => expect(announcer()).toHaveTextContent('Inspector hidden'));
  });

  it('LA-BRW-T146 Alt+W, Alt+G and Alt+M (or Ctrl+1, 2 and 4) toggle the views off a Mac, Ctrl+3 shows only the focused pane, and Ctrl+3 or Escape restores', async () => {
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, '2', 'Digit2', { ctrlKey: true });
    expect(window.location.search).toBe('?view=wiki,graph');
    await waitFor(() => expect(announcer()).toHaveTextContent('Graph view opened'));
    press(document.body, 'w', 'KeyW', { altKey: true });
    expect(window.location.search).toBe('?view=graph');
    // The last open view stays open.
    press(document.body, 'g', 'KeyG', { altKey: true });
    expect(window.location.search).toBe('?view=graph');
    await waitFor(() => expect(announcer()).toHaveTextContent('stays open'));
    press(document.body, '1', 'Digit1', { ctrlKey: true });
    expect(window.location.search).toBe('?view=wiki,graph');
    // Ctrl+4 and Alt+M do nothing where Model is not offered; Ctrl+3 is not Split any more.
    press(document.body, '4', 'Digit4', { ctrlKey: true });
    press(document.body, 'm', 'KeyM', { altKey: true });
    expect(window.location.search).toBe('?view=wiki,graph');

    // Ctrl+3 maximizes the focused pane; Ctrl+3 again restores, and so does Escape.
    screen.getByRole('button', { name: 'Full screen: Graph' }).focus();
    press(document.activeElement!, '3', 'Digit3', { ctrlKey: true });
    expect(screen.getByRole('region', { name: 'Graph pane' }).className).toContain('is-fullscreen');
    expect(screen.getByRole('region', { name: 'Wiki pane' })).toHaveAttribute('inert');
    press(document.body, '3', 'Digit3', { ctrlKey: true });
    expect(screen.getByRole('region', { name: 'Graph pane' }).className).not.toContain('is-fullscreen');
    // With focus outside every pane, the leftmost one.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Full screen: Graph' })).toHaveFocus());
    act(() => (document.activeElement as HTMLElement).blur());
    press(document.body, '3', 'Digit3', { ctrlKey: true });
    expect(screen.getByRole('region', { name: 'Wiki pane' }).className).toContain('is-fullscreen');
    press(document.body, 'Escape', 'Escape');
    expect(screen.getByRole('region', { name: 'Wiki pane' }).className).not.toContain('is-fullscreen');
    // The old full-screen key is gone.
    press(document.body, 'Enter', 'Enter', { ctrlKey: true, shiftKey: true });
    expect(document.querySelector('.is-fullscreen')).toBeNull();
  });

  it('LA-BRW-T147 F8 and Shift+F8 move through the problems on the page and say each one', async () => {
    await openApp('/checks');
    await screen.findByRole('heading', { level: 1, name: 'Checks' });
    const problems = [...document.querySelectorAll<HTMLElement>('#main li.problem')];
    expect(problems.length).toBeGreaterThan(1);
    press(document.body, 'F8', 'F8');
    expect(active()).toBe(problems[0]);
    await waitFor(() => expect(announcer()).toHaveTextContent(`Problem 1 of ${problems.length}`));
    press(active(), 'F8', 'F8');
    expect(active()).toBe(problems[1]);
    press(active(), 'F8', 'F8', { shiftKey: true });
    expect(active()).toBe(problems[0]);
    press(active(), 'F8', 'F8', { shiftKey: true });
    expect(active()).toBe(problems[problems.length - 1]);
  });

  it('LA-BRW-T148 ? opens the shortcuts sheet and Ctrl+Shift+P the command palette, both searchable; the palette runs a command', async () => {
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    press(document.body, '?', 'Slash', { shiftKey: true });
    const sheet = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    for (const group of ['Navigate', 'View', 'Graph', 'Lists']) expect(within(sheet).getByRole('heading', { name: group })).toBeInTheDocument();
    expect(within(sheet).getByRole('rowheader', { name: 'Command palette' }).nextElementSibling).toHaveTextContent('Ctrl+Shift+P');
    expect(within(sheet).getByText(/lathe:keybindings/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(within(sheet).getByRole('searchbox', { name: 'Search shortcuts' }), 'inspector');
    expect(within(sheet).queryByRole('heading', { name: 'Graph' })).toBeNull();
    expect(within(sheet).getByRole('rowheader', { name: 'Show or hide the inspector' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    // Typing "?" in a search box types it.
    const find = within(nav()).getByRole('combobox', { name: 'Quick find' });
    await user.type(find, '?');
    expect(find).toHaveValue('?');
    expect(screen.queryByRole('dialog')).toBeNull();

    press(document.body, 'P', 'KeyP', { ctrlKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    const input = within(palette).getByRole('combobox', { name: 'Type a command' });
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, 'graph view');
    const options = within(palette).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Graph view on or off');
    expect(options[0]).toHaveTextContent('Alt+G');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(window.location.search).toBe('?view=wiki,graph'));
    // The palette has Expand all and Collapse all.
    press(document.body, 'P', 'KeyP', { ctrlKey: true, shiftKey: true });
    await user.type(within(screen.getByRole('dialog', { name: 'Command palette' })).getByRole('combobox'), 'all rows');
    expect(within(screen.getByRole('dialog')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Expand all rows on this page', 'Collapse all rows on this page']);
  });

  it('LA-BRW-T149 g then c, f, d or h jumps to Checks, the format, Diagrams or home, with a hint while it waits', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    press(document.body, 'g', 'KeyG');
    expect(document.querySelector('.key-pending')).toHaveTextContent('G…');
    press(document.body, 'c', 'KeyC');
    expect(window.location.pathname).toBe('/checks');
    expect(document.querySelector('.key-pending')).toBeNull();
    press(document.body, 'g', 'KeyG');
    press(document.body, 'f', 'KeyF');
    expect(window.location.pathname).toBe('/format');
    press(document.body, 'g', 'KeyG');
    press(document.body, 'h', 'KeyH');
    expect(window.location.pathname).toBe('/');
    // Not while typing.
    const find = within(nav()).getByRole('combobox', { name: 'Quick find' });
    find.focus();
    press(find, 'g', 'KeyG');
    press(find, 'c', 'KeyC');
    expect(window.location.pathname).toBe('/');
  });

  it('LA-BRW-T150 In the graph, + and - change the depth, t switches trace mode, . fits the view and o opens or closes the focused group', async () => {
    await openApp('/P-D?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(node('P-D/question')).not.toBeNull());
    press(document.body, '+', 'Equal', { shiftKey: true });
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    press(document.body, '-', 'Minus');
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'true');
    press(document.body, '.', 'Period');
    // o opens the open questions in place (their question leaves the faded ring), and closes them again.
    const group = node('P-D/question')!;
    group.focus();
    press(group, 'o', 'KeyO');
    await waitFor(() => expect(node('P-D-Q01')?.className).not.toContain('is-context'));
    press(document.activeElement ?? document.body, 'o', 'KeyO');
    await waitFor(() => expect(node('P-D-Q01')?.className).toContain('is-context'));

    await openApp('/P-D-UC01-R01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(node('P-D-UC01')).not.toBeNull());
    press(document.body, 't', 'KeyT');
    expect(screen.getByRole('checkbox', { name: 'Trace mode' })).toBeChecked();
    await waitFor(() => expect(node('file:src/thing.ts')).not.toBeNull());
  });

  it('LA-BRW-T151 F12, Shift+F12, Ctrl+Shift+E, Ctrl+Shift+I, / and Ctrl+- reach links, incoming links, the nav, the inspector, search and Back', async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    await openApp('/P-D-UC01', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const inspector = screen.getByRole('complementary', { name: 'Inspector' });

    // F12 on a focused link opens its record.
    const link = within(inspector).getAllByRole('link', { name: /P-D-DR01/ })[0];
    link.focus();
    press(link, 'F12', 'F12');
    expect(window.location.pathname).toBe('/P-D-DR01');
    await screen.findByRole('heading', { level: 1, name: 'A thing has one owner' });

    // Shift+F12 shows the incoming links in the inspector.
    press(document.body, 'F12', 'F12', { shiftKey: true });
    await waitFor(() => expect(within(screen.getByRole('complementary', { name: 'Inspector' })).getByRole('heading', { name: /^Links in/ })).toHaveFocus());

    // Ctrl+Shift+E: the nav; Ctrl+Shift+I: the inspector.
    press(document.body, 'E', 'KeyE', { ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(nav().contains(document.activeElement)).toBe(true));
    press(document.body, 'I', 'KeyI', { ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Inspector' })).toHaveFocus());

    // / focuses the nearest search box: the page's, or quick find.
    press(document.body, '/', 'Slash');
    await waitFor(() => expect(within(nav()).getByRole('combobox', { name: 'Quick find' })).toHaveFocus());
    await openApp('/P-D', { workspace: testWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Domain' });
    press(document.body, '/', 'Slash');
    expect(screen.getByRole('searchbox', { name: 'Filter records' })).toHaveFocus();

    // Ctrl+- goes back.
    fireEvent.click(within(nav()).getByRole('link', { name: /^Checks:/ }));
    expect(window.location.pathname).toBe('/checks');
    await act(async () => {
      press(document.body, '-', 'Minus', { ctrlKey: true });
      await new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    });
    expect(window.location.pathname).toBe('/P-D');
  });
});
