import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { ResizeHandle } from '../components/ResizeHandle';
import { CHAT_DEFAULT, CHAT_MAX, CHAT_MIN } from '../exploring/session-settings/model';
import { Link, useLocation } from '../router';
import { useAnnounce, useCommand } from '../shell/commands';
import { Tooltip } from '../shell/Tooltip';
import { type RecordIndex } from '../exploring/record-summaries/record-index';
import { Markdown } from '../specs/Markdown';
import { proseLinks } from '../specs/mentions';
import { addressOf } from '../views/address';
import { openInNewPlace } from '../views/usePlace';
import { reloadChanges, useChanges, type RecordChange } from '../changes/changes';
import { CHANGE_LABEL, ChangeDetails } from '../changes/ChangeDetails';
import { focusContext, useViewChanges } from './appRequests';
import { BypassWarning, ChatModeMenu, MODE_INFO } from './ChatMode';
import type { ChatBridge, ChatItem, ChatMode, ChatSessions, ChatSkill, LatheTools, ModelChoice, OpenChoice, PromptAnswer, SessionSummary } from './types';
import { useChat, type Turn } from './useChat';
import { chatDraft, useChatDraft } from './draft';
import { chatChips, chipsContext, useChatChips } from './chips';
import { attachmentOf, imagesOnPaste, MAX_IMAGES, readImage, type Attachment } from './images';
import { matchSkills, slashQuery } from './slash';
import { Attachments, PointedChips, QueueList, SkillList } from './ComposerParts';
import { choiceLabel, ModelMenu } from './ModelMenu';
import { changesOfTurn, ReviewBar, TurnActions, type UndoState } from './Review';
import { MicButton, VoiceIntro, VoiceMenu, VoiceStatus } from './voice/VoiceControls';
import { useVoice } from './voice/useVoice';
import { SignInNotice, useSignIn } from './SignIn';
import './ChatPanel.css';

// The chat panel (LA-PLT-UC19, LA-V99): the desktop app's conversation with the Owner's own Claude
// Code, floating at the right over the stage as a frosted panel, so the stage frames its focus in
// what the panel leaves (views/openSpace.ts). Its head names the session and opens the session
// picker (resume, fork or start one), the help and the hide button (and a Bypass badge while Claude
// may use every tool), and under them the Lathe tools the session has and the permission mode
// (LA-V99-R03, ChatMode.tsx); the log shows the conversation:
// the Owner's messages, Claude's answers as Markdown whose record IDs open the record on the stage,
// each tool call as a row that expands to its input and result, each permission prompt with Allow
// once, Allow always in this chat and Deny, notices, and after each turn the records it changed, as
// diffs. Above the composer a chip names what the Owner is looking at, sent with each message as
// context (LA-PLT-UC19-R12) unless they remove it. The composer at its
// foot sends a message (Enter; Shift+Enter for a new line) and becomes Stop while Claude works
// (Escape stops too). Up and Down walk the messages in the log; Home and End go to its ends.
// Where the Mac can recognize speech on-device, the mic button dictates into the message box, and the Voice menu
// under the head turns on voice activation and Quick mode (LA-PLT-UC20, voice/).
// More around the composer: records the Owner pointed at ("Ask Claude about this") are chips sent as context (chips.ts);
// images pasted, or the stage as it is drawn, go with the message (images.ts); the model and effort picker sits beside the
// mode (ModelMenu.tsx); typing "/" lists the skills and slash commands (slash.ts); a message typed while Claude works is
// queued and sent in order (LA-PLT-UC47-R01); a turn's changes can be reviewed on the stage or undone (Review.tsx).
// When Claude Code is not signed in, before a session or when a turn says so, the panel signs it in (SignIn.tsx,
// LA-PLT-UC30); the session picker's foot signs it out, so another account can sign in.
// The shell runs the CLI (desktop/src/chatSession.ts); the panel only draws and asks.

