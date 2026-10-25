// The keymap: one table of every keyboard command, which drives both the key handlers and the
// shortcuts sheet, so nothing is listed twice. Bindings follow VS Code (and common developer
// apps) so people can use what they already know.
//
// A binding is a chord such as "Mod+Shift+P" ("Mod" is Cmd on macOS and Ctrl elsewhere), or a
// sequence of chords separated by a space, such as "g c" (GitHub-style). Nothing here touches
// React; the dispatcher in commands.tsx uses it.

export type CommandGroup = 'Navigate' | 'View' | 'Graph' | 'Lists';

/** Where a command applies: anywhere, on a record/group/product/domain page, while the graph shows, or in a list. */
export type CommandContext = 'global' | 'page' | 'graph' | 'list';

export interface Command {
  id: string;
  title: string;
  group: CommandGroup;
  keys: string[];
  when: CommandContext;
  /** Handled by the component it belongs to (arrow keys in the graph), listed here so the sheet shows it. */
  local?: boolean;
  /** Left to the browser (Alt+Left): listed, never intercepted. */
  browser?: boolean;
  /** Listed in the shortcuts sheet only while something handles it (Switch to space 4 when there are four products). */
  dynamic?: boolean;
}

/** How many spaces have a key of their own: Alt+1 to Alt+9, in rail order. */
export const SPACE_KEYS = 9;
export const spaceCommandId = (n: number) => `switchSpace${n}`;

