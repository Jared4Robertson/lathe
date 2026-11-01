// The app commands the native menus offer. A menu choice is sent to the page as the command's ID
// (app/src/shell/keymap.ts), and the app's command system runs it. The key a command shows is the keymap's `menu` binding,
// which the page sends (setMenuKeys); this file lists no keys. The preload presses that key for the page when the app has
// not subscribed to window.latheDesktop.onCommand yet.

export interface MenuCommand {
  id: string;
  label: string;
  /**
   * The menu item's own accelerator, only for keys a web page never receives, which a browser keeps for its tabs and
   * history (Cmd/Ctrl+T and W, Ctrl+Tab, Cmd/Ctrl+[ and ]): the menu owns them and runs the command by ID.
   */
  accelerator?: string;
}

export const VIEW_COMMANDS: readonly MenuCommand[] = [
  { id: 'commandPalette', label: 'Command Palette…' },
  { id: 'quickOpen', label: 'Quick Open…' },
  { id: 'stageGraph', label: 'Graph Stage' },
  { id: 'stageErd', label: 'ERD Stage' },
  { id: 'stageTrace', label: 'Trace Stage' },
  { id: 'toggleWikiCard', label: 'Show or Collapse Wiki Card' },
  { id: 'toggleNav', label: 'Show or Hide Navigation' },
  { id: 'toggleChat', label: 'Show or Hide Chat' },
];

/**
 * The app's tabs (app/src/views/useTabs.ts), in View › Tabs, as a browser's: the menu owns Cmd/Ctrl+T, Cmd/Ctrl+W,
 * Ctrl+Tab, Ctrl+Shift+Tab, and Cmd/Ctrl+[ and ] for Back and Forward in the active tab.
 */
export const TAB_COMMANDS: readonly MenuCommand[] = [
  { id: 'newTab', label: 'New Tab', accelerator: 'CmdOrCtrl+T' },
  { id: 'closeTab', label: 'Close Tab', accelerator: 'CmdOrCtrl+W' },
  { id: 'duplicateTab', label: 'Duplicate Tab' },
  { id: 'nextTab', label: 'Show Next Tab', accelerator: 'Ctrl+Tab' },
  { id: 'previousTab', label: 'Show Previous Tab', accelerator: 'Ctrl+Shift+Tab' },
  { id: 'goBack', label: 'Back', accelerator: 'CmdOrCtrl+[' },
  { id: 'goForward', label: 'Forward', accelerator: 'CmdOrCtrl+]' },
];

export const HELP_COMMANDS: readonly MenuCommand[] = [
  { id: 'goFormat', label: 'Record Format' },
  { id: 'showShortcuts', label: 'Keyboard Shortcuts' },
];

export const MENU_COMMANDS: readonly MenuCommand[] = [...VIEW_COMMANDS, ...TAB_COMMANDS, ...HELP_COMMANDS];

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