export interface ChatPanelProps {
  bridge: ChatBridge;
  /** The whole workspace's specs: record links and diffs read them. */
  index: RecordIndex | null;
  /** The product the window shows, for what the Owner is looking at. */
  product: string | null;
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

/** Why the chat cannot start a session yet, with the fix; null when it can (or cannot tell). */
const blocked = (sessions: ChatSessions | null) => (sessions?.claude === null ? 'missing' : sessions?.signedIn === false ? 'signed-out' : null);

type Answer = (id: string, reply: PromptAnswer) => Promise<boolean>;

export function ChatPanel({ bridge, index, product, width, onWidth, onClose, input }: ChatPanelProps) {
  const { view, send, answer, stop, setMode, setModel, unqueue } = useChat(bridge, index, product);
  const announce = useAnnounce();
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [sessions, setSessions] = useState<ChatSessions | null>(null);
  const draft = useChatDraft();
  const voice = useVoice();
  const working = busy(view.status);
  // How undoing each turn has come to, by the turn's start; a new session starts over.
  const [undoStates, setUndoStates] = useState<Map<number, UndoState>>(new Map());
  useEffect(() => { setUndoStates(new Map()); }, [view.sessionId]);
  const panel = useRef<HTMLElement>(null);

  // The picker shows until a session is open, and whenever the Owner asks for it.
  const showPicker = picker || !view.open;
  const loadSessions = useCallback(() => { void bridge.sessions().then(setSessions); }, [bridge]);
  useEffect(() => { if (showPicker) loadSessions(); }, [showPicker, loadSessions]);

  // Signed out: before a session (the CLI says so) or when a turn found it so, until a sign-in succeeds. Each time it
  // turns out signed out, or a sign-in succeeds, the CLI is asked again.
  const signIn = useSignIn(bridge, sessions?.signIn);
  const signedOut = !!sessions?.claude && sessions.signedIn === false || (view.signedOut && signIn.status !== 'signed-in');
  useEffect(() => { if (view.signedOut) loadSessions(); }, [view.signedOut, loadSessions]);
  useEffect(() => {
    if (signIn.status !== 'signed-in') return;
    loadSessions();
    announce('Claude Code is signed in');
  }, [signIn.status, loadSessions, announce]);
  const signOut = async () => {
    if (!(await bridge.signOut())) { announce('Claude Code could not sign out.'); return; }
    announce('Claude Code is signed out');
    loadSessions();
  };
  const signInNotice = signedOut ? <SignInNotice bridge={bridge} state={signIn.status === 'signed-in' ? { ...signIn, status: 'idle' } : signIn} /> : null;

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

  // Sends a message: the draft, or what dictation hands over (which it has taken out of the box: it goes back if it
  // cannot be sent). While Claude works the shell queues it.
  const pointed = useChatChips();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const submitText = async (message: string) => {
    const text = message.trim();
    const putBack = () => { if (chatDraft.read() === '') chatDraft.write(message); };
    if (!text) return;
    if (view.open && signedOut) { putBack(); announce('Claude Code is not signed in.'); return; }
    if (!view.open && blocked(sessions)) { putBack(); announce(blocked(sessions) === 'missing' ? 'Lathe could not find Claude Code.' : 'Claude Code is not signed in.'); return; }
    if (!view.open && !(await bridge.open({ mode: 'new' }))) { putBack(); announce('Claude Code could not start.'); return; }
    setPicker(false);
    // What the Owner is looking at as they send, unless they removed the chip, and the records they pointed at.
    const context = [focusShown ? focusContext(index, window.location.pathname, product).context : null, chipsContext(index, chatChips.read())].filter(Boolean).join('\n\n') || null;
    const images = attachmentsRef.current.map(({ mediaType, data }) => ({ mediaType, data }));
    if (chatDraft.read() === message) chatDraft.write('');
    if (!(await send(text, context, images))) { putBack(); return; }
    chatChips.clear();
    setAttachments([]);
    if (working) announce('Your message waits for Claude to finish');
  };
  const submit = () => submitText(draft);
  const submitRef = useRef(submitText);
  submitRef.current = submitText;
  useEffect(() => {
    if (!voice) return;
    voice.sendWith((text) => void submitRef.current(text));
    return () => voice.sendWith(null);
  }, [voice?.sendWith]);
  // Review Claude's changes (key `g r`): the last turn's records, lit on the stage and walked through.
  const { setReview } = useChanges();
  useCommand('reviewClaudeChanges', async () => {
    const last = view.turns.at(-1);
    if (!last || !index) { announce('Claude has changed nothing yet'); return; }
    const changes = await changesOfTurn(last, index);
    if (!changes.length) { announce('Claude changed nothing in its last turn'); return; }
    setReview({ label: `Claude's changes, turn ${view.turns.length}`, changes });
  }, view.turns.length > 0);

  // The "/" list: skills and commands matching what is typed after a leading slash.
  const [skills, setSkills] = useState<ChatSkill[] | null>(null);
  const query = slashQuery(draft);
  useEffect(() => { if (query !== null && skills === null) void bridge.skills().then(setSkills); }, [query, skills, bridge]);
  const matches = useMemo(() => (query === null || !skills ? [] : matchSkills(skills, query)), [query, skills]);
  const [slashAt, setSlashAt] = useState(0);
  const [slashClosed, setSlashClosed] = useState(false);
  useEffect(() => { setSlashAt(0); if (query === null) setSlashClosed(false); }, [query]);
  const listOpen = query !== null && !slashClosed && skills !== null;
  const pick = (skill: ChatSkill) => { chatDraft.write('/' + skill.name + ' '); setSlashClosed(true); input.current?.focus(); };
  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (listOpen && !e.nativeEvent.isComposing) {
      const at = Math.min(slashAt, Math.max(0, matches.length - 1));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (matches.length) setSlashAt((at + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSlashClosed(true); return; }
      const chosen = matches[at];
      if ((e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) && chosen && draft !== '/' + chosen.name) { e.preventDefault(); pick(chosen); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };

  // Images pasted into the message box, and the stage as it is drawn.
  const addImages = async (files: File[]) => {
    for (const file of files) {
      if (attachmentsRef.current.length >= MAX_IMAGES) { announce(`A message carries at most ${MAX_IMAGES} images`); return; }
      const read = await readImage(file);
      if ('problem' in read) { announce(read.problem); continue; }
      setAttachments((a) => (a.length < MAX_IMAGES ? [...a, attachmentOf(read.image)] : a));
    }
  };
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = imagesOnPaste(e.clipboardData);
    if (!files.length) return;
    e.preventDefault();
    void addImages(files);
  };
  const sendStage = async () => {
    const stage = document.querySelector('.focus-stage');
    if (!stage) { announce('There is no stage to send'); return; }
    const r = stage.getBoundingClientRect();
    // The chat floats over the stage's right: only what is drawn left of it is the stage.
    const width = Math.min(r.right, panel.current?.getBoundingClientRect().left ?? r.right) - r.left;
    const data = await bridge.captureStage({ x: r.left, y: r.top, width, height: r.height });
    if (!data) { announce('The stage could not be captured'); return; }
    if (attachmentsRef.current.length >= MAX_IMAGES) { announce(`A message carries at most ${MAX_IMAGES} images`); return; }
    setAttachments((a) => [...a, attachmentOf({ mediaType: 'image/png', data })]);
    announce('The stage is attached as an image');
    input.current?.focus();
  };

  // Escape anywhere in the panel stops Claude's turn.
  const onPanelKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && working && !e.defaultPrevented) { e.preventDefault(); void stop(); announce('Stopping'); }
  };

