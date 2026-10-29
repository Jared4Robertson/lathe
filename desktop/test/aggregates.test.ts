// The desktop's aggregates: each repository loads and saves its aggregate whole over its own storage, each rule
// refuses with its reason, the commands go through them, and the policies run in order when a command raises its event.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { startAppServer } from '../src/app-server/commands/start-app-server.ts';
import { stopAppServer } from '../src/app-server/commands/stop-app-server.ts';
import { onWindowClosedStopAppServer, onWindowOpenedStartAppServer } from '../src/app-server/policies.ts';
import { AppServerRepository } from '../src/app-server/repository.ts';
import { appServerProblems } from '../src/app-server/rules.ts';
import { LOCAL_ACTION_CHANNELS } from '../src/launch.ts';
import { closeProductWindow } from '../src/product-window/commands/close-product-window.ts';
import { openProductFolder } from '../src/product-window/commands/open-product-folder.ts';
import { reportErrorCount } from '../src/product-window/commands/report-error-count.ts';
import { revealRecordDataFile } from '../src/product-window/commands/reveal-record-data-file.ts';
import { saveWindowPlace } from '../src/product-window/commands/save-window-place.ts';
import type { OpenWindow } from '../src/product-window/model.ts';
import { ProductWindowRepository } from '../src/product-window/repository.ts';
import { productWindowProblems } from '../src/product-window/rules.ts';
import { addRecentFolder } from '../src/recent-folders/commands/add-recent-folder.ts';
import { clearRecentFolders } from '../src/recent-folders/commands/clear-recent-folders.ts';
import { onWindowOpenedAddRecentFolder } from '../src/recent-folders/policies.ts';
import { listRecentFolders } from '../src/recent-folders/queries.ts';
import { recentFoldersReader } from '../src/recent-folders/reader.ts';
import { RecentFolderRepository } from '../src/recent-folders/repository.ts';
import { recentFoldersProblems } from '../src/recent-folders/rules.ts';
import { chooseEditor } from '../src/shell-settings/commands/choose-editor.ts';
import { openSettingsFile } from '../src/shell-settings/commands/open-settings-file.ts';
import { ShellSettingsRepository } from '../src/shell-settings/repository.ts';
import { shellSettingsProblems } from '../src/shell-settings/rules.ts';
import type { AppServer } from '../src/servers.ts';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-aggregates-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const file = (name: string) => () => path.join(temp, name);
const json = (name: string): unknown => JSON.parse(readFileSync(path.join(temp, name), 'utf8'));

const window = (folder: string, extra: Partial<OpenWindow> = {}): OpenWindow =>
  ({ folder, product: path.basename(folder), win: { id: folder } as unknown as OpenWindow['win'], errors: 0, dataFiles: null, launchRun: 0, key: folder, chatSent: null, ...extra });
const server = (url: string, label = 'serve'): AppServer => ({ url, label, stop: vi.fn(async () => {}) });

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
    const reveal = vi.fn();
    revealRecordDataFile(windows, { folder: '/p/b', request: { id: 'LA-AUT-UC01', path: '/etc' } }, reveal);
    revealRecordDataFile(windows, { folder: '/p/b', request: { id: 'LA-AUT-UC01' } }, reveal);
    expect(reveal.mock.calls).toEqual([['/p/b/data/use_case.jsonl']]);
  });

  it('refuses a window kept under another folder', () => {
    const open = new Map([['/p/a', window('/p/b')]]);
    expect(productWindowProblems({ open, places: {}, chrome: {} })).toEqual(['The window for /p/b is kept under /p/a.']);
  });
});

describe('LA-PLT-INV06-T A server the shell starts never listens on 5199: the App server\'s repository keeps the servers in memory', () => {
  it('starts a folder\'s server once, and stops it, keeping the stop until it settles', async () => {
    const servers = new AppServerRepository();
    const start = vi.fn(async () => ({ server: server('http://127.0.0.1:6001'), lathe: 'bundled Lathe 1.0.0' }));
    const first = await startAppServer(servers, { folder: '/p/a', start });
    expect(await startAppServer(servers, { folder: '/p/a', start })).toBe(first);
    expect(start).toHaveBeenCalledTimes(1);
    const stop = stopAppServer(servers, { folder: '/p/a' }, () => {});
    expect(servers.load().running.size).toBe(0);
    expect(servers.load().stopping.size).toBe(1);
    await stop;
    await Promise.resolve();
    expect(first.server.stop).toHaveBeenCalled();
    expect(servers.load().stopping.size).toBe(0);
  });

  it('refuses a server it started on 5199, and stops it; the shared dev server may be there', async () => {
    const servers = new AppServerRepository();
    const own = server('http://127.0.0.1:5199');
    await expect(startAppServer(servers, { folder: '/p/a', start: async () => ({ server: own, lathe: 'x' }) })).rejects.toThrow('listens on 5199');
    expect(own.stop).toHaveBeenCalled();
    expect(appServerProblems({ running: new Map([['/p/b', { server: server('http://localhost:5199', 'shared dev server'), lathe: 'x' }]]), stopping: new Set() })).toEqual([]);
  });

  it('LA-PLT-PO01-T LA-PLT-PO02-T when a window opens its server starts, and when it closes its server stops', async () => {
    const servers = new AppServerRepository();
    const serveWindow = vi.fn(async () => {});
    await onWindowOpenedStartAppServer({ folder: '/p/a', window: window('/p/a') }, serveWindow);
    expect(serveWindow).toHaveBeenCalledWith('/p/a');
    const running = await startAppServer(servers, { folder: '/p/a', start: async () => ({ server: server('http://127.0.0.1:6002'), lathe: 'x' }) });
    await onWindowClosedStopAppServer({ folder: '/p/a' }, servers, () => {});
    expect(running.server.stop).toHaveBeenCalled();
  });
});

