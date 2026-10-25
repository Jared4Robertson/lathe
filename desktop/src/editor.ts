// Which editor "Open in editor" uses (LA-AUT-UC15-R02): VS Code by default, another known editor, the
// system's default app for Markdown, or a command of the person's own. The choice is kept in
// settings.json in the user data folder; File › Open Records In sets it, and a custom command is
// written there by hand ("editorCommand", which gets the file as its last argument).

export const EDITORS = ['vscode', 'cursor', 'zed', 'system', 'custom'] as const;
export type Editor = (typeof EDITORS)[number];

export interface Settings {
  editor: Editor;
  /** A shell command, such as "subl" or "idea --line 1"; the file is added as its last argument. */
  editorCommand?: string;
}

export const DEFAULT_SETTINGS: Settings = { editor: 'vscode' };

export const EDITOR_NAMES: Record<Editor, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  zed: 'Zed',
  system: 'Default App',
  custom: 'Custom Command',
};

/** The macOS app of each known editor, by bundle ID, and its command elsewhere. */
const KNOWN: Record<'vscode' | 'cursor' | 'zed', { bundle: string; command: string }> = {
  vscode: { bundle: 'com.microsoft.VSCode', command: 'code' },
  cursor: { bundle: 'com.todesktop.230313mzl4w4u92', command: 'cursor' },
  zed: { bundle: 'dev.zed.Zed', command: 'zed' },
};

/** Reads saved settings, keeping only what is valid, with VS Code as the editor otherwise. */
export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };
  const { editor, editorCommand } = raw as Record<string, unknown>;
  const command = typeof editorCommand === 'string' && editorCommand.trim() ? editorCommand.trim() : undefined;
  const chosen = typeof editor === 'string' && (EDITORS as readonly string[]).includes(editor) ? (editor as Editor) : DEFAULT_SETTINGS.editor;
  // A custom editor with no command falls back to the default.
  const usable = chosen === 'custom' && !command ? DEFAULT_SETTINGS.editor : chosen;
  return { editor: usable, ...(command ? { editorCommand: command } : {}) };
}

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
 * How to open a spec file in the chosen editor. On macOS a known editor opens by its bundle ID, so it
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