  // The mode: the open chat's own, else the one the folder's next chat starts in. Bypass asks first.
  const mode: ChatMode = view.mode ?? sessions?.mode ?? 'accept-reads';
  const [confirmBypass, setConfirmBypass] = useState(false);
  const chooseMode = async (next: ChatMode) => {
    setConfirmBypass(false);
    if (!(await setMode(next))) { announce('The mode can change once Claude has finished.'); return; }
    announce(`${MODE_INFO[next].name} mode`);
    if (!view.open) loadSessions();
  };

  const chooseModel = async (choice: ModelChoice) => {
    if (!(await setModel(choice.model, choice.effort))) { announce('The model can change once Claude has finished.'); return; }
    announce(`${choiceLabel(choice)}`);
  };

  // What the Owner is looking at, as the chip names it; removing it leaves it out until they look at something else.
  const location = useLocation();
  const viewChanges = useViewChanges();
  const focusLabel = useMemo(() => focusContext(index, location.path, product).label, [index, location.path, product, viewChanges]);
  const [focusDropped, setFocusDropped] = useState<string | null>(null);
  const focusShown = focusDropped !== focusLabel;

  const current = sessions?.sessions.find((s) => s.id === view.sessionId);
  const title = view.open ? current?.title ?? (view.sessionId ? 'This session' : 'New session') : 'Claude';
  const rest = width ?? CHAT_DEFAULT;

