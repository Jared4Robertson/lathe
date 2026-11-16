// Shell settings (LA-WBN-A11): the shell's own settings, kept in settings.json in the user data folder: which
// editor "Open in editor" uses (LA-PAT-RECORD-DATA-FILE-R02), VS Code by default, another known editor, the system's default
// app for the file, or a command of the person's own ("editorCommand", written there by hand, which gets the file
// as its last argument). File › Open Records In sets the editor; Edit Settings File… opens the file.

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

/** The settings as settings.json keeps them: with an empty "editorCommand" to fill in by hand when none is set. */
export function storedSettings(settings: Settings): Record<string, string> {
  return { ...settings, editorCommand: settings.editorCommand ?? '' };
}
