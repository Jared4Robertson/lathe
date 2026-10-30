// One window's conversation with the user's own `claude` CLI (LA-PLT-UC19): it runs the CLI in the
// window's folder (chat.ts says how), writes the Owner's messages, permission answers and Stop to it,
// and reads what it prints into the chat's state. A session continues with `--resume`; when the
// process ends, the next message starts it again on the same session. Choosing another permission
// mode (LA-PLT-UC19-R09) starts the CLI again on the same session with that mode's flags. The panel
// answers a permission prompt itself when the mode decides it (chat.ts `decide`): allowed without a
// row, or, in View only, refused at once, saying why; a tool the Owner allowed always is allowed for
// the rest of the chat (LA-PLT-UC19-R11). Each message may carry what the Owner is looking at
// (LA-PLT-UC19-R12).
import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import {
  applyLine, claudeArgs, claudeEnv, decide, EMPTY_CHAT, interruptLine, NEW_CURSOR, permissionLine, userLine, withdrawPrompts,
  type ChatItem, type ChatMode, type ChatSetup, type ChatState, type LatheTools, type StartOptions, type StreamCursor,
} from './chat.ts';

/** What counting a run's Lathe tools gives: the tools as the header shows them, and the names of those that only read. */
export interface CountedTools {
  lathe: LatheTools;
  reads: string[];
}

/** The Owner's answer to a permission prompt. */
export type Answer = 'once' | 'always' | 'deny';

/** What each mode is called in the log. */
const MODE_NOTICE: Record<ChatMode, string> = {
  ask: 'Ask: Claude asks before every tool it uses.',
  'accept-reads': 'Accept reads: Claude reads without asking, and asks before anything else.',
  auto: "Auto: Claude Code's auto mode decides what needs asking.",
  bypass: 'Bypass: Claude uses every tool without asking.',
  'view-only': 'View only: Claude can read the spec but not change it.',
};

type Spawn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => ChildProcessWithoutNullStreams;

export interface ChatSessionOptions {
  /** The `claude` executable. */
  command: string;
  /** The window's product folder: the CLI works there, with its CLAUDE.md, settings and plugins. */
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** The Lathe plugin every run loads, and the mode the chat starts in. */
  setup: ChatSetup;
  /** Counts the Lathe tools a run gets with its environment (chatLathe.ts), each time a session opens or the mode changes. */
  countTools?: (env: NodeJS.ProcessEnv) => Promise<CountedTools>;
  /** Told after every change, with the whole state. */
  onChange: (state: ChatState) => void;
  spawn?: Spawn;
}

/** How long a stopped process may take to end before it is killed. */
const KILL_AFTER_MS = 3000;
/** How much of the CLI's error output a notice keeps. */
const STDERR_TAIL = 2000;

export class ChatSession {
  state: ChatState;
  private cursor: StreamCursor = NEW_CURSOR;
  /** How the session was opened, for starting it again before the CLI has named it. */
  private start: StartOptions = {};
  private child: ChildProcessWithoutNullStreams | null = null;
  /** Each pending permission prompt's tool input, sent back unchanged when allowed. */
  private inputs = new Map<string, unknown>();
  /** Lathe's tools that only read, as Claude Code names them, once counted. */
  private latheReads = new Set<string>();
  /** The tools the Owner allowed always in this chat. */
  private always = new Set<string>();
  private counter = 0;
  private stderr = '';
  private readonly spawn: Spawn;
  private readonly options: ChatSessionOptions;

  constructor(options: ChatSessionOptions) {
    this.options = options;
    this.state = { ...EMPTY_CHAT, mode: options.setup.mode };
    this.spawn = options.spawn ?? ((command, args, o) => nodeSpawn(command, args, { ...o, stdio: ['pipe', 'pipe', 'pipe'] }));
  }

  /** The running CLI's process ID, so the session picker does not count it as another client. */
  get pid(): number | null {
    return this.child?.pid ?? null;
  }

  private set(state: ChatState) {
    this.state = state;
    this.options.onChange(state);
  }

