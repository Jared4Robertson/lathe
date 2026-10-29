import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DataFiles, findDataFile, parseRecordId, recordMenuTemplate, revealLabel } from '../src/records.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-records-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function write(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

describe('LA-PAT-RECORD-DATA-FILE-R01-T01 LA-PAT-SHELL-ACTIONS-R01-T02 The record actions take only a record ID, each on its own channel, and find the data file themselves', () => {
  it('accepts exactly { id } with a record ID, each action on its own channel', () => {
    expect(parseRecordId({ id: 'SMK-ORD' })).toBe('SMK-ORD');
    expect(parseRecordId({ id: 'LA-V71-R01' })).toBe('LA-V71-R01');
  });

  it('refuses paths, odd IDs and extra keys', () => {
    const refused: unknown[] = [
      null,
      'SMK',
      ['SMK'],
      {},
      { action: 'reveal', id: 'SMK' },
      { id: '../../etc/passwd' },
      { id: '/Users/person/.ssh/id_rsa' },
      { id: 'smk-ord' },
      { id: 'SMK--ORD' },
      { id: 'SMK-ORD/requirement' },
      { id: 'SMK ORD' },
      { id: 42 },
      { id: 'A'.repeat(200) },
      { id: 'SMK', path: '/etc/hosts' },
    ];
    for (const input of refused) expect(parseRecordId(input), JSON.stringify(input)).toBeNull();
  });

  it('finds the data file whose row starts with the record\'s id, never a row that only names it, and finds it again when it changes', () => {
    const data = path.join(temp, 'data');
    write(path.join(data, 'product.jsonl'), '{"id":"SMK","title":"Smoke"}\n');
    write(path.join(data, 'domain.jsonl'), '{"id":"SMK-ORD","title":"Orders","product_id":"SMK"}\n{"id":"SMK-ORDERS","title":"Longer","product_id":"SMK"}\n');
    write(path.join(data, 'about.jsonl'), '{"source_id":"SMK-Q01","target_id":"SMK-NOTE"}\n');
    write(path.join(data, 'notes.txt'), '{"id":"SMK-NOTE"}');
    expect(findDataFile(data, 'SMK')).toBe(path.join(data, 'product.jsonl'));
    expect(findDataFile(data, 'SMK-ORDERS')).toBe(path.join(data, 'domain.jsonl'));
    expect(findDataFile(data, 'SMK-NOTE')).toBeNull();
    expect(findDataFile(path.join(temp, 'missing'), 'SMK')).toBeNull();

    const files = new DataFiles([data]);
    expect(files.find('SMK-ORD')).toBe(path.join(data, 'domain.jsonl'));
    expect(files.find('SMK-NONE')).toBeNull();
    // A record that became another kind is in that kind's file now.
    write(path.join(data, 'domain.jsonl'), '{"id":"SMK-ORDERS","title":"Longer","product_id":"SMK"}\n');
    write(path.join(data, 'pattern.jsonl'), '{"id":"SMK-ORD","title":"Orders","product_id":"SMK"}\n');
    expect(files.find('SMK-ORD')).toBe(path.join(data, 'pattern.jsonl'));

    // In a workspace, each product's records are found in its own data folder.
    const other = path.join(temp, 'examples/shop/data');
    write(path.join(other, 'product.jsonl'), '{"id":"SH","title":"Shop"}\n');
    const workspace = new DataFiles([data, other]);
    expect(workspace.find('SMK')).toBe(path.join(data, 'product.jsonl'));
    expect(workspace.find('SH')).toBe(path.join(other, 'product.jsonl'));
  });

  it('offers reveal, open in the editor and copy ID in the native menu, the first two only for a record with a file', () => {
    const actions = { openInNewTab: vi.fn(), reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', true, 'VS Code', actions, 'darwin');
    expect(menu.map((m) => m.label ?? m.type)).toEqual(['Open in New Tab', 'separator', 'Reveal Data File in Finder', 'Open in VS Code', 'separator', 'Copy ID “SMK-ORD”']);
    expect(menu.every((m) => m.enabled !== false)).toBe(true);
    (menu[5].click as () => void)();
    expect(actions.copyId).toHaveBeenCalled();
    const missing = recordMenuTemplate('SMK-X', false, 'VS Code', actions, 'darwin');
    expect(missing.filter((m) => m.enabled === false).map((m) => m.label)).toEqual(['Reveal Data File in Finder', 'Open in VS Code']);
    expect(revealLabel('win32')).toBe('Show Data File in File Explorer');
    expect(revealLabel('linux')).toBe('Show Data File in Folder');
  });

  it('LA-V96-R11-T04 The record\'s right-click menu offers Open in New Tab', () => {
    const actions = { openInNewTab: vi.fn(), reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', false, 'VS Code', actions, 'darwin');
    expect(menu[0]).toMatchObject({ label: 'Open in New Tab' });
    expect(menu[0].enabled).not.toBe(false);
    (menu[0].click as () => void)();
    expect(actions.openInNewTab).toHaveBeenCalled();
  });
});
