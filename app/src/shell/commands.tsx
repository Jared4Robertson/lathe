import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  GROUPS,
  OVERRIDES_KEY,
  ariaKeyShortcuts,
  eventChord,
  formatBinding,
  isMac,
  isSingleKey,
  isTyping,
  match,
  readOverrides,
  resolveCommands,
  usesArrows,
  usesEnter,
  walkArrow,
  type Command,
} from './keymap';
import { Link } from '../router';
import { Button } from '../components/Button';
import { formatPath } from '../specs/data';

// The command dispatcher: components register handlers for command ids (useCommand), one key
// listener matches key presses against the keymap, and the shortcuts sheet and quick find's
// commands (QuickOpen.tsx) are drawn from the same table. A command only runs (and only shows as
// available in quick find) while something has registered a handler for it, so "when it applies"
// follows what is on screen: the graph's commands exist while a graph is shown. The same listener sends the plain arrow keys,
// and W, A, S and D as Up, Left, Down and Right, to the stage's walk (useStageWalk) from anywhere on the page, except a
// control that uses arrows itself (keymap usesArrows). A plain Enter runs its command (the wiki card) only outside a control
// that handles Enter (keymap usesEnter); Escape runs its command only when nothing took it first: an overlay that closes on
// Escape (a dialog, a menu, a tooltip, a tool panel) calls preventDefault, so the topmost thing closes first.

type Handler = () => void;
/** A stage's walk: takes a plain arrow's key ("ArrowLeft", for W, A, S and D too), moves the focus, and returns what to announce, or null. */
type Walk = (key: string) => string | null;
/** A stage's own meaning for a plain Enter where the walk stands (the Trace stage's "+N more" opens): true when it took it. */
type StageEnter = () => boolean;
type WalkRef = { current: Walk; enter?: StageEnter };
/** A registered handler, and the title it gives its command while mounted ("Switch to Lathe"). */
type HandlerRef = { current: Handler; title?: string };

interface CommandsApi {
  commands: Command[];
  mac: boolean;
  register: (id: string, handler: HandlerRef) => () => void;
  registerWalk: (walk: WalkRef) => () => void;
  run: (id: string) => boolean;
  available: (id: string) => boolean;
  /** The command's title: the one its current handler gives, or the keymap's. */
  titleOf: (c: Command) => string;
  /** Says something to screen readers (a view change, a panel opening). */
  announce: (text: string) => void;
}

const CommandsContext = createContext<CommandsApi | null>(null);

/** The keymap (with overrides) and the platform, for showing shortcuts. Works without a provider. */
export function useKeymap() {
  const api = useContext(CommandsContext);
  const fallback = useMemo(() => ({ commands: resolveCommands({}, isMac()), mac: isMac() }), []);
  return api ? { commands: api.commands, mac: api.mac } : fallback;
}

export interface ShortcutHint {
  /** The first binding as shown: "⌘B", "Ctrl+B", "g then c"; '' when the command has none. */
  text: string;
  /** The first binding as written in the keymap (after overrides), for <Keys>. */
  binding: string;
  /** The value for aria-keyshortcuts, or undefined when no binding can be said that way. */
  aria: string | undefined;
}

/** How a command's shortcut is shown and announced, read from the keymap with its overrides; `nested` reads a graph step's Nested and Voronoi keys. */
export function useShortcutHint(id: string | undefined, nested = false): ShortcutHint {
  const { commands, mac } = useKeymap();
  const command = id ? commands.find((c) => c.id === id) : undefined;
  const keys = (nested ? command?.nestedKeys : undefined) ?? command?.keys ?? [];
  const binding = keys[0] ?? '';
  return { text: binding ? formatBinding(binding, mac) : '', binding, aria: ariaKeyShortcuts(keys, mac) || undefined };
}

