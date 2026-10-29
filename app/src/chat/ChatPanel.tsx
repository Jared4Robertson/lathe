import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { ResizeHandle } from '../components/ResizeHandle';
import { CHAT_DEFAULT, CHAT_MAX, CHAT_MIN } from '../graph/settings';
import { Link } from '../router';
import { useAnnounce } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import type { SpecIndex } from '../specs/data';
import { Markdown } from '../specs/Markdown';
import { proseLinks } from '../specs/mentions';
import { addressOf } from '../views/address';
import { diffIndexes, type RecordDiff } from './diff';
import type { ChatBridge, ChatItem, ChatSessions, OpenChoice, SessionSummary } from './types';
import { useChat, type Turn } from './useChat';
import './ChatPanel.css';

// The chat panel (LA-PLT-UC19, LA-V99): the desktop app's conversation with the Owner's own Claude
// Code, floating at the right over the stage as a frosted panel, so the stage frames its focus in
// what the panel leaves (views/openSpace.ts). Its head names the session and opens the session
// picker (resume, fork or start one), the help and the hide button; the log shows the conversation:
// the Owner's messages, Claude's answers as Markdown whose record IDs open the record on the stage,
// each tool call as a row that expands to its input and result, each permission prompt with Allow
// once and Deny, notices, and after each turn the records it changed, as diffs. The composer at its
// foot sends a message (Enter; Shift+Enter for a new line) and becomes Stop while Claude works
// (Escape stops too). Up and Down walk the messages in the log; Home and End go to its ends.
// The shell runs the CLI (desktop/src/chatSession.ts); the panel only draws and asks.