  return (
    <aside ref={panel} id="chat-panel" className={`chat-panel is-${mode}`} data-floating="right" aria-label="Chat with Claude" onKeyDown={onPanelKey}>
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
          {mode === 'bypass' && <span className="chat-bypass-badge" title="Bypass: Claude uses every tool without asking">Bypass</span>}
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
      <div className="chat-context">
        {view.open && view.lathe ? <LatheToolsNote lathe={view.lathe} /> : <span className="chat-tools hint">Lathe's tools load with a session</span>}
        <div className="chat-context-controls">
          {voice && <VoiceMenu voice={voice} />}
          <ModelMenu choice={view.choice} disabled={working || !view.open} onChoose={(c) => void chooseModel(c)} />
          <ChatModeMenu mode={mode} disabled={working} onChoose={(next) => (next === 'bypass' ? setConfirmBypass(true) : void chooseMode(next))} />
        </div>
      </div>
      {confirmBypass && <BypassWarning onConfirm={() => void chooseMode('bypass')} onCancel={() => setConfirmBypass(false)} />}
      {help && <ChatHelp />}
      {showPicker
        ? <SessionPicker sessions={sessions} current={view.sessionId} busy={working} signInNotice={signInNotice} onChoose={(c) => void choose(c)} onCheck={loadSessions} onSignOut={() => void signOut()} />
        : <ChatLog items={view.items} turns={view.turns} index={index} answer={answer} viewOnly={mode === 'view-only'} idle={!working} undoStates={undoStates} onUndoState={(start, state) => setUndoStates((m) => { const next = new Map(m); if (state) next.set(start, state); else next.delete(start); return next; })} />}
      {!showPicker && signInNotice}
      <div className="chat-status" aria-live="polite">
        {working ? (view.status === 'stopping' ? 'Stopping…' : 'Claude is working…') : view.open && view.status === 'closed' ? 'Claude Code is not running; your next message starts it again.' : ''}
      </div>
      <ReviewBar index={index} />
      <QueueList queue={view.queue} onRemove={(id) => void unqueue(id)} />
      {(focusShown || pointed.length > 0) && (
        <div className="chat-focus">
          {focusShown && (
            <span className="chat-focus-chip">
              <Icon name="focus" size={14} />
              <span className="chat-focus-label" title="Sent with your message, so Claude starts from it">{focusLabel}</span>
              <Button variant="icon" className="chat-focus-remove" label={`Leave out: ${focusLabel}`} onClick={() => { setFocusDropped(focusLabel); input.current?.focus(); }}>
                <Icon name="x" size={12} />
              </Button>
            </span>
          )}
          <PointedChips ids={pointed} index={index} onRemove={(id) => { chatChips.remove(id); input.current?.focus(); }} />
        </div>
      )}
      <Attachments items={attachments} onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))} />
      {voice && <VoiceIntro voice={voice} />}
      {voice && <VoiceStatus voice={voice} />}
      {listOpen && <SkillList skills={matches} active={Math.min(slashAt, Math.max(0, matches.length - 1))} onPick={pick} onHover={setSlashAt} />}
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <textarea
          ref={input}
          className="chat-input"
          aria-label="Message Claude"
          aria-controls={listOpen ? 'chat-skills' : undefined}
          aria-activedescendant={listOpen && matches.length ? `chat-skill-${Math.min(slashAt, matches.length - 1)}` : undefined}
          placeholder={mode === 'view-only' ? (view.open ? 'Ask Claude, View only…' : 'Ask Claude, in a new View only session…') : view.open ? 'Ask Claude…  (/ for skills)' : 'Ask Claude, in a new session…'}
          rows={2}
          value={draft}
          onChange={(e) => chatDraft.write(e.target.value)}
          onKeyDown={onComposerKey}
          onPaste={onPaste}
        />
        <Tooltip label="Send the stage as an image" placement="left">
          <Button variant="icon" label="Send the stage as an image" className="chat-stage-image" onClick={() => void sendStage()}>
            <Icon name="image" size={16} />
          </Button>
        </Tooltip>
        {voice && <MicButton voice={voice} />}
        {working && (
          <Tooltip label="Stop (Escape)" placement="left">
            <Button variant="icon" label="Stop" className="chat-stop" disabled={view.status === 'stopping'} onClick={() => { void stop(); announce('Stopping'); }}>
              <Icon name="stop" size={16} />
            </Button>
          </Tooltip>
        )}
        <Tooltip label={working ? 'Queue this message: it goes when Claude has finished (Enter)' : 'Send (Enter)'} placement="left">
          <Button variant="icon" type="submit" label={working ? 'Queue message' : voice?.view.countdown ? 'Send now (sending by itself; any key cancels)' : 'Send'} className={`chat-send${voice?.view.countdown && !working ? ' is-counting' : ''}`} disabled={!draft.trim()}>
            {voice?.view.countdown && !working && <span key={voice.view.countdown.until} className="chat-send-countdown" aria-hidden="true" style={{ animationDuration: `${Math.max(0, voice.view.countdown.until - Date.now())}ms` }} />}
            <Icon name="send" size={16} />
          </Button>
        </Tooltip>
      </form>
    </aside>
  );
}

