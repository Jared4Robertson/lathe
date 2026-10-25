import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openApp } from './helpers';

// The desktop app's menus run app commands by ID through the preload's onCommand (LA-DSK-UC03-R02).

afterEach(() => { delete window.latheDesktop; });

describe('desktop menu commands', () => {
  it('LA-DSK-T09 A menu choice sent by ID runs the app command, and the app stops listening when it unmounts', async () => {
    let listener: ((id: string) => void) | null = null;
    let unsubscribed = false;
    window.latheDesktop = { isDesktop: true, onCommand: (l) => { listener = l; return () => { unsubscribed = true; }; } };
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    act(() => listener!('toggleInspector'));
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    act(() => listener!('toggleInspector'));
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument();
    act(() => listener!('noSuchCommand'));
    await openApp('/records/DM-SHOP-UC01');
    expect(unsubscribed).toBe(true);
  });
});
