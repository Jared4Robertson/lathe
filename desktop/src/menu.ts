// The native menus: the app menu on a Mac (About Lathe, Settings…), File (Open, Open Recent, Open
// Records In, Close Window), Edit, View (with the app's tabs), Window and Help. An app command shows the key the person
// bound to it (the page sends its keymap, LA-V66-R03) without taking it: the label only, so every key still reaches the
// app's own keymap unchanged. Off a Mac the accelerator is not registered; on a Mac the page gets each key first and the
// menu only sees what the page left. Settings (Cmd+,, which the keymap does not use) and the keys a browser keeps for its
// tabs and history (commands.ts's TAB_COMMANDS) are the menu's own.
import type { MenuItemConstructorOptions } from 'electron';
import { HELP_COMMANDS, TAB_COMMANDS, VIEW_COMMANDS, type MenuCommand } from './commands.ts';
import { EDITOR_NAMES, EDITORS, type Editor, type Settings } from './shell-settings/model.ts';
import type { RecentFolderItem } from './recent-folders/read-model.ts';

/** Each command's keys as the page's keymap has them, by command ID, in the keymap's normal form ("Shift+Meta+P"). */
export type MenuKeys = Readonly<Record<string, readonly string[]>>;

/** The page's keys as sent: a map of command ID to a list of key texts; anything else in it is dropped. */
export function menuKeysFrom(input: unknown): MenuKeys {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).flatMap(([id, keys]) =>
    /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(id) && Array.isArray(keys) ? [[id, keys.filter((k): k is string => typeof k === 'string' && k.length > 0 && k.length < 40)]] : []));
}

const ACCELERATOR_KEYS: Record<string, string> = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', '+': 'Plus' };

/**
 * A key as an Electron accelerator ("Shift+Meta+P" is "Cmd+Shift+P" on a Mac), or none: only a single chord with Ctrl,
 * Cmd or Alt, or a function key, is one; a plain key or a sequence ("g f") cannot be shown so.
 */
export function acceleratorOf(binding: string, mac: boolean): string | undefined {
  if (!binding || /\s/.test(binding)) return undefined;
  const parts = binding.split('+');
  let key = parts.pop()!;
  if (key === '' && parts.at(-1) === '') { parts.pop(); key = '+'; }
  const commandKey = parts.some((p) => p === 'Ctrl' || p === 'Alt' || p === 'Meta');
  if (!commandKey && !/^F\d{1,2}$/.test(key)) return undefined;
  const mods = parts.map((p) => (p === 'Meta' ? (mac ? 'Cmd' : 'Super') : p));
  return [...mods, ACCELERATOR_KEYS[key] ?? key].join('+');
}

export interface MenuActions {
  /** File › Open Recent: the Recent folders' query's answer (recent-folders/queries.ts). */
  recent: readonly RecentFolderItem[];
  openFolder: () => void;
  openRecent: (folder: string) => void;
  clearRecent: () => void;
  runCommand: (id: string) => void;
  /** The keys the focused window's page sent, shown beside its commands; the defaults' labels are none until it does. */
  keys?: MenuKeys;
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
  const shown = (c: MenuCommand) => (actions.keys?.[c.id] ?? []).map((k) => acceleratorOf(k, mac)).find((a) => a !== undefined);
  const command = (c: MenuCommand): MenuItemConstructorOptions => {
    const label = c.accelerator ? undefined : shown(c);
    return {
      label: c.label,
      ...(c.accelerator ? { accelerator: c.accelerator } : label ? { accelerator: label, registerAccelerator: false } : {}),
      click: () => actions.runCommand(c.id),
    };
  };
  const recent: MenuItemConstructorOptions[] = actions.recent.length
    ? [...actions.recent.map((item) => ({ label: item.label, click: () => actions.openRecent(item.folder) })), { type: 'separator' }, { label: 'Clear Menu', click: actions.clearRecent }]
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
        // Cmd/Ctrl+W closes the tab (View › Tabs), as in a browser; the window takes Shift too.
        { role: 'close', label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W' },
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
