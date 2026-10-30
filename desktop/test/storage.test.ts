// Storage tests for the desktop shell's user data folder (LA-PLT-STORE03): what it keeps across launches. Each test
// saves through the aggregate's own repository into a fresh folder, then loads through a new repository on the same
// file, as the next launch does, so the round trip goes through real files.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveWindow, windowFor } from '../src/product-window/model.ts';
import { ProductWindowRepository } from '../src/product-window/repository.ts';
import { addRecent } from '../src/recent-folders/model.ts';
import { RecentFolderRepository } from '../src/recent-folders/repository.ts';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A fresh folder standing in for the shell's user data folder, and a file in it. */
function userData(): (name: string) => () => string {
  const folder = mkdtempSync(path.join(tmpdir(), 'lathe-user-data-'));
  folders.push(folder);
  return (name) => () => path.join(folder, name);
}

const display = { x: 0, y: 0, width: 1728, height: 1080 };

describe('LA-PLT-A6-SR01 a window\'s place is kept across launches', () => {
  it('LA-PLT-A6-SR01-T01 a saved window reopens at its place after a relaunch, and a broken file is a fresh start', () => {
    const file = userData();
    const files = { places: file('window-state.json'), chrome: file('chrome.json'), modes: file('chat-modes.json') };
    const first = new ProductWindowRepository(files);
    const windows = first.load();
    first.save({ ...windows, places: saveWindow(windows.places, '/p/lathe', { x: 100, y: 80, width: 1400, height: 900, maximized: true }) });
    expect(existsSync(`${files.places()}.tmp`)).toBe(false);
    const relaunched = new ProductWindowRepository(files).load();
    expect(windowFor(relaunched.places, '/p/lathe', [display])).toEqual({ x: 100, y: 80, width: 1400, height: 900, maximized: true });
    expect(relaunched.open.size).toBe(0);
    writeFileSync(files.places(), '{"/p/lathe": {"width": 14');
    expect(new ProductWindowRepository(files).load().places).toEqual({});
  });
});

describe('LA-PLT-A9-SR01 the recent folders are kept across launches', () => {
  it('LA-PLT-A9-SR01-T01 the recent list, latest first, reads back after a relaunch, and no half-written file is left', () => {
    const file = userData()('recent-folders.json');
    new RecentFolderRepository(file).save(addRecent(addRecent([], '/p/a'), '/p/b'));
    expect(existsSync(`${file()}.tmp`)).toBe(false);
    expect(new RecentFolderRepository(file).load()).toEqual(['/p/b', '/p/a']);
    expect(new RecentFolderRepository(() => `${file()}.missing`).load()).toEqual([]);
  });
});
