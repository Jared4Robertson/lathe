// Bind a key (LA-PLT-CMD55): the person records a key for a shortcut in the shortcuts sheet, in place of one of its keys or beside them.
import { normalizeBinding, overlap } from '../../../shell/keymap';
import { boundCommands, commandOf, keysNow, withKeys, type KeyBindings } from '../model';
import { keyBindingsRepository } from '../repository';
import { holdToRules } from '../rules';

export interface BindKey {
  shortcut: string;
  key: string;
  /** The key it takes the place of; none to add it beside the shortcut's keys. */
  replacing?: string;
  /** Take the key from the shortcut that has it, which gets `replacing` in its place (or just loses it). */
  swap?: boolean;
  mac: boolean;
}

/** The bindings with the key handed over: every other shortcut that has it where this one applies gets `replacing` in its place, or loses it. */
function handOver(bindings: KeyBindings, shortcut: string, key: string, replacing: string | undefined, mac: boolean): KeyBindings {
  const own = commandOf(shortcut);
  let next = bindings;
  for (const other of boundCommands(bindings, mac)) {
    if (other.id === shortcut || !own || !overlap(own.when, other.when)) continue;
    const keys = keysNow(next, other.id, mac);
    if (!keys.includes(key)) continue;
    const given = replacing && !keys.includes(replacing) ? keys.map((k) => (k === key ? replacing : k)) : keys.filter((k) => k !== key);
    next = withKeys(next, other.id, given, mac);
  }
  return next;
}

/** Gives the shortcut the key; a key another shortcut has where both apply is refused, unless swapped. */
export function bindKey({ shortcut, key, replacing, swap = false, mac }: BindKey): void {
  const was = keyBindingsRepository.load();
  const k = normalizeBinding(key, mac);
  const r = replacing === undefined ? undefined : normalizeBinding(replacing, mac);
  const now = keysNow(was, shortcut, mac);
  if (now.includes(k) && (r === undefined || r === k)) return;
  const keys = r !== undefined && now.includes(r) ? now.map((x) => (x === r ? k : x)) : [...now, k];
  const bound = withKeys(was, shortcut, keys, mac);
  const next = swap ? handOver(bound, shortcut, k, r, mac) : bound;
  holdToRules(next, mac);
  keyBindingsRepository.save(next);
}
