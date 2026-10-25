import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { frontMatterId, indexSpecFiles, parseRecordRequest, recordMenuTemplate, revealLabel, SpecFiles } from '../src/records.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-records-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function write(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

describe('LA-AUT-T116 The record actions take only a known action and a record ID, and find the spec file themselves', () => {
  it('accepts exactly { action, id } with a known action and a record ID', () => {
    expect(parseRecordRequest({ action: 'reveal', id: 'SMK-ORD' })).toEqual({ action: 'reveal', id: 'SMK-ORD' });
    for (const action of ['open-in-editor', 'copy-id', 'menu']) expect(parseRecordRequest({ action, id: 'LA-PLT-UC14-R01' })).toEqual({ action, id: 'LA-PLT-UC14-R01' });
  });

  it('refuses paths, unknown actions, odd IDs and extra keys', () => {
    const refused: unknown[] = [
      null,
      'reveal',
      ['reveal', 'SMK'],
      { action: 'reveal' },
      { id: 'SMK' },
      { action: 'delete', id: 'SMK' },
      { action: 'reveal', id: '../../etc/passwd' },
      { action: 'reveal', id: '/Users/me/.ssh/id_rsa' },
      { action: 'reveal', id: 'smk-ord' },
      { action: 'reveal', id: 'SMK--ORD' },
      { action: 'reveal', id: 'SMK-ORD/requirement' },
      { action: 'reveal', id: 'SMK ORD' },
      { action: 'reveal', id: 42 },
      { action: 'reveal', id: 'A'.repeat(200) },
      { action: 'reveal', id: 'SMK', path: '/etc/hosts' },
    ];
    for (const input of refused) expect(parseRecordRequest(input), JSON.stringify(input)).toBeNull();
  });

  it('reads a record ID from a spec file\'s front matter', () => {
    expect(frontMatterId('---\nid: SMK-ORD\nkind: domain\n---\nBody')).toBe('SMK-ORD');
    expect(frontMatterId('---\nkind: domain\nid: "SMK-ORD"\n---\n')).toBe('SMK-ORD');
    expect(frontMatterId('No front matter. id: SMK')).toBeNull();
    expect(frontMatterId('---\nid: ../x\n---\n')).toBeNull();
  });

  it('finds each record\'s file under the specs folder, and finds it again after it moves', () => {
    const specs = path.join(temp, 'specs');
    write(path.join(specs, 'smoke', 'product.md'), '---\nid: SMK\nkind: product\ntitle: Smoke\n---\n');
    write(path.join(specs, 'smoke', 'orders', 'domain.md'), '---\nid: SMK-ORD\nkind: domain\n---\n');
    write(path.join(specs, 'smoke', 'notes.txt'), 'id: SMK-NOTE');
    write(path.join(specs, '.hidden', 'x.md'), '---\nid: SMK-HID\n---\n');
    expect([...indexSpecFiles(specs).keys()].sort()).toEqual(['SMK', 'SMK-ORD']);

    const files = new SpecFiles(specs);
    expect(files.find('SMK-ORD')).toBe(path.join(specs, 'smoke', 'orders', 'domain.md'));
    expect(files.find('SMK-NONE')).toBeNull();
    mkdirSync(path.join(specs, 'smoke', 'sales'));
    renameSync(path.join(specs, 'smoke', 'orders', 'domain.md'), path.join(specs, 'smoke', 'sales', 'domain.md'));
    expect(files.find('SMK-ORD')).toBe(path.join(specs, 'smoke', 'sales', 'domain.md'));
  });

  it('offers reveal, open in the editor and copy ID in the native menu, the first two only for a record with a file', () => {
    const actions = { reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', true, 'VS Code', actions, 'darwin');
    expect(menu.map((m) => m.label ?? m.type)).toEqual(['Reveal Spec File in Finder', 'Open in VS Code', 'separator', 'Copy ID “SMK-ORD”']);
    expect(menu.every((m) => m.enabled !== false)).toBe(true);
    (menu[3].click as () => void)();
    expect(actions.copyId).toHaveBeenCalled();
    const missing = recordMenuTemplate('SMK-X', false, 'VS Code', actions, 'darwin');
    expect(missing.filter((m) => m.enabled === false).map((m) => m.label)).toEqual(['Reveal Spec File in Finder', 'Open in VS Code']);
    expect(revealLabel('win32')).toBe('Show Spec File in File Explorer');
    expect(revealLabel('linux')).toBe('Show Spec File in Folder');
  });
});
