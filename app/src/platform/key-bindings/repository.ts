// Generated from data/ by `npm run generate`. Do not edit.
// KeyBindingsRepository (LA-PLT-REPO24): Keeps the changed shortcuts as JSON in local storage under
// `lathe:keybindings`, each its keys or null for one left without a key, loaded and saved whole; a shortcut that cannot
// be bound or a malformed value is dropped as it loads, and the app works on without storage.
import { BrowserRepository } from '../../shell/prefs';
import { putStored, readStored, storedText } from '../../shell/storage';
import { KEY_BINDINGS_STORAGE, keyBindingsFrom, keyBindingsStored, type KeyBindings } from './model';

export class KeyBindingsRepository extends BrowserRepository<KeyBindings> {
  protected stored() {
    return storedText(KEY_BINDINGS_STORAGE) ?? '';
  }

  protected read(): KeyBindings {
    const keyBindings = keyBindingsFrom(readStored(KEY_BINDINGS_STORAGE));
    this.#put(keyBindings, true);
    return keyBindings;
  }

  protected write(keyBindings: KeyBindings) {
    this.#put(keyBindings, false);
  }

  // Keeps each part whose stored text changed; held, only a part already stored, so one read in another form is
  // rewritten in today's.
  #put(keyBindings: KeyBindings, held: boolean) {
    putStored(KEY_BINDINGS_STORAGE, keyBindingsStored(keyBindings), held);
  }
}

export const keyBindingsRepository = new KeyBindingsRepository();
