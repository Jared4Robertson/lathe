// The keymap: one table of every keyboard command, which drives both the key handlers and the
// shortcuts sheet, so nothing is listed twice. Bindings follow VS Code (and common developer
// apps) so people can use what they already know.
//
// A binding is a chord such as "Mod+Shift+P" ("Mod" is Cmd on macOS and Ctrl elsewhere), or a
// sequence of chords separated by a space, such as "g c" (GitHub-style). Nothing here touches
// React; the dispatcher in commands.tsx uses it.
// With its extension: the desktop app compiles this file too, under Node's resolution.
import { MOVES, type Move } from '../views/levels.ts';

export type CommandGroup = 'Navigate' | 'View' | 'Graph' | 'Lists';

/** Where a command applies: anywhere, on a record/group/product/domain page, while the graph shows, or in a list. */
export type CommandContext = 'global' | 'page' | 'graph' | 'list';

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  /** The bindings, first one shown; on every platform unless `otherKeys` says otherwise. */
  keys: string[];
  /** The bindings off a Mac, when they differ (Ctrl+W closes the tab there, so Alt+W instead). */
  otherKeys?: string[];
  when: CommandContext;
  /** Never matched from this table: handled by the control it belongs to by the keys the ARIA practices give it (a tree's arrows, Enter on a graph box), listed here so the sheet shows it; its keys are fixed. */
  local?: boolean;
  /** Left to the browser (Alt+Left): listed, never intercepted. */
  browser?: boolean;
  /** Listed in the shortcuts sheet only while something handles it (Switch to space 4 when there are four products). */
  dynamic?: boolean;
}

/** How many spaces have a key of their own: Alt+1 to Alt+9, in rail order. */
export const SPACE_KEYS = 9;
export const spaceCommandId = (n: number) => `switchSpace${n}`;

/**
 * The default keys of each move of the stage walk (LA-V61-R49, views/levels.ts), from anywhere on the page: the plain
 * arrows; as a game's keys, W Up, A Left, S Down and D Right; as vim's, H Left, J Down, K Up and L Right; Shift+Up
 * (Shift+W, Shift+K) out to the container and Shift+Down (Shift+S, Shift+J) in to the first node inside it. The arrow
 * comes first: it is the key a move is shown by. A person can bind others (platform/key-bindings).
 */
const WALK_KEYS: Readonly<Record<Move, readonly string[]>> = {
  left: ['ArrowLeft', 'A', 'H'], right: ['ArrowRight', 'D', 'L'], up: ['ArrowUp', 'W', 'K'], down: ['ArrowDown', 'S', 'J'],
  out: ['Shift+ArrowUp', 'Shift+W', 'Shift+K'], in: ['Shift+ArrowDown', 'Shift+S', 'Shift+J'],
};
/** Each move's keymap command, in the toolbar's order. */
export const WALK_COMMANDS: Readonly<Record<Move, string>> = { left: 'walkLeft', right: 'walkRight', up: 'walkUp', down: 'walkDown', out: 'walkOut', in: 'walkIn' };
/**
 * The move a chord walks the stage by in the keymap as bound, or none: the move whose command has the chord among its
 * keys. A chord with Cmd, Ctrl or Alt, or Shift with another key, walks only when a person bound it so.
 */
export const walkMove = (chord: string, commands: readonly Command[], mac: boolean): Move | undefined =>
  MOVES.find((m) => commands.find((c) => c.id === WALK_COMMANDS[m])?.keys.some((k) => normalizeBinding(k, mac) === chord));
/** The plain letter a move is also walked by (A for Left), shown on its toolbar button; '' when it has none. */
export const walkLetter = (move: Move, commands: readonly Command[], mac: boolean): string =>
  commands.find((c) => c.id === WALK_COMMANDS[move])?.keys.map((k) => normalizeBinding(k, mac)).find((k) => /^[A-Z]$/.test(k)) ?? '';
const walk = (move: Move, title: string): Command => ({ id: WALK_COMMANDS[move], title, group: 'Graph', keys: [...WALK_KEYS[move]], when: 'page' });

