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
import type { OpenWindow } from '../src/product-window/model.ts';
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
    const windows = new ProductWindowRepository({ places: file('window-state.json'), chrome: file('chrome.json') });
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
    const windows = new ProductWindowRepository({ places: file('window-state.json'), chrome: file('chrome.json') });
    saveWindowPlace(windows, { folder: '/p/a', place: { x: 10, y: 20, width: 900, height: 700 } });
    expect(json('window-state.json')).toEqual({ '/p/a': { x: 10, y: 20, width: 900, height: 700 } });
    expect(new ProductWindowRepository({ places: file('window-state.json'), chrome: file('chrome.json') }).load().places['/p/a']).toEqual({ x: 10, y: 20, width: 900, height: 700 });
    expect(existsSync(path.join(temp, 'chrome.json'))).toBe(false);
  });

  it('takes an error count only as a number, and record actions only as exactly { id }', async () => {
    const windows = new ProductWindowRepository({ places: file('ws2.json'), chrome: file('c2.json') });
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
    expect(productWindowProblems({ open, places: {}, chrome: {} })).toEqual([{ rule: 'one-window-per-folder', message: 'The window for /p/b is kept under /p/a.' }]);
  });

  it('LA-PLT-INV05-T finds the open window of a folder however it is spelled, so it is focused and not opened twice', () => {
    const open = new Map([['/work/shop', 'window 1']]);
    expect(windowForFolder(open, '/work/shop/')).toBe('window 1');
    expect(windowForFolder(open, '/work/./shop')).toBe('window 1');
    expect(windowForFolder(open, '/work/other')).toBeUndefined();
  });
});
