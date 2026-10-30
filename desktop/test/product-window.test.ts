// The Product window aggregate (LA-PLT-A6): its repository keeps the open windows in memory and the places and chrome
// in their files, its commands go through it, and its rule refuses a second window for a folder.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { windowForFolder } from '../src/instance.ts';
import { closeProductWindow } from '../src/product-window/commands/close-product-window.ts';
import { openProductFolder } from '../src/product-window/commands/open-product-folder.ts';
import { reportErrorCount } from '../src/product-window/commands/report-error-count.ts';
import { reportMenuKeys } from '../src/product-window/commands/report-menu-keys.ts';
import { revealRecordDataFile } from '../src/product-window/commands/reveal-record-data-file.ts';
import { saveWindowPlace } from '../src/product-window/commands/save-window-place.ts';
import { chooseChatMode } from '../src/product-window/commands/choose-chat-mode.ts';
import { parseChatModes, startingMode, type OpenWindow } from '../src/product-window/model.ts';
import { ProductWindowRepository } from '../src/product-window/repository.ts';
import { productWindowProblems } from '../src/product-window/rules.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-product-window-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const file = (name: string) => () => path.join(temp, name);
const json = (name: string): unknown => JSON.parse(readFileSync(path.join(temp, name), 'utf8'));

const window = (folder: string, extra: Partial<OpenWindow> = {}): OpenWindow =>
  ({ folder, product: path.basename(folder), win: { id: folder } as unknown as OpenWindow['win'], errors: 0, dataFiles: null, launchRun: 0, key: folder, chatSent: null, ...extra });

describe('LA-PLT-INV05-T Each folder has one window: the Product window\'s repository keeps the open windows in memory and the places and chrome in their files', () => {
  it('opens a folder once, raising Product window opened to the recent folders and then the server, and closing raises Product window closed', async () => {
    const windows = new ProductWindowRepository({ places: file('window-state.json'), chrome: file('chrome.json'), modes: file('chat-modes.json') });
    const heard: string[] = [];
    const reactions = {
      onWindowOpenedAddRecentFolder: () => void heard.push('recent'),
      onWindowOpenedStartAppServer: async () => void heard.push('server'),
    };
    await openProductFolder(windows, { window: window('/p/a') }, reactions);
    expect(heard).toEqual(['recent', 'server']);
    await expect(openProductFolder(windows, { window: window('/p/a') }, reactions)).rejects.toThrow('/p/a already has a window.');
    expect([...windows.load().open.keys()]).toEqual(['/p/a']);
    const stop = vi.fn(async () => {});
    await closeProductWindow(windows, { folder: '/p/a' }, { onWindowClosedStopAppServer: stop });
    expect(stop).toHaveBeenCalledWith({ folder: '/p/a' });
    expect(windows.load().open.size).toBe(0);
  });

  it('saves a window\'s place to window-state.json, and a new repository reads it back', () => {
    const windows = new ProductWindowRepository({ places: file('window-state.json'), chrome: file('chrome.json'), modes: file('chat-modes.json') });
    saveWindowPlace(windows, { folder: '/p/a', place: { x: 10, y: 20, width: 900, height: 700 } });
    expect(json('window-state.json')).toEqual({ '/p/a': { x: 10, y: 20, width: 900, height: 700 } });
    expect(new ProductWindowRepository({ places: file('window-state.json'), chrome: file('chrome.json'), modes: file('chat-modes.json') }).load().places['/p/a']).toEqual({ x: 10, y: 20, width: 900, height: 700 });
    expect(existsSync(path.join(temp, 'chrome.json'))).toBe(false);
  });

  it('takes an error count only as a number, and record actions only as exactly { id }', async () => {
    const windows = new ProductWindowRepository({ places: file('ws2.json'), chrome: file('c2.json'), modes: file('v2.json') });
    const find = vi.fn(() => '/p/b/data/use_case.jsonl');
    await openProductFolder(windows, { window: window('/p/b', { dataFiles: { find } as unknown as OpenWindow['dataFiles'] }) }, { onWindowOpenedAddRecentFolder: () => {}, onWindowOpenedStartAppServer: async () => {} });
    expect(reportErrorCount(windows, { folder: '/p/b', count: 3 })).toBe(true);
    expect(reportErrorCount(windows, { folder: '/p/b', count: '3' })).toBe(false);
    expect(windows.load().open.get('/p/b')?.errors).toBe(3);
    // The page's keys, for the menu: kept as sent, anything that is not a list of key texts dropped.
    expect(reportMenuKeys(windows, { folder: '/p/b', keys: { toggleNav: ['Shift+Meta+J'], bad: 'x', 'no id': ['A'] } })).toBe(true);
    expect(reportMenuKeys(windows, { folder: '/p/b', keys: { toggleNav: ['Shift+Meta+J'] } })).toBe(false);
    expect(reportMenuKeys(windows, { folder: '/p/x', keys: {} })).toBe(false);
    expect(windows.load().open.get('/p/b')?.menuKeys).toEqual({ toggleNav: ['Shift+Meta+J'] });
    const reveal = vi.fn();
    revealRecordDataFile(windows, { folder: '/p/b', request: { id: 'LA-AUT-UC01', path: '/etc' } }, reveal);
    revealRecordDataFile(windows, { folder: '/p/b', request: { id: 'LA-AUT-UC01' } }, reveal);
    expect(reveal.mock.calls).toEqual([['/p/b/data/use_case.jsonl']]);
  });

  it('refuses a window kept under another folder', () => {
    const open = new Map([['/p/a', window('/p/b')]]);
    expect(productWindowProblems({ open, places: {}, chrome: {}, modes: {} })).toEqual([{ rule: 'one-window-per-folder', message: 'The window for /p/b is kept under /p/a.' }]);
  });

  it('LA-PLT-INV05-T finds the open window of a folder however it is spelled, so it is focused and not opened twice', () => {
    const open = new Map([['/work/shop', 'window 1']]);
    expect(windowForFolder(open, '/work/shop/')).toBe('window 1');
    expect(windowForFolder(open, '/work/./shop')).toBe('window 1');
    expect(windowForFolder(open, '/work/other')).toBeUndefined();
  });
});