describe('LA-PLT-INV14-T The recent folders list puts the latest first, each folder once, at most 10: the Recent folders\' repository keeps it in recent-folders.json', () => {
  it('adds and clears through the repository, and the read model lists them as the menu shows them', () => {
    const recents = new RecentFolderRepository(file('recent-folders.json'));
    addRecentFolder(recents, { folder: '/p/a' });
    addRecentFolder(recents, { folder: '/p/b' });
    expect(json('recent-folders.json')).toEqual(['/p/b', '/p/a']);
    expect(new RecentFolderRepository(file('recent-folders.json')).load()).toEqual(['/p/b', '/p/a']);
    expect(listRecentFolders(recentFoldersReader(recents.load(), '/p'))).toEqual([{ folder: '/p/b', label: '~/b' }, { folder: '/p/a', label: '~/a' }]);
    clearRecentFolders(recents);
    expect(json('recent-folders.json')).toEqual([]);
  });

  it('refuses a folder twice, a relative path or more than 10', () => {
    expect(recentFoldersProblems(['/a', '/a', 'b'])).toEqual(['The recent folders list /a twice.', 'The recent folder b is not a full path.']);
    expect(recentFoldersProblems(Array.from({ length: 11 }, (_, i) => `/f${i}`))).toEqual(['The recent folders list 11 folders, more than 10.']);
  });

  it('LA-PLT-PO03-T when a folder opens it goes first in the recent folders, the system\'s recent documents and the menu', () => {
    const recents = new RecentFolderRepository(file('recent-3.json'));
    const shell = { addRecentDocument: vi.fn(), recentFoldersChanged: vi.fn() };
    onWindowOpenedAddRecentFolder({ folder: '/p/c', window: window('/p/c') }, recents, shell);
    expect(recents.load()).toEqual(['/p/c']);
    expect(shell.addRecentDocument).toHaveBeenCalledWith('/p/c');
    expect(shell.recentFoldersChanged).toHaveBeenCalled();
  });
});

describe('Shell settings are kept in settings.json, through their repository', () => {
  it('chooses an editor, keeping the rest of the file, and refuses a custom editor with no command', () => {
    const settings = new ShellSettingsRepository(file('settings.json'));
    writeFileSync(path.join(temp, 'settings.json'), JSON.stringify({ editor: 'zed', claudePath: '/opt/claude' }));
    chooseEditor(settings, { editor: 'cursor' });
    expect(settings.load()).toEqual({ editor: 'cursor', claudePath: '/opt/claude' });
    expect(() => chooseEditor(settings, { editor: 'custom' })).toThrow('A custom editor needs its command in settings.json.');
    expect(shellSettingsProblems({ editor: 'custom', editorCommand: 'subl' })).toEqual([]);
  });

  it('writes the settings file when missing, with an empty editor command to fill in, and opens it', () => {
    const settings = new ShellSettingsRepository(file('new-settings.json'));
    const open = vi.fn();
    openSettingsFile(settings, open);
    expect(json('new-settings.json')).toEqual({ editor: 'vscode', editorCommand: '' });
    expect(open).toHaveBeenCalledWith(path.join(temp, 'new-settings.json'));
  });
});

describe('LA-PAT-SHELL-ACTIONS-R01-T03 Each shell action has its own channel', () => {
  it('sends each error page button on its command\'s channel', () => {
    const preload = readFileSync(path.join(SRC, 'local-preload.cts'), 'utf8');
    for (const [action, channel] of Object.entries(LOCAL_ACTION_CHANNELS)) expect(preload).toMatch(new RegExp(`'?${action}'?: '${channel}'`));
  });

  it('sends each record action on its own channel with { id } only', () => {
    const preload = readFileSync(path.join(SRC, 'preload.cts'), 'utf8');
    for (const channel of ['lathe:reveal-record', 'lathe:open-record-in-editor', 'lathe:copy-record-id', 'lathe:show-record-menu']) expect(preload).toContain(`recordAction('${channel}')`);
    expect(preload).toContain('ipcRenderer.send(channel, { id })');
  });
});
