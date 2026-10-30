import {
  Fragment,
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
  ariaKeyShortcuts,
  eventChord,
  formatBinding,
  holderOf,
  isMac,
  isSingleKey,
  isTyping,
  match,
  normalizeBinding,
  resolveCommands,
  usesArrows,
  usesEnter,
  walkMove,
  type Command,
} from './keymap';
import { RuleBroken, useAggregate } from './prefs';
import { keyBindingsRepository } from '../platform/key-bindings/repository';
import { keymapReader } from '../platform/key-bindings/reader';
import { listKeyboardCommands } from '../platform/key-bindings/queries';
import type { KeymapEntry } from '../platform/key-bindings/read-model';
import { bindKey } from '../platform/key-bindings/commands/bind-key';
import { removeBinding } from '../platform/key-bindings/commands/remove-binding';
import { resetShortcut } from '../platform/key-bindings/commands/reset-shortcut';
import { resetAllShortcuts } from '../platform/key-bindings/commands/reset-all-shortcuts';
import type { Move } from '../views/levels';
import { Link } from '../router';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { formatPath } from '../format/reference';
import { useOverlayFocus } from '../views/overlays';

// The command dispatcher: components register handlers for command ids (useCommand), one key
// listener matches key presses against the keymap, and the shortcuts sheet and quick find's
// commands (QuickOpen.tsx) are drawn from the same table, with the person's own keys (the Key bindings, edited in the
// sheet). A command only runs (and only shows as available in quick find) while something has registered a handler for
// it, so "when it applies" follows what is on screen: the graph's commands exist while a graph is shown. The same listener
// sends the walk's keys (by default the plain arrow keys, W, A, S and D and vim's H, J, K and L as the arrows, and
// Shift+Up and Shift+Down as Out and In) to the stage's walk (useStageWalk, keymap walkMove) from anywhere on the page,
// except a control that uses arrows itself (keymap usesArrows); the stage toolbar's buttons run the same walk (useRunWalk). A plain Enter runs its command (the wiki card) only outside a control
// that handles Enter (keymap usesEnter); Escape runs its command only when nothing took it first: an overlay that closes on
// Escape (a dialog, a menu, a tooltip, a tool panel) calls preventDefault, so the topmost thing closes first.

type Handler = () => void;
/** A stage's walk: takes a move (an arrow, for W, A, S and D too, or Out and In), moves the focus, and returns what to announce, or null. */
type Walk = (move: Move) => string | null;
/** A stage's own meaning for a plain Enter where the walk stands (the Trace stage's link or file opens its record): true when it took it. */
type StageEnter = () => boolean;
type WalkRef = { current: Walk; enter?: StageEnter };
/** A registered handler, and the title it gives its command while mounted ("Switch to Lathe"). */
type HandlerRef = { current: Handler; title?: string };

interface CommandsApi {
  commands: KeymapEntry[];
  mac: boolean;
  register: (id: string, handler: HandlerRef) => () => void;
  registerWalk: (walk: WalkRef) => () => void;
  run: (id: string) => boolean;
  /** Runs a move of the shown stage's walk and announces it; false when no stage walks. */
  walk: (move: Move) => boolean;
  available: (id: string) => boolean;
  /** The command's title: the one its current handler gives, or the keymap's. */
  titleOf: (c: Command) => string;
  /** Says something to screen readers (a view change, a panel opening). */
  announce: (text: string) => void;
}

const CommandsContext = createContext<CommandsApi | null>(null);

/** The keymap (with the person's keys) and the platform, for showing shortcuts. Works without a provider. */
export function useKeymap() {
  const api = useContext(CommandsContext);
  const fallback = useMemo(() => ({ commands: resolveCommands({}, isMac()), mac: isMac() }), []);
  return api ? { commands: api.commands, mac: api.mac } : fallback;
}

export interface ShortcutHint {
  /** The first binding as shown: "⌘B", "Ctrl+B", "g then c"; '' when the command has none. */
  text: string;
  /** The first binding as written in the keymap (the person's keys), for <Keys>. */
  binding: string;
  /** The value for aria-keyshortcuts, or undefined when no binding can be said that way. */
  aria: string | undefined;
}