/** Registers a handler for a command while the component is mounted (and `enabled`), optionally with its own title. */
export function useCommand(id: string, handler: Handler, enabled = true, title?: string) {
  const api = useContext(CommandsContext);
  const ref = useRef<HandlerRef>({ current: handler, title });
  ref.current.current = handler;
  ref.current.title = title;
  // A layout effect, as the stage walk's, so a stage Suspense hides while the next one loads stops answering its commands
  // at once: React keeps the hidden stage's passive effects, and only its layout effects go.
  useLayoutEffect(() => {
    if (!api || !enabled) return;
    return api.register(id, ref.current);
  }, [api, id, enabled, title]);
}

/**
 * Registers the shown stage's walk while mounted (and `enabled`): the plain arrow keys go to it from anywhere on the
 * page but a control that uses arrows itself, and what it returns is announced. The last one registered walks. `enter`
 * is offered a plain Enter from the same places as the wiki card's toggle, first; when it takes it, the card is left.
 */
export function useStageWalk(walk: Walk, enabled = true, enter?: StageEnter) {
  const api = useContext(CommandsContext);
  const ref = useRef<WalkRef>({ current: walk, enter });
  ref.current.current = walk;
  ref.current.enter = enter;
  // A layout effect, so a stage Suspense hides while the next one loads stops walking at once: React keeps the hidden
  // stage's passive effects, and only its layout effects go.
  useLayoutEffect(() => {
    if (!api || !enabled) return;
    return api.registerWalk(ref.current);
  }, [api, enabled]);
}

export function useAnnounce() {
  const api = useContext(CommandsContext);
  return api?.announce ?? (() => {});
}

/** The keymap with what applies now, for quick find's commands: each command's title, whether it is handled, and running it. */
export function useCommandList() {
  const api = useContext(CommandsContext);
  const keymap = useKeymap();
  return useMemo(() => ({
    commands: keymap.commands,
    mac: keymap.mac,
    available: api?.available ?? (() => false),
    titleOf: api?.titleOf ?? ((c: Command) => c.title),
    run: api?.run ?? (() => false),
  }), [api, keymap]);
}

export function useRunCommand() {
  const api = useContext(CommandsContext);
  return useCallback((id: string) => api?.run(id) ?? false, [api]);
}

const SEQUENCE_WAIT = 1500;

