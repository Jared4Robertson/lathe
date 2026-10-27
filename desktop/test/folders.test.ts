import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { addRecent, checkFolder, displayPath, parseRecent, productNames, RECENT_LIMIT, windowTitle } from '../src/folders.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-desktop-folders-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function folder(name: string, files: Record<string, string> = {}, dirs: string[] = []) {
  const root = path.join(temp, name);
  mkdirSync(root, { recursive: true });
  for (const dir of dirs) mkdirSync(path.join(root, dir), { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  return root;
}

describe('LA-PLT-T106 A folder opens only when it holds lathe.config.json or a data folder', () => {
  it('opens a folder with lathe.config.json, reading its data folder', () => {
    const root = folder('configured', { 'lathe.config.json': '{ "data": "tables" }' });
    expect(checkFolder(root)).toEqual({ ok: true, dataDir: path.join(root, 'tables') });
    const plainConfig = folder('configured-default', { 'lathe.config.json': '{}' });
    expect(checkFolder(plainConfig)).toEqual({ ok: true, dataDir: path.join(plainConfig, 'data') });
  });

  it('opens a folder with a data folder and no config', () => {
    const root = folder('plain', {}, ['data']);
    expect(checkFolder(root)).toEqual({ ok: true, dataDir: path.join(root, 'data') });
  });

  it('says what is missing otherwise', () => {
    const root = folder('empty');
    const check = checkFolder(root);
    expect(check.ok).toBe(false);
    expect(!check.ok && check.message).toMatch(/has no lathe\.config\.json and no data folder/);
  });

  it('refuses a config that is not valid JSON, naming the file', () => {
    const root = folder('broken', { 'lathe.config.json': '{ data: ' }, ['data']);
    const check = checkFolder(root);
    expect(!check.ok && check.message).toMatch(/lathe\.config\.json .* is not valid JSON/);
  });

  it('refuses a path that is not a folder', () => {
    const root = folder('file-parent', { 'note.txt': 'x' });
    expect(checkFolder(path.join(root, 'note.txt')).ok).toBe(false);
    expect(checkFolder(path.join(root, 'missing')).ok).toBe(false);
  });

  it('names the window after the products in the folder, then the folder', () => {
    const root = folder('products', {
      'data/product.jsonl': '{"id":"LA","title":"Lathe"}\n{"id":"TL","title":"Tool Library"}\nnot json\n',
      'data/domain.jsonl': '{"id":"LA-D","title":"Not a product","product_id":"LA"}\n',
    });
    const names = productNames(path.join(root, 'data'));
    expect(productNames(path.join(root, 'missing'))).toEqual([]);
    expect(names).toEqual(['Lathe', 'Tool Library']);
    expect(windowTitle('/Users/person/Development/Lathe', names, '/Users/owner')).toBe('Lathe, Tool Library — ~/Development/Lathe');
    expect(windowTitle('/srv/product', [], '/Users/owner')).toBe('product — /srv/product');
    expect(displayPath('/Users/jaredx', '/Users/owner')).toBe('/Users/jaredx');
  });
});

describe('LA-PLT-T107 The recent folders list puts the latest first, each folder once, at most 10', () => {
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
