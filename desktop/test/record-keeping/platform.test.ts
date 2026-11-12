import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { openProductFolder } from '../../src/product-window/commands/open-product-folder.ts';
import { reportErrorCount } from '../../src/product-window/commands/report-error-count.ts';
import { revealProductFolder } from '../../src/product-window/commands/reveal-product-folder.ts';
import { setWindowChrome } from '../../src/product-window/commands/set-window-chrome.ts';
import { showRecordMenu } from '../../src/product-window/commands/show-record-menu.ts';
import type { OpenWindow } from '../../src/product-window/model.ts';
import { ProductWindowRepository } from '../../src/product-window/repository.ts';

// The commands of the Product window that the desktop shell runs for a page, each run through the aggregate's
// repository with a stand-in for the window's native parts, and the state it leaves read back.

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-record-keeping-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

const repository = (name: string) => new ProductWindowRepository({ places: () => path.join(temp, `${name}-places.json`), chrome: () => path.join(temp, `${name}-chrome.json`) });
const background = vi.fn();
const window = (folder: string): OpenWindow =>
  ({ folder, product: path.basename(folder), win: { id: folder, setBackgroundColor: background } as unknown as OpenWindow['win'], errors: 0, launchRun: 0, key: folder });
const opened = async (name: string, folder: string) => {
  const windows = repository(name);
  await openProductFolder(windows, { window: window(folder) }, { onWindowOpenedAddRecentFolder: () => {}, onWindowOpenedStartAppServer: async () => {} });
  return windows;
};

describe("Show a record's menu", () => {
  it("LA-PLT-UC101-R01-T01 LA-PLT-UC101-FL-T A record's menu is shown over its window from the record's ID alone", async () => {
    const windows = await opened('menu', '/p/a');
    const dataFileOf = vi.fn(async () => '/p/a/data/use_case.jsonl');
    const popup = vi.fn();
    // A path sent with the ID is refused, and a folder with no window gets no menu.
    await showRecordMenu(windows, { folder: '/p/a', request: { id: 'LA-MOD-UC02', path: '/etc' } }, dataFileOf, popup);
    await showRecordMenu(windows, { folder: '/p/x', request: { id: 'LA-MOD-UC02' } }, dataFileOf, popup);
    expect(popup).not.toHaveBeenCalled();
    await showRecordMenu(windows, { folder: '/p/a', request: { id: 'LA-MOD-UC02' } }, dataFileOf, popup);
    expect(dataFileOf.mock.calls).toEqual([['/p/a', 'LA-MOD-UC02']]);
    expect(popup).toHaveBeenCalledWith(windows.load().open.get('/p/a'), 'LA-MOD-UC02', '/p/a/data/use_case.jsonl');
  });
});

describe('Reveal a product folder', () => {
  it("LA-PLT-UC102-R01-T01 LA-PLT-UC102-FL-T Reveal shows the folder of the window it is asked from, and none else", async () => {
    const windows = await opened('reveal', '/p/a');
    const reveal = vi.fn();
    revealProductFolder(windows, { folder: '/p/x' }, reveal);
    expect(reveal).not.toHaveBeenCalled();
    revealProductFolder(windows, { folder: '/p/a' }, reveal);
    expect(reveal.mock.calls).toEqual([['/p/a']]);
  });
});

describe("The policies' reactions", () => {
  it("LA-PLT-PO20-T A theme's colors color the window's chrome, are kept for the system's appearance, and a refused color changes nothing", async () => {
    const windows = await opened('chrome', '/p/a');
    const colors = { background: '#101418', foreground: '#E8ECF0' };
    expect(setWindowChrome(windows, { folder: '/p/a', chrome: colors, dark: true, platform: 'darwin' })).toEqual(colors);
    expect(background).toHaveBeenCalledWith('#101418');
    expect(windows.load().chrome.dark).toEqual(colors);
    expect(windows.load().open.get('/p/a')?.chrome).toEqual(colors);
    expect(setWindowChrome(windows, { folder: '/p/a', chrome: { background: 'red', foreground: '#fff' }, dark: true, platform: 'darwin' })).toBeNull();
    expect(setWindowChrome(windows, { folder: '/p/x', chrome: colors, dark: true, platform: 'darwin' })).toBeNull();
    expect(windows.load().chrome.dark).toEqual(colors);
  });

  it("LA-PLT-PO21-T A window's error count is kept as a whole number the window's own page sent, and nothing else", async () => {
    const windows = await opened('errors', '/p/a');
    expect(reportErrorCount(windows, { folder: '/p/a', count: 7 })).toBe(true);
    expect(windows.load().open.get('/p/a')?.errors).toBe(7);
    expect(reportErrorCount(windows, { folder: '/p/a', count: -1 })).toBe(false);
    expect(reportErrorCount(windows, { folder: '/p/a', count: '7' })).toBe(false);
    expect(reportErrorCount(windows, { folder: '/p/x', count: 7 })).toBe(false);
    expect(windows.load().open.get('/p/a')?.errors).toBe(7);
  });
});
