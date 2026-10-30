// Storage tests for the desktop shell's user data folder (LA-PLT-STORE03): what it keeps across launches. Each test
// writes the JSON file as main.ts does (writeJson) into a fresh folder, then reads it back as the next launch does
// (readJson and the parser), so the round trip goes through real files.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { addRecent, parseRecent } from '../src/folders.ts';
import { readJson, writeJson } from '../src/store.ts';
import { parseWindowStates, saveWindow, windowFor } from '../src/windowState.ts';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

/** A fresh folder standing in for the shell's user data folder. */
function userData(): string {
  const folder = mkdtempSync(path.join(tmpdir(), 'lathe-user-data-'));
  folders.push(folder);
  return folder;
}

const display = { x: 0, y: 0, width: 1728, height: 1080 };

describe('LA-PLT-A6-SR01 a window\'s place is kept across launches', () => {
  it('LA-PLT-A6-SR01-T01 a saved window reopens at its place after a relaunch, and a broken file is a fresh start', () => {
    const folder = userData();
    const file = path.join(folder, 'window-state.json');
    writeJson(file, saveWindow({}, '/p/lathe', { x: 100, y: 80, width: 1400, height: 900, maximized: true }));
    expect(readdirSync(folder)).toEqual(['window-state.json']);
    expect(windowFor(parseWindowStates(readJson(file)), '/p/lathe', [display])).toEqual({ x: 100, y: 80, width: 1400, height: 900, maximized: true });
    writeFileSync(file, '{"/p/lathe": {"width": 14');
    expect(parseWindowStates(readJson(file))).toEqual({});
  });
});

describe('LA-PLT-A9-SR01 the recent folders are kept across launches', () => {
  it('LA-PLT-A9-SR01-T01 the recent list, latest first, reads back after a relaunch, and no half-written file is left', () => {
    const folder = userData();
    const file = path.join(folder, 'recent-folders.json');
    writeJson(file, addRecent(addRecent([], '/p/a'), '/p/b'));
    expect(existsSync(`${file}.tmp`)).toBe(false);
    expect(parseRecent(readJson(file))).toEqual(['/p/b', '/p/a']);
    expect(parseRecent(readJson(path.join(folder, 'missing.json')))).toEqual([]);
  });
});