/** The Lathe tools the open session has: how many and from which Lathe, still loading, or that they did not load (the log says why). */
function LatheToolsNote({ lathe }: { lathe: LatheTools }) {
  const version = lathe.version ? `Lathe ${lathe.version}` : 'Lathe';
  if (lathe.status === 'counting') return <span className="chat-tools hint" title={`Loading ${version}'s tools`}>Loading tools…</span>;
  if (lathe.status === 'failed') return <span className="chat-tools is-failed" title={`${version}'s tools did not load`}>Lathe tools failed</span>;
  return <span className="chat-tools" title={`${lathe.count === 1 ? '1 tool' : `${lathe.count} tools`} from ${version}`}>{lathe.count} Lathe {lathe.count === 1 ? 'tool' : 'tools'}</span>;
}

/** What works in the chat, and what is not supported yet. */
function ChatHelp() {
  return (
    <section id="chat-help" className="chat-help" aria-label="What the chat can do">
      <p>This is your own Claude Code, working in this product's folder with your login, settings, skills, plugins and <code>CLAUDE.md</code>, and always with Lathe's own tools, from the Lathe this window runs, whether or not you installed its plugin. Record IDs in its answers open the record on the stage; it can see what you are looking at and open records here.</p>
      <p>The mode under the head sets what Claude may do without asking: <strong>Ask</strong> (everything asks), <strong>Accept reads</strong> (reads run, everything else asks; the default), <strong>Auto</strong> (Claude Code's auto mode decides), <strong>Bypass</strong> (nothing asks) or <strong>View only</strong> (Claude only reads: Lathe's commands and Claude Code's tools that write files or run commands are taken away, and anything else that may change things is refused). A new chat in this folder starts in the mode the last one had. <strong>Allow always in this chat</strong> on a prompt lets that tool run for the rest of the chat.</p>
      <p>Each message goes with what you are looking at (the chip above the message box), so Claude starts from it; remove the chip to leave it out.</p>
      <p>On a Mac with macOS 26 or later, the mic button dictates into the message box, with speech recognized on the Mac itself (nothing leaves it or is kept); edit the words, then send. Under <strong>Voice</strong>, <strong>voice activation</strong> listens, while this window is in front, for <q>Lathe</q> after a pause: the rest of what you say becomes the message. While dictating, a pause and then <q>Lathe, send</q>, <q>Lathe, cancel</q>, <q>Lathe, scratch that</q> or <q>Lathe, new line</q> is a command; anything else is text. <strong>Quick mode</strong> sends a dictated message by itself when you have finished.</p>
      <p><strong>Point and ask:</strong> choose Ask Claude About This in a box's menu, or press its key, and the record joins your message as a chip. After a turn that changed records, <strong>Review Claude's changes</strong> lights them alone on the stage and walks through them with their diffs; <strong>Undo this turn</strong> puts them back through the records' own commands, or says why it cannot. Type <code>/</code> for the skills and commands, paste an image or send the stage as one, choose the model and effort in the head, and send more messages while Claude works: they wait in order. Cmd or Ctrl+click on a record ID opens it in a new tab.</p>
      <p>Slash commands go to Claude Code as text: those it runs without a dialog, such as <code>/compact</code> or a skill's own command, work.</p>
      <p>Not supported in the chat yet:</p>
      <ul>
        <li>Slash commands that open a dialog, such as <code>/model</code>, <code>/config</code> or <code>/resume</code> (use the session picker).</li>
        <li>Plan mode's approval of a plan.</li>
        <li>Claude's question cards with choices.</li>
      </ul>
    </section>
  );
}

// ---------- The session picker ----------

function SessionPicker({ sessions, current, busy, signInNotice, onChoose, onCheck, onSignOut }: { sessions: ChatSessions | null; current: string | null; busy: boolean; signInNotice: ReactNode; onChoose: (choice: OpenChoice) => void; onCheck: () => void; onSignOut: () => void }) {
  const [warning, setWarning] = useState<SessionSummary | null>(null);
  const resume = (s: SessionSummary) => (s.openElsewhere ? setWarning(s) : onChoose({ mode: 'resume', id: s.id }));
  return (
    <section id="chat-sessions" className="chat-sessions" aria-labelledby="chat-sessions-title">
      <div className="chat-sessions-head">
        <h3 id="chat-sessions-title" className="chat-section-title">Sessions in this folder</h3>
        <Button variant="primary" icon="plus" disabled={busy || !!blocked(sessions)} onClick={() => onChoose({ mode: 'new' })}>New session</Button>
      </div>
      {sessions === null && <p className="hint">Reading the sessions…</p>}
      {sessions?.claude === null && (
        <div className="chat-missing" role="alert">
          <p>
            Lathe could not find Claude Code{sessions.configured ? ' where settings.json says it is' : ''}. Install it from <a href="https://claude.com/claude-code">claude.com/claude-code</a>, or give its path as <code>claudePath</code> in Lathe's <code>settings.json</code> (File › Open Records In › Edit Settings File).
          </p>
          <Button onClick={onCheck}>Check again</Button>
        </div>
      )}
      {signInNotice}
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
      {sessions && sessions.sessions.length === 0 && !blocked(sessions) && <p className="hint">No saved sessions in this folder yet.</p>}
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
      {sessions?.claude && sessions.signedIn === true && (
        <div className="chat-account">
          <Button disabled={busy} onClick={onSignOut}>Sign out of Claude Code</Button>
        </div>
      )}
    </section>
  );
}

// ---------- The log ----------

function ChatLog({ items, turns, index, answer, viewOnly, idle, undoStates, onUndoState }: { items: ChatItem[]; turns: Turn[]; index: RecordIndex | null; answer: Answer; viewOnly: boolean; idle: boolean; undoStates: Map<number, UndoState>; onUndoState: (start: number, state: UndoState | undefined) => void }) {
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
  const blocks = new Map<number, { turn: Turn; number: number; items: ChatItem[] }>();
  turns.forEach((t, n) => blocks.set((turns[n + 1]?.start ?? items.length) - 1, { turn: t, number: n + 1, items: items.slice(t.start, turns[n + 1]?.start ?? items.length) }));
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
      {items.length === 0 && (
        <p className="hint chat-empty">
          {viewOnly
            ? 'Ask Claude about this product. View only is on: it reads through Lathe\'s tools and changes nothing.'
            : 'Ask Claude about this product, or to change it. It works through Lathe\'s tools, and you see each change here.'}
        </p>
      )}
      {items.map((item, n) => (
        <ItemWithChanges key={item.id} item={item} index={index} answer={answer} tabIndex={item.id === focusable ? 0 : -1} onFocus={setActive} block={blocks.get(n)} idle={idle && n === items.length - 1 ? true : idle} undoStates={undoStates} onUndoState={onUndoState} />
      ))}
    </div>
  );
}