export interface ChatPanelProps {
  bridge: ChatBridge;
  /** The whole workspace's specs: record links and diffs read them. */
  index: SpecIndex | null;
  width: number | null;
  onWidth: (width: number | null) => void;
  onClose: () => void;
  /** The message box, for the toggle command to focus. */
  input: RefObject<HTMLTextAreaElement | null>;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
/** "5 minutes ago", "yesterday", or a date for anything older than a week. */
export function sessionDate(updated: number, now = Date.now()): string {
  const minutes = Math.round((updated - now) / 60_000);
  if (minutes > -60) return relative.format(Math.min(minutes, 0), 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (days > -7) return relative.format(days, 'day');
  return new Date(updated).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

const busy = (status: string) => status === 'running' || status === 'stopping';

export function ChatPanel({ bridge, index, width, onWidth, onClose, input }: ChatPanelProps) {
  const { view, send, answer, stop } = useChat(bridge, index);
  const announce = useAnnounce();
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [sessions, setSessions] = useState<ChatSessions | null>(null);
  const [draft, setDraft] = useState('');
  const working = busy(view.status);
  const panel = useRef<HTMLElement>(null);

  // The picker shows until a session is open, and whenever the Owner asks for it.
  const showPicker = picker || !view.open;
  const loadSessions = useCallback(() => { void bridge.sessions().then(setSessions); }, [bridge]);
  useEffect(() => { if (showPicker) loadSessions(); }, [showPicker, loadSessions]);

  const choose = useCallback(async (choice: OpenChoice) => {
    const ok = await bridge.open(choice);
    if (!ok) { announce('Claude Code could not open that session.'); loadSessions(); return; }
    setPicker(false);
    announce(choice.mode === 'new' ? 'New session' : choice.mode === 'fork' ? 'Forked the session' : 'Session resumed');
    setTimeout(() => input.current?.focus(), 0);
  }, [bridge, announce, loadSessions, input]);

  // Claude's turn ending, and a permission prompt arriving, are said aloud; the streamed text is not.
  const wasBusy = useRef(working);
  useEffect(() => {
    if (wasBusy.current && !working) announce('Claude finished');
    wasBusy.current = working;
  }, [working, announce]);
  const pending = view.items.filter((i) => i.kind === 'permission' && i.answer === 'pending').length;
  useEffect(() => { if (pending) announce('Claude asks for permission'); }, [pending, announce]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || working) return;
    if (!view.open && !(await bridge.open({ mode: 'new' }))) { announce('Claude Code could not start.'); return; }
    setPicker(false);
    if (await send(text)) setDraft('');
  };
  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };
  // Escape anywhere in the panel stops Claude's turn.
  const onPanelKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && working && !e.defaultPrevented) { e.preventDefault(); void stop(); announce('Stopping'); }
  };

  const current = sessions?.sessions.find((s) => s.id === view.sessionId);
  const title = view.open ? current?.title ?? (view.sessionId ? 'This session' : 'New session') : 'Claude';
  const rest = width ?? CHAT_DEFAULT;

  return (
    <aside ref={panel} id="chat-panel" className="chat-panel" data-floating="right" aria-label="Chat with Claude" onKeyDown={onPanelKey}>
      <ResizeHandle
        className="chat-handle"
        label="Resize the chat"
        side="after"
        value={rest}
        min={CHAT_MIN}
        max={CHAT_MAX}
        step={16}
        bigStep={64}
        valueAt={(x) => (panel.current?.getBoundingClientRect().right ?? x) - x}
        onChange={onWidth}
        onReset={() => onWidth(null)}
        collapseBelow={200}
        onCollapse={onClose}
      />
      <div className="chat-head">
        <h2 className="chat-title">
          <Icon name="chat" size={16} />
          <span className="chat-title-text">{title}</span>
        </h2>
        <div className="chat-head-actions">
          {view.open && (
            <Tooltip label="Sessions" placement="bottom">
              <Button variant="icon" label="Sessions" aria-expanded={showPicker} aria-controls="chat-sessions" className={showPicker ? 'is-on' : undefined} onClick={() => setPicker(!picker)}>
                <Icon name="history" size={16} />
              </Button>
            </Tooltip>
          )}
          {!showPicker && (
            <Tooltip label="New session" placement="bottom">
              <Button variant="icon" label="New session" disabled={working} onClick={() => void choose({ mode: 'new' })}>
                <Icon name="plus" size={16} />
              </Button>
            </Tooltip>
          )}
          <Tooltip label="What the chat can do" placement="bottom">
            <Button variant="icon" label="What the chat can do" aria-expanded={help} aria-controls="chat-help" className={help ? 'is-on' : undefined} onClick={() => setHelp(!help)}>
              <Icon name="help" size={16} />
            </Button>
          </Tooltip>
          <Tooltip label="Hide the chat" command="toggleChat" placement="left">
            <Button variant="icon" label="Hide the chat" onClick={onClose}>
              <Icon name="x" size={16} />
            </Button>
          </Tooltip>
        </div>
      </div>
      {help && <ChatHelp />}
      {showPicker
        ? <SessionPicker sessions={sessions} current={view.sessionId} busy={working} onChoose={(c) => void choose(c)} />
        : <ChatLog items={view.items} turns={view.turns} index={index} answer={answer} />}
      <div className="chat-status" aria-live="polite">
        {working ? (view.status === 'stopping' ? 'Stopping…' : 'Claude is working…') : view.open && view.status === 'closed' ? 'Claude Code is not running; your next message starts it again.' : ''}
      </div>
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <textarea
          ref={input}
          className="chat-input"
          aria-label="Message Claude"
          placeholder={view.open ? 'Ask Claude…' : 'Ask Claude, in a new session…'}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onComposerKey}
        />
        {working ? (
          <Tooltip label="Stop (Escape)" placement="left">
            <Button variant="icon" label="Stop" className="chat-stop" disabled={view.status === 'stopping'} onClick={() => { void stop(); announce('Stopping'); }}>
              <Icon name="stop" size={16} />
            </Button>
          </Tooltip>
        ) : (
          <Tooltip label="Send (Enter)" placement="left">
            <Button variant="icon" type="submit" label="Send" className="chat-send" disabled={!draft.trim()}>
              <Icon name="send" size={16} />
            </Button>
          </Tooltip>
        )}
      </form>
    </aside>
  );
}