export const COMMANDS: readonly Command[] = [
  // Navigate
  { id: 'quickOpen', title: 'Quick open: go to a record, domain or product', group: 'Navigate', keys: ['Mod+P', 'Mod+K'], when: 'global' },
  { id: 'commandPalette', title: 'Command palette', group: 'Navigate', keys: ['Mod+Shift+P'], when: 'global' },
  { id: 'goBack', title: 'Go back', group: 'Navigate', keys: ['Ctrl+-'], when: 'global' },
  { id: 'goForward', title: 'Go forward', group: 'Navigate', keys: ['Ctrl+Shift+-'], when: 'global' },
  { id: 'browserBack', title: 'Go back (browser)', group: 'Navigate', keys: ['Alt+ArrowLeft'], when: 'global', browser: true },
  { id: 'browserForward', title: 'Go forward (browser)', group: 'Navigate', keys: ['Alt+ArrowRight'], when: 'global', browser: true },
  { id: 'goToDefinition', title: "Go to the focused link's record", group: 'Navigate', keys: ['F12'], when: 'global' },
  { id: 'showReferences', title: 'Show incoming links in the wiki card', group: 'Navigate', keys: ['Shift+F12'], when: 'page' },
  { id: 'openChecks', title: 'Open Checks', group: 'Navigate', keys: ['Mod+Shift+M'], when: 'global' },
  { id: 'openChanges', title: 'Open the Changes panel', group: 'Navigate', keys: ['g d'], when: 'global' },
  { id: 'nextProblem', title: 'Next problem on this page', group: 'Navigate', keys: ['F8'], when: 'global' },
  { id: 'previousProblem', title: 'Previous problem on this page', group: 'Navigate', keys: ['Shift+F8'], when: 'global' },
  { id: 'focusNav', title: 'Move focus to the navigation', group: 'Navigate', keys: ['Mod+Shift+E'], when: 'global' },
  { id: 'goChecks', title: 'Go to Checks', group: 'Navigate', keys: ['g c'], when: 'global' },
  { id: 'goFormat', title: 'Record format', group: 'Navigate', keys: ['g f'], when: 'global' },
  { id: 'goHome', title: 'Go home (all products)', group: 'Navigate', keys: ['g h'], when: 'global' },
  // The desktop app's tabs, as a browser's (LA-V96-R10..R17), handled only there (on the web the browser's tabs are the
  // places): its menu owns Cmd/Ctrl+T and Cmd/Ctrl+W, which a page never gets in a browser; Alt+Shift+T and Alt+Shift+W
  // are the keys of the same commands, as Ctrl+W toggles the wiki card on a Mac.
  { id: 'newTab', title: 'New tab at the product', group: 'Navigate', keys: ['Alt+Shift+T'], when: 'page', dynamic: true },
  { id: 'closeTab', title: 'Close the tab', group: 'Navigate', keys: ['Alt+Shift+W'], when: 'page', dynamic: true },
  { id: 'duplicateTab', title: 'Duplicate the tab, with its history', group: 'Navigate', keys: ['Alt+Shift+D'], when: 'page', dynamic: true },
  { id: 'openRecordInNewTab', title: 'Open the record in a new tab', group: 'Navigate', keys: [], when: 'page', dynamic: true },
  { id: 'nextTab', title: 'Next tab', group: 'Navigate', keys: ['Ctrl+Tab'], when: 'page', dynamic: true },
  { id: 'previousTab', title: 'Previous tab', group: 'Navigate', keys: ['Ctrl+Shift+Tab'], when: 'page', dynamic: true },
  { id: 'showShortcuts', title: 'Keyboard shortcuts', group: 'Navigate', keys: ['?', 'Mod+/'], when: 'global' },
  // Spaces: one per product, in rail order. Each is titled "Switch to <product>" by whoever handles it.
  ...Array.from({ length: SPACE_KEYS }, (_, i): Command => ({ id: spaceCommandId(i + 1), title: `Switch to space ${i + 1}`, group: 'Navigate', keys: [`Alt+${i + 1}`], when: 'global', dynamic: true })),
  // View
  { id: 'toggleNav', title: 'Show or hide the navigation', group: 'View', keys: ['Mod+B'], when: 'global' },
  // The desktop app's chat (LA-PLT-UC19), as VS Code's: Ctrl+Cmd+I on a Mac; Ctrl+Alt+C elsewhere. It shows the chat and focuses its message box.
  { id: 'toggleChat', title: 'Show the chat with Claude, or hide it', group: 'View', keys: ['Ctrl+Meta+I'], otherKeys: ['Ctrl+Alt+C'], when: 'global' },
  // Dictation in the chat (LA-PLT-UC20-R01), as VS Code's Start Dictation: listed only where the Mac recognizes speech on-device.
  { id: 'dictate', title: 'Dictate a message to Claude, or stop dictating', group: 'View', keys: ['Mod+Alt+V'], when: 'global', dynamic: true },
  // Ctrl is the Control key on a Mac too, where Cmd+W stays the browser's; elsewhere Ctrl+W closes the tab and Ctrl+G finds the next match, so Alt.
  { id: 'stageGraph', title: 'Graph stage', group: 'View', keys: ['Ctrl+G', 'Ctrl+1'], otherKeys: ['Alt+G', 'Ctrl+1'], when: 'page' },
  { id: 'stageErd', title: 'ERD stage', group: 'View', keys: ['Ctrl+E', 'Ctrl+2'], otherKeys: ['Alt+E', 'Ctrl+2'], when: 'page' },
  // Elsewhere Ctrl+T opens a browser tab, so Alt.
  { id: 'stageTrace', title: 'Trace stage', group: 'View', keys: ['Ctrl+T', 'Ctrl+3'], otherKeys: ['Alt+T', 'Ctrl+3'], when: 'page' },
  // Enter from anywhere but a control that handles Enter itself (usesEnter), a focused graph box included; Escape only
  // collapses, once nothing above the card is open (each overlay takes its own Escape first, LA-V96-R19).
  { id: 'toggleWikiCard', title: 'Show or collapse the wiki card', group: 'View', keys: ['Enter', 'Ctrl+W'], otherKeys: ['Enter', 'Alt+W'], when: 'page' },
  { id: 'collapseWikiCard', title: 'Collapse the wiki card', group: 'View', keys: ['Escape'], when: 'page' },
  // Highlight changes and Follow (LA-EXP-UC15), the same on every stage.
  { id: 'toggleHighlightChanges', title: 'Highlight changes: mark what is new, changed or removed and dim the rest, or show everything again', group: 'View', keys: ['g l'], when: 'page' },
  { id: 'nextChange', title: 'Next change: go to the next new or changed record', group: 'View', keys: [']'], when: 'page' },
  { id: 'previousChange', title: 'Previous change: go to the previous new or changed record', group: 'View', keys: ['['], when: 'page' },
  { id: 'toggleFollow', title: 'Follow the changes: glide to each change as it lands', group: 'View', keys: [], when: 'page' },
  { id: 'expandAll', title: 'Expand all rows on this page', group: 'View', keys: [], when: 'page' },
  { id: 'collapseAll', title: 'Collapse all rows on this page', group: 'View', keys: [], when: 'page' },
  // Themes (app/src/theme). VS Code's Cmd+K Cmd+T cannot be used: Mod+K is a whole binding (quick open), and a sequence may not start with one.
  { id: 'chooseTheme', title: 'Color theme', group: 'View', keys: ['g t'], when: 'global' },
  { id: 'chooseColorMode', title: 'Light, dark or system', group: 'View', keys: [], when: 'global' },
  { id: 'openAppearance', title: 'Open Appearance settings', group: 'View', keys: [], when: 'global' },
  // Scroll to zoom (the Appearance's): scroll zooms the stages and Cmd/Ctrl+scroll pans, or back to scroll panning.
  { id: 'toggleScrollToZoom', title: 'Turn scroll to zoom on or off', group: 'View', keys: [], when: 'global' },
  // Graph
  // On a box that is not the focus, Enter focuses it; on the focus's own box it goes on to show or collapse the wiki card.
  { id: 'graphActivate', title: 'Focus the box with keyboard focus', group: 'Graph', keys: ['Enter'], when: 'graph', local: true },
  { id: 'graphDepthUp', title: 'More depth', group: 'Graph', keys: ['+', '='], when: 'graph' },
  { id: 'graphDepthDown', title: 'Less depth', group: 'Graph', keys: ['-'], when: 'graph' },
  { id: 'graphFit', title: 'Frame the focus again', group: 'Graph', keys: ['.'], when: 'graph' },
  // The ERD's Tidy up (LA-V94-R09): new data keeps every box where it was, so the map is laid out afresh only on request.
  { id: 'stageTidy', title: 'Tidy up: lay the whole map out afresh', group: 'Graph', keys: ['t'], when: 'graph' },
  { id: 'graphLayout', title: 'Tree or Nested layout: parents beside their children, or made of them as boxes', group: 'Graph', keys: ['v'], when: 'graph' },
  // The stage walk (WALK_KEYS), from anywhere but a control that uses arrows itself (usesArrows), by the commands layer's
  // one handler (LA-V61-R49), never matched as a command (no handler registers for it). Each move moves the stage's focus: the arrows among the siblings (on the Graph by its
  // layout's keys, graph/steps.ts), Out and In between the levels. Tab steps through the boxes.
  walk('left', 'Step left'),
  walk('right', 'Step right'),
  walk('up', 'Step up'),
  walk('down', 'Step down'),
  walk('out', 'Out to the container'),
  walk('in', 'In to the first node inside'),
  // Lists
  { id: 'focusSearch', title: 'Focus the nearest search box', group: 'Lists', keys: ['/'], when: 'global' },
  { id: 'treeExpand', title: 'Expand the row (or move into it)', group: 'Lists', keys: ['ArrowRight'], when: 'list', local: true },
  { id: 'treeCollapse', title: 'Collapse the row (or move to its parent)', group: 'Lists', keys: ['ArrowLeft'], when: 'list', local: true },
];

