import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { COMMANDS, eventChord, normalizeBinding, platformKeys } from '../../app/src/shell/keymap.ts';
import { commandKeys, keyPresses, MENU_COMMANDS, TAB_COMMANDS } from '../src/commands.ts';
import { menuTemplate } from '../src/menu.ts';

type Item = MenuItemConstructorOptions;
const submenu = (item: Item | undefined) => (item?.submenu ?? []) as Item[];
/** Every item of a menu, its submenus' items included. */
const flat = (items: Item[]): Item[] => items.flatMap((m) => [m, ...flat(submenu(m))]);

function template(mac: boolean, recent: string[] = []) {
  const actions = { recent, openFolder: vi.fn(), openRecent: vi.fn(), clearRecent: vi.fn(), runCommand: vi.fn() };
  return { actions, menu: menuTemplate(actions, mac) };
}

describe('The native menus offer the app commands, by command ID, without taking any key', () => {
  it('LA-V66-R01-T01 has File, Edit, View, Window and Help, plus the app menu on a Mac', () => {
    const names = template(true).menu.map((m) => m.label ?? m.role);
    expect(names).toEqual(['appMenu', 'File', 'editMenu', 'View', 'windowMenu', 'help']);
    expect(template(false).menu.map((m) => m.label ?? m.role)).toEqual(['File', 'editMenu', 'View', 'windowMenu', 'help']);
  });

  it('LA-V66-R04-T01 opens a product folder with Cmd+O, lists recent folders and closes the window', () => {
    const { menu, actions } = template(true, ['/a', '/b']);
    const file = submenu(menu.find((m) => m.label === 'File'));
    expect(file[0]).toMatchObject({ label: 'Open Product Folder…', accelerator: 'CmdOrCtrl+O' });
    const recent = submenu(file.find((m) => m.label === 'Open Recent'));
    expect(recent.map((m) => m.label ?? m.type)).toEqual(['/a', '/b', 'separator', 'Clear Menu']);
    (recent[1].click as () => void)();
    expect(actions.openRecent).toHaveBeenCalledWith('/b');
    expect(file.some((m) => m.role === 'close')).toBe(true);
    expect(submenu(template(true).menu.find((m) => m.label === 'File')).find((m) => m.label === 'Open Recent')?.submenu).toEqual([{ label: 'No Recent Folders', enabled: false }]);
  });

  it('LA-V66-R01-T01 has reload, developer tools, zoom and full screen in View, and the record format and shortcuts in Help', () => {
    const { menu, actions } = template(true);
    const view = submenu(menu.find((m) => m.label === 'View'));
    for (const role of ['reload', 'toggleDevTools', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']) expect(view.some((m) => m.role === role)).toBe(true);
    const help = submenu(menu.find((m) => m.role === 'help'));
    expect(help.map((m) => m.label)).toEqual(['Record Format', 'Keyboard Shortcuts']);
    (help[1].click as () => void)();
    expect(actions.runCommand).toHaveBeenCalledWith('showShortcuts');
  });

  it('LA-V66-R03-T01 sends each app command by its ID, with no accelerator of its own but for keys a page never gets', () => {
    const { menu, actions } = template(true);
    const items = flat(menu).filter((m) => MENU_COMMANDS.some((c) => c.label === m.label));
    expect(items).toHaveLength(MENU_COMMANDS.length);
    for (const item of items) {
      const command = MENU_COMMANDS.find((c) => c.label === item.label)!;
      expect(item.accelerator, command.id).toBe(command.accelerator);
      (item.click as () => void)();
    }
    expect(actions.runCommand.mock.calls.map(([id]) => id)).toEqual(MENU_COMMANDS.map((c) => c.id));
  });

  it("LA-V66-R03-T01 names only commands in the app's keymap, each with one of its default bindings on a Mac and elsewhere", () => {
    for (const command of MENU_COMMANDS) {
      const entry = COMMANDS.find((c) => c.id === command.id);
      expect(entry, command.id).toBeDefined();
      for (const mac of [true, false]) {
        expect(platformKeys(entry!, mac).map((k) => normalizeBinding(k, mac)), `${command.id} on ${mac ? 'Mac' : 'other'}`).toContain(normalizeBinding(commandKeys(command, mac), mac));
      }
    }
  });

  it("LA-V66-R03-T01 presses keys that the app's keymap reads as the binding, on a Mac and elsewhere", () => {
    for (const mac of [true, false]) {
      for (const command of MENU_COMMANDS) {
        const keys = commandKeys(command, mac);
        const chords = keyPresses(keys, mac).map((press) => eventChord(press));
        expect(chords.join(' '), `${command.id} on ${mac ? 'Mac' : 'other'}`).toBe(normalizeBinding(keys, mac));
      }
    }
  });
});

describe('The app menu has About and Settings, File chooses the editor, and View has the record tabs', () => {
  function full(mac: boolean) {
    const actions = {
      recent: [],
      openFolder: vi.fn(),
      openRecent: vi.fn(),
      clearRecent: vi.fn(),
      runCommand: vi.fn(),
      about: vi.fn(),
      settings: vi.fn(),
      settingsNow: { editor: 'vscode' as const },
      chooseEditor: vi.fn(),
      editSettingsFile: vi.fn(),
    };
    return { actions, menu: menuTemplate(actions, mac) };
  }

  it('LA-V70-R01-T02 opens About Lathe from the app menu, or from Help elsewhere, with no Check for Updates yet', () => {
    const { menu, actions } = full(true);
    const appMenu = submenu(menu[0]);
    expect(menu[0].role).toBe('appMenu');
    expect(appMenu[0].label).toBe('About Lathe');
    (appMenu[0].click as () => void)();
    expect(actions.about).toHaveBeenCalled();
    expect(flat(menu).some((m) => /update/i.test(m.label ?? ''))).toBe(false);
    expect(appMenu.some((m) => m.role === 'quit')).toBe(true);
    expect(submenu(full(false).menu.find((m) => m.role === 'help')).some((m) => m.label === 'About Lathe')).toBe(true);
  });

  it('LA-V66-R05-T01 opens Settings (Cmd+,) from the app menu, or from File elsewhere', () => {
    const { menu, actions } = full(true);
    const settings = submenu(menu[0]).find((m) => m.label === 'Settings…')!;
    expect(settings.accelerator).toBe('CmdOrCtrl+,');
    (settings.click as () => void)();
    expect(actions.settings).toHaveBeenCalled();
    expect(submenu(full(false).menu.find((m) => m.label === 'File')).some((m) => m.label === 'Settings…')).toBe(true);
  });

  it('LA-AUT-UC15-R02-T02 chooses the editor in File › Open Records In, with the current one checked', () => {
    const { menu, actions } = full(true);
    const editors = submenu(submenu(menu.find((m) => m.label === 'File')).find((m) => m.label === 'Open Records In'));
    expect(editors.map((m) => m.label ?? m.type)).toEqual(['VS Code', 'Cursor', 'Zed', 'Default App', 'separator', 'Edit Settings File…']);
    expect(editors.find((m) => m.checked)?.label).toBe('VS Code');
    (editors[2].click as () => void)();
    expect(actions.chooseEditor).toHaveBeenCalledWith('zed');
  });

  it('LA-V96-R17-T01 has View › Tabs: new, close, duplicate, next, previous, back and forward, with Cmd+T, Cmd+W, Ctrl+Tab, Cmd+[ and Cmd+] owned by the menu', () => {
    const { menu, actions } = full(true);
    const tabs = submenu(submenu(menu.find((m) => m.label === 'View')).find((m) => m.label === 'Tabs'));
    expect(tabs.map((m) => [m.label, m.accelerator])).toEqual([
      ['New Tab', 'CmdOrCtrl+T'],
      ['Close Tab', 'CmdOrCtrl+W'],
      ['Duplicate Tab', undefined],
      ['Show Next Tab', 'Ctrl+Tab'],
      ['Show Previous Tab', 'Ctrl+Shift+Tab'],
      ['Back', 'CmdOrCtrl+['],
      ['Forward', 'CmdOrCtrl+]'],
    ]);
    for (const item of tabs) (item.click as () => void)();
    const ids = ['newTab', 'closeTab', 'duplicateTab', 'nextTab', 'previousTab', 'goBack', 'goForward'];
    expect(actions.runCommand.mock.calls.map(([id]) => id)).toEqual(ids);
    expect(TAB_COMMANDS.map((c) => c.id)).toEqual(ids);
    // Cmd/Ctrl+W is the tab's, so the window closes with Shift too.
    expect(submenu(menu.find((m) => m.label === 'File')).find((m) => m.role === 'close')?.accelerator).toBe('CmdOrCtrl+Shift+W');
  });
});
