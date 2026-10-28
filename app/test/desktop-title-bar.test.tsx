import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopBridgeStub, openApp, openSideBar } from './helpers';
import type { Chrome } from '../src/shell/desktopChrome';

// The desktop app's own title bar (LA-PLT-UC14): drawn only in the desktop shell, with back and
// forward, a command center that opens quick find, the layout toggles, and the theme's colors sent
// to the window's chrome.

const host = window as unknown as { latheDesktop?: LatheDesktop; navigation?: unknown };

function desktop(platform = 'darwin') {
  const setChrome = vi.fn<(chrome: Chrome) => void>();
  host.latheDesktop = desktopBridgeStub({ platform, setChrome });
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
  const proveLaV67R01T03 = async () => {
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(screen.queryByRole('banner', { name: 'Title bar' })).toBeNull();
    expect(document.documentElement.hasAttribute('data-title-bar')).toBe(false);

    desktop('darwin');
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(titleBar()).toHaveClass('desktop-title-bar', 'is-mac');
    expect(document.documentElement.hasAttribute('data-title-bar')).toBe(true);
    // Above the workbench, spanning the window: a sibling before the app shell.
    expect(titleBar().nextElementSibling).toHaveClass('app');

    desktop('win32');
    await openApp('/DM-SHOP-UC01');
    expect(titleBar()).toHaveClass('is-overlay');
  };
  it('LA-V67-R01-T03 The title bar is drawn only in the desktop app, with room for the window\'s controls on each platform', proveLaV67R01T03);
  it('LA-V67-R07-T01 The title bar is drawn only in the desktop app, with room for the window\'s controls on each platform', proveLaV67R01T03);

  it('LA-V67-R02-T01 Back and forward follow the app\'s history and are disabled at its ends', async () => {
    desktop();
    const ends = { canGoBack: false, canGoForward: false };
    host.navigation = { get canGoBack() { return ends.canGoBack; }, get canGoForward() { return ends.canGoForward; }, addEventListener() {}, removeEventListener() {} };
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    expect(bar().getByRole('button', { name: 'Go back' })).toBeDisabled();
    expect(bar().getByRole('button', { name: 'Go forward' })).toBeDisabled();

    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => {});
    ends.canGoBack = true;
    fireEvent(window, new PopStateEvent('popstate'));
    window.history.pushState(null, '', '/DM');
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() => expect(bar().getByRole('button', { name: 'Go back' })).toBeEnabled());
    expect(bar().getByRole('button', { name: 'Go forward' })).toBeDisabled();
    fireEvent.click(bar().getByRole('button', { name: 'Go back' }));
    expect(back).toHaveBeenCalledTimes(1);

    ends.canGoForward = true;
    fireEvent(window, new PopStateEvent('popstate'));
    window.history.replaceState(null, '', '/DM-SHOP-UC01');
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() => expect(bar().getByRole('button', { name: 'Go forward' })).toBeEnabled());
    fireEvent.click(bar().getByRole('button', { name: 'Go forward' }));
    expect(forward).toHaveBeenCalledTimes(1);
  });

  it('LA-V67-R03-T01 The command center names the page and opens quick find', async () => {
    desktop();
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const center = await waitFor(() => bar().getByRole('button', { name: 'Lathe — Add an item to the basket. Quick find' }));
    expect(center).toHaveTextContent('Lathe — Add an item to the basket');
    fireEvent.click(center);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Quick find' })).toHaveFocus());
  });

  it('LA-V67-R04-T01 The layout toggles run the navigation and side bar commands and show whether each panel shows', async () => {
    // The side bar starts closed in the Wiki view; this test reads it open.
    openSideBar('details', ['wiki', 'graph', 'model']);
    desktop();
    await openApp('/DM-SHOP-UC01');
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    const nav = bar().getByRole('button', { name: 'Show or hide the navigation' });
    const sideBar = bar().getByRole('button', { name: 'Show or hide the side bar' });
    await waitFor(() => expect(sideBar).toHaveAttribute('aria-pressed', 'true'));
    expect(nav).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(nav);
    await waitFor(() => expect(nav).toHaveAttribute('aria-pressed', 'false'));
    expect(document.querySelector('.app')).toHaveClass('nav-collapsed');
    fireEvent.click(nav);
    await waitFor(() => expect(nav).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(sideBar);
    await waitFor(() => expect(sideBar).toHaveAttribute('aria-pressed', 'false'));
    expect(screen.queryByRole('complementary', { name: 'Side bar' })).toBeNull();
    fireEvent.click(sideBar);
    await waitFor(() => expect(screen.getByRole('complementary', { name: 'Side bar' })).toBeInTheDocument());
  });

  it('LA-V67-R06-T03 The window\'s chrome follows the theme: setChrome gets its shell and ink as hex colors', async () => {
    const setChrome = desktop();
    await openApp('/DM-SHOP-UC01');
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
