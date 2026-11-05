import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindKey } from '../src/platform/key-bindings/commands/bind-key';
import { isMac } from '../src/shell/keymap';
import { desktopBridgeStub, openApp } from './helpers';

// The desktop app's menus run app commands by ID through the preload's onCommand (LA-V66-R02), and show the person's
// keys, which the page sends again whenever the key bindings change (LA-PLT-PO05).

afterEach(() => { delete window.latheDesktop; });

describe('desktop menu commands', () => {
  it('LA-V66-R02-T02 A menu choice sent by ID runs the app command, and the app stops listening when it unmounts', async () => {
    let listener: ((id: string) => void) | null = null;
    let unsubscribed = false;
    window.latheDesktop = desktopBridgeStub({ onCommand: (l) => { listener = l; return () => { unsubscribed = true; }; } });
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const app = document.querySelector('.app')!;
    expect(app).not.toHaveClass('nav-collapsed');
    act(() => listener!('toggleNav'));
    expect(app).toHaveClass('nav-collapsed');
    act(() => listener!('toggleNav'));
    expect(app).not.toHaveClass('nav-collapsed');
    // An unknown ID does nothing.
    act(() => listener!('noSuchCommand'));
    expect(app).not.toHaveClass('nav-collapsed');
    expect(screen.getByRole('heading', { level: 1, name: 'Add an item to the basket' })).toBeInTheDocument();
    await openApp('/DM-SHOP-UC01');
    expect(unsubscribed).toBe(true);
  });

  it('LA-PLT-PO05-T A rebound key reaches the window\'s menu keys', async () => {
    const setMenuKeys = vi.fn<(keys: Record<string, string[]>) => void>();
    window.latheDesktop = desktopBridgeStub({ setMenuKeys });
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    await waitFor(() => expect(setMenuKeys).toHaveBeenCalled());
    expect(setMenuKeys.mock.lastCall![0].stageGraph).toEqual(['Ctrl+1']);
    act(() => bindKey({ shortcut: 'stageGraph', key: 'Ctrl+9', replacing: 'Ctrl+1', mac: isMac() }));
    await waitFor(() => expect(setMenuKeys.mock.lastCall![0].stageGraph).not.toEqual(['Ctrl+1']));
    const sent = setMenuKeys.mock.lastCall![0];
    // Rebound, the menu shows the shortcut's first key; the other commands' keys stay as they were.
    expect(sent.stageGraph).toEqual([isMac() ? 'Ctrl+G' : 'Alt+G']);
    expect(sent.stageErd).toEqual(['Ctrl+2']);
  });
});