export function CommandsProvider({ children }: { children: ReactNode }) {
  const mac = useMemo(() => isMac(), []);
  const commands = useMemo(() => resolveCommands(readOverrides(), mac), [mac]);
  const handlers = useRef(new Map<string, HandlerRef[]>());
  const walks = useRef<WalkRef[]>([]);
  const [, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<string[]>([]);
  const pendingRef = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheet, setSheet] = useState(false);

  const setPendingKeys = (keys: string[]) => {
    pendingRef.current = keys;
    setPending(keys);
    if (timer.current) clearTimeout(timer.current);
    if (keys.length) timer.current = setTimeout(() => setPendingKeys([]), SEQUENCE_WAIT);
  };

  const register = useCallback((id: string, handler: HandlerRef) => {
    const list = handlers.current.get(id) ?? [];
    handlers.current.set(id, [...list, handler]);
    setVersion((v) => v + 1);
    return () => {
      handlers.current.set(id, (handlers.current.get(id) ?? []).filter((h) => h !== handler));
      setVersion((v) => v + 1);
    };
  }, []);
  const registerWalk = useCallback((walk: WalkRef) => {
    walks.current = [...walks.current, walk];
    return () => { walks.current = walks.current.filter((w) => w !== walk); };
  }, []);
  const available = useCallback((id: string) => (handlers.current.get(id)?.length ?? 0) > 0, []);
  const run = useCallback((id: string) => {
    const list = handlers.current.get(id);
    if (!list?.length) return false;
    list[list.length - 1].current();
    return true;
  }, []);
  const announce = useCallback((text: string) => {
    setMessage('');
    setTimeout(() => setMessage(text), 30);
  }, []);
  const titleOf = useCallback((c: Command) => handlers.current.get(c.id)?.at(-1)?.title ?? c.title, []);
  const api = useMemo(() => ({ commands, mac, register, registerWalk, run, available, titleOf, announce }), [commands, mac, register, registerWalk, run, available, titleOf, announce]);

  // In the desktop app, a native menu choice arrives as a command ID and runs like its keys would (LA-V66-R02).
  useEffect(() => window.latheDesktop?.onCommand((id: string) => { run(id); }), [run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      const chord = eventChord(e);
      const typing = isTyping(e.target);
      const before = pendingRef.current;
      // A plain arrow, or W, A, S or D, walks the stage, wherever keyboard focus is, unless it is in a control that uses
      // arrows itself or the key goes on a sequence already begun.
      const walk = walks.current.at(-1);
      const arrow = walkArrow(chord);
      const continues = before.length > 0 && arrow !== chord && match([...before, chord], commands, mac, available).command !== undefined;
      if (arrow && walk && !usesArrows(e.target) && !continues) {
        e.preventDefault();
        if (before.length) setPendingKeys([]);
        const said = walk.current(arrow);
        if (said) announce(said);
        return;
      }
      if (typing && isSingleKey(chord) && before.length === 0) return;
      // Enter is a control's own where it handles Enter; Escape is a field's own while typing.
      if (chord === 'Enter' && before.length === 0 && usesEnter(e.target)) return;
      // The stage's own Enter where its walk stands comes before the wiki card's.
      if (chord === 'Enter' && before.length === 0 && walk?.enter?.()) { e.preventDefault(); return; }
      if (chord === 'Escape' && typing) return;
      let result = match([...before, chord], commands, mac, available);
      // A key that does not continue the sequence starts afresh.
      if (!result.command && !result.pending && before.length) result = match([chord], commands, mac, available);
      if (result.command) {
        if (typing && isSingleKey(chord)) { setPendingKeys([]); return; }
        e.preventDefault();
        setPendingKeys([]);
        run(result.command.id);
      } else if (result.pending && !typing) {
        e.preventDefault();
        setPendingKeys(before.length && match([...before, chord], commands, mac, available).pending ? [...before, chord] : [chord]);
      } else if (before.length) {
        setPendingKeys([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commands, mac, available, run, announce]);

  return (
    <CommandsContext.Provider value={api}>
      <ProviderCommands openSheet={() => setSheet(true)} />
      {children}
      <div className="sr-only" role="status" aria-live="polite" data-testid="announcer">{message}</div>
      {pending.length > 0 && <div className="key-pending" aria-hidden="true">{pending.join(' ')}…</div>}
      {sheet && <ShortcutSheet commands={commands} mac={mac} available={available} titleOf={titleOf} onClose={() => setSheet(false)} />}
    </CommandsContext.Provider>
  );
}

function ProviderCommands({ openSheet }: { openSheet: () => void }) {
  useCommand('showShortcuts', openSheet);
  return null;
}

// ---------- Dialogs ----------

/** A modal dialog: focus goes into it, Tab stays inside, Escape or a click outside closes it, and focus goes back. */
export function Dialog({ label, onClose, children, className, backdropClassName }: { label: string; onClose: () => void; children: ReactNode; className?: string; backdropClassName?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input, button')?.focus();
    return () => { if (before?.isConnected) before.focus(); };
  }, []);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    if (e.key === 'Tab' && box.current) {
      const items = [...box.current.querySelectorAll<HTMLElement>('input, button, [href], [tabindex="0"]')];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  return (
    <div className={`dialog-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className={`dialog ${className ?? ''}`} role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}

/** A binding in <kbd> styling: "⌘⇧P", "Ctrl+Shift+P", "g then c". */
export function Keys({ binding, mac, className }: { binding: string; mac: boolean; className?: string }) {
  return <kbd className={`kbd${className ? ` ${className}` : ''}`}>{formatBinding(binding, mac)}</kbd>;
}

interface ListProps {
  commands: Command[];
  mac: boolean;
  available: (id: string) => boolean;
  titleOf: (c: Command) => string;
  onClose: () => void;
}

function ShortcutSheet({ commands, mac, available, titleOf, onClose }: ListProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const id = useId();
  const shown = commands.filter((c) => c.keys.length > 0 && (!c.dynamic || available(c.id)) && (!q || titleOf(c).toLowerCase().includes(q) || [...c.keys, ...(c.nestedKeys ?? [])].some((k) => formatBinding(k, mac).toLowerCase().includes(q))));
  return (
    <Dialog label="Keyboard shortcuts" onClose={onClose} className="shortcut-sheet">
      <div className="dialog-head">
        <h2 id={id}>Keyboard shortcuts</h2>
        <Button variant="icon" label="Close" onClick={onClose}>×</Button>
      </div>
      <input type="search" className="dialog-search" aria-label="Search shortcuts" placeholder="Search shortcuts" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="shortcut-groups" tabIndex={0} role="region" aria-label="Shortcuts">
        {GROUPS.map((g) => {
          const rows = shown.filter((c) => c.group === g);
          if (rows.length === 0) return null;
          return (
            <section key={g} aria-label={g}>
              <h3>{g}</h3>
              <table className="shortcut-table">
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">{titleOf(c)}</th>
                      <td>
                        {c.keys.map((k, i) => <span key={k}>{i > 0 && <span className="kbd-or"> or </span>}<Keys binding={k} mac={mac} /></span>)}
                        {/* A graph step's keys differ by view: the Tree view's, then the Nested and Voronoi views'. */}
                        {c.nestedKeys && <>
                          <span className="kbd-or"> in Tree, </span>
                          {c.nestedKeys.map((k, i) => <span key={k}>{i > 0 && <span className="kbd-or"> or </span>}<Keys binding={k} mac={mac} /></span>)}
                          <span className="kbd-or"> in Nested and Voronoi</span>
                        </>}
                      </td>
                      <td className="cmd-id"><code>{c.id}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
        {shown.length === 0 && <p className="hint">No shortcut matches “{query.trim()}”.</p>}
      </div>
      <p className="hint shortcut-note">
        To change a shortcut, put a JSON map of command to keys in local storage under <code>{OVERRIDES_KEY}</code>, for
        example <code>{'{"toggleNav": "Mod+J"}'}</code> (Mod is {mac ? '⌘' : 'Ctrl'}), and reload. Each command's name is in the last column.
      </p>
      <p className="hint shortcut-note">
        How records are written, and every kind and check: <Link to={formatPath} onClick={onClose}>Record format</Link>.
      </p>
    </Dialog>
  );
}

declare global {
  interface Window {
    /** Set by the desktop app's preload (desktop/src/preload.cts); absent in a browser. */
    latheDesktop?: LatheDesktop;
  }

  /** The desktop app's bridge (desktop/src/preload.cts), built with the app: every member is there. */
  interface LatheDesktop {
    isDesktop: boolean;
    /** The operating system: "darwin", "win32" or "linux". */
    platform: string;
    /** Subscribes to native menu choices, each a command ID; returns the unsubscribe. */
    onCommand: (listener: (id: string) => void) => () => void;
    /** Sends the theme's shell and ink for the window's chrome. */
    setChrome: (chrome: { background: string; foreground: string }) => void;
    /** Subscribes to the window entering and leaving full screen; called at once with the current state. */
    onFullScreen: (listener: (fullScreen: boolean) => void) => () => void;
    /** Sets the Dock badge to the product's number of check errors (LA-V71-R03). */
    setErrorCount: (count: number) => void;
    /** The record actions (LA-AUT-UC15-R01): reveal its data file, open it in the editor, copy its ID, or a native menu of the three. */
    revealRecord: (id: string) => void;
    openRecordInEditor: (id: string) => void;
    copyRecordId: (id: string) => void;
    showRecordMenu: (id: string) => void;
    /** The chat panel's Claude Code (LA-PLT-UC19). */
    chat: import('../chat/types').ChatBridge;
    /** Answers the app bridge's questions for Lathe's MCP tools: what the Reader is looking at, and opening a record. */
    onAppRequest: (handler: (request: import('../chat/types').AppRequest) => unknown) => () => void;
  }
}
