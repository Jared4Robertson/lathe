import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import * as latheConfig from '../../lathe/src/config.ts';
import { checkFolder as check, displayPath, latheConfigModulePath, loadLatheConfig, productNames as names, windowTitle, type LatheConfigReads } from '../src/folders.ts';

// The folder check and the products' names read with Lathe's own config module, as the app loads it.
const lathe: LatheConfigReads = latheConfig;
const checkFolder = (folder: string) => check(folder, lathe);
const productNames = (dataDirs: string[]) => names(dataDirs, lathe);

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

describe('LA-PLT-SP01-T A folder opens only when it holds lathe.config.json or a data folder', () => {
  it('opens a folder with lathe.config.json, reading its data folder', () => {
    const root = folder('configured', { 'lathe.config.json': '{ "data": "tables" }' });
    expect(checkFolder(root)).toEqual({ ok: true, dataDirs: [path.join(root, 'tables')] });
    const plainConfig = folder('configured-default', { 'lathe.config.json': '{}' });
    expect(checkFolder(plainConfig)).toEqual({ ok: true, dataDirs: [path.join(plainConfig, 'data')] });
  });

  it('LA-PLT-UC11-R08-T01 opens a workspace with the data folder of each product it lists, from its own config', () => {
    const root = folder('workspace', {
      'lathe.config.json': '{ "products": ["examples/shop"] }',
      'examples/shop/lathe.config.json': '{ "data": "spec" }',
      'data/product.jsonl': '{"id":"LA","title":"Lathe"}\n',
      'examples/shop/spec/product.jsonl': '{"id":"SH","title":"Shop"}\n',
    });
    const check = checkFolder(root);
    expect(check).toEqual({ ok: true, dataDirs: [path.join(root, 'data'), path.join(root, 'examples/shop/spec')] });
    expect(check.ok && productNames(check.dataDirs)).toEqual(['Lathe', 'Shop']);
    // A listed folder with no config of its own is refused with Lathe's reason, as its engine would refuse it.
    const gone = folder('workspace-gone', { 'lathe.config.json': '{ "products": ["examples/gone"] }' });
    expect(checkFolder(gone)).toEqual({ ok: false, message: expect.stringMatching(/examples\/gone holds no lathe\.config\.json/) });
  });

  it('refuses a config Lathe refuses, with its reason', () => {
    const root = folder('unknown-setting', { 'lathe.config.json': '{ "diagrams": "model" }' });
    expect(checkFolder(root)).toEqual({ ok: false, message: expect.stringMatching(/unknown setting "diagrams"/) });
  });

  it("loads Lathe's config module from this repo's source, or the packed app's built package", async () => {
    const repo = path.resolve(import.meta.dirname, '..', '..');
    expect(latheConfigModulePath(repo, null)).toBe(path.join(repo, 'lathe', 'src', 'config.ts'));
    expect(latheConfigModulePath(repo, { resourcesPath: '/Applications/Lathe.app/Contents/Resources' })).toBe('/Applications/Lathe.app/Contents/Resources/node_modules/@jaredrob/lathe/dist/src/config.js');
    const loaded = await loadLatheConfig(latheConfigModulePath(repo, null));
    expect(loaded.CONFIG_FILE).toBe('lathe.config.json');
    expect(loaded.productTitles(path.join(repo, 'data'))).toEqual(['Lathe']);
  });

  it('opens a folder with a data folder and no config', () => {
    const root = folder('plain', {}, ['data']);
    expect(checkFolder(root)).toEqual({ ok: true, dataDirs: [path.join(root, 'data')] });
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
    expect(!check.ok && check.message).toMatch(/lathe\.config\.json is not valid JSON/);
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
    const names = productNames([path.join(root, 'data')]);
    expect(productNames([path.join(root, 'missing')])).toEqual([]);
    expect(names).toEqual(['Lathe', 'Tool Library']);
    expect(windowTitle('/Users/person/Development/Lathe', names, '/Users/person')).toBe('Lathe, Tool Library — ~/Development/Lathe');
    expect(windowTitle('/srv/product', [], '/Users/person')).toBe('product — /srv/product');
    expect(displayPath('/Users/personx', '/Users/person')).toBe('/Users/personx');
  });
});
