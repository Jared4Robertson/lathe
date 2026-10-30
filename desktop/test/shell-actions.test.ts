// Each shell action has its own channel: the error page's buttons and the record actions, as the preloads send them.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCAL_ACTION_CHANNELS } from '../src/launch.ts';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('LA-PAT-SHELL-ACTIONS-R01-T03 Each shell action has its own channel', () => {
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
