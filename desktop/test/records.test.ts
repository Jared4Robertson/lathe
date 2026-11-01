import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { LOCAL_ACTION_CHANNELS } from '../src/launch.ts';
import { FIND_RECORD_DATA_FILE } from '../../lathe/src/authoring/record-data-file/queries.ts';
import { parseRecordId, RECORD_DATA_FILE_ROUTE, recordDataFile, recordMenuTemplate, revealLabel } from '../src/records.ts';

describe('LA-PAT-RECORD-DATA-FILE-R01-T01 LA-PAT-SHELL-ACTIONS-R01-T02 The record actions take only a record ID, each on its own channel, and ask the engine for the data file', () => {
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

  it("asks the window's engine which data file holds the record, and takes only a full path to a data file", async () => {
    expect(RECORD_DATA_FILE_ROUTE).toBe(FIND_RECORD_DATA_FILE.route);
    const answering = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    const engine = answering(200, { id: 'SMK-ORD', file: '/p/shop/data/domain.jsonl' });
    expect(await recordDataFile('http://127.0.0.1:5400', 'SMK-ORD', engine)).toBe('/p/shop/data/domain.jsonl');
    expect(engine).toHaveBeenCalledWith('http://127.0.0.1:5400/api/record-data-file/find-record-data-file?id=SMK-ORD');
    // No record has the ID, an older Lathe has no such read, an answer that is no data file, or no answer at all.
    expect(await recordDataFile('http://127.0.0.1:5400', 'SMK-NONE', answering(422, { error: 'no record has the ID SMK-NONE' }))).toBeNull();
    expect(await recordDataFile('http://127.0.0.1:5400', 'SMK', answering(404, { error: 'Not found' }))).toBeNull();
    expect(await recordDataFile('http://127.0.0.1:5400', 'SMK', answering(200, { file: 'data/product.jsonl' }))).toBeNull();
    expect(await recordDataFile('http://127.0.0.1:5400', 'SMK', answering(200, { file: '/etc/hosts' }))).toBeNull();
    expect(await recordDataFile('http://127.0.0.1:5400', 'SMK', vi.fn(async () => { throw new Error('refused'); }) as unknown as typeof fetch)).toBeNull();
  });

  it('offers reveal, open in the editor and copy ID in the native menu, the first two only for a record with a file', () => {
    const actions = { openInNewTab: vi.fn(), askClaude: vi.fn(), reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', true, 'VS Code', actions, 'darwin');
    expect(menu.map((m) => m.label ?? m.type)).toEqual(['Open in New Tab', 'Ask Claude About This', 'separator', 'Reveal Data File in Finder', 'Open in VS Code', 'separator', 'Copy ID “SMK-ORD”']);
    expect(menu.every((m) => m.enabled !== false)).toBe(true);
    (menu[6].click as () => void)();
    expect(actions.copyId).toHaveBeenCalled();
    const missing = recordMenuTemplate('SMK-X', false, 'VS Code', actions, 'darwin');
    expect(missing.filter((m) => m.enabled === false).map((m) => m.label)).toEqual(['Reveal Data File in Finder', 'Open in VS Code']);
    expect(revealLabel('win32')).toBe('Show Data File in File Explorer');
    expect(revealLabel('linux')).toBe('Show Data File in Folder');
  });

  it('LA-V96-R11-T04 The record\'s right-click menu offers Open in New Tab', () => {
    const actions = { openInNewTab: vi.fn(), askClaude: vi.fn(), reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', false, 'VS Code', actions, 'darwin');
    expect(menu[0]).toMatchObject({ label: 'Open in New Tab' });
    expect(menu[0].enabled).not.toBe(false);
    (menu[0].click as () => void)();
    expect(actions.openInNewTab).toHaveBeenCalled();
  });

  it('LA-PLT-UC22-R01-T02 The record\'s right-click menu offers Ask Claude About This, which attaches the record to the chat', () => {
    const actions = { openInNewTab: vi.fn(), askClaude: vi.fn(), reveal: vi.fn(), openInEditor: vi.fn(), copyId: vi.fn() };
    const menu = recordMenuTemplate('SMK-ORD', false, 'VS Code', actions, 'darwin');
    expect(menu[1]).toMatchObject({ label: 'Ask Claude About This' });
    (menu[1].click as () => void)();
    expect(actions.askClaude).toHaveBeenCalled();
  });
});

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('LA-PAT-SHELL-ACTIONS-R01-T02 Each shell action has its own channel', () => {
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
