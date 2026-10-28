// The app commands the native menus offer. A menu choice is sent to the page as the command's ID
// (app/src/shell/keymap.ts), and the app's command system runs it. `keys` is one of the command's
// default bindings in the keymap on every platform (test/commands.test.ts checks it), which the preload presses for
// the page when the app has not subscribed to window.latheDesktop.onCommand yet.

export interface MenuCommand {
  id: string;
  label: string;
  keys: string;
  /** The binding off a Mac, when the keymap gives another there (its otherKeys). */
  otherKeys?: string;
  /**
   * The menu item's own accelerator, only for keys a web page never receives (Ctrl+Tab and
   * Ctrl+Shift+Tab, which the browser keeps): the menu owns them and runs the command by ID.
   */
  accelerator?: string;
}

export const VIEW_COMMANDS: readonly MenuCommand[] = [
  { id: 'commandPalette', label: 'Command Palette…', keys: 'Mod+Shift+P' },
  { id: 'quickOpen', label: 'Quick Open…', keys: 'Mod+P' },
  { id: 'stageGraph', label: 'Graph Stage', keys: 'Ctrl+1' },
  { id: 'stageErd', label: 'ERD Stage', keys: 'Ctrl+2' },
  { id: 'stageTrace', label: 'Trace Stage', keys: 'Ctrl+3' },
  { id: 'toggleWikiCard', label: 'Show or Collapse Wiki Card', keys: 'w' },
  { id: 'toggleNav', label: 'Show or Hide Navigation', keys: 'Mod+B' },
  { id: 'toggleSideBar', label: 'Show or Hide Side Bar', keys: 'Mod+Alt+B' },
];

/** The record tabs (app/src/views/useTabs.ts), in View › Tabs. */
export const TAB_COMMANDS: readonly MenuCommand[] = [
  { id: 'nextTab', label: 'Show Next Tab', keys: 'Ctrl+Tab', accelerator: 'Ctrl+Tab' },
  { id: 'previousTab', label: 'Show Previous Tab', keys: 'Ctrl+Shift+Tab', accelerator: 'Ctrl+Shift+Tab' },
  { id: 'keepTab', label: 'Keep Tab Open', keys: 'Ctrl+K Enter', otherKeys: 'Alt+K Enter' },
  { id: 'closeTab', label: 'Close Tab', keys: 'Alt+Shift+W' },
];

export const HELP_COMMANDS: readonly MenuCommand[] = [
  { id: 'goFormat', label: 'Record Format', keys: 'g f' },
  { id: 'showShortcuts', label: 'Keyboard Shortcuts', keys: 'Mod+/' },
];

export const MENU_COMMANDS: readonly MenuCommand[] = [...VIEW_COMMANDS, ...TAB_COMMANDS, ...HELP_COMMANDS];

/** The binding a command's keys stand for on a platform. */
export function commandKeys(command: MenuCommand, mac: boolean): string {
  return mac ? command.keys : (command.otherKeys ?? command.keys);
}

/** One key press of a binding, as the page's keydown listener reads it. */
export interface KeyPress {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const CODES: Record<string, string> = { Tab: 'Tab', Enter: 'Enter', '/': 'Slash', '\\': 'Backslash', '-': 'Minus', '=': 'Equal', '.': 'Period', ',': 'Comma' };

/** The key presses of a binding such as "Mod+Shift+P" or "g f" ("Mod" is Cmd on a Mac, Ctrl elsewhere). */
export function keyPresses(binding: string, mac: boolean): KeyPress[] {
  return binding.trim().split(/\s+/).map((chord) => {
    const parts = chord.split('+');
    const key = parts.pop()!;
    const mods = new Set(parts.map((p) => (p === 'Mod' ? (mac ? 'Meta' : 'Ctrl') : p)));
    const code = /^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/.test(key) ? `Digit${key}` : CODES[key] ?? key;
    return {
      key: mods.has('Shift') && key.length === 1 ? key.toUpperCase() : key.length === 1 ? key.toLowerCase() : key,
      code,
      ctrlKey: mods.has('Ctrl'),
      altKey: mods.has('Alt'),
      shiftKey: mods.has('Shift'),
      metaKey: mods.has('Meta'),
    };
  });
}
