import { storedText } from '../../shell/prefs';
import { COMMANDS, resolveCommands, type Command } from '../../shell/keymap';

// Keymap (LA-PLT-RM02): the keyboard commands with the keys that run them on this platform, which every key, the
// palette, the shortcuts sheet and every hint read. It is read-only configuration, not an aggregate: the defaults are
// code (shell/keymap.ts), and a person's own bindings are a JSON map they put in local storage themselves under
// `lathe:keybindings`; the app reads it as it starts and never writes it.

/** Where a person's own bindings are kept, by command ID. */
export const OVERRIDES_KEY = 'lathe:keybindings';

/** The read model's table, kept in memory. */
export interface KeymapTable { commands: Command[] }

/** A person's bindings from their stored text, `{ "commandId": "Mod+J" | ["Mod+J", "g j"] }`; unknown commands and bad values are ignored. */
export function overridesFrom(text: string | null): Record<string, string[]> {
  try {
    const raw: unknown = JSON.parse(text ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string[]> = {};
    for (const [id, value] of Object.entries(raw)) {
      const keys = typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((v) => typeof v === 'string') : null;
      if (keys && COMMANDS.some((c) => c.id === id && !c.local && !c.browser)) out[id] = keys;
    }
    return out;
  } catch {
    return {};
  }
}

/** Builds the Keymap table: the commands with the person's bindings applied, the only code that reads `lathe:keybindings`. */
export function keymapTableFrom(mac: boolean): KeymapTable {
  return { commands: resolveCommands(overridesFrom(storedText(OVERRIDES_KEY)), mac) };
}
