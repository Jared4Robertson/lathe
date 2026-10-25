import { describe, expect, it } from 'vitest';
import { editorLaunch, editorName, parseSettings } from '../src/editor.ts';

describe('LA-AUT-T119 Open in editor uses VS Code by default, another known editor, the default app or a command of one\'s own', () => {
  it('reads settings, with VS Code when nothing valid is saved', () => {
    expect(parseSettings(undefined)).toEqual({ editor: 'vscode' });
    expect(parseSettings({ editor: 'emacs' })).toEqual({ editor: 'vscode' });
    expect(parseSettings({ editor: 'zed' })).toEqual({ editor: 'zed' });
    // A custom editor needs its command; without one it falls back to the default.
    expect(parseSettings({ editor: 'custom' })).toEqual({ editor: 'vscode' });
    expect(parseSettings({ editor: 'custom', editorCommand: '  subl -w ' })).toEqual({ editor: 'custom', editorCommand: 'subl -w' });
    expect(parseSettings({ editor: 'cursor', editorCommand: 5 })).toEqual({ editor: 'cursor' });
  });

  it('opens a known editor by its app on a Mac, and by its command elsewhere', () => {
    expect(editorLaunch({ editor: 'vscode' }, '/p/specs/a.md', 'darwin')).toEqual({ kind: 'exec', file: '/usr/bin/open', args: ['-b', 'com.microsoft.VSCode', '/p/specs/a.md'] });
    expect(editorLaunch({ editor: 'zed' }, '/p/a.md', 'linux')).toEqual({ kind: 'exec', file: 'zed', args: ['/p/a.md'] });
    expect(editorLaunch({ editor: 'system' }, '/p/a.md', 'darwin')).toEqual({ kind: 'open-path', path: '/p/a.md' });
  });

  it('passes the file to a custom command as an argument, never in the command\'s text', () => {
    const file = '/p/specs/odd "name"; rm -rf ~.md';
    const launch = editorLaunch({ editor: 'custom', editorCommand: 'subl -w' }, file, 'darwin');
    expect(launch).toEqual({ kind: 'exec', file: '/bin/sh', args: ['-lc', 'subl -w "$1"', 'lathe', file] });
    if (launch.kind === 'exec') expect(launch.args[1]).not.toContain(file);
  });

  it('names the editor for the menu', () => {
    expect(editorName({ editor: 'vscode' })).toBe('VS Code');
    expect(editorName({ editor: 'system' })).toBe('Default App');
    expect(editorName({ editor: 'custom', editorCommand: 'subl -w' })).toBe('subl');
  });
});
