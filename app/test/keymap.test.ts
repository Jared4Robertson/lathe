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
  platformKeys,
  readOverrides,
  resolveCommands,
  usesArrows,
} from '../src/shell/keymap';

const key = (k: string, code: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  ({ key: k, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });
const all = () => true;

describe('the keymap', () => {
  it('LA-VO61-C02-T No default binding takes a browser essential, on a Mac or elsewhere', () => {
    for (const mac of [true, false]) {
      const reserved = new Set(RESERVED.map((r) => normalizeBinding(r, mac)));
      for (const c of COMMANDS) for (const k of platformKeys(c, mac)) expect(reserved.has(normalizeBinding(k, mac)), `${c.id} ${k}`).toBe(false);
    }
  });

  it('LA-PLT-INV01-T No binding is used twice where both can apply, nor starts a sequence of its own', () => {
    for (const mac of [true, false]) expect(duplicateBindings(COMMANDS, mac)).toEqual([]);
    // The check itself finds a clash, including a sequence that starts with a whole binding.
    const clash = [...COMMANDS, { id: 'x', title: 'X', group: 'View' as const, keys: ['Mod+B'], when: 'page' as const }];
    expect(duplicateBindings(clash, false)).toContain('Ctrl+B: toggleNav and x');
    const prefix = [...COMMANDS, { id: 'y', title: 'Y', group: 'View' as const, keys: ['g'], when: 'global' as const }];
    expect(duplicateBindings(prefix, false).some((d) => d.includes('goChecks and y') || d.includes('y and goChecks'))).toBe(true);
  });

  it('LA-V61-R07-T01 Every command is one row of the keymap, with an id, a title, a group and its default keys', () => {
    const ids = COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of COMMANDS) {
      expect(c.title.trim(), c.id).not.toBe('');
      expect(GROUPS, c.id).toContain(c.group);
    }
    // The VS Code defaults are there.
    const keysOf = (id: string) => COMMANDS.find((c) => c.id === id)!.keys;
    expect(keysOf('quickOpen')).toEqual(['Mod+P', 'Mod+K']);
    expect(keysOf('commandPalette')).toEqual(['Mod+Shift+P']);
    expect(keysOf('toggleNav')).toEqual(['Mod+B']);
    expect(keysOf('toggleSideBar')).toEqual(['Mod+Alt+B']);
    expect(keysOf('stageGraph')).toEqual(['Ctrl+G', 'Ctrl+1']);
    expect(keysOf('toggleWikiCard')).toEqual(['w', 'Ctrl+W']);
    expect(COMMANDS.some((c) => ['viewWiki', 'viewGraph', 'maximizePane', 'toggleFullScreen'].includes(c.id))).toBe(false);
    expect(keysOf('nextProblem')).toEqual(['F8']);
  });

  it('LA-V61-R07-T02 Mod is Cmd on macOS and Ctrl elsewhere in what the app shows', () => {
    expect(isMac('MacIntel')).toBe(true);
    expect(isMac('Win32')).toBe(false);
    expect(formatBinding('Mod+Shift+P', true)).toBe('⇧⌘P');
    expect(formatBinding('Mod+Shift+P', false)).toBe('Ctrl+Shift+P');
    expect(formatBinding('Ctrl+1', true)).toBe('⌃1');
    expect(formatBinding('g c', false)).toBe('g then c');
    expect(formatBinding('?', false)).toBe('?');
  });

  it('LA-VO61-C01-T A binding is read as chords in the keymap\'s normal form, Mod being Cmd on macOS and Ctrl elsewhere', () => {
    expect(normalizeBinding('Mod+Shift+P', true)).toBe('Shift+Meta+P');
    expect(normalizeBinding('Mod+Shift+P', false)).toBe('Ctrl+Shift+P');

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
    expect(match(['V'], pc, false, (id) => id !== 'graphLayout').command).toBeUndefined();
    expect(match(['Alt+ArrowLeft'], pc, false, all).command).toBeUndefined();
  });

  it('LA-V61-R09-T01 Single-key shortcuts never fire while typing; chords with Ctrl, Cmd or Alt, function keys and Escape still do', () => {
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

  it('LA-V61-R10-T01 A person can override bindings in local storage; a binding that takes a browser essential is dropped', () => {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ toggleNav: 'Mod+J', quickOpen: ['Mod+W', 'Mod+O'], nope: 'Mod+Y', graphStepOut: 'X' }));
    const overrides = readOverrides();
    expect(overrides).toEqual({ toggleNav: ['Mod+J'], quickOpen: ['Mod+W', 'Mod+O'] });
    const commands = resolveCommands(overrides, false);
    expect(commands.find((c) => c.id === 'toggleNav')!.keys).toEqual(['Mod+J']);
    expect(commands.find((c) => c.id === 'quickOpen')!.keys).toEqual(['Mod+O']);
    expect(match(['Ctrl+J'], commands, false, all).command?.id).toBe('toggleNav');
    window.localStorage.setItem(OVERRIDES_KEY, 'not json');
    expect(readOverrides()).toEqual({});
  });

  const keysOn = (id: string, mac: boolean) => resolveCommands({}, mac).find((c) => c.id === id)!.keys;

  it('LA-V61-R08-T08 The stage switch has Ctrl+G, Ctrl+E and Ctrl+T on a Mac and Alt+G, Alt+E and Alt+T elsewhere, then Ctrl+1, 2 and 3; the wiki card w, and Ctrl+W on a Mac or Alt+W elsewhere', () => {
    expect(keysOn('toggleWikiCard', true)).toEqual(['w', 'Ctrl+W']);
    expect(keysOn('stageGraph', true)).toEqual(['Ctrl+G', 'Ctrl+1']);
    expect(keysOn('stageErd', true)).toEqual(['Ctrl+E', 'Ctrl+2']);
    expect(keysOn('stageTrace', true)).toEqual(['Ctrl+T', 'Ctrl+3']);
    expect(keysOn('toggleWikiCard', false)).toEqual(['w', 'Alt+W']);
    expect(keysOn('stageGraph', false)).toEqual(['Alt+G', 'Ctrl+1']);
    expect(keysOn('stageErd', false)).toEqual(['Alt+E', 'Ctrl+2']);
    expect(keysOn('stageTrace', false)).toEqual(['Alt+T', 'Ctrl+3']);
  });

  it('LA-V61-R12-T02 A key means the platform\'s own key, and no platform is offered a browser key, even by an override', () => {
    // On a Mac, Ctrl is the Control key, so Ctrl+W is not Cmd+W.
    expect(match(['Ctrl+W'], resolveCommands({}, true), true, all).command?.id).toBe('toggleWikiCard');
    expect(match(['Meta+W'], resolveCommands({}, true), true, all).command).toBeUndefined();
    expect(match(['Alt+G'], resolveCommands({}, false), false, all).command?.id).toBe('stageGraph');
    expect(match(['Ctrl+G'], resolveCommands({}, false), false, all).command).toBeUndefined();
    // Off a Mac, Ctrl+W (close the tab) and Ctrl+G (find next) are reserved: never offered, even by an override.
    expect(resolveCommands({ toggleWikiCard: ['Ctrl+W'], stageGraph: ['Ctrl+G'] }, false).filter((c) => c.id === 'toggleWikiCard' || c.id === 'stageGraph').map((c) => c.keys)).toEqual([[], []]);
    for (const mac of [true, false]) {
      const reserved = new Set(RESERVED.map((r) => normalizeBinding(r, mac)));
      for (const c of resolveCommands({}, mac)) for (const k of c.keys) expect(reserved.has(normalizeBinding(k, mac)), `${c.id} ${k}`).toBe(false);
    }
  });

  it('LA-V61-R49-T01 The arrow guard leaves a plain arrow with each control that uses arrows, and with nothing else', () => {
    const make = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.append(host);
      return host.firstElementChild as HTMLElement;
    };
    // Each control that uses arrows keeps them, and so does what is inside it.
    const own = [
      '<input type="text">', '<input type="search">', '<input type="number">', '<input>', '<input type="radio">', '<input type="range">',
      '<textarea></textarea>', '<select><option>a</option></select>', '<div contenteditable="true"><b>x</b></div>', '<div contenteditable=""><b>x</b></div>',
      ...['tree', 'treegrid', 'grid', 'menu', 'menubar', 'listbox', 'combobox', 'tablist', 'radiogroup', 'slider', 'spinbutton'].map((r) => `<div role="${r}"><button>x</button></div>`),
      '<div role="separator" tabindex="0"></div>', '<button aria-haspopup="menu">x</button>', '<button aria-haspopup="true">x</button>', '<button aria-haspopup="listbox">x</button>',
      '<div role="dialog" aria-modal="true"><button>x</button></div>', '<ul data-arrows="own"><li><a href="/x">x</a></li></ul>',
      '<pre tabindex="0">code</pre>', '<div role="region" tabindex="0" aria-label="Scrolls">text</div>',
    ];
    for (const html of own) {
      const el = make(html);
      expect(usesArrows(el), html).toBe(true);
      const inner = el.querySelector('button, a, b, option');
      if (inner) expect(usesArrows(inner), `inside ${html}`).toBe(true);
    }
    // Anything else gives a plain arrow to the stage: the body, a button, a link, a checkbox, a link in a scrolling
    // region (the region only keeps them when it has focus itself), a splitter that takes no focus, a dialog that is not modal.
    const stage = [
      '<button>x</button>', '<a href="/x">x</a>', '<input type="checkbox">', '<input type="button" value="x">', '<p>text</p>',
      '<div role="separator"></div>', '<button aria-haspopup="dialog">x</button>', '<div role="dialog"><button>x</button></div>',
    ];
    for (const html of stage) expect(usesArrows(make(html)), html).toBe(false);
    const region = make('<div role="region" tabindex="0" aria-label="Scrolls"><a href="/x">x</a></div>');
    expect(usesArrows(region.querySelector('a'))).toBe(false);
    const dialog = make('<div role="dialog"><button>x</button></div>');
    expect(usesArrows(dialog.querySelector('button'))).toBe(false);
    expect(usesArrows(document.body)).toBe(false);
    expect(usesArrows(null)).toBe(false);
    document.body.innerHTML = '';
  });
});
