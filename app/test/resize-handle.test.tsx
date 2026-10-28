import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp, openSideBar } from './helpers';

// Resizing the workbench's panels from the keyboard and by double-click, and collapsing by drag
// (LA-PAT-APP-UX-R02). Pointer drags need real layout, so they are checked in the browser.

const handle = (name: string) => screen.getByRole('separator', { name });

describe('resizable panels', () => {
  const proveLaV61R02T02 = async () => {
    // The side bar starts closed in the Wiki view; this test reads it open.
    openSideBar('details');
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const nav = handle('Resize the navigation');
    expect(nav).toHaveAttribute('aria-valuenow', '336');
    fireEvent.keyDown(nav, { key: 'ArrowRight' });
    expect(nav).toHaveAttribute('aria-valuenow', '352');
    fireEvent.keyDown(nav, { key: 'ArrowLeft', shiftKey: true });
    expect(nav).toHaveAttribute('aria-valuenow', '288');
    fireEvent.keyDown(nav, { key: 'End' });
    expect(nav).toHaveAttribute('aria-valuenow', '560');
    expect(window.localStorage.getItem('lathe:nav-width')).toBe('560');
    expect((document.querySelector('.app') as HTMLElement).style.getPropertyValue('--nav-width')).toBe('560px');
    fireEvent.doubleClick(nav);
    expect(nav).toHaveAttribute('aria-valuenow', '336');

    // The side bar sits after its handle, so Left grows it.
    const sideBar = handle('Resize the side bar');
    expect(sideBar).toHaveAttribute('aria-valuenow', '340');
    fireEvent.keyDown(sideBar, { key: 'ArrowLeft' });
    expect(sideBar).toHaveAttribute('aria-valuenow', '356');
    fireEvent.keyDown(sideBar, { key: 'Home' });
    expect(sideBar).toHaveAttribute('aria-valuenow', '260');
  };
  it('LA-V61-R02-T02 A handle resizes its panel with the arrow keys, Shift, Home and End, remembers it, and double-click resets it', proveLaV61R02T02);
  it('LA-V61-R03-T02 A handle resizes its panel with the arrow keys, Shift, Home and End, remembers it, and double-click resets it', proveLaV61R02T02);

  const proveLaV61R03T03 = async () => {
    // The side bar starts closed in the Wiki view; this test reads it open.
    openSideBar('details');
    window.localStorage.setItem('lathe:nav-width', '400');
    window.localStorage.setItem('lathe:side-bar-width', '9999');
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(handle('Resize the navigation')).toHaveAttribute('aria-valuenow', '400');
    expect(handle('Resize the side bar')).toHaveAttribute('aria-valuenow', '340');

    // On a narrow screen the nav and the side bar are drawers: nothing to resize.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(document.body).queryAllByRole('separator').filter((s) => s.hasAttribute('aria-valuenow'))).toEqual([]);
  };
  it('LA-V61-R03-T03 Remembered sizes come back, out-of-range ones fall back to the default, and the narrow layout has no handles', proveLaV61R03T03);
  it('LA-V61-R04-T01 Remembered sizes come back, out-of-range ones fall back to the default, and the narrow layout has no handles', proveLaV61R03T03);
});
