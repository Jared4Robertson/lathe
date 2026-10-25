import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { desktopBridgeStub, openApp, openSideBar } from './helpers';

// The desktop app's menus run app commands by ID through the preload's onCommand (LA-PLT-UC12-R02).

afterEach(() => { delete window.latheDesktop; });

describe('desktop menu commands', () => {
  it('LA-PLT-T111 A menu choice sent by ID runs the app command, and the app stops listening when it unmounts', async () => {
    // The side bar starts closed in the Wiki view (brief 64); this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    let listener: ((id: string) => void) | null = null;
    let unsubscribed = false;
    window.latheDesktop = desktopBridgeStub({ onCommand: (l) => { listener = l; return () => { unsubscribed = true; }; } });
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(screen.getByRole('complementary', { name: 'Side bar' })).toBeInTheDocument();
    act(() => listener!('toggleSideBar'));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    act(() => listener!('toggleSideBar'));
    expect(screen.getByRole('complementary', { name: 'Side bar' })).toBeInTheDocument();
    act(() => listener!('noSuchCommand'));
    await openApp('/DM-SHOP-UC01');
    expect(unsubscribed).toBe(true);
  });
});
