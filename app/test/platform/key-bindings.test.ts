import { describe, expect, it } from 'vitest';
import { RuleBroken } from '../../src/shell/prefs';
import { match, normalizeBinding } from '../../src/shell/keymap';
import { keyBindingsRepository } from '../../src/platform/key-bindings/repository';
import { holdToRules } from '../../src/platform/key-bindings/rules';
import { keymapReader } from '../../src/platform/key-bindings/reader';
import { listKeyboardCommands } from '../../src/platform/key-bindings/queries';
import { bindKey } from '../../src/platform/key-bindings/commands/bind-key';
import { removeBinding } from '../../src/platform/key-bindings/commands/remove-binding';
import { resetShortcut } from '../../src/platform/key-bindings/commands/reset-shortcut';
import { resetAllShortcuts } from '../../src/platform/key-bindings/commands/reset-all-shortcuts';

// The Key bindings aggregate's commands (LA-PLT-CMD55–58): each holds the bindings to their rules and saves them through
// KeyBindingsRepository, kept in local storage under lathe:keybindings. The test browser is not a Mac (mac: false), so
// Mod is Ctrl, except where a test says so.

const stored = () => JSON.parse(window.localStorage.getItem('lathe:keybindings') ?? 'null') as unknown;
const keymap = (mac = false) => listKeyboardCommands(keymapReader({ changed: keyBindingsRepository.load().changed, mac }));
const keysOf = (id: string, mac = false) => keymap(mac).find((c) => c.id === id)!.keys.map((k) => normalizeBinding(k, mac));
const refusal = (run: () => void): RuleBroken => {
  try { run(); } catch (e) { if (e instanceof RuleBroken) return e; throw e; }
  throw new Error('not refused');
};
const all = () => true;

describe('LA-PLT-INV40-T No two shortcuts share a key where both apply: binding one that another has is refused naming it, and Swap hands the key over', () => {
  it('refuses a key another shortcut has, naming both, and saves nothing', () => {
    const before = window.localStorage.getItem('lathe:keybindings');
    const e = refusal(() => bindKey({ shortcut: 'toggleNav', key: 'Ctrl+Shift+M', mac: false }));
    expect(e.problems).toEqual([{ rule: 'key-free-where-it-applies', message: 'Ctrl+Shift+M would be the key of both "Open Checks" and "Show or hide the navigation".' }]);
    expect(window.localStorage.getItem('lathe:keybindings')).toBe(before);
  });

  it('refuses a key a sequence starts with, and allows a key shared only where the two never apply together', () => {
    expect(refusal(() => bindKey({ shortcut: 'toggleNav', key: 'G', mac: false })).problems[0].rule).toBe('key-free-where-it-applies');
    // V (the Graph's layout) applies only on the Graph; the tree's rows (list) never with it.
    bindKey({ shortcut: 'expandAll', key: 'Ctrl+Alt+E', mac: false });
    expect(keysOf('expandAll')).toEqual(['Ctrl+Alt+E']);
  });

  it('swaps: the key goes to this shortcut and the other gets the key it gave up', () => {
    bindKey({ shortcut: 'toggleNav', key: 'Ctrl+Shift+M', replacing: 'Ctrl+B', swap: true, mac: false });
    expect(keysOf('toggleNav')).toEqual(['Ctrl+Shift+M']);
    expect(keysOf('openChecks')).toEqual(['Ctrl+B']);
    expect(stored()).toEqual({ toggleNav: ['Ctrl+Shift+M'], openChecks: ['Ctrl+B'] });
    // Resetting one while the other holds its default key is refused, naming it.
    expect(refusal(() => resetShortcut({ shortcut: 'toggleNav', mac: false })).problems[0].message).toBe('Ctrl+B would be the key of both "Open Checks" and "Show or hide the navigation".');
  });
});

describe('LA-PLT-INV41-T A key the browser or the system keeps cannot be bound', () => {
  it('refuses Ctrl+W off a Mac and Cmd+Q on a Mac, with the reason', () => {
    expect(refusal(() => bindKey({ shortcut: 'toggleNav', key: 'Ctrl+W', mac: false })).problems).toEqual([
      { rule: 'key-not-kept-by-browser', message: 'Ctrl+W belongs to the browser or the system, so "Show or hide the navigation" cannot take it.' },
    ]);
    expect(refusal(() => bindKey({ shortcut: 'toggleNav', key: 'Meta+Q', mac: true })).problems[0].message).toBe('⌘Q belongs to the browser or the system, so "Show or hide the navigation" cannot take it.');
    // On a Mac, Ctrl is the Control key: Ctrl+L is free there, as Cmd+L is the browser's.
    bindKey({ shortcut: 'goHome', key: 'Ctrl+L', mac: true });
    expect(keysOf('goHome', true)).toEqual(['G H', 'Ctrl+L']);
  });
});

