// How "Open in editor" (LA-AUT-UC15-R02) launches the editor the Shell settings name (shell-settings/model.ts):
// a known editor by its app or command, the system's default app for the file, or a command of the person's own.
import { EDITOR_NAMES, type Settings } from './shell-settings/model.ts';

/** The macOS app of each known editor, by bundle ID, and its command elsewhere. */
const KNOWN: Record<'vscode' | 'cursor' | 'zed', { bundle: string; command: string }> = {
  vscode: { bundle: 'com.microsoft.VSCode', command: 'code' },
  cursor: { bundle: 'com.todesktop.230313mzl4w4u92', command: 'cursor' },
  zed: { bundle: 'dev.zed.Zed', command: 'zed' },
};

/** The editor's name, for "Open in …". */
export function editorName(settings: Settings): string {
  return settings.editor === 'custom' && settings.editorCommand ? settings.editorCommand.split(/\s+/)[0] : EDITOR_NAMES[settings.editor];
}

export type Launch =
  /** Run a program with arguments, no shell. */
  | { kind: 'exec'; file: string; args: string[] }
  /** Open the file with the system's default app (shell.openPath). */
  | { kind: 'open-path'; path: string };

/**
 * How to open a data file in the chosen editor. On macOS a known editor opens by its bundle ID, so it
 * needs no command on the PATH (an app started from the Dock has a short one); a custom command runs
 * in a login shell, with the file passed as an argument, never spliced into the command's text.
 */
export function editorLaunch(settings: Settings, file: string, platform: NodeJS.Platform): Launch {
  const { editor } = settings;
  if (editor === 'system') return { kind: 'open-path', path: file };
  if (editor === 'custom' && settings.editorCommand) {
    if (platform === 'win32') return { kind: 'exec', file: 'cmd.exe', args: ['/d', '/s', '/c', `${settings.editorCommand} "%LATHE_FILE%"`] };
    return { kind: 'exec', file: '/bin/sh', args: ['-lc', `${settings.editorCommand} "$1"`, 'lathe', file] };
  }
  const known = KNOWN[editor === 'custom' ? 'vscode' : editor];
  if (platform === 'darwin') return { kind: 'exec', file: '/usr/bin/open', args: ['-b', known.bundle, file] };
  return { kind: 'exec', file: known.command, args: [file] };
}