describe('LA-PLT-UC19-R09-T05 A folder\'s chat starts in the mode its last chat had: Accept reads at first', () => {
  it('keeps the mode in chat-modes.json, by folder, leaving out the default, and a new repository reads it back', async () => {
    const windows = new ProductWindowRepository({ places: file('ws3.json'), chrome: file('c3.json'), modes: file('m3.json') });
    expect(startingMode(windows.load().modes, '/p/c')).toBe('accept-reads');
    await openProductFolder(windows, { window: window('/p/c') }, { onWindowOpenedAddRecentFolder: () => {}, onWindowOpenedStartAppServer: async () => {} });
    expect(chooseChatMode(windows, { folder: '/p/c', mode: 'view-only' })).toBe(true);
    expect(json('m3.json')).toEqual({ '/p/c': 'view-only' });
    const again = new ProductWindowRepository({ places: file('ws3.json'), chrome: file('c3.json'), modes: file('m3.json') }).load();
    expect(startingMode(again.modes, '/p/c/')).toBe('view-only');
    expect(startingMode(again.modes, '/p/d')).toBe('accept-reads');
    expect(chooseChatMode(windows, { folder: '/p/c', mode: 'accept-reads' })).toBe(true);
    expect(json('m3.json')).toEqual({});
  });

  it('changes the open chat\'s mode too, and is refused when the chat refuses (a turn under way), for a closed window, or for a mode Lathe does not know', async () => {
    const windows = new ProductWindowRepository({ places: file('ws4.json'), chrome: file('c4.json'), modes: file('m4.json') });
    let busy = true;
    const setMode = vi.fn(() => !busy);
    await openProductFolder(windows, { window: window('/p/e', { chat: { setMode } as unknown as OpenWindow['chat'] }) }, { onWindowOpenedAddRecentFolder: () => {}, onWindowOpenedStartAppServer: async () => {} });
    expect(chooseChatMode(windows, { folder: '/p/e', mode: 'bypass' })).toBe(false);
    expect(windows.load().modes).toEqual({});
    busy = false;
    expect(chooseChatMode(windows, { folder: '/p/e', mode: 'bypass' })).toBe(true);
    expect(setMode).toHaveBeenLastCalledWith('bypass');
    expect(windows.load().modes).toEqual({ '/p/e': 'bypass' });
    expect(chooseChatMode(windows, { folder: '/p/e', mode: 'yolo' })).toBe(false);
    expect(chooseChatMode(windows, { folder: '/p/none', mode: 'ask' })).toBe(false);
  });

  it('reads back only full paths with a mode Lathe knows', () => {
    expect(parseChatModes({ '/p/b': 'ask', relative: 'auto', '/p/c': 'yolo', '/p/a/': 'bypass', '/p/d': 'accept-reads' })).toEqual({ '/p/a': 'bypass', '/p/b': 'ask' });
    expect(parseChatModes(['/p/a'])).toEqual({});
  });
});
