// One window's conversation with the user's own `claude` CLI (LA-PLT-UC19): it runs the CLI in the
// window's folder (chat.ts says how), writes the Owner's messages, permission answers and Stop to it,
// and reads what it prints into the chat's state. A session continues with `--resume`; when the
// process ends, the next message starts it again on the same session.
import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { applyLine, claudeArgs, interruptLine, NEW_CURSOR, permissionLine, userLine, withdrawPrompts, type ChatItem, type ChatState, type StartOptions, type StreamCursor } from './chat.ts';

type Spawn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => ChildProcessWithoutNullStreams;

export interface ChatSessionOptions {
  /** The `claude` executable. */
  command: string;
  /** The window's product folder: the CLI works there, with its CLAUDE.md, settings and plugins. */
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Told after every change, with the whole state. */
  onChange: (state: ChatState) => void;
  spawn?: Spawn;
}

/** How long a stopped process may take to end before it is killed. */
const KILL_AFTER_MS = 3000;
/** How much of the CLI's error output a notice keeps. */
const STDERR_TAIL = 2000;

export class ChatSession {
  state: ChatState = { sessionId: null, status: 'closed', items: [] };
  private cursor: StreamCursor = NEW_CURSOR;
  private child: ChildProcessWithoutNullStreams | null = null;
  /** Each pending permission prompt's tool input, sent back unchanged when allowed. */
  private inputs = new Map<string, unknown>();
  private counter = 0;
  private stderr = '';
  private readonly spawn: Spawn;
  private readonly options: ChatSessionOptions;

  constructor(options: ChatSessionOptions) {
    this.options = options;
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
    this.set({ sessionId: start.resume && !start.fork ? start.resume : null, status: 'idle', items: history });
    this.launch(start);
  }

  private launch(start: StartOptions) {
    let child: ChildProcessWithoutNullStreams;
    this.stderr = '';
    try {
      child = this.spawn(this.options.command, claudeArgs(start), { cwd: this.options.cwd, env: this.options.env });
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
    // A permission prompt's input is kept whole, to be sent back when it is allowed.
    if (line.includes('"can_use_tool"')) {
      try {
        const m = JSON.parse(line) as { request_id?: string; request?: { subtype?: string; input?: unknown } };
        if (m.request?.subtype === 'can_use_tool' && m.request_id) this.inputs.set(m.request_id, m.request.input);
      } catch {
        // Not a prompt after all.
      }
    }
    const next = applyLine(this.state, this.cursor, line);
    this.cursor = next.cursor;
    if (next.state !== this.state) this.set(next.state);
  }

  private write(line: string): boolean {
    if (!this.child || this.child.stdin.destroyed) return false;
    this.child.stdin.write(`${line}\n`);
    return true;
  }

  /** Sends the Owner's message, starting the CLI again on the session when it has ended. */
  send(text: string): boolean {
    const message = text.trim();
    if (!message || this.state.status === 'running' || this.state.status === 'stopping') return false;
    if (!this.child) this.launch(this.state.sessionId ? { resume: this.state.sessionId } : {});
    if (!this.child) return false;
    this.set({ ...this.state, status: 'running', items: [...this.state.items, { kind: 'user', id: `u:${++this.counter}`, text: message }] });
    return this.write(userLine(message));
  }

  /** Answers a permission prompt: allow once, or deny. */
  answer(requestId: string, allow: boolean): boolean {
    const item = this.state.items.find((i) => i.id === requestId && i.kind === 'permission');
    if (!item || item.kind !== 'permission' || item.answer !== 'pending') return false;
    if (!this.write(permissionLine(requestId, allow, this.inputs.get(requestId)))) return false;
    this.inputs.delete(requestId);
    this.set({ ...this.state, items: this.state.items.map((i) => (i === item ? { ...item, answer: allow ? 'allowed' : 'denied' } : i)) });
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
