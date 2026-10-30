import { COMMANDS, customizable, normalizeBinding, platformKeys, resolveCommands, type Command } from '../../shell/keymap';

// Keymap (LA-PLT-RM02): every keyboard command with the keys that run it on this platform as the person bound them,
// which every key, the palette, the shortcuts sheet, every hint and the desktop app's menu read. The defaults are code
// (shell/keymap.ts); the person's keys come from the Key bindings (LA-PLT-A14).

/** What the projection reads: the person's changed shortcuts as kept, and the platform. */
export interface KeymapSource { changed: readonly { shortcut: string; keys: readonly string[] }[]; mac: boolean }

/** A command as the keymap shows it: its keys now, its defaults, and whether the person changed them or may. */
export interface KeymapEntry extends Command {
  /** Its keys on this platform before the person's. */
  defaultKeys: string[];
  /** The person changed its keys: the sheet offers Reset. */
  changed: boolean;
  /** The person may bind its keys (not the browser's own, nor an ARIA control's). */
  customizable: boolean;
}

/** The read model's table, kept in memory. */
export interface KeymapTable { commands: KeymapEntry[] }

/** Builds the Keymap table: the defaults with the person's keys in their place, worked out again on each change. */
export function keymapTableFrom(source: KeymapSource): KeymapTable {
  const bound = new Map(source.changed.map((b) => [b.shortcut, b.keys]));
  const resolved = resolveCommands(Object.fromEntries(bound), source.mac);
  return {
    commands: resolved.map((c, i) => ({
      ...c,
      defaultKeys: platformKeys(COMMANDS[i], source.mac).map((k) => normalizeBinding(k, source.mac)),
      changed: bound.has(c.id),
      customizable: customizable(c),
    })),
  };
}