export const COMMANDS: readonly Command[] = [
  // Navigate
  { id: 'quickOpen', title: 'Quick open: go to a record, domain, product or diagram', group: 'Navigate', keys: ['Mod+P', 'Mod+K'], when: 'global' },
  { id: 'commandPalette', title: 'Command palette', group: 'Navigate', keys: ['Mod+Shift+P'], when: 'global' },
  { id: 'goBack', title: 'Go back', group: 'Navigate', keys: ['Ctrl+-'], when: 'global' },
  { id: 'goForward', title: 'Go forward', group: 'Navigate', keys: ['Ctrl+Shift+-'], when: 'global' },
  { id: 'browserBack', title: 'Go back (browser)', group: 'Navigate', keys: ['Alt+ArrowLeft'], when: 'global', browser: true },
  { id: 'browserForward', title: 'Go forward (browser)', group: 'Navigate', keys: ['Alt+ArrowRight'], when: 'global', browser: true },
  { id: 'goToDefinition', title: "Go to the focused link's record", group: 'Navigate', keys: ['F12'], when: 'global' },
  { id: 'showReferences', title: 'Show incoming links in the inspector', group: 'Navigate', keys: ['Shift+F12'], when: 'page' },
  { id: 'openChecks', title: 'Open Checks', group: 'Navigate', keys: ['Mod+Shift+M'], when: 'global' },
  { id: 'nextProblem', title: 'Next problem on this page', group: 'Navigate', keys: ['F8'], when: 'global' },
  { id: 'previousProblem', title: 'Previous problem on this page', group: 'Navigate', keys: ['Shift+F8'], when: 'global' },
  { id: 'focusNav', title: 'Move focus to the navigation', group: 'Navigate', keys: ['Mod+Shift+E'], when: 'global' },
  { id: 'focusInspector', title: 'Move focus to the inspector', group: 'Navigate', keys: ['Mod+Shift+I', 'Mod+Alt+I'], when: 'page' },
  { id: 'goChecks', title: 'Go to Checks', group: 'Navigate', keys: ['g c'], when: 'global' },
  { id: 'goFormat', title: 'Go to the record format', group: 'Navigate', keys: ['g f'], when: 'global' },
  { id: 'goDiagrams', title: 'Go to Diagrams', group: 'Navigate', keys: ['g d'], when: 'global' },
  { id: 'goHome', title: 'Go home (all products)', group: 'Navigate', keys: ['g h'], when: 'global' },
  { id: 'showShortcuts', title: 'Keyboard shortcuts', group: 'Navigate', keys: ['?', 'Mod+/'], when: 'global' },
  // Spaces: one per product, in rail order. Each is titled "Switch to <product>" by whoever handles it.
  ...Array.from({ length: SPACE_KEYS }, (_, i): Command => ({ id: spaceCommandId(i + 1), title: `Switch to space ${i + 1}`, group: 'Navigate', keys: [`Alt+${i + 1}`], when: 'global', dynamic: true })),
  // View
  { id: 'toggleNav', title: 'Show or hide the navigation', group: 'View', keys: ['Mod+B'], when: 'global' },
  { id: 'toggleInspector', title: 'Show or hide the inspector', group: 'View', keys: ['Mod+Alt+B'], when: 'page' },
  { id: 'toggleSplit', title: 'Toggle Split view', group: 'View', keys: ['Mod+\\'], when: 'page' },
  { id: 'viewWiki', title: 'Wiki view', group: 'View', keys: ['Ctrl+1'], when: 'page' },
  { id: 'viewGraph', title: 'Graph view', group: 'View', keys: ['Ctrl+2'], when: 'page' },
  { id: 'viewSplit', title: 'Split view', group: 'View', keys: ['Ctrl+3'], when: 'page' },
  { id: 'toggleFullScreen', title: 'Full screen for the focused pane', group: 'View', keys: ['Mod+Shift+Enter'], when: 'page' },
  { id: 'escape', title: 'Leave full screen, or clear or close the innermost thing', group: 'View', keys: ['Escape'], when: 'global' },
  { id: 'expandAll', title: 'Expand all rows on this page', group: 'View', keys: [], when: 'page' },
  { id: 'collapseAll', title: 'Collapse all rows on this page', group: 'View', keys: [], when: 'page' },
  // Themes (app/src/theme). VS Code's Cmd+K Cmd+T cannot be used: Mod+K is a whole binding (quick open), and a sequence may not start with one.
  { id: 'chooseTheme', title: 'Color theme', group: 'View', keys: ['g t'], when: 'global' },
  { id: 'chooseColorMode', title: 'Light, dark or system', group: 'View', keys: [], when: 'global' },
  { id: 'openAppearance', title: 'Open Appearance settings', group: 'View', keys: [], when: 'global' },
  // Graph
  { id: 'graphMove', title: 'Move between boxes', group: 'Graph', keys: ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'], when: 'graph', local: true },
  { id: 'graphActivate', title: 'Center on the focused box, or open or close a group', group: 'Graph', keys: ['Enter'], when: 'graph', local: true },
  { id: 'graphDepthUp', title: 'More depth', group: 'Graph', keys: ['+', '='], when: 'graph' },
  { id: 'graphDepthDown', title: 'Less depth', group: 'Graph', keys: ['-'], when: 'graph' },
  { id: 'graphTrace', title: 'Trace mode on or off', group: 'Graph', keys: ['t'], when: 'graph' },
  { id: 'graphFit', title: 'Fit the graph to the view', group: 'Graph', keys: ['.'], when: 'graph' },
  { id: 'graphToggleGroup', title: 'Open or close the focused group', group: 'Graph', keys: ['o'], when: 'graph' },
  // Lists
  { id: 'focusSearch', title: 'Focus the nearest search box', group: 'Lists', keys: ['/'], when: 'global' },
  { id: 'treeExpand', title: 'Expand the row (or move into it)', group: 'Lists', keys: ['ArrowRight'], when: 'list', local: true },
  { id: 'treeCollapse', title: 'Collapse the row (or move to its parent)', group: 'Lists', keys: ['ArrowLeft'], when: 'list', local: true },
];

export const GROUPS: readonly CommandGroup[] = ['Navigate', 'View', 'Graph', 'Lists'];

/** Browser essentials a binding may never take, on any platform. */
export const RESERVED = ['Mod+W', 'Mod+T', 'Mod+L', 'Mod+R', 'Mod+N', 'Mod+Q', 'Tab', 'Shift+Tab', 'F5', 'F11'];

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

// ---------- Overrides ----------

export const OVERRIDES_KEY = 'lathe:keybindings';

/** Reads `{ "commandId": "Mod+J" | ["Mod+J", "g j"] }` from local storage. Unknown commands and bad values are ignored. */
export function readOverrides(): Record<string, string[]> {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(OVERRIDES_KEY) ?? '{}');
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

/** The table with a person's overrides applied; a binding that takes a browser essential is dropped. */
export function resolveCommands(overrides: Record<string, string[]>, mac: boolean, commands: readonly Command[] = COMMANDS): Command[] {
  const reserved = new Set(RESERVED.map((r) => normalizeBinding(r, mac)));
  return commands.map((c) => {
    const keys = (overrides[c.id] ?? c.keys).filter((k) => k.trim() && !reserved.has(normalizeBinding(k, mac)));
    return { ...c, keys };
  });
}

/** Contexts that can be active at the same time: the same one, or either one global. */
const overlap = (a: CommandContext, b: CommandContext) => a === b || a === 'global' || b === 'global';

/** Bindings used by two commands whose contexts can be active at the same time. */
export function duplicateBindings(commands: readonly Command[], mac: boolean): string[] {
  const clashes: string[] = [];
  const all = commands.flatMap((c) => c.keys.map((k) => ({ c, b: normalizeBinding(k, mac) })));
  all.forEach((x, i) => all.slice(i + 1).forEach((y) => {
    if (x.b === y.b && x.c.id !== y.c.id && overlap(x.c.when, y.c.when)) clashes.push(`${x.b}: ${x.c.id} and ${y.c.id}`);
    // A sequence must not start with a key that is a whole binding on its own.
    if (overlap(x.c.when, y.c.when) && (x.b.startsWith(`${y.b} `) || y.b.startsWith(`${x.b} `))) clashes.push(`${x.b} / ${y.b}: ${x.c.id} and ${y.c.id}`);
  }));
  return clashes;
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

/** The display of a command's first binding, or '' when it has none. */
export const shortcutOf = (commands: readonly Command[], id: string, mac: boolean) => {
  const k = commands.find((c) => c.id === id)?.keys[0];
  return k ? formatBinding(k, mac) : '';
};
