import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DataFiles, findDataFile, parseRecordRequest, recordMenuTemplate, revealLabel } from '../src/records.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-records-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function write(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

describe('LA-AUT-UC15-R01-T01 The record actions take only a known action and a record ID, and find the data file themselves', () => {
  it('accepts exactly { action, id } with a known action and a record ID', () => {
    expect(parseRecordRequest({ action: 'reveal', id: 'SMK-ORD' })).toEqual({ action: 'reveal', id: 'SMK-ORD' });
    for (const action of ['open-in-editor', 'copy-id', 'menu']) expect(parseRecordRequest({ action, id: 'LA-V71-R01' })).toEqual({ action, id: 'LA-V71-R01' });
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
      { action: 'reveal', id: '/Users/person/.ssh/id_rsa' },
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

    const files = new DataFiles(data);
    expect(files.find('SMK-ORD')).toBe(path.join(data, 'domain.jsonl'));
    expect(files.find('SMK-NONE')).toBeNull();
    // A record that became another kind is in that kind's file now.
    write(path.join(data, 'domain.jsonl'), '{"id":"SMK-ORDERS","title":"Longer","product_id":"SMK"}\n');
    write(path.join(data, 'pattern.jsonl'), '{"id":"SMK-ORD","title":"Orders","product_id":"SMK"}\n');
    expect(files.find('SMK-ORD')).toBe(path.join(data, 'pattern.jsonl'));
  });

  it('offers reveal, open in the editor and copy ID in the native menu, the first two only for a record with a file', () => {
    const actions = { reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', true, 'VS Code', actions, 'darwin');
    expect(menu.map((m) => m.label ?? m.type)).toEqual(['Reveal Data File in Finder', 'Open in VS Code', 'separator', 'Copy ID “SMK-ORD”']);
    expect(menu.every((m) => m.enabled !== false)).toBe(true);
    (menu[3].click as () => void)();
    expect(actions.copyId).toHaveBeenCalled();
    const missing = recordMenuTemplate('SMK-X', false, 'VS Code', actions, 'darwin');
    expect(missing.filter((m) => m.enabled === false).map((m) => m.label)).toEqual(['Reveal Data File in Finder', 'Open in VS Code']);
    expect(revealLabel('win32')).toBe('Show Data File in File Explorer');
    expect(revealLabel('linux')).toBe('Show Data File in Folder');
  });
});
