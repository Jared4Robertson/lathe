import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseSettings } from '../src/shell-settings/model.ts';
import { findClaude, listSessions, projectDirName, runningSessions, sessionTitle, transcriptFile } from '../src/claudeSessions.ts';

const home = mkdtempSync(path.join(os.tmpdir(), 'lathe-claude-home-'));
const store = path.join(home, 'projects');
const registry = path.join(home, 'sessions');
const folder = '/Users/person/Product_one.x';
afterAll(() => rmSync(home, { recursive: true, force: true }));

const ID = (n: number) => `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`;
function transcript(id: string, lines: object[], ageMs: number) {
  const dir = path.join(store, projectDirName(folder));
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.jsonl`);
  writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const at = (Date.now() - ageMs) / 1000;
  utimesSync(file, at, at);
}
const prompt = (text: string) => ({ type: 'user', message: { role: 'user', content: text } });

describe('LA-PLT-UC19-R05-T01 The picker lists the folder\'s saved sessions by title and date, and warns of one open elsewhere', () => {
  it('names the store\'s folder as the CLI does', () => {
    expect(projectDirName('/Users/person/Product_one.x')).toBe('-Users-person-Product-one-x');
  });

  it('titles a session by its name, else its summary, else its first prompt', () => {
    const head = [JSON.stringify({ type: 'user', isMeta: true, message: { content: 'meta' } }), JSON.stringify(prompt('<command-name>/clear</command-name>')), JSON.stringify(prompt('Model the   orders domain'))].join('\n');
    expect(sessionTitle(head, '')).toBe('Model the orders domain');
    expect(sessionTitle(head, JSON.stringify({ type: 'summary', summary: 'Orders modeling' }))).toBe('Orders modeling');
    expect(sessionTitle(head, [JSON.stringify({ type: 'summary', summary: 'Orders modeling' }), JSON.stringify({ type: 'custom-title', customTitle: 'Orders' })].join('\n'))).toBe('Orders');
    expect(sessionTitle(JSON.stringify(prompt('x'.repeat(200))), '')).toHaveLength(80);
    expect(sessionTitle('', '')).toBeNull();
  });

  it('lists sessions newest first, leaving out empty ones, and marks those running or just written', () => {
    transcript(ID(1), [prompt('Older one')], 3_600_000);
    transcript(ID(2), [prompt('Newer one'), { type: 'custom-title', customTitle: 'Named' }], 600_000);
    transcript(ID(3), [{ type: 'summary', summary: 'Just written' }], 5_000);
    transcript(ID(4), [{ type: 'file-history-snapshot' }], 1_000);
    writeFileSync(path.join(store, projectDirName(folder), 'notes.txt'), 'not a session');
    const sessions = listSessions(store, folder, new Set([ID(1)]));
    expect(sessions.map((s) => [s.id, s.title, s.openElsewhere])).toEqual([
      [ID(3), 'Just written', 'recent'],
      [ID(2), 'Named', null],
      [ID(1), 'Older one', 'running'],
    ]);
    expect(listSessions(store, '/no/such/folder', new Set())).toEqual([]);
  });

  it('finds the sessions other clients are running, leaving out ended processes and its own', () => {
    mkdirSync(registry, { recursive: true });
    writeFileSync(path.join(registry, '101.json'), JSON.stringify({ pid: 101, sessionId: ID(1) }));
    writeFileSync(path.join(registry, '102.json'), JSON.stringify({ pid: 102, sessionId: ID(2) }));
    writeFileSync(path.join(registry, '103.json'), JSON.stringify({ pid: 103, sessionId: ID(3) }));
    writeFileSync(path.join(registry, 'broken.json'), '{');
    const alive = (pid: number) => pid !== 102;
    expect([...runningSessions(registry, alive, new Set([103]))]).toEqual([ID(1)]);
    expect([...runningSessions(path.join(home, 'none'), alive)]).toEqual([]);
  });

  it('opens only a session ID\'s own transcript', () => {
    expect(transcriptFile(store, folder, ID(1))).toBe(path.join(store, projectDirName(folder), `${ID(1)}.jsonl`));
    expect(transcriptFile(store, folder, '../../etc/passwd')).toBeNull();
    expect(transcriptFile(store, folder, ID(9))).toBeNull();
  });
});

describe('LA-PLT-UC19-R01-T03 The chat finds the Owner\'s own claude', () => {
  it('takes the configured path, else the PATH, else where the installers put it', () => {
    const at = (files: string[]) => (f: string) => files.includes(f);
    expect(findClaude('/x/claude', '/h', '/usr/bin', at(['/x/claude']))).toBe('/x/claude');
    expect(findClaude('/x/claude', '/h', '/usr/bin', at([]))).toBeNull();
    expect(findClaude(undefined, '/h', '/a:/b', at(['/b/claude', '/h/.local/bin/claude']))).toBe('/b/claude');
    expect(findClaude(undefined, '/h', '/usr/bin', at(['/h/.local/bin/claude']))).toBe('/h/.local/bin/claude');
    expect(findClaude(undefined, '/h', undefined, at([]))).toBeNull();
  });

  it('reads the configured path from settings.json', () => {
    expect(parseSettings({ claudePath: ' /opt/claude ' })).toEqual({ editor: 'vscode', claudePath: '/opt/claude' });
    expect(parseSettings({ claudePath: '' })).toEqual({ editor: 'vscode' });
  });
});
