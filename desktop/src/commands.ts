// The app commands the native menus offer. A menu choice is sent to the page as the command's ID
// (app/src/shell/keymap.ts), and the app's command system runs it. `keys` is one of the command's
// default bindings in the keymap (test/commands.test.ts checks it), which the preload presses for
// the page when the app has not subscribed to window.latheDesktop.onCommand yet.

export interface MenuCommand {
  id: string;
  label: string;
  keys: string;
}

export const VIEW_COMMANDS: readonly MenuCommand[] = [
  { id: 'commandPalette', label: 'Command Palette…', keys: 'Mod+Shift+P' },
  { id: 'quickOpen', label: 'Quick Open…', keys: 'Mod+P' },
  { id: 'viewWiki', label: 'Wiki View', keys: 'Ctrl+1' },
  { id: 'viewGraph', label: 'Graph View', keys: 'Ctrl+2' },
  { id: 'viewSplit', label: 'Split View', keys: 'Ctrl+3' },
  { id: 'toggleNav', label: 'Show or Hide Navigation', keys: 'Mod+B' },
  { id: 'toggleInspector', label: 'Show or Hide Inspector', keys: 'Mod+Alt+B' },
];

export const HELP_COMMANDS: readonly MenuCommand[] = [
  { id: 'goFormat', label: 'Record Format', keys: 'g f' },
  { id: 'showShortcuts', label: 'Keyboard Shortcuts', keys: 'Mod+/' },
];

export const MENU_COMMANDS: readonly MenuCommand[] = [...VIEW_COMMANDS, ...HELP_COMMANDS];

/** One key press of a binding, as the page's keydown listener reads it. */
export interface KeyPress {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const CODES: Record<string, string> = { '/': 'Slash', '\\': 'Backslash', '-': 'Minus', '=': 'Equal', '.': 'Period', ',': 'Comma' };

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