function ItemWithChanges({ item, index, answer, tabIndex, onFocus, block, idle, undoStates, onUndoState }: {
  item: ChatItem; index: RecordIndex | null; answer: Answer; tabIndex: number; onFocus: (id: string) => void;
  block?: { turn: Turn; number: number; items: ChatItem[] }; idle: boolean; undoStates: Map<number, UndoState>; onUndoState: (start: number, state: UndoState | undefined) => void;
}) {
  return (
    <>
      <ChatEntry item={item} index={index} answer={answer} tabIndex={tabIndex} onFocus={onFocus} />
      {block && index && <TurnChanges block={block} index={index} idle={idle} state={undoStates.get(block.turn.start)} onState={(state) => onUndoState(block.turn.start, state)} />}
    </>
  );
}

const WHO: Record<ChatItem['kind'], string> = { user: 'You', assistant: 'Claude', tool: 'Tool call', permission: 'Permission', notice: 'Notice' };

const ChatEntry = memo(function ChatEntry({ item, index, answer, tabIndex, onFocus }: { item: ChatItem; index: RecordIndex | null; answer: Answer; tabIndex: number; onFocus: (id: string) => void }) {
  const common = { className: `chat-item is-${item.kind}`, 'data-item': item.id, tabIndex, onFocus: (e: { target: EventTarget; currentTarget: EventTarget }) => { if (e.target === e.currentTarget) onFocus(item.id); } };
  switch (item.kind) {
    case 'user':
      return <article {...common} aria-label={WHO.user}><p className="chat-user-text">{item.text}</p>{item.images > 0 && <p className="chat-user-images">{item.images === 1 ? '1 image' : `${item.images} images`} attached</p>}</article>;
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
function AssistantText({ text, index }: { text: string; index: RecordIndex | null }) {
  const links = useMemo(() => (index ? proseLinks(index, text, '') : undefined), [index, text]);
  // A record ID focuses the stage on a plain click (Markdown does that); Cmd or Ctrl+click, or a middle-click, opens it in a new tab (LA-EXP-UC10-R10).
  const openNew = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest?.('a.mention');
    const to = a?.getAttribute('href');
    if (!to || !to.startsWith('/')) return;
    const middle = e.type === 'auxclick' && e.button === 1;
    if (!middle && !(e.type === 'click' && e.button === 0 && (e.metaKey || e.ctrlKey))) return;
    e.preventDefault();
    e.stopPropagation();
    openInNewPlace(to);
  };
  return <div onClickCapture={openNew} onAuxClick={openNew}><Markdown source={text} links={links} /></div>;
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
        <span className="chat-tool-name" title={item.name}>{item.label}</span>
        <span className="chat-tool-summary">{item.summary}</span>
      </button>
      {open && (
        <div id={body} className="chat-tool-body">
          <h4 className="chat-tool-heading">Tool</h4>
          <p className="chat-tool-raw"><code>{item.name}</code></p>
          <h4 className="chat-tool-heading">Input</h4>
          <pre tabIndex={0}>{item.input}</pre>
          <h4 className="chat-tool-heading">Result</h4>
          {item.result === null ? <p className="hint">Running…</p> : <pre tabIndex={0}>{item.result || '(empty)'}</pre>}
        </div>
      )}
    </div>
  );
}

const ANSWERED = { allowed: 'Allowed once', always: 'Allowed always in this chat', denied: 'Denied', refused: 'Refused: View only', canceled: 'Withdrawn: the turn ended first' } as const;

function PermissionPrompt({ item, answer }: { item: Extract<ChatItem, { kind: 'permission' }>; answer: Answer }) {
  const [sending, setSending] = useState(false);
  const reply = async (choice: PromptAnswer) => {
    setSending(true);
    await answer(item.id, choice);
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
          <Button variant="primary" disabled={sending} onClick={() => void reply('once')}>Allow once</Button>
          <Button disabled={sending} onClick={() => void reply('always')}>Allow always in this chat</Button>
          <Button danger disabled={sending} onClick={() => void reply('deny')}>Deny</Button>
        </div>
      ) : (
        <p className="chat-permission-answer">{ANSWERED[item.answer]}</p>
      )}
    </div>
  );
}

