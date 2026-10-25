// The native menus: the app menu on a Mac (About Lathe, Settings…), File (Open, Open Recent, Open
// Records In, Close Window), Edit, View (with the record tabs), Window and Help. App commands carry no
// accelerator, so every key still reaches the app's own keymap unchanged, except Settings (Cmd+,, which
// the keymap does not use) and the keys a web page never receives (Ctrl+Tab and Ctrl+Shift+Tab).
import type { MenuItemConstructorOptions } from 'electron';
import { HELP_COMMANDS, TAB_COMMANDS, VIEW_COMMANDS, type MenuCommand } from './commands.ts';
import { EDITOR_NAMES, EDITORS, type Editor, type Settings } from './editor.ts';
import { displayPath } from './folders.ts';

export interface MenuActions {
  recent: readonly string[];
  openFolder: () => void;
  openRecent: (folder: string) => void;
  clearRecent: () => void;
  runCommand: (id: string) => void;
  /** The small About window. */
  about?: () => void;
  /** Opens the focused window's Settings page. */
  settings?: () => void;
  /** The editor "Open in editor" uses, and how to change it. */
  settingsNow?: Settings;
  chooseEditor?: (editor: Editor) => void;
  /** Opens settings.json, where a custom editor command is written. */
  editSettingsFile?: () => void;
}

/** File › Open Records In: the editors to pick from; the custom command only once settings.json names one. */
function editorMenu(actions: MenuActions): MenuItemConstructorOptions[] {
  const settings = actions.settingsNow;
  if (!settings || !actions.chooseEditor) return [];
  const choose = actions.chooseEditor;
  const items: MenuItemConstructorOptions[] = EDITORS.filter((e) => e !== 'custom' || settings.editorCommand).map((editor) => ({
    label: editor === 'custom' ? `${EDITOR_NAMES.custom} (${settings.editorCommand})` : EDITOR_NAMES[editor],
    type: 'radio',
    checked: settings.editor === editor,
    click: () => choose(editor),
  }));
  return [{ label: 'Open Records In', submenu: [...items, { type: 'separator' }, { label: 'Edit Settings File…', click: actions.editSettingsFile }] }];
}

export function menuTemplate(actions: MenuActions, mac = process.platform === 'darwin'): MenuItemConstructorOptions[] {
  const command = (c: MenuCommand): MenuItemConstructorOptions => ({ label: c.label, ...(c.accelerator ? { accelerator: c.accelerator } : {}), click: () => actions.runCommand(c.id) });
  const recent: MenuItemConstructorOptions[] = actions.recent.length
    ? [...actions.recent.map((folder) => ({ label: displayPath(folder), click: () => actions.openRecent(folder) })), { type: 'separator' }, { label: 'Clear Menu', click: actions.clearRecent }]
    : [{ label: 'No Recent Folders', enabled: false }];
  const settings: MenuItemConstructorOptions = { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: actions.settings };
  const appMenu: MenuItemConstructorOptions = {
    role: 'appMenu',
    submenu: [
      actions.about ? { label: 'About Lathe', click: actions.about } : { role: 'about' },
      // Check for Updates… comes when signed builds are published.
      { type: 'separator' },
      settings,
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  };
  return [
    ...(mac ? [appMenu] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Product Folder…', accelerator: 'CmdOrCtrl+O', click: actions.openFolder },
        { label: 'Open Recent', submenu: recent },
        ...editorMenu(actions),
        { type: 'separator' },
        { role: 'close', label: 'Close Window' },
        ...(mac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, settings, { type: 'separator' } as MenuItemConstructorOptions, { role: 'quit' } as MenuItemConstructorOptions]),
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        ...VIEW_COMMANDS.slice(0, 2).map(command),
        { type: 'separator' },
        ...VIEW_COMMANDS.slice(2).map(command),
        { type: 'separator' },
        { label: 'Tabs', submenu: TAB_COMMANDS.map(command) },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    { role: 'help', submenu: [...HELP_COMMANDS.map(command), ...(!mac && actions.about ? [{ type: 'separator' } as MenuItemConstructorOptions, { label: 'About Lathe', click: actions.about }] : [])] },
  ];
}
