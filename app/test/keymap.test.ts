import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  GROUPS,
  OVERRIDES_KEY,
  RESERVED,
  duplicateBindings,
  eventChord,
  formatBinding,
  isMac,
  isSingleKey,
  isTyping,
  match,
  normalizeBinding,
  readOverrides,
  resolveCommands,
} from '../src/shell/keymap';

const key = (k: string, code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  ({ key: k, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });
const all = () => true;

describe('the keymap', () => {
  it('LA-BRW-T140 Every command has a title and a group, no binding is used twice where both can apply, and no browser essential is taken', () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COMMANDS) {
      expect(c.title.trim(), c.id).not.toBe('');
      expect(GROUPS, c.id).toContain(c.group);
    }
    for (const mac of [true, false]) {
      expect(duplicateBindings(COMMANDS, mac)).toEqual([]);
      const reserved = new Set(RESERVED.map((r) => normalizeBinding(r, mac)));
      for (const c of COMMANDS) for (const k of c.keys) expect(reserved.has(normalizeBinding(k, mac)), `${c.id} ${k}`).toBe(false);
    }
    // The check itself finds a clash, including a sequence that starts with a whole binding.
    const clash = [...COMMANDS, { id: 'x', title: 'X', group: 'View' as const, keys: ['Mod+B'], when: 'page' as const }];
    expect(duplicateBindings(clash, false)).toContain('Ctrl+B: toggleNav and x');
    const prefix = [...COMMANDS, { id: 'y', title: 'Y', group: 'View' as const, keys: ['g'], when: 'global' as const }];
    expect(duplicateBindings(prefix, false).some((d) => d.includes('goChecks and y') || d.includes('y and goChecks'))).toBe(true);
    // The VS Code defaults are there.
    const keysOf = (id: string) => COMMANDS.find((c) => c.id === id)!.keys;
    expect(keysOf('quickOpen')).toEqual(['Mod+P', 'Mod+K']);
    expect(keysOf('commandPalette')).toEqual(['Mod+Shift+P']);
    expect(keysOf('toggleNav')).toEqual(['Mod+B']);
    expect(keysOf('toggleInspector')).toEqual(['Mod+Alt+B']);
    expect(keysOf('viewGraph')).toEqual(['Ctrl+2']);
    expect(keysOf('nextProblem')).toEqual(['F8']);
  });

  it('LA-BRW-T141 Mod is Cmd on macOS and Ctrl elsewhere, in matching and in what is shown', () => {
    expect(isMac('MacIntel')).toBe(true);
    expect(isMac('Win32')).toBe(false);
    expect(normalizeBinding('Mod+Shift+P', true)).toBe('Shift+Meta+P');
    expect(normalizeBinding('Mod+Shift+P', false)).toBe('Ctrl+Shift+P');
    expect(formatBinding('Mod+Shift+P', true)).toBe('⇧⌘P');
    expect(formatBinding('Mod+Shift+P', false)).toBe('Ctrl+Shift+P');
    expect(formatBinding('Ctrl+1', true)).toBe('⌃1');
    expect(formatBinding('g c', false)).toBe('g then c');
    expect(formatBinding('?', false)).toBe('?');

    // Key events: the physical key with modifiers (Alt+B is "∫" on a Mac), the character without.
    expect(eventChord(key('p', 'KeyP', { metaKey: true }))).toBe('Meta+P');
    expect(eventChord(key('∫', 'KeyB', { metaKey: true, altKey: true }))).toBe('Alt+Meta+B');
    expect(eventChord(key('_', 'Minus', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+-');
    expect(eventChord(key('?', 'Slash', { shiftKey: true }))).toBe('?');
    expect(eventChord(key('+', 'Equal', { shiftKey: true }))).toBe('+');
    expect(eventChord(key('F8', 'F8', { shiftKey: true }))).toBe('Shift+F8');
    const mac = resolveCommands({}, true);
    expect(match(['Meta+P'], mac, true, all).command?.id).toBe('quickOpen');
    expect(match(['Ctrl+P'], mac, true, all).command).toBeUndefined();
    const pc = resolveCommands({}, false);
    expect(match(['Ctrl+P'], pc, false, all).command?.id).toBe('quickOpen');
    expect(match(['G'], pc, false, all)).toEqual({ pending: true });
    expect(match(['G', 'C'], pc, false, all).command?.id).toBe('goChecks');
    // A command without a handler right now does not match; local and browser keys never do.
    expect(match(['T'], pc, false, (id) => id !== 'graphTrace').command).toBeUndefined();
    expect(match(['Alt+ArrowLeft'], pc, false, all).command).toBeUndefined();
  });

  it('LA-BRW-T142 Single-key shortcuts never fire while typing; chords with Ctrl, Cmd or Alt, function keys and Escape still do', () => {
    const input = document.createElement('input');
    const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' });
    const area = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inside = document.createElement('span');
    editable.append(inside);
    expect(isTyping(input)).toBe(true);
    expect(isTyping(area)).toBe(true);
    expect(isTyping(inside)).toBe(true);
    expect(isTyping(checkbox)).toBe(false);
    expect(isTyping(document.createElement('button'))).toBe(false);
    expect(isSingleKey('T')).toBe(true);
    expect(isSingleKey('?')).toBe(true);
    expect(isSingleKey('Shift+T')).toBe(true);
    expect(isSingleKey('Ctrl+P')).toBe(false);
    expect(isSingleKey('F8')).toBe(false);
    expect(isSingleKey('Escape')).toBe(false);
  });

  it('LA-BRW-T143 A person can override bindings in local storage; a binding that takes a browser essential is dropped', () => {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ toggleNav: 'Mod+J', quickOpen: ['Mod+W', 'Mod+O'], nope: 'Mod+Y', graphMove: 'X' }));
    const overrides = readOverrides();
    expect(overrides).toEqual({ toggleNav: ['Mod+J'], quickOpen: ['Mod+W', 'Mod+O'] });
    const commands = resolveCommands(overrides, false);
    expect(commands.find((c) => c.id === 'toggleNav')!.keys).toEqual(['Mod+J']);
    expect(commands.find((c) => c.id === 'quickOpen')!.keys).toEqual(['Mod+O']);
    expect(match(['Ctrl+J'], commands, false, all).command?.id).toBe('toggleNav');
    window.localStorage.setItem(OVERRIDES_KEY, 'not json');
    expect(readOverrides()).toEqual({});
  });
});
