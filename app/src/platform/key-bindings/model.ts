import { COMMANDS, customizable, normalizeBinding, platformKeys, resolveCommands, type Command } from '../../shell/keymap';

// Key bindings (LA-PLT-A14): the keys a person gave the shortcuts in place of the defaults, which stay in code
// (shell/keymap.ts COMMANDS). Only a changed shortcut is kept; one put back to its defaults is dropped again. Every
// shortcut the app handles itself can be bound, the stage walk's included; the browser's own (Alt+Left) and the keys an
// ARIA control owns (a tree's arrows) cannot.

/** One changed shortcut (LA-PLT-EN25). */
export interface ShortcutBinding {
  /** The shortcut: a keymap command's ID. */
  shortcut: string;
  /** Its keys in the keymap's normal form for this platform, the first one shown. */
  keys: readonly string[];
  /** Left without a key on purpose: its last key was removed and the person said so. */
  unbound: boolean;
}

/** The person's key bindings (LA-PLT-EN24): the changed shortcuts, in the order they were first changed. */
export interface KeyBindings { changed: readonly ShortcutBinding[] }

export const NO_BINDINGS: KeyBindings = { changed: [] };

/** The keymap's command for a shortcut, or none. */
export const commandOf = (shortcut: string): Command | undefined => COMMANDS.find((c) => c.id === shortcut);

/** The keys each changed shortcut has, by its ID. */
export const boundKeys = (bindings: KeyBindings): Record<string, readonly string[]> =>
  Object.fromEntries(bindings.changed.map((b) => [b.shortcut, b.keys]));

/** The keymap as the person bound it, a key the browser or OS keeps left out. */
export const boundCommands = (bindings: KeyBindings, mac: boolean): Command[] => resolveCommands(boundKeys(bindings), mac);

/** A shortcut's keys now, normalized: the person's, else its defaults on this platform. */
export function keysNow(bindings: KeyBindings, shortcut: string, mac: boolean): string[] {
  const own = bindings.changed.find((b) => b.shortcut === shortcut);
  const command = commandOf(shortcut);
  return (own ? own.keys : command ? platformKeys(command, mac) : []).map((k) => normalizeBinding(k, mac));
}

/**
 * The bindings with a shortcut's keys set (normalized, each once). Keys that are its defaults again drop the change, so
 * the shortcut shows as unchanged; `unbound` keeps an empty list as a choice.
 */
export function withKeys(bindings: KeyBindings, shortcut: string, keys: readonly string[], mac: boolean, unbound = false): KeyBindings {
  const normal = [...new Set(keys.map((k) => normalizeBinding(k, mac)))];
  const command = commandOf(shortcut);
  const defaults = command ? platformKeys(command, mac).map((k) => normalizeBinding(k, mac)) : null;
  const isDefault = !unbound && defaults !== null && defaults.length === normal.length && defaults.every((k, i) => k === normal[i]);
  const rest = bindings.changed.filter((b) => b.shortcut !== shortcut);
  if (isDefault) return { changed: rest };
  const binding: ShortcutBinding = { shortcut, keys: normal, unbound: unbound && normal.length === 0 };
  const at = bindings.changed.findIndex((b) => b.shortcut === shortcut);
  return { changed: at < 0 ? [...rest, binding] : bindings.changed.map((b) => (b.shortcut === shortcut ? binding : b)) };
}

/** The bindings without a shortcut's change: it has its default keys again. */
export const withoutChange = (bindings: KeyBindings, shortcut: string): KeyBindings => ({ changed: bindings.changed.filter((b) => b.shortcut !== shortcut) });

/**
 * The bindings as stored, `{ "<shortcut>": ["Meta+J", …] | null }` (null: left without a key on purpose). A shortcut
 * that is not in the keymap or cannot be bound, a key that is not text and an empty list are dropped.
 */
export function keyBindingsFrom(value: unknown): KeyBindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return NO_BINDINGS;
  const changed = Object.entries(value).flatMap(([shortcut, keys]): ShortcutBinding[] => {
    const command = commandOf(shortcut);
    if (!command || !customizable(command)) return [];
    if (keys === null) return [{ shortcut, keys: [], unbound: true }];
    if (!Array.isArray(keys)) return [];
    const texts = keys.filter((k): k is string => typeof k === 'string' && k.trim() !== '');
    return texts.length ? [{ shortcut, keys: texts, unbound: false }] : [];
  });
  return { changed };
}

/** The bindings as stored. */
export const storedKeyBindings = (bindings: KeyBindings): Record<string, string[] | null> =>
  Object.fromEntries(bindings.changed.map((b) => [b.shortcut, b.unbound ? null : [...b.keys]]));