export const GROUPS: readonly CommandGroup[] = ['Navigate', 'View', 'Graph', 'Lists'];

/**
 * The keys the browser or the operating system keeps, which a binding may never take, on any platform: close, open and
 * reload a tab or window, the address bar, quit, hide and minimize, find next, the clipboard and undo, moving focus, and
 * the function keys that reload and go full screen.
 */
export const RESERVED = [
  'Mod+W', 'Mod+T', 'Mod+L', 'Mod+R', 'Mod+N', 'Mod+Q', 'Mod+H', 'Mod+M', 'Mod+G',
  'Mod+C', 'Mod+V', 'Mod+X', 'Mod+A', 'Mod+Z', 'Mod+Shift+Z',
  'Tab', 'Shift+Tab', 'F5', 'F11',
];

/** A command's own bindings on this platform, before a person's. */
export const platformKeys = (c: Command, mac: boolean): string[] => (mac ? c.keys : c.otherKeys ?? c.keys);

/** Whether a person may bind a command's keys: every command but those whose keys the browser (Alt+Left) or an ARIA control (a tree's arrows) owns. */
export const customizable = (c: Command): boolean => !c.local && !c.browser;

// ---------- Platform ----------

export const isMac = (platform = typeof navigator === 'undefined' ? '' : (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || navigator.userAgent) =>
  /mac|iphone|ipad|ipod/i.test(platform);

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const;

/** A chord with "Mod" resolved and its modifiers in a fixed order: "Ctrl+Shift+P", "Meta+K", "?". */
export function normalizeChord(chord: string, mac: boolean): string {
  const parts = chord.split('+');
  // "Ctrl++" style: a trailing empty part means the key is "+".
  let key = parts.pop()!;
  if (key === '' && parts.at(-1) === '') { parts.pop(); key = '+'; }
  const mods = new Set(parts.map((p) => (p === 'Mod' ? (mac ? 'Meta' : 'Ctrl') : p === 'Cmd' ? 'Meta' : p === 'Option' ? 'Alt' : p)));
  const k = key.length === 1 ? key.toUpperCase() : key;
  return [...MODIFIERS.filter((m) => mods.has(m)), k].join('+');
}

export const normalizeBinding = (binding: string, mac: boolean) => binding.trim().split(/\s+/).map((c) => normalizeChord(c, mac)).join(' ');

const CODE_KEYS: Record<string, string> = {
  Minus: '-', Equal: '=', Backslash: '\\', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`',
};

/** The chord a key event makes, in the same form as normalizeChord. */
export function eventChord(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string {
  const command = e.ctrlKey || e.metaKey || e.altKey;
  let key = e.key;
  // With Ctrl, Cmd or Alt held, the character the key makes varies (Alt+B is "∫" on a Mac, Shift+- is "_"), so use the physical key.
  if (command && e.code) {
    if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
    else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
    else if (CODE_KEYS[e.code]) key = CODE_KEYS[e.code];
  }
  if (key === ' ') key = 'Space';
  const printable = key.length === 1;
  // A symbol typed with Shift ("?", "+") is its own key: Shift is part of the character.
  const shift = e.shiftKey && !(printable && !command && !/[a-z]/i.test(key));
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', shift && 'Shift', e.metaKey && 'Meta'].filter(Boolean);
  return [...mods, printable ? key.toUpperCase() : key].join('+');
}

/** True for a chord with no Ctrl, Cmd or Alt that is not a function key or Escape: it would type text. */
export function isSingleKey(chord: string): boolean {
  const parts = chord.split('+');
  if (parts.some((p) => p === 'Ctrl' || p === 'Meta' || p === 'Alt')) return false;
  const key = parts.at(-1)!;
  return !/^F\d+$/.test(key) && key !== 'Escape';
}

/** True when the event's target takes typing: an input, a textarea, a select or editable text. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable || el.closest('[contenteditable=""], [contenteditable="true"]')) return true;
  const field = el.closest('input, textarea, select');
  if (!field) return false;
  if (field.tagName !== 'INPUT') return true;
  const type = (field as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(type);
}

/**
 * Controls that use the arrow keys themselves, so a plain arrow inside one is theirs and never walks the stage: a field
 * that takes text or picks by arrows (every input but a checkbox and the buttons, a textarea, a select, editable text
 * such as the chat box), the composite widgets the ARIA practices give arrows to (a tree, grid, menu, menu bar, listbox,
 * combobox, tab list, radio group, slider, spin button and a focusable window splitter), a menu button, a modal dialog
 * (it holds the keyboard), and anything marked `data-arrows="own"` (a tree list, the chat log, the trace
 * table, the breadcrumb's menu).
 */
const ARROW_CONTROLS = [
  'input:not([type="checkbox"], [type="button"], [type="submit"], [type="reset"], [type="image"], [type="file"], [type="color"], [type="hidden"])',
  'textarea', 'select', '[contenteditable=""]', '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
  ...['tree', 'treegrid', 'grid', 'menu', 'menubar', 'listbox', 'combobox', 'tablist', 'radiogroup', 'slider', 'spinbutton'].map((r) => `[role="${r}"]`),
  '[role="separator"][tabindex]',
  '[aria-haspopup="menu"]', '[aria-haspopup="true"]', '[aria-haspopup="listbox"]',
  '[aria-modal="true"]',
  // The one mark for an element whose own key handling uses the arrows.
  '[data-arrows="own"]',
].join(', ');

/** A box that takes focus only so the arrow keys can scroll it (LA-V61-R46): a code block or a named scrolling region. */
const SCROLL_BOX = 'pre[tabindex="0"], [role="region"][tabindex="0"]';

/**
 * True when a plain arrow pressed with keyboard focus on `target` belongs to it: the target is in a control that uses
 * arrows (ARROW_CONTROLS), or is itself a box that took focus to scroll by them. Anywhere else the arrow walks the stage.
 * The walking letters (W, A, S, D) ask the same: every element that takes text is among those controls, so a letter typed
 * there stays text, and one pressed in a list or menu stays with it (to find a row by its first letter).
 */
export function usesArrows(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable) return true;
  return el.closest(ARROW_CONTROLS) !== null || el.matches(SCROLL_BOX);
}

/**
 * Controls that handle a plain Enter themselves, so Enter there is theirs and never toggles the wiki card (LA-V96-R19): a
 * link, a button, a summary, every field (a text field submits, a checkbox or radio is its own), editable text (the chat
 * box), the widgets that act on Enter (a menu and its items, a listbox and its options, a combobox, a tab, a tree and its
 * rows, a grid) and a modal dialog. A graph box is none of these: Enter on one is
 * the stage's (it focuses that box, and on the focus's own box goes on to the card).
 */
const ENTER_CONTROLS = [
  'a[href]', 'button', 'summary', 'input', 'textarea', 'select',
  '[contenteditable=""]', '[contenteditable="true"]', '[contenteditable="plaintext-only"]',
  ...['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'tab', 'checkbox', 'radio', 'switch',
    'menu', 'menubar', 'listbox', 'combobox', 'tree', 'treeitem', 'treegrid', 'grid', 'gridcell'].map((r) => `[role="${r}"]`),
  '[aria-modal="true"]',
  // A tool over the stage (views/ToolPanel.tsx): Enter stays with it, whatever in it has focus.
  '.tool-panel',
].join(', ');

/** True when a plain Enter pressed with keyboard focus on `target` belongs to it (ENTER_CONTROLS); anywhere else it toggles the wiki card. */
export function usesEnter(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable) return true;
  return el.closest(ENTER_CONTROLS) !== null;
}

// ---------- A person's bindings ----------

/** The table with a person's keys in place of the defaults (by command ID); a key the browser or OS keeps is dropped. */
export function resolveCommands(bound: Readonly<Record<string, readonly string[]>>, mac: boolean, commands: readonly Command[] = COMMANDS): Command[] {
  const reserved = new Set(RESERVED.map((r) => normalizeBinding(r, mac)));
  return commands.map((c) => {
    const keys = (bound[c.id] ?? platformKeys(c, mac)).filter((k) => k.trim() && !reserved.has(normalizeBinding(k, mac)));
    return { ...c, keys };
  });
}

/** Contexts that can be active at the same time: the same one, or either one global. */
export const overlap = (a: CommandContext, b: CommandContext) => a === b || a === 'global' || b === 'global';

/** Two commands that take the same key, or a sequence and the key it starts with, in contexts active at the same time. */
export interface Clash { binding: string; other: string; a: Command; b: Command }

/** The other command that has the key, or a key it starts or that starts it, where the command applies too; none when the key is free for it. */
export function holderOf(commands: readonly Command[], id: string, key: string, mac: boolean): Command | undefined {
  const own = commands.find((c) => c.id === id);
  const k = normalizeBinding(key, mac);
  return commands.find((c) => c.id !== id && (!own || overlap(own.when, c.when)) && c.keys.some((x) => {
    const b = normalizeBinding(x, mac);
    return b === k || b.startsWith(`${k} `) || k.startsWith(`${b} `);
  }));
}

/** Every clash in a keymap as bound (each command's `keys`). */
export function clashes(commands: readonly Command[], mac: boolean): Clash[] {
  const found: Clash[] = [];
  const all = commands.flatMap((c) => c.keys.map((k) => ({ c, b: normalizeBinding(k, mac) })));
  all.forEach((x, i) => all.slice(i + 1).forEach((y) => {
    if (x.c.id === y.c.id || !overlap(x.c.when, y.c.when)) return;
    // The same key; or a sequence that starts with a key that is a whole binding on its own.
    if (x.b === y.b || x.b.startsWith(`${y.b} `) || y.b.startsWith(`${x.b} `)) found.push({ binding: x.b, other: y.b, a: x.c, b: y.c });
  }));
  return found;
}

// ---------- Display ----------

const MAC_SYMBOLS: Record<string, string> = { Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' };
const KEY_NAMES: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', Enter: 'Enter', '\\': '\\' };

/** How a binding is shown: "⌘⇧P" on a Mac, "Ctrl+Shift+P" elsewhere, "g then c" for a sequence. */
export function formatBinding(binding: string, mac: boolean): string {
  return normalizeBinding(binding, mac).split(' ').map((chord) => {
    const parts = chord.split('+');
    let key = parts.pop()!;
    if (key === '') { parts.pop(); key = '+'; }
    const name = KEY_NAMES[key] ?? (parts.length === 0 && key.length === 1 ? key.toLowerCase() : key);
    if (mac) return parts.map((p) => MAC_SYMBOLS[p] ?? p).join('') + name;
    return [...parts, name].join('+');
  }).join(' then ');
}

// ---------- Matching ----------

export interface MatchResult {
  /** A command whose binding is complete. */
  command?: Command;
  /** True when the chord starts a sequence ("g"): wait for the next key. */
  pending?: boolean;
}

/**
 * Matches the chords pressed so far against the table. `available` says which command ids have a
 * handler right now; local and browser commands never match here.
 */
export function match(pressed: string[], commands: readonly Command[], mac: boolean, available: (id: string) => boolean): MatchResult {
  const typed = pressed.join(' ');
  let pending = false;
  for (const c of commands) {
    if (c.local || c.browser || !available(c.id)) continue;
    for (const k of c.keys) {
      const b = normalizeBinding(k, mac);
      if (b === typed) return { command: c };
      if (b.startsWith(`${typed} `)) pending = true;
    }
  }
  return { pending };
}

/**
 * A command's keys in the form `aria-keyshortcuts` takes: "Control+Shift+P Control+K", modifiers
 * named as the DOM names them. A sequence ("g c") cannot be said that way, so it is left out.
 */
export function ariaKeyShortcuts(keys: readonly string[], mac: boolean): string {
  const ARIA_KEYS: Record<string, string> = { '+': 'Plus', Space: 'Space' };
  return keys
    .map((k) => normalizeBinding(k, mac))
    .filter((b) => b && !b.includes(' '))
    .map((b) => {
      const parts = b.split('+');
      let key = parts.pop()!;
      if (key === '') { parts.pop(); key = '+'; }
      return [...parts.map((p) => (p === 'Ctrl' ? 'Control' : p)), ARIA_KEYS[key] ?? key].join('+');
    })
    .join(' ');
}
