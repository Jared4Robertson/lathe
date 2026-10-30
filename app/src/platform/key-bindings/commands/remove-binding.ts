// Remove a binding (LA-PLT-CMD56): the person takes a key off a shortcut in the shortcuts sheet; its last key only on purpose.
import { normalizeBinding } from '../../../shell/keymap';
import { keysNow, withKeys } from '../model';
import { keyBindingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface RemoveBinding {
  shortcut: string;
  key: string;
  /** Leave the shortcut without a key when this is its last one; otherwise that is refused. */
  unbind?: boolean;
  mac: boolean;
}

/** Takes the key off the shortcut; a key it does not have changes nothing. */
export function removeBinding({ shortcut, key, unbind = false, mac }: RemoveBinding): void {
  const was = keyBindingsRepository.load();
  const k = normalizeBinding(key, mac);
  const now = keysNow(was, shortcut, mac);
  if (!now.includes(k)) return;
  const keys = now.filter((x) => x !== k);
  const next = withKeys(was, shortcut, keys, mac, unbind);
  holdToRules(next, mac);
  keyBindingsRepository.save(next);
}