/** What works in the chat, and what is not supported yet. */
function ChatHelp() {
  return (
    <section id="chat-help" className="chat-help" aria-label="What the chat can do">
      <p>This is your own Claude Code, working in this product's folder with your login, settings, skills, plugins and <code>CLAUDE.md</code>. Record IDs in its answers open the record on the stage; it can see what you are looking at and open records here.</p>
      <p>Slash commands go to Claude Code as text: those it runs without a dialog, such as <code>/compact</code> or a skill's own command, work.</p>
      <p>Not supported in the chat yet:</p>
      <ul>
        <li>Slash commands that open a dialog, such as <code>/model</code>, <code>/config</code> or <code>/resume</code> (use the session picker).</li>
        <li>Plan mode's approval of a plan.</li>
        <li>Claude's question cards with choices.</li>
        <li>Permission rules (always allow): each prompt is allowed once or denied.</li>
      </ul>
    </section>
  );
}

// ---------- The session picker ----------

function SessionPicker({ sessions, current, busy, onChoose }: { sessions: ChatSessions | null; current: string | null; busy: boolean; onChoose: (choice: OpenChoice) => void }) {
  const [warning, setWarning] = useState<SessionSummary | null>(null);
  const resume = (s: SessionSummary) => (s.openElsewhere ? setWarning(s) : onChoose({ mode: 'resume', id: s.id }));
  return (
    <section id="chat-sessions" className="chat-sessions" aria-labelledby="chat-sessions-title">
      <div className="chat-sessions-head">
        <h3 id="chat-sessions-title" className="chat-section-title">Sessions in this folder</h3>
        <Button variant="primary" icon="plus" disabled={busy || sessions?.claude === null} onClick={() => onChoose({ mode: 'new' })}>New session</Button>
      </div>
      {sessions === null && <p className="hint">Reading the sessions…</p>}
      {sessions?.claude === null && (
        <p className="chat-missing" role="alert">
          Lathe could not find Claude Code{sessions.configured ? ' where settings.json says it is' : ''}. Install it, or give its path as <code>claudePath</code> in Lathe's <code>settings.json</code> (File › Open Records In › Edit Settings File).
        </p>
      )}
      {warning && (
        <div className="chat-warning" role="alert">
          <p>
            <strong>{warning.title}</strong> {warning.openElsewhere === 'running' ? 'is open in another Claude client now' : 'was written to in the last minute, so it may be open in another Claude client'}.
            Two clients writing one transcript can tangle it; a fork continues a copy and leaves the original alone.
          </p>
          <div className="chat-warning-actions">
            <Button variant="primary" icon="fork" onClick={() => { setWarning(null); onChoose({ mode: 'fork', id: warning.id }); }}>Fork instead</Button>
            <Button onClick={() => { setWarning(null); onChoose({ mode: 'resume', id: warning.id }); }}>Resume anyway</Button>
            <Button onClick={() => setWarning(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {sessions && sessions.sessions.length === 0 && sessions.claude !== null && <p className="hint">No saved sessions in this folder yet.</p>}
      {sessions && sessions.sessions.length > 0 && (
        <ul className="chat-session-list">
          {sessions.sessions.map((s) => (
            <li key={s.id} className={`chat-session${s.id === current ? ' is-current' : ''}`}>
              <button type="button" className="chat-session-open" disabled={busy} aria-current={s.id === current ? 'true' : undefined} onClick={() => resume(s)}>
                <span className="chat-session-title">{s.title}</span>
                <span className="chat-session-meta">
                  <time dateTime={new Date(s.updated).toISOString()}>{sessionDate(s.updated)}</time>
                  {s.openElsewhere && <span className="chat-session-elsewhere">{s.openElsewhere === 'running' ? 'Open elsewhere' : 'Just written'}</span>}
                </span>
              </button>
              <Tooltip label={`Fork ${s.title}`} placement="left">
                <Button variant="icon" label={`Fork ${s.title}`} disabled={busy} onClick={() => onChoose({ mode: 'fork', id: s.id })}>
                  <Icon name="fork" size={16} />
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- The log ----------

function ChatLog({ items, turns, index, answer }: { items: ChatItem[]; turns: Turn[]; index: SpecIndex | null; answer: (id: string, allow: boolean) => Promise<boolean> }) {
  const log = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  // The log stays at its foot while Claude writes, unless the Owner has scrolled up.
  const stuck = useRef(true);
  useLayoutEffect(() => {
    const el = log.current;
    if (el && stuck.current) el.scrollTop = el.scrollHeight;
  });
  const onScroll = () => {
    const el = log.current;
    if (el) stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  // The turns' changes, each placed after the turn's last item.
  const blocks = new Map<number, Turn>();
  turns.forEach((t, n) => blocks.set((turns[n + 1]?.start ?? items.length) - 1, t));
  const focusable = items.length ? (active && items.some((i) => i.id === active) ? active : items[items.length - 1].id) : null;

  // Up and Down walk the messages; Home and End go to the first and last.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const messages = [...(log.current?.querySelectorAll<HTMLElement>(':scope > .chat-item') ?? [])];
    const at = messages.findIndex((m) => m === document.activeElement);
    if (at < 0 || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? messages.length - 1 : Math.max(0, Math.min(messages.length - 1, at + (e.key === 'ArrowUp' ? -1 : 1)));
    messages[next].focus();
    setActive(messages[next].dataset.item ?? null);
  };

  return (
    <div ref={log} className="chat-log" role="log" data-arrows="own" aria-label="Conversation" aria-live="off" onScroll={onScroll} onKeyDown={onKey}>
      {items.length === 0 && <p className="hint chat-empty">Ask Claude about this product, or to change it. It works through Lathe's tools, and you see each change here.</p>}
      {items.map((item, n) => (
        <ItemWithChanges key={item.id} item={item} index={index} answer={answer} tabIndex={item.id === focusable ? 0 : -1} onFocus={setActive} turn={blocks.get(n)} />
      ))}
    </div>
  );
}

function ItemWithChanges({ item, index, answer, tabIndex, onFocus, turn }: { item: ChatItem; index: SpecIndex | null; answer: (id: string, allow: boolean) => Promise<boolean>; tabIndex: number; onFocus: (id: string) => void; turn?: Turn }) {
  return (
    <>
      <ChatEntry item={item} index={index} answer={answer} tabIndex={tabIndex} onFocus={onFocus} />
      {turn && index && <TurnChanges before={turn.before} after={turn.after ?? index} />}
    </>
  );
}

const WHO: Record<ChatItem['kind'], string> = { user: 'You', assistant: 'Claude', tool: 'Tool call', permission: 'Permission', notice: 'Notice' };

const ChatEntry = memo(function ChatEntry({ item, index, answer, tabIndex, onFocus }: { item: ChatItem; index: SpecIndex | null; answer: (id: string, allow: boolean) => Promise<boolean>; tabIndex: number; onFocus: (id: string) => void }) {
  const common = { className: `chat-item is-${item.kind}`, 'data-item': item.id, tabIndex, onFocus: (e: { target: EventTarget; currentTarget: EventTarget }) => { if (e.target === e.currentTarget) onFocus(item.id); } };
  switch (item.kind) {
    case 'user':
      return <article {...common} aria-label={WHO.user}><p className="chat-user-text">{item.text}</p></article>;
    case 'assistant':
      return (
        <article {...common} aria-label={WHO.assistant} aria-busy={item.streaming || undefined}>
          <AssistantText text={item.text} index={index} />
        </article>
      );
    case 'tool':
      return <article {...common} aria-label={`${WHO.tool}: ${item.label}`}><ToolRow item={item} /></article>;
    case 'permission':
      return <article {...common} aria-label={`${WHO.permission}: ${item.label}`}><PermissionPrompt item={item} answer={answer} /></article>;
    case 'notice':
      return <article {...common} aria-label={WHO.notice}><p className={`chat-notice${item.tone === 'error' ? ' is-error' : ''}`}>{item.text}</p></article>;
  }
});

/** Claude's text as Markdown, each record ID it names a link that opens the record on the stage. */
function AssistantText({ text, index }: { text: string; index: SpecIndex | null }) {
  const links = useMemo(() => (index ? proseLinks(index, text, '') : undefined), [index, text]);
  return <Markdown source={text} links={links} />;
}

const STATUS_LABEL = { running: 'running', done: 'done', error: 'failed' } as const;

function ToolRow({ item }: { item: Extract<ChatItem, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  const body = `chat-tool-${item.id}`;
  return (
    <div className={`chat-tool is-${item.status}`}>
      <button type="button" className="chat-tool-row" aria-expanded={open} aria-controls={body} onClick={() => setOpen(!open)}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />
        <span className="chat-tool-status" aria-label={STATUS_LABEL[item.status]} role="img" />
        <span className="chat-tool-name">{item.label}</span>
        <span className="chat-tool-summary">{item.summary}</span>
      </button>
      {open && (
        <div id={body} className="chat-tool-body">
          <h4 className="chat-tool-heading">Input</h4>
          <pre tabIndex={0}>{item.input}</pre>
          <h4 className="chat-tool-heading">Result</h4>
          {item.result === null ? <p className="hint">Running…</p> : <pre tabIndex={0}>{item.result || '(empty)'}</pre>}
        </div>
      )}
    </div>
  );
}

const ANSWERED = { allowed: 'Allowed once', denied: 'Denied', canceled: 'Withdrawn: the turn ended first' } as const;

function PermissionPrompt({ item, answer }: { item: Extract<ChatItem, { kind: 'permission' }>; answer: (id: string, allow: boolean) => Promise<boolean> }) {
  const [sending, setSending] = useState(false);
  const reply = async (allow: boolean) => {
    setSending(true);
    await answer(item.id, allow);
    setSending(false);
  };
  return (
    <div className={`chat-permission is-${item.answer}`}>
      <p className="chat-permission-ask">Claude wants to use <strong>{item.label}</strong>{item.summary && <>: <code>{item.summary}</code></>}</p>
      {item.reason && <p className="hint">{item.reason}</p>}
      <details className="chat-permission-input">
        <summary>Input</summary>
        <pre tabIndex={0}>{item.input}</pre>
      </details>
      {item.answer === 'pending' ? (
        <div className="chat-permission-actions">
          <Button variant="primary" disabled={sending} onClick={() => void reply(true)}>Allow once</Button>
          <Button danger disabled={sending} onClick={() => void reply(false)}>Deny</Button>
        </div>
      ) : (
        <p className="chat-permission-answer">{ANSWERED[item.answer]}</p>
      )}
    </div>
  );
}

// ---------- A turn's changes ----------

const CHANGE_LABEL = { added: 'Added', removed: 'Removed', changed: 'Changed' } as const;
/** The most records a turn's changes list; the rest are counted. */
const MOST_RECORDS = 40;

function TurnChanges({ before, after }: { before: SpecIndex; after: SpecIndex }) {
  const diffs = useMemo(() => diffIndexes(before, after), [before, after]);
  if (diffs.length === 0) return null;
  const shown = diffs.slice(0, MOST_RECORDS);
  return (
    <details className="chat-changes" open>
      <summary>{diffs.length === 1 ? '1 record changed' : `${diffs.length} records changed`}</summary>
      <ul className="chat-change-list">
        {shown.map((d) => <RecordChange key={d.id} diff={d} />)}
      </ul>
      {diffs.length > shown.length && <p className="hint">and {diffs.length - shown.length} more.</p>}
    </details>
  );
}

function RecordChange({ diff }: { diff: RecordDiff }) {
  return (
    <li className={`chat-change is-${diff.change}`}>
      <div className="chat-change-head">
        <span className="chat-change-kind">{CHANGE_LABEL[diff.change]}</span>
        {diff.change === 'removed' ? <span className="chat-change-id">{diff.id}</span> : <Link to={addressOf(diff.id)} className="chat-change-id mention">{diff.id}</Link>}
        <span className="chat-change-title">{diff.title}</span>
      </div>
      {diff.change === 'changed' && (
        <dl className="chat-change-fields">
          {diff.fields.map((f) => (
            <div key={f.field}>
              <dt>{f.field}</dt>
              <dd>
                {f.before !== null && <del>{f.before}</del>}
                {f.after !== null && <ins>{f.after}</ins>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
