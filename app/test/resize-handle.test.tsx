import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from './helpers';

// Resizing the workbench's panels from the keyboard and by double-click, and collapsing by drag
// (LA-PAT-APP-UX-R02). Pointer drags need real layout, so they are checked in the browser.

const handle = (name: string) => screen.getByRole('separator', { name });

describe('resizable panels', () => {
  it('LA-BRW-T296 A handle resizes its panel with the arrow keys, Shift, Home and End, remembers it, and double-click resets it', async () => {
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const nav = handle('Resize the navigation');
    expect(nav).toHaveAttribute('aria-valuenow', '304');
    fireEvent.keyDown(nav, { key: 'ArrowRight' });
    expect(nav).toHaveAttribute('aria-valuenow', '320');
    fireEvent.keyDown(nav, { key: 'ArrowLeft', shiftKey: true });
    expect(nav).toHaveAttribute('aria-valuenow', '256');
    fireEvent.keyDown(nav, { key: 'End' });
    expect(nav).toHaveAttribute('aria-valuenow', '560');
    expect(window.localStorage.getItem('lathe:nav-width')).toBe('560');
    expect((document.querySelector('.app') as HTMLElement).style.getPropertyValue('--nav-width')).toBe('560px');
    fireEvent.doubleClick(nav);
    expect(nav).toHaveAttribute('aria-valuenow', '304');

    // The inspector sits after its handle, so Left grows it.
    const inspector = handle('Resize the inspector');
    expect(inspector).toHaveAttribute('aria-valuenow', '340');
    fireEvent.keyDown(inspector, { key: 'ArrowLeft' });
    expect(inspector).toHaveAttribute('aria-valuenow', '356');
    fireEvent.keyDown(inspector, { key: 'Home' });
    expect(inspector).toHaveAttribute('aria-valuenow', '260');
  });

  it('LA-BRW-T297 Remembered sizes come back, out-of-range ones fall back to the default, and the narrow layout has no handles', async () => {
    window.localStorage.setItem('lathe:nav-width', '400');
    window.localStorage.setItem('lathe:inspector-width', '9999');
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(handle('Resize the navigation')).toHaveAttribute('aria-valuenow', '400');
    expect(handle('Resize the inspector')).toHaveAttribute('aria-valuenow', '340');

    // On a narrow screen the nav and the inspector are drawers: nothing to resize.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(within(document.body).queryAllByRole('separator').filter((s) => s.hasAttribute('aria-valuenow'))).toEqual([]);
  });
});