describe('LA-PLT-INV42-T Every shortcut keeps a key unless it is unbound on purpose', () => {
  it('refuses removing the last key, and leaves the shortcut without one when told to', () => {
    removeBinding({ shortcut: 'quickOpen', key: 'Ctrl+K', mac: false });
    expect(keysOf('quickOpen')).toEqual(['Ctrl+P']);
    const e = refusal(() => removeBinding({ shortcut: 'quickOpen', key: 'Ctrl+P', mac: false }));
    expect(e.problems).toEqual([{ rule: 'shortcut-keeps-a-key', message: '"Quick open: go to a record, domain or product" would have no key. Remove its last key on purpose to leave it without one.' }]);
    removeBinding({ shortcut: 'quickOpen', key: 'Ctrl+P', unbind: true, mac: false });
    expect(keysOf('quickOpen')).toEqual([]);
    expect(stored()).toEqual({ quickOpen: null });
    expect(() => holdToRules({ changed: [{ shortcut: 'toggleNav', keys: [], unbound: false }] }, false)).toThrow(RuleBroken);
  });
});

describe('LA-PLT-INV43-T Only the app\'s own shortcuts can be bound: not the browser\'s, nor an ARIA control\'s', () => {
  it('refuses Go back (browser), a tree\'s arrows and a shortcut that does not exist', () => {
    expect(refusal(() => bindKey({ shortcut: 'browserBack', key: 'Ctrl+Alt+B', mac: false })).problems).toEqual([
      { rule: 'shortcut-can-be-bound', message: '"Go back (browser)" keeps its own keys: the browser handles them.' },
    ]);
    expect(refusal(() => bindKey({ shortcut: 'treeExpand', key: 'Ctrl+Alt+R', mac: false })).problems[0].message).toBe('"Expand the row (or move into it)" keeps its own keys: its control handles them.');
    expect(refusal(() => bindKey({ shortcut: 'nope', key: 'Ctrl+Alt+R', mac: false })).problems[0].message).toBe('There is no shortcut nope.');
    // Stored by hand, such a binding is dropped as the bindings load.
    window.localStorage.setItem('lathe:keybindings', JSON.stringify({ browserBack: ['Ctrl+Alt+B'], nope: ['X'], toggleNav: 'Mod+J', goHome: [] }));
    expect(keyBindingsRepository.load().changed).toEqual([]);
  });
});

describe('LA-PLT-UC24-R01-T01 LA-PLT-UC48-R01-T01 LA-PLT-UC49-R01-T01 LA-PLT-UC50-R01-T01 LA-V61-R10-T01 A person binds, removes and resets keys, and the keymap follows at once', () => {
  it('binds a second key, changes one in place, and resets it to its own keys', () => {
    bindKey({ shortcut: 'toggleNav', key: 'Ctrl+J', mac: false });
    expect(keysOf('toggleNav')).toEqual(['Ctrl+B', 'Ctrl+J']);
    expect(match(['Ctrl+J'], keymap(), false, all).command?.id).toBe('toggleNav');
    bindKey({ shortcut: 'toggleNav', key: 'Ctrl+Alt+N', replacing: 'Ctrl+B', mac: false });
    expect(keysOf('toggleNav')).toEqual(['Ctrl+Alt+N', 'Ctrl+J']);
    expect(keymap().find((c) => c.id === 'toggleNav')).toMatchObject({ changed: true, customizable: true, defaultKeys: ['Ctrl+B'] });
    resetShortcut({ shortcut: 'toggleNav', mac: false });
    expect(keysOf('toggleNav')).toEqual(['Ctrl+B']);
    expect(keymap().find((c) => c.id === 'toggleNav')!.changed).toBe(false);
    // Putting the defaults back by hand drops the change too.
    bindKey({ shortcut: 'goHome', key: 'Ctrl+Alt+H', replacing: 'g h', mac: false });
    bindKey({ shortcut: 'goHome', key: 'g h', replacing: 'Ctrl+Alt+H', mac: false });
    expect(stored()).toEqual({});
  });

  it('rebinds a walk key and a stage key, and Reset all gives every shortcut its own keys again', () => {
    bindKey({ shortcut: 'walkLeft', key: 'Y', replacing: 'H', mac: false });
    bindKey({ shortcut: 'stageGraph', key: 'Alt+Shift+G', replacing: 'Alt+G', mac: false });
    expect(keysOf('walkLeft')).toEqual(['ArrowLeft', 'A', 'Y']);
    expect(keysOf('stageGraph')).toEqual(['Alt+Shift+G', 'Ctrl+1']);
    // A shortcut with no default key, such as Turn scroll to zoom on or off, takes one too.
    bindKey({ shortcut: 'toggleScrollToZoom', key: 'Ctrl+Alt+Z', mac: false });
    expect(keysOf('toggleScrollToZoom')).toEqual(['Ctrl+Alt+Z']);
    expect(keymap().find((c) => c.id === 'toggleScrollToZoom')).toMatchObject({ changed: true, customizable: true, defaultKeys: [] });
    resetAllShortcuts({ mac: false });
    expect(stored()).toEqual({});
    expect(keysOf('walkLeft')).toEqual(['ArrowLeft', 'A', 'H']);
  });
});
