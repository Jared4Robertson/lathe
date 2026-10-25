import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp } from './helpers';
import type { Chrome, DesktopBridge } from '../src/shell/desktopChrome';

// The desktop app's own title bar (LA-DSK-UC04): drawn only in the desktop shell, with back and
// forward, a command center that opens quick find, the layout toggles, and the theme's colors sent
// to the window's chrome.

const host = window as unknown as { latheDesktop?: DesktopBridge; navigation?: unknown };

function desktop(platform = 'darwin') {
  const setChrome = vi.fn<(chrome: Chrome) => void>();
  host.latheDesktop = { isDesktop: true, platform, onCommand: () => () => {}, setChrome };
  return setChrome;
}

const titleBar = () => screen.getByRole('banner', { name: 'Title bar' });
const bar = () => within(titleBar());

afterEach(() => {
  delete host.latheDesktop;
  delete host.navigation;
  document.documentElement.removeAttribute('data-title-bar');
});

describe('desktop title bar', () => {
  it('LA-DSK-T12 The title bar is drawn only in the desktop app, with room for the window\'s controls on each platform', async () => {
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(screen.queryByRole('banner', { name: 'Title bar' })).toBeNull();
    expect(document.documentElement.hasAttribute('data-title-bar')).toBe(false);

    desktop('darwin');
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(titleBar()).toHaveClass('desktop-title-bar', 'is-mac');
    expect(document.documentElement.hasAttribute('data-title-bar')).toBe(true);
    // Above the workbench, spanning the window: a sibling before the app shell.
    expect(titleBar().nextElementSibling).toHaveClass('app');

    desktop('win32');
    await openApp('/records/DM-SHOP-UC01');
    expect(titleBar()).toHaveClass('is-overlay');
  });

  it('LA-DSK-T13 Back and forward follow the app\'s history and are disabled at its ends', async () => {
    desktop();
    const ends = { canGoBack: false, canGoForward: false };
    host.navigation = { get canGoBack() { return ends.canGoBack; }, get canGoForward() { return ends.canGoForward; }, addEventListener() {}, removeEventListener() {} };
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(bar().getByRole('button', { name: 'Go back' })).toBeDisabled();
    expect(bar().getByRole('button', { name: 'Go forward' })).toBeDisabled();

    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => {});
    ends.canGoBack = true;
    fireEvent(window, new PopStateEvent('popstate'));
    window.history.pushState(null, '', '/specs/DM');
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() => expect(bar().getByRole('button', { name: 'Go back' })).toBeEnabled());
    expect(bar().getByRole('button', { name: 'Go forward' })).toBeDisabled();
    fireEvent.click(bar().getByRole('button', { name: 'Go back' }));
    expect(back).toHaveBeenCalledTimes(1);

    ends.canGoForward = true;
    fireEvent(window, new PopStateEvent('popstate'));
    window.history.replaceState(null, '', '/records/DM-SHOP-UC01');
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() => expect(bar().getByRole('button', { name: 'Go forward' })).toBeEnabled());
    fireEvent.click(bar().getByRole('button', { name: 'Go forward' }));
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it('LA-DSK-T14 The command center names the page and opens quick find', async () => {
    desktop();
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const center = await waitFor(() => bar().getByRole('button', { name: 'Lathe — Add an item to the basket. Quick find' }));
    expect(center).toHaveTextContent('Lathe — Add an item to the basket');
    fireEvent.click(center);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Quick find' })).toHaveFocus());
  });

  it('LA-DSK-T15 The layout toggles run the navigation and inspector commands and show whether each panel shows', async () => {
    desktop();
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const nav = bar().getByRole('button', { name: 'Show or hide the navigation' });
    const inspector = bar().getByRole('button', { name: 'Show or hide the inspector' });
    await waitFor(() => expect(inspector).toHaveAttribute('aria-pressed', 'true'));
    expect(nav).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(nav);
    await waitFor(() => expect(nav).toHaveAttribute('aria-pressed', 'false'));
    expect(document.querySelector('.app')).toHaveClass('nav-collapsed');
    fireEvent.click(nav);
    await waitFor(() => expect(nav).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(inspector);
    await waitFor(() => expect(inspector).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.queryByRole('complementary', { name: 'Inspector' })).toBeNull();
    fireEvent.click(inspector);
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Inspector' })).toBeInTheDocument());
  });

  it('LA-DSK-T16 The window\'s chrome follows the theme: setChrome gets its shell and ink as hex colors', async () => {
    const setChrome = desktop();
    await openApp('/records/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    await waitFor(() => expect(setChrome).toHaveBeenCalled());
    expect(setChrome).toHaveBeenLastCalledWith({ background: '#dde3e6', foreground: '#1d2830' });
    const before = setChrome.mock.calls.length;

    fireEvent.keyDown(document.body, { key: 'g', code: 'KeyG' });
    fireEvent.keyDown(document.body, { key: 't', code: 'KeyT' });
    const input = within(await screen.findByRole('dialog', { name: 'Color theme' })).getByRole('combobox');
    fireEvent.change(input, { target: { value: 'mid' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(setChrome.mock.calls.length).toBeGreaterThan(before));
    const last = setChrome.mock.lastCall![0];
    expect(last.background).toBe('#d8e2ec');
    for (const color of [last.background, last.foreground]) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