// ---------- A turn's changes ----------

/** The most records a turn's changes list; the rest are counted. */
const MOST_RECORDS = 40;

/** The records a turn changed (LA-PLT-UC19-R03): the engine's record diff (changes/changes.ts) of the spec before the turn against the spec after it, with Review and Undo (Review.tsx). */
function TurnChanges({ block, index, idle, state, onState }: { block: { turn: Turn; number: number; items: ChatItem[] }; index: RecordIndex; idle: boolean; state: UndoState | undefined; onState: (state: UndoState | undefined) => void }) {
  const { turn } = block;
  const after = turn.after ?? index;
  const diffs = useMemo(() => reloadChanges(turn.before, after), [turn.before, after]);
  if (diffs.length === 0) return null;
  const shown = diffs.slice(0, MOST_RECORDS);
  return (
    <details className="chat-changes" open>
      <summary>{diffs.length === 1 ? '1 record changed' : `${diffs.length} records changed`}</summary>
      <TurnActions turn={turn} number={block.number} items={block.items} index={index} idle={idle} state={state} onState={onState} />
      <ul className="chat-change-list">
        {shown.map((d) => <TurnChange key={d.id} index={after} change={d} />)}
      </ul>
      {diffs.length > shown.length && <p className="hint">and {diffs.length - shown.length} more.</p>}
    </details>
  );
}

function TurnChange({ index, change }: { index: RecordIndex; change: RecordChange }) {
  return (
    <li className={`chat-change is-${change.change}`}>
      <div className="chat-change-head">
        <span className="chat-change-kind">{CHANGE_LABEL[change.change]}</span>
        {change.change === 'removed' ? <span className="chat-change-id">{change.id}</span> : <Link to={addressOf(change.id)} className="chat-change-id mention">{change.id}</Link>}
        <span className="chat-change-title">{change.title}</span>
      </div>
      <ChangeDetails index={index} change={change} />
    </li>
  );
}
