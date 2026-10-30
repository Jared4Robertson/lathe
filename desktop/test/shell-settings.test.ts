// The Shell settings aggregate (LA-PLT-A11): its repository keeps them in settings.json, its commands go through it,
// and its rules refuse an editor Lathe does not know and a custom editor without its command.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { chooseEditor } from '../src/shell-settings/commands/choose-editor.ts';
import { openSettingsFile } from '../src/shell-settings/commands/open-settings-file.ts';
import type { Editor } from '../src/shell-settings/model.ts';
import { ShellSettingsRepository } from '../src/shell-settings/repository.ts';
import { shellSettingsProblems } from '../src/shell-settings/rules.ts';

const temp = mkdtempSync(path.join(os.tmpdir(), 'lathe-shell-settings-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));
const file = (name: string) => () => path.join(temp, name);
const json = (name: string): unknown => JSON.parse(readFileSync(path.join(temp, name), 'utf8'));

describe('LA-PLT-INV31-T A custom editor has its command', () => {
  it('chooses an editor, keeping the rest of the file, and refuses a custom editor with no command', () => {
    const settings = new ShellSettingsRepository(file('settings.json'));
    writeFileSync(path.join(temp, 'settings.json'), JSON.stringify({ editor: 'zed', claudePath: '/opt/claude' }));
    chooseEditor(settings, { editor: 'cursor' });
    expect(settings.load()).toEqual({ editor: 'cursor', claudePath: '/opt/claude' });
    expect(() => chooseEditor(settings, { editor: 'custom' })).toThrow('A custom editor needs its command in settings.json.');
    expect(shellSettingsProblems({ editor: 'custom', editorCommand: 'subl' })).toEqual([]);
  });

  it('writes the settings file when missing, with an empty editor command to fill in, and opens it', () => {
    const settings = new ShellSettingsRepository(file('new-settings.json'));
    const open = vi.fn();
    openSettingsFile(settings, open);
    expect(json('new-settings.json')).toEqual({ editor: 'vscode', editorCommand: '' });
    expect(open).toHaveBeenCalledWith(path.join(temp, 'new-settings.json'));
  });
});

describe('LA-PLT-INV32-T The editor is one Lathe knows', () => {
  it('refuses an editor Lathe does not know, with its reason, and saves nothing', () => {
    const settings = new ShellSettingsRepository(file('unknown-settings.json'));
    writeFileSync(path.join(temp, 'unknown-settings.json'), JSON.stringify({ editor: 'zed' }));
    expect(shellSettingsProblems({ editor: 'notepad' as Editor })).toEqual([{ rule: 'editor-is-known', message: 'The editor "notepad" is not one Lathe knows.' }]);
    expect(() => chooseEditor(settings, { editor: 'notepad' as Editor })).toThrow('The editor "notepad" is not one Lathe knows.');
    expect(json('unknown-settings.json')).toEqual({ editor: 'zed' });
  });
});