  private notice(text: string, tone: 'info' | 'error'): ChatItem {
    return { kind: 'notice', id: `n:local:${++this.counter}`, text, tone };
  }

  /** Starts a session: a new one, or `resume` (as it is, or forked), with its saved items shown first. */
  open(start: StartOptions, history: ChatItem[]) {
    this.kill();
    this.cursor = NEW_CURSOR;
    this.start = start;
    this.set({ ...this.state, sessionId: start.resume && !start.fork ? start.resume : null, status: 'idle', items: history });
    this.launch(start);
    this.count();
  }

  /** Counts the Lathe tools for the current mode; a count for a mode since left is dropped. */
  private count() {
    const { countTools } = this.options;
    if (!countTools) return;
    const mode = this.state.mode;
    this.set({ ...this.state, lathe: { status: 'counting', version: this.state.lathe.version } });
    void countTools(claudeEnv(this.options.env, mode)).then(({ lathe, reads }) => {
      if (this.state.mode !== mode) return;
      this.latheReads = new Set(reads);
      // Why the tools did not load goes in the log, where it can be read whole.
      const items = lathe.status === 'failed' ? [...this.state.items, this.notice(`Lathe's tools did not load: ${lathe.problem}`, 'error')] : this.state.items;
      this.set({ ...this.state, lathe, items });
    });
  }

  /**
   * Chooses the permission mode: the CLI starts again on the same session with the mode's flags, and the log says so.
   * Refused while a turn is under way; the same mode again changes nothing.
   */
  setMode(mode: ChatMode): boolean {
    if (this.state.status === 'running' || this.state.status === 'stopping') return false;
    if (mode === this.state.mode) return true;
    const running = !!this.child;
    void this.kill();
    this.set({ ...this.state, mode, items: [...this.state.items, this.notice(MODE_NOTICE[mode], 'info')] });
    if (running) this.launch(this.state.sessionId ? { resume: this.state.sessionId } : this.start);
    this.count();
    return true;
  }

