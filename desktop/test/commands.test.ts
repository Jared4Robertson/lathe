import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { COMMANDS, eventChord, normalizeBinding, platformKeys } from '../../app/src/shell/keymap.ts';
import { keyPresses, MENU_COMMANDS } from '../src/commands.ts';
import { menuTemplate } from '../src/menu.ts';

type Item = MenuItemConstructorOptions;
const submenu = (item: Item | undefined) => (item?.submenu ?? []) as Item[];

function template(mac: boolean, recent: string[] = []) {
  const actions = { recent, openFolder: vi.fn(), openRecent: vi.fn(), clearRecent: vi.fn(), runCommand: vi.fn() };
  return { actions, menu: menuTemplate(actions, mac) };
}

describe('LA-DSK-T05 The native menus offer the app commands, by command ID, without taking any key', () => {
  it('has File, Edit, View, Window and Help, plus the app menu on a Mac', () => {
    const names = template(true).menu.map((m) => m.label ?? m.role);
    expect(names).toEqual(['appMenu', 'File', 'editMenu', 'View', 'windowMenu', 'help']);
    expect(template(false).menu.map((m) => m.label ?? m.role)).toEqual(['File', 'editMenu', 'View', 'windowMenu', 'help']);
  });

  it('opens a product folder with Cmd+O, lists recent folders and closes the window', () => {
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

  it('has reload, developer tools, zoom and full screen in View, and the record format and shortcuts in Help', () => {
    const { menu, actions } = template(true);
    const view = submenu(menu.find((m) => m.label === 'View'));
    for (const role of ['reload', 'toggleDevTools', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']) expect(view.some((m) => m.role === role)).toBe(true);
    const help = submenu(menu.find((m) => m.role === 'help'));
    expect(help.map((m) => m.label)).toEqual(['Record Format', 'Keyboard Shortcuts']);
    (help[1].click as () => void)();
    expect(actions.runCommand).toHaveBeenCalledWith('showShortcuts');
  });

  it('sends each app command by its ID, with no accelerator of its own', () => {
    const { menu, actions } = template(true);
    const items = menu.flatMap((m) => submenu(m)).filter((m) => MENU_COMMANDS.some((c) => c.label === m.label));
    expect(items).toHaveLength(MENU_COMMANDS.length);
    for (const item of items) {
      expect(item.accelerator).toBeUndefined();
      (item.click as () => void)();
    }
    expect(actions.runCommand.mock.calls.map(([id]) => id)).toEqual(MENU_COMMANDS.map((c) => c.id));
  });

  it("names only commands in the app's keymap, each with one of its default bindings on a Mac and elsewhere", () => {
    for (const command of MENU_COMMANDS) {
      const entry = COMMANDS.find((c) => c.id === command.id);
      expect(entry, command.id).toBeDefined();
      for (const mac of [true, false]) {
        expect(platformKeys(entry!, mac).map((k) => normalizeBinding(k, mac)), `${command.id} on ${mac ? 'Mac' : 'other'}`).toContain(normalizeBinding(command.keys, mac));
      }
    }
  });

  it("presses keys that the app's keymap reads as the binding, on a Mac and elsewhere", () => {
    for (const mac of [true, false]) {
      for (const command of MENU_COMMANDS) {
        const chords = keyPresses(command.keys, mac).map((press) => eventChord(press));
        expect(chords.join(' '), `${command.id} on ${mac ? 'Mac' : 'other'}`).toBe(normalizeBinding(command.keys, mac));
      }
    }
  });
});
