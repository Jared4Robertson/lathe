// The native menus: File (Open, Open Recent, Close Window), Edit, View, Window and Help. App
// commands carry no accelerator, so every key still reaches the app's own keymap unchanged.
import type { MenuItemConstructorOptions } from 'electron';
import { HELP_COMMANDS, VIEW_COMMANDS } from './commands.ts';
import { displayPath } from './folders.ts';

export interface MenuActions {
  recent: readonly string[];
  openFolder: () => void;
  openRecent: (folder: string) => void;
  clearRecent: () => void;
  runCommand: (id: string) => void;
}

export function menuTemplate(actions: MenuActions, mac = process.platform === 'darwin'): MenuItemConstructorOptions[] {
  const command = (c: { id: string; label: string }): MenuItemConstructorOptions => ({ label: c.label, click: () => actions.runCommand(c.id) });
  const recent: MenuItemConstructorOptions[] = actions.recent.length
    ? [...actions.recent.map((folder) => ({ label: displayPath(folder), click: () => actions.openRecent(folder) })), { type: 'separator' }, { label: 'Clear Menu', click: actions.clearRecent }]
    : [{ label: 'No Recent Folders', enabled: false }];
  return [
    ...(mac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Product Folder…', accelerator: 'CmdOrCtrl+O', click: actions.openFolder },
        { label: 'Open Recent', submenu: recent },
        { type: 'separator' },
        { role: 'close', label: 'Close Window' },
        ...(mac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'quit' } as MenuItemConstructorOptions]),
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
    { role: 'help', submenu: HELP_COMMANDS.map(command) },
  ];
}