  private launch(start: StartOptions) {
    let child: ChildProcessWithoutNullStreams;
    this.stderr = '';
    const setup = { ...this.options.setup, mode: this.state.mode };
    try {
      child = this.spawn(this.options.command, claudeArgs(start, setup), { cwd: this.options.cwd, env: claudeEnv(this.options.env, setup.mode) });
    } catch (error) {
      this.set({ ...this.state, status: 'closed', items: [...this.state.items, this.notice(`Claude Code did not start: ${error instanceof Error ? error.message : String(error)}`, 'error')] });
      return;
    }
    this.child = child;
    if (this.state.status === 'closed') this.set({ ...this.state, status: 'idle' });
    createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => this.read(line));
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderr = (this.stderr + chunk.toString('utf8')).slice(-STDERR_TAIL);
    });
    child.stdin.on('error', () => {});
    child.on('error', (error) => this.ended(child, `Claude Code did not start: ${error.message}`));
    child.on('exit', (code, signal) => this.ended(child, code === 0 || signal === 'SIGTERM' ? null : `Claude Code stopped (${signal ?? `exit ${code}`}).${this.stderr.trim() ? ` ${this.stderr.trim()}` : ''}`));
  }

  private ended(child: ChildProcessWithoutNullStreams, problem: string | null) {
    if (this.child !== child) return;
    this.child = null;
    this.inputs.clear();
    const items = withdrawPrompts(this.state.items).map((i) => (i.kind === 'assistant' && i.streaming ? { ...i, streaming: false } : i));
    this.set({ ...this.state, status: 'closed', items: problem ? [...items, this.notice(problem, 'error')] : items });
  }

  private read(line: string) {
    // A permission prompt's input is kept whole, to be sent back when it is allowed. The mode may answer it at once:
    // allowed without a row, or refused with one that says why.
    if (line.includes('"can_use_tool"')) {
      try {
        const m = JSON.parse(line) as { request_id?: string; request?: { subtype?: string; tool_name?: unknown; input?: unknown } };
        const tool = m.request?.tool_name;
        if (m.request?.subtype === 'can_use_tool' && m.request_id && typeof tool === 'string') {
          const decision = decide(this.state.mode, tool, this.latheReads, this.always);
          if (decision.kind === 'allow' && this.write(permissionLine(m.request_id, true, m.request.input))) return;
          this.inputs.set(m.request_id, m.request.input);
          if (decision.kind === 'refuse') return this.refuse(line, m.request_id, decision.why);
        }
      } catch {
        // Not a prompt after all.
      }
    }
    this.apply(line);
  }

  private apply(line: string) {
    const next = applyLine(this.state, this.cursor, line);
    this.cursor = next.cursor;
    if (next.state !== this.state) this.set(next.state);
  }

  /** Shows a prompt the mode refuses, refused, saying why, and tells the CLI. */
  private refuse(line: string, id: string, why: string) {
    this.apply(line);
    if (!this.write(permissionLine(id, false, null, why))) return;
    this.inputs.delete(id);
    this.set({ ...this.state, items: this.state.items.map((i) => (i.id === id && i.kind === 'permission' ? { ...i, answer: 'refused', reason: why } : i)) });
  }

  private write(line: string): boolean {
    if (!this.child || this.child.stdin.destroyed) return false;
    this.child.stdin.write(`${line}\n`);
    return true;
  }

  /** Sends the Owner's message, with what they are looking at as context, starting the CLI again on the session when it has ended. */
  send(text: string, focus: string | null = null): boolean {
    const message = text.trim();
    if (!message || this.state.status === 'running' || this.state.status === 'stopping') return false;
    if (!this.child) this.launch(this.state.sessionId ? { resume: this.state.sessionId } : {});
    if (!this.child) return false;
    this.set({ ...this.state, status: 'running', items: [...this.state.items, { kind: 'user', id: `u:${++this.counter}`, text: message }] });
    return this.write(userLine(message, focus));
  }

  /** Answers a permission prompt: allow once, allow the tool always in this chat (its other waiting prompts too), or deny. */
  answer(requestId: string, answer: Answer): boolean {
    const item = this.state.items.find((i) => i.id === requestId && i.kind === 'permission');
    if (!item || item.kind !== 'permission' || item.answer !== 'pending') return false;
    const allow = answer !== 'deny';
    if (!this.write(permissionLine(requestId, allow, this.inputs.get(requestId)))) return false;
    this.inputs.delete(requestId);
    if (answer === 'always') this.always.add(item.tool);
    const others = answer === 'always' ? this.state.items.filter((i) => i.kind === 'permission' && i.answer === 'pending' && i.tool === item.tool && i !== item) : [];
    for (const other of others) {
      this.write(permissionLine(other.id, true, this.inputs.get(other.id)));
      this.inputs.delete(other.id);
    }
    const answered = answer === 'once' ? 'allowed' : answer === 'always' ? 'always' : 'denied';
    this.set({ ...this.state, items: this.state.items.map((i) => (i === item ? { ...item, answer: answered } : others.includes(i) ? { ...i, answer: 'always' } as ChatItem : i)) });
    return true;
  }

  /** Stops the turn under way; the CLI ends it and waits for the next message. */
  stop(): boolean {
    if (this.state.status !== 'running') return false;
    if (!this.write(interruptLine(`lathe-stop-${++this.counter}`))) return false;
    this.set({ ...this.state, status: 'stopping', items: withdrawPrompts(this.state.items) });
    return true;
  }

  private kill(): Promise<void> {
    const child = this.child;
    this.child = null;
    this.inputs.clear();
    if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.stdin.end();
      child.kill('SIGTERM');
    });
  }

  /** Ends the CLI (the window closed, or the app quits); resolves once it has. */
  close(): Promise<void> {
    const ended = this.kill();
    if (this.state.status !== 'closed') this.set({ ...this.state, status: 'closed', items: withdrawPrompts(this.state.items) });
    return ended;
  }
}