/** How a command's shortcut is shown and announced, read from the keymap with the person's keys. */
export function useShortcutHint(id: string | undefined): ShortcutHint {
  const { commands, mac } = useKeymap();
  const command = id ? commands.find((c) => c.id === id) : undefined;
  const keys = command?.keys ?? [];
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

/** Runs a move of the shown stage's walk, as its keys do, and announces it: the stage toolbar's step, Out and In buttons. */
export function useRunWalk() {
  const api = useContext(CommandsContext);
  return useCallback((move: Move) => api?.walk(move) ?? false, [api]);
}

const SEQUENCE_WAIT = 1500;

export function CommandsProvider({ children }: { children: ReactNode }) {
  const mac = useMemo(() => isMac(), []);
  const bindings = useAggregate(keyBindingsRepository);
  const commands = useMemo(() => listKeyboardCommands(keymapReader({ changed: bindings.changed, mac })), [bindings, mac]);
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
  const walk = useCallback((move: Move) => {
    const shown = walks.current.at(-1);
    if (!shown) return false;
    const said = shown.current(move);
    if (said) announce(said);
    return true;
  }, [announce]);
  const api = useMemo(() => ({ commands, mac, register, registerWalk, run, walk, available, titleOf, announce }), [commands, mac, register, registerWalk, run, walk, available, titleOf, announce]);

  // In the desktop app, a native menu choice arrives as a command ID and runs like its keys would (LA-V66-R02), and the
  // menu shows the person's keys (LA-V66-R03), sent as they change; the shell keeps each window's own.
  useEffect(() => window.latheDesktop?.onCommand((id: string) => { run(id); }), [run]);
  useEffect(() => {
    window.latheDesktop?.setMenuKeys(Object.fromEntries(commands.map((c) => [c.id, c.keys.map((k) => normalizeBinding(k, mac))])));
  }, [commands, mac]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      const chord = eventChord(e);
      const typing = isTyping(e.target);
      const before = pendingRef.current;
      // A walk key walks the stage, wherever keyboard focus is, unless it is in a control that uses arrows itself (every
      // field that takes text among them, so a letter typed there stays text) or the key goes on a sequence already begun.
      const walk = walks.current.at(-1);
      const move = walkMove(chord, commands, mac);
      const continues = before.length > 0 && !chord.includes('Arrow') && match([...before, chord], commands, mac, available).command !== undefined;
      if (move && walk && !usesArrows(e.target) && !continues) {
        e.preventDefault();
        if (before.length) setPendingKeys([]);
        const said = walk.current(move);
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
      {sheet && <ShortcutSheet commands={commands} mac={mac} available={available} titleOf={titleOf} announce={announce} onClose={() => setSheet(false)} />}
    </CommandsContext.Provider>
  );
}

function ProviderCommands({ openSheet }: { openSheet: () => void }) {
  useCommand('showShortcuts', openSheet);
  return null;
}

// ---------- Dialogs ----------

/** A modal dialog: focus goes into it, Tab stays inside, Escape or a click outside closes it, and focus goes back (views/overlays.ts). */
export function Dialog({ label, onClose, children, className, backdropClassName }: { label: string; onClose: () => void; children: ReactNode; className?: string; backdropClassName?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useOverlayFocus(box, 'input, button, [href]');
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


// ---------- The shortcuts sheet, where a person binds keys ----------

interface SheetProps {
  commands: KeymapEntry[];
  mac: boolean;
  available: (id: string) => boolean;
  titleOf: (c: Command) => string;
  announce: (text: string) => void;
  onClose: () => void;
}

/** What a row asks after a refusal: Swap or Cancel for a key another shortcut has, a choice to leave a shortcut without a key, or a reason. */
type Offer =
  | { kind: 'swap'; id: string; key: string; replacing?: string; message: string }
  | { kind: 'unbind'; id: string; key: string; message: string }
  | { kind: 'refused'; id: string; message: string };

/** Where a row's recording is: a new key beside its keys, or in place of one. */
interface Recording { id: string; replacing?: string }

const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn'];

/**
 * The control that records a key: it takes focus, and the next key pressed with it (with its modifiers) is the new key.
 * Escape cancels, as does Tab or leaving it, so the keyboard is never trapped; nothing it takes reaches a command.
 */
function KeyRecorder({ title, replacing, mac, onKey, onCancel }: { title: string; replacing?: string; mac: boolean; onKey: (chord: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const label = `Press a key for ${title}${replacing ? `, in place of ${formatBinding(replacing, mac)}` : ''}. Escape cancels.`;
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Tab') { onCancel(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (MODIFIER_KEYS.includes(e.key)) return;
    if (e.key === 'Escape') { onCancel(); return; }
    onKey(eventChord(e.nativeEvent));
  };
  return (
    <Button ref={ref} className="key-recorder" aria-label={label} data-recording="" onKeyDown={onKeyDown} onBlur={onCancel}>
      Press a key… <span className="key-recorder-hint">Esc cancels</span>
    </Button>
  );
}

function ShortcutSheet({ commands, mac, available, titleOf, announce, onClose }: SheetProps) {
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState<Recording | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [askResetAll, setAskResetAll] = useState(false);
  const q = query.trim().toLowerCase();
  const id = useId();
  const shown = commands.filter((c) => (!c.dynamic || available(c.id)) && (c.keys.length > 0 || c.customizable) && (!q || titleOf(c).toLowerCase().includes(q) || c.keys.some((k) => formatBinding(k, mac).toLowerCase().includes(q))));
  const changed = commands.filter((c) => c.changed).length;
  const shownKey = (k: string) => formatBinding(k, mac);
  const titleById = (shortcut: string) => titleOf(commands.find((c) => c.id === shortcut)!);
  /** After a row's change, focus goes back to its Add key button (or the sheet's search when the row is gone). */
  const refocus = (shortcut: string) => setTimeout(() => (document.querySelector<HTMLElement>(`.shortcut-sheet [data-shortcut="${shortcut}"] .shortcut-add`) ?? document.querySelector<HTMLElement>('.shortcut-sheet .dialog-search'))?.focus(), 0);
  /** Runs a change; a refusal becomes the row's offer, the swap or unbind one when it is that. */
  const attempt = (shortcut: string, change: () => void, said: string, refused: (e: RuleBroken) => Offer) => {
    try {
      change();
      setOffer(null);
      announce(said);
      refocus(shortcut);
    } catch (e) {
      if (!(e instanceof RuleBroken)) throw e;
      setOffer(refused(e));
    }
  };
  const reason = (shortcut: string) => (e: RuleBroken): Offer => ({ kind: 'refused', id: shortcut, message: e.problems.map((p) => p.message).join(' ') });
  const record = (shortcut: string, key: string, replacing?: string) => {
    setRecording(null);
    const holder = holderOf(commands, shortcut, key, mac);
    attempt(shortcut, () => bindKey({ shortcut, key, replacing, mac }), `${titleById(shortcut)}: ${shownKey(key)}`, (e) =>
      holder && e.problems.every((p) => p.rule === 'key-free-where-it-applies') && normalizeBinding(key, mac) !== ''
        ? { kind: 'swap', id: shortcut, key, replacing, message: `${shownKey(key)} is already “${titleOf(holder)}”.` }
        : reason(shortcut)(e));
  };
  const swap = (o: Extract<Offer, { kind: 'swap' }>) =>
    attempt(o.id, () => bindKey({ shortcut: o.id, key: o.key, replacing: o.replacing, swap: true, mac }), `${titleById(o.id)}: ${shownKey(o.key)}, swapped`, reason(o.id));
  const remove = (shortcut: string, key: string, unbind = false) =>
    attempt(shortcut, () => removeBinding({ shortcut, key, unbind, mac }), `${shownKey(key)} removed from ${titleById(shortcut)}`, (e) =>
      e.problems.every((p) => p.rule === 'shortcut-keeps-a-key') ? { kind: 'unbind', id: shortcut, key, message: `“${titleById(shortcut)}” would have no key.` } : reason(shortcut)(e));
  const reset = (shortcut: string) => attempt(shortcut, () => resetShortcut({ shortcut, mac }), `${titleById(shortcut)} reset to its own keys`, reason(shortcut));
  const cancel = (shortcut: string) => { setOffer(null); refocus(shortcut); };
  const onOfferKey = (shortcut: string) => (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(shortcut); }
  };
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
                  {rows.map((c) => {
                    const title = titleOf(c);
                    const mine = offer?.id === c.id ? offer : null;
                    return (
                      <tr key={c.id} data-shortcut={c.id} data-changed={c.changed ? '' : undefined}>
                        <th scope="row">{title}</th>
                        <td className="shortcut-keys">
                          <div className="shortcut-key-list">
                            {c.keys.map((k, i) => (
                              <Fragment key={k}>
                                {i > 0 && <span className="kbd-or"> or </span>}
                                {recording?.id === c.id && recording.replacing === k ? (
                                  <KeyRecorder title={title} replacing={k} mac={mac} onKey={(chord) => record(c.id, chord, k)} onCancel={() => setRecording(null)} />
                                ) : c.customizable ? (
                                  <span className="shortcut-key">
                                    <Button className="shortcut-key-change" aria-label={`Change ${shownKey(k)} of ${title}`} onClick={() => { setOffer(null); setRecording({ id: c.id, replacing: k }); }}><Keys binding={k} mac={mac} /></Button>
                                    <Button variant="icon" className="shortcut-key-remove" label={`Remove ${shownKey(k)} from ${title}`} onClick={() => remove(c.id, k)}><Icon name="x" size={12} /></Button>
                                  </span>
                                ) : <Keys binding={k} mac={mac} />}
                              </Fragment>
                            ))}
                            {c.keys.length === 0 && <span className="shortcut-none">No key</span>}
                            {recording?.id === c.id && recording.replacing === undefined && (
                              <KeyRecorder title={title} mac={mac} onKey={(chord) => record(c.id, chord)} onCancel={() => setRecording(null)} />
                            )}
                            {c.customizable && !(recording?.id === c.id && recording.replacing === undefined) && (
                              <Button className="shortcut-add" icon="plus" aria-label={`Add a key to ${title}`} onClick={() => { setOffer(null); setRecording({ id: c.id }); }}>Key</Button>
                            )}
                            {c.changed && <Button className="shortcut-reset" aria-label={`Reset ${title}`} onClick={() => reset(c.id)}>Reset</Button>}
                            {!c.customizable && <span className="shortcut-fixed">{c.browser ? 'The browser’s' : 'Fixed'}</span>}
                          </div>
                          {mine && (
                            <div className="shortcut-offer" role="alert" onKeyDown={onOfferKey(c.id)}>
                              <span>{mine.message}</span>
                              {mine.kind === 'swap' && <Button variant="primary" autoFocus onClick={() => swap(mine)}>Swap</Button>}
                              {mine.kind === 'unbind' && <Button variant="primary" autoFocus onClick={() => remove(c.id, mine.key, true)}>Leave without a key</Button>}
                              <Button autoFocus={mine.kind === 'refused'} onClick={() => cancel(c.id)}>{mine.kind === 'refused' ? 'OK' : 'Cancel'}</Button>
                            </div>
                          )}
                        </td>
                        <td className="cmd-id"><code>{c.id}</code></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
        {shown.length === 0 && <p className="hint">No shortcut matches “{query.trim()}”.</p>}
      </div>
      <div className="shortcut-foot">
        <p className="hint shortcut-note">
          Choose a key to change it, or add one; press the new key, Escape cancels. How records are written, and every kind and
          check: <Link to={formatPath} onClick={onClose}>Record format</Link>.
        </p>
        {askResetAll ? (
          <div className="shortcut-offer" role="alert" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAskResetAll(false); } }}>
            <span>Give all {changed} changed shortcuts their own keys again?</span>
            <Button variant="primary" autoFocus onClick={() => { resetAllShortcuts({ mac }); setAskResetAll(false); setOffer(null); announce('Every shortcut has its own keys again'); }}>Reset all</Button>
            <Button onClick={() => setAskResetAll(false)}>Cancel</Button>
          </div>
        ) : (
          <Button className="shortcut-reset-all" disabled={changed === 0} onClick={() => setAskResetAll(true)}>Reset all</Button>
        )}
      </div>
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
    /** Sends each command's keys as the person bound them, by command ID, for the native menu's key labels (LA-V66-R03). */
    setMenuKeys: (keys: Record<string, string[]>) => void;
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
