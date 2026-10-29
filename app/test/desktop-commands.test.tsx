import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { desktopBridgeStub, openApp } from './helpers';

// The desktop app's menus run app commands by ID through the preload's onCommand (LA-V66-R02).

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
});
