// The Recent folders aggregate (LA-PLT-A9): its repository keeps the list in recent-folders.json, its commands,
// policy and read model go through it, and its rule refuses a folder twice, a relative path or more than 10.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { OpenWindow } from '../src/product-window/model.ts';
import { addRecentFolder } from '../src/recent-folders/commands/add-recent-folder.ts';
import { clearRecentFolders } from '../src/recent-folders/commands/clear-recent-folders.ts';
import { addRecent, parseRecent, RECENT_LIMIT } from '../src/recent-folders/model.ts';
import { onWindowOpenedAddRecentFolder } from '../src/recent-folders/policies.ts';
import { listRecentFolders } from '../src/recent-folders/queries.ts';
import { recentFoldersReader } from '../src/recent-folders/reader.ts';
import { RecentFolderRepository } from '../src/recent-folders/repository.ts';
import { recentFoldersProblems } from '../src/recent-folders/rules.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-recent-folders-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const file = (name: string) => () => path.join(temp, name);
const json = (name: string): unknown => JSON.parse(readFileSync(path.join(temp, name), 'utf8'));

const window = (folder: string, extra: Partial<OpenWindow> = {}): OpenWindow =>
  ({ folder, product: path.basename(folder), win: { id: folder } as unknown as OpenWindow['win'], errors: 0, dataFiles: null, launchRun: 0, key: folder, ...extra });

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
    expect(recentFoldersProblems(['/a', '/a', 'b'])).toEqual([
      { rule: 'recent-folders-once-at-most-10', message: 'The recent folders list /a twice.' },
      { rule: 'recent-folders-once-at-most-10', message: 'The recent folder b is not a full path.' },
    ]);
    expect(recentFoldersProblems(Array.from({ length: 11 }, (_, i) => `/f${i}`))).toEqual([{ rule: 'recent-folders-once-at-most-10', message: 'The recent folders list 11 folders, more than 10.' }]);
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

describe('LA-PLT-INV14-T The recent folders list puts the latest first, each folder once, at most 10', () => {
  it('puts the folder opened last first', () => {
    expect(addRecent(['/a', '/b'], '/c')).toEqual(['/c', '/a', '/b']);
  });

  it('moves a folder opened again to the top instead of listing it twice', () => {
    expect(addRecent(['/a', '/b', '/c'], '/b')).toEqual(['/b', '/a', '/c']);
    expect(addRecent(['/a', '/b'], '/b/')).toEqual(['/b', '/a']);
  });

  it('keeps at most 10 folders, dropping the oldest', () => {
    let list: string[] = [];
    for (let i = 1; i <= 12; i++) list = addRecent(list, `/p${i}`);
    expect(RECENT_LIMIT).toBe(10);
    expect(list).toHaveLength(10);
    expect(list[0]).toBe('/p12');
    expect(list.at(-1)).toBe('/p3');
  });

  it('reads a saved list safely, keeping its order', () => {
    expect(parseRecent(['/a', 3, '/b', '/a', '', null])).toEqual(['/a', '/b']);
    expect(parseRecent({ not: 'a list' })).toEqual([]);
    expect(parseRecent(Array.from({ length: 15 }, (_, i) => `/f${i}`))).toHaveLength(10);
  });
});
