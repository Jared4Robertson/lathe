import { BrowserRepository, readPref, storedText, writePref } from '../../shell/prefs';
import { keyBindingsFrom, storedKeyBindings, type KeyBindings } from './model';

const KEY_BINDINGS_KEY = 'lathe:keybindings';
const isAny = (_v: unknown): _v is unknown => true;

/** Loads and saves the Key bindings whole, as JSON in local storage under `lathe:keybindings`: each changed shortcut's keys, or null for one left without a key. */
export class KeyBindingsRepository extends BrowserRepository<KeyBindings> {
  protected stored() { return storedText(KEY_BINDINGS_KEY) ?? ''; }
  protected read() { return keyBindingsFrom(readPref<unknown>(KEY_BINDINGS_KEY, undefined, isAny)); }
  protected write(bindings: KeyBindings) { writePref(KEY_BINDINGS_KEY, storedKeyBindings(bindings)); }
}

export const keyBindingsRepository = new KeyBindingsRepository();
