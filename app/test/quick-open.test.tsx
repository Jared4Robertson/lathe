import './graph/setup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from './helpers';
import { testWorkspace } from './graph/workspace';
import { isCenter } from './graph/scene';

// Quick open (app/src/shell/QuickOpen.tsx): quick find and the command palette as one centered
// overlay. The test browser is not a Mac, so Mod is Ctrl.

const served = () => ({ data: testWorkspace() });
const card = () => screen.getByRole('region', { name: 'Wiki card' });
const title = () => screen.getByRole('heading', { level: 1 }).textContent;
const press = (target: Element, key: string, code: string, mods: Partial<Record<'ctrlKey' | 'shiftKey', boolean>> = {}) =>
  fireEvent.keyDown(target, { key, code, ...mods });
const box = () => screen.getByRole('combobox');

describe('quick open', () => {
  it('LA-V64-R06-T01 A highlighted record previews on the stage and in the wiki card; Escape puts the camera, the card and focus back, Enter commits', async () => {
    await openApp('/P-D-UC01?stage=graph', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    // The card shows the whole page (the tests' setting), so the preview's compact summary can be told from it.
    expect(card()).toHaveClass('is-expanded');
    const opener = screen.getByRole('button', { name: 'Go to…' });
    opener.focus();
    fireEvent.click(opener);
    const user = userEvent.setup();
    await user.type(box(), 'Loan desk');
    const option = within(screen.getByRole('listbox', { name: 'Quick find results' })).getAllByRole('option')[0];
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(option).toHaveTextContent('P-V01');

    // The stage glides to the highlighted record and the card shows it; the address, the tabs and the strip stay.
    await waitFor(() => expect(isCenter('P-V01')).toBe(true));
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'P-V01'));
    await waitFor(() => expect(card()).not.toHaveClass('is-expanded'));
    expect(window.location.pathname).toBe('/P-D-UC01');
    expect(title()).toBe('Lend a thing');

    // Escape: the stage, the card and keyboard focus are back where they were.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'P-D-UC01'));
    await waitFor(() => expect(card()).toHaveClass('is-expanded'));
    expect(opener).toHaveFocus();
    expect(window.location.pathname).toBe('/P-D-UC01');

    // Enter commits: the address moves there.
    press(document.body, 'p', 'KeyP', { ctrlKey: true });
    await user.type(box(), 'Loan desk');
    await user.keyboard('{Enter}');
    expect(window.location.pathname).toBe('/P-V01');
    await waitFor(() => expect(title()).toBe('Loan desk'));
    await waitFor(() => expect(card()).toHaveAttribute('data-page', 'P-V01'));

    // A command previews nothing.
    press(document.body, 'P', 'KeyP', { ctrlKey: true, shiftKey: true });
    await user.type(box(), 'trace stage');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(card()).toHaveAttribute('data-page', 'P-V01');
  });

  it('LA-V64-R07-T01 Quick open is a dialog with a combobox over a listbox; > switches it to commands and back, and focus returns on close', async () => {
    await openApp('/P-D-UC01', served());
    await screen.findByRole('heading', { level: 1, name: 'Lend a thing' });
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Go to…' });
    opener.focus();
    press(opener, 'p', 'KeyP', { ctrlKey: true });

    // Records: a modal dialog whose combobox owns the listbox and names the highlighted option.
    const dialog = screen.getByRole('dialog', { name: 'Quick find' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const input = within(dialog).getByRole('combobox', { name: 'Quick find' });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.type(input, 'lend');
    const list = within(dialog).getByRole('listbox', { name: 'Quick find results' });
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', within(list).getAllByRole('option')[0].id);
    // Tab stays in the dialog.
    await user.tab();
    expect(input).toHaveFocus();

    // ">" switches to commands, each with its keys; deleting it goes back to records.
    await user.clear(input);
    await user.type(input, '>hide the navigation');
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBe(dialog);
    const commands = within(dialog).getByRole('listbox', { name: 'Commands' });
    expect(within(commands).getAllByRole('option')[0]).toHaveTextContent('Show or hide the navigation');
    expect(within(commands).getAllByRole('option')[0].querySelector('kbd')).toHaveTextContent('Ctrl+B');
    await user.clear(input);
    await user.type(input, 'lend');
    expect(screen.getByRole('dialog', { name: 'Quick find' })).toBe(dialog);

    // Ctrl+Shift+P while it is open turns it to commands afresh.
    press(input, 'P', 'KeyP', { ctrlKey: true, shiftKey: true });
    expect(within(dialog).getByRole('combobox')).toHaveValue('>');

    // A click on the dimmed page closes it, and focus is back on the opener.
    fireEvent.mouseDown(document.querySelector('.quick-open-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
