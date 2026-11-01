import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionSettingsRepository, SETTINGS_KEY } from '../src/exploring/session-settings/repository';
import { KeyBindingsRepository } from '../src/platform/key-bindings/repository';
import { AppearanceRepository, APPEARANCE_KEYS } from '../src/platform/appearance/repository';
import { PanelRepository } from '../src/platform/panel/repository';
import { VoiceSettingsRepository } from '../src/platform/voice-settings/repository';
import { DEFAULT_VOICE_SETTINGS } from '../src/platform/voice-settings/model';
import { SpaceRepository } from '../src/exploring/space/repository';
import { desktopBridgeStub, openApp } from './helpers';
import type { LatheDesktop } from '../src/shell/desktop-bridge';

// Storage tests for the app's browser storage: what local storage (LA-STORE01) keeps in this browser from one launch
// to the next, where losing it costs only the choice, and what session storage (LA-STORE02) keeps for the session
// alone. Each saves through the aggregate's own repository, then loads through a new one, as the next launch or the
// next page of the session does.

afterEach(() => vi.restoreAllMocks());

describe('LA-PLT-A2-SR01 a panel\'s size and whether it shows are kept in this browser, and losing them is acceptable', () => {
  it('LA-PLT-A2-SR01-T01 a panel\'s width reads back from local storage, and the app works on when storage refuses', () => {
    const panels = new PanelRepository().load();
    new PanelRepository().save({ ...panels, nav: { width: 312, collapsed: true } });
    expect(window.localStorage.getItem('lathe:nav-width')).toBe('312');
    expect(window.sessionStorage.getItem('lathe:nav-width')).toBeNull();
    expect(new PanelRepository().load().nav).toEqual({ width: 312, collapsed: true });
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => new PanelRepository().save({ ...panels, nav: { width: 400, collapsed: false } })).not.toThrow();
    expect(new PanelRepository().load()).toEqual(panels);
  });
});

describe('LA-PLT-A4-SR01 the person\'s themes, chosen theme, color mode and Scroll to zoom are kept in this browser', () => {
  it('LA-PLT-A4-SR01-T01 the themes and choices saved read back from local storage, and a blocked storage loses only the choice', () => {
    const appearance = new AppearanceRepository().load();
    expect(appearance.scrollToZoom).toBe(false);
    new AppearanceRepository().save({ ...appearance, mode: 'dark', scrollToZoom: true });
    expect(window.localStorage.getItem(APPEARANCE_KEYS.mode)).toBe(JSON.stringify('dark'));
    expect(window.localStorage.getItem(APPEARANCE_KEYS.scrollToZoom)).toBe('true');
    expect(new AppearanceRepository().load()).toMatchObject({ mode: 'dark', scrollToZoom: true });
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => new AppearanceRepository().save({ ...appearance, mode: 'light' })).not.toThrow();
  });
});

describe('LA-PLT-A14-SR01 the person\'s key bindings are kept in this browser', () => {
  it('LA-PLT-A14-SR01-T01 the bindings saved read back from local storage, and a blocked storage loses only the bindings', () => {
    new KeyBindingsRepository().save({ changed: [{ shortcut: 'toggleNav', keys: ['Ctrl+J'], unbound: false }, { shortcut: 'goHome', keys: [], unbound: true }] });
    expect(JSON.parse(window.localStorage.getItem('lathe:keybindings')!)).toEqual({ toggleNav: ['Ctrl+J'], goHome: null });
    expect(new KeyBindingsRepository().load().changed).toEqual([{ shortcut: 'toggleNav', keys: ['Ctrl+J'], unbound: false }, { shortcut: 'goHome', keys: [], unbound: true }]);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => new KeyBindingsRepository().save({ changed: [] })).not.toThrow();
    expect(new KeyBindingsRepository().load().changed).toEqual([]);
  });
});

describe('LA-EXP-A6-SR01 the session\'s settings are kept for the browser session alone', () => {
  it('LA-EXP-A6-SR01-T01 the settings saved read back from session storage, and none is written to local storage', () => {
    const settings = new SessionSettingsRepository().load();
    new SessionSettingsRepository().save({ ...settings, graph: { ...settings.graph, layout: 'nested', minimap: true, allLinks: false } });
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ layout: 'nested', minimap: true });
    expect(new SessionSettingsRepository().load().graph).toEqual({ layout: 'nested', minimap: true, allLinks: false });
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

describe('LA-PLT-A15-SR01 the person\'s voice settings are kept in this browser', () => {
  it('LA-PLT-A15-SR01-T01 the voice settings saved read back from local storage, and a malformed or blocked storage gives the defaults', () => {
    const settings = { ...DEFAULT_VOICE_SETTINGS, activation: true, wake: 'Hey Lathe' };
    new VoiceSettingsRepository().save(settings);
    expect(window.sessionStorage.getItem('lathe:voice')).toBeNull();
    expect(new VoiceSettingsRepository().load()).toEqual(settings);
    window.localStorage.setItem('lathe:voice', '{"activation":"yes"}');
    expect(new VoiceSettingsRepository().load()).toEqual(DEFAULT_VOICE_SETTINGS);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => new VoiceSettingsRepository().save(settings)).not.toThrow();
    expect(new VoiceSettingsRepository().load()).toEqual(DEFAULT_VOICE_SETTINGS);
  });
});

describe('LA-EXP-A2-SR01 the space chosen last is kept in this browser, and each space\'s last page for the session alone', () => {
  it('LA-EXP-A2-SR01-T01 the chosen space reads back from local storage and its last page from session storage', () => {
    const memory = new SpaceRepository().load();
    new SpaceRepository().save({ ...memory, chosen: 'TL', pages: { TL: '/TL-LEND' } });
    expect(JSON.parse(window.localStorage.getItem('lathe:space') ?? 'null')).toBe('TL');
    expect(window.localStorage.getItem('lathe:space-pages')).toBeNull();
    expect(new SpaceRepository().load()).toMatchObject({ chosen: 'TL', pages: { TL: '/TL-LEND' } });
    window.sessionStorage.clear();
    expect(new SpaceRepository().load()).toMatchObject({ chosen: 'TL', pages: {} });
  });
});
