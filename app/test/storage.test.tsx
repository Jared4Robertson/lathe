import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveSessionSettings, sessionSettings, SETTINGS_KEY } from '../src/graph/settings';
import { isNumber, readPref, writePref } from '../src/shell/prefs';
import { STORAGE_KEYS, themeStore } from '../src/theme/store';
import { desktopBridgeStub, openApp } from './helpers';

// Storage tests for the app's browser storage: what local storage (LA-STORE01) keeps in this browser from one launch
// to the next, where losing it costs only the choice, and what session storage (LA-STORE02) keeps for the session
// alone. Each writes through the app's own code, then reads back with a fresh read of the browser's storage, as the
// next launch or the next page of the session does.

afterEach(() => vi.restoreAllMocks());

describe('LA-PLT-A2-SR01 a panel\'s size and whether it shows are kept in this browser, and losing them is acceptable', () => {
  it('LA-PLT-A2-SR01-T01 a panel\'s width reads back from local storage, and the app works on when storage refuses', () => {
    writePref('lathe:nav-width', 312);
    expect(window.localStorage.getItem('lathe:nav-width')).toBe('312');
    expect(window.sessionStorage.getItem('lathe:nav-width')).toBeNull();
    expect(readPref('lathe:nav-width', 280, isNumber)).toBe(312);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => writePref('lathe:nav-width', 400)).not.toThrow();
    expect(readPref('lathe:nav-width', 280, isNumber)).toBe(280);
  });
});

describe('LA-PLT-A4-SR01 the person\'s themes, chosen theme and color mode are kept in this browser', () => {
  it('LA-PLT-A4-SR01-T01 the themes and choices saved read back from local storage, and a blocked storage loses only the choice', () => {
    const state = { ...themeStore.load(), custom: [], chosen: 'lathe-dark', mode: 'dark' } as Parameters<typeof themeStore.save>[0];
    themeStore.save(state, ':root { --page: #000; }');
    expect(window.localStorage.getItem(STORAGE_KEYS.chosen)).toBe(JSON.stringify('lathe-dark'));
    expect(themeStore.load()).toMatchObject({ chosen: 'lathe-dark', mode: 'dark' });
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => themeStore.save({ ...state, mode: 'light' }, '')).not.toThrow();
  });
});

describe('LA-EXP-A6-SR01 the session\'s settings are kept for the browser session alone', () => {
  it('LA-EXP-A6-SR01-T01 the settings saved read back from session storage, and none is written to local storage', () => {
    const settings = sessionSettings();
    saveSessionSettings({ ...settings, graph: { ...settings.graph, layout: 'nested', minimap: true } });
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ layout: 'nested', minimap: true });
    expect(sessionSettings().graph).toEqual({ layout: 'nested', minimap: true });
  });
});

describe('LA-EXP-A3-SR01 what the Reader folds in the nav is kept for the browser session alone', () => {
  it('LA-EXP-A3-SR01-T01 a domain unfolded in the nav is saved in session storage, never in local storage', async () => {
    await openApp('/DM');
    await screen.findByRole('heading', { level: 1, name: 'Demo shop' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await userEvent.setup().click(within(nav.querySelector<HTMLElement>('.space-items')!).getByRole('button', { name: 'Unfold Shopping' }));
    await waitFor(() => expect(window.sessionStorage.getItem('lathe:nav-folders')).toContain('DM-SHOP'));
    expect(window.localStorage.getItem('lathe:nav-folders')).toBeNull();
  });
});

describe('LA-EXP-A5-SR01 the desktop app\'s tabs are kept for the window\'s session alone', () => {
  it('LA-EXP-A5-SR01-T01 the tabs saved in session storage open again with the window, and none is written to local storage', async () => {
    (window as unknown as { latheDesktop?: LatheDesktop }).latheDesktop = desktopBridgeStub();
    const tab = (key: string, address: string) => ({ key, place: { history: [{ address, note: {} }], at: 0, view: { depth: 1, hiddenKinds: [], card: { open: true, expanded: true } } } });
    window.sessionStorage.setItem('lathe:tabs', JSON.stringify({ DM: { active: 't1', tabs: [tab('t1', '/DM-SHOP-UC01'), tab('t2', '/DM-SHOP')] } }));
    try {
      await openApp('/DM-SHOP-UC01');
      await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
      expect([...document.querySelectorAll('.tab-strip [data-page]')].map((t) => t.getAttribute('data-page'))).toEqual(['/DM-SHOP-UC01', '/DM-SHOP']);
      expect(window.localStorage.getItem('lathe:tabs')).toBeNull();
    } finally {
      delete (window as unknown as { latheDesktop?: LatheDesktop }).latheDesktop;
    }
  });
});
