// Signing the chat's Claude Code in and out from inside the app (LA-PLT-UC30): the user's own `claude` runs
// `auth login` with no terminal, and opens the browser for the sign-in itself. What it prints is read for the
// sign-in page's link and for a request to paste a code, which the Owner types into the panel and which goes to
// its input; when it ends, the CLI is asked again whether it is signed in. Credentials never pass through Lathe:
// none goes on the command line, and what the CLI prints is kept only as the link, whether it asks for a code,
// and its last line when it fails; nothing of it is logged.
import { execFile, spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/** How the Owner signs in: their Claude subscription (the default), or an Anthropic Console account billed by use. */
export const SIGN_IN_METHODS = ['claudeai', 'console'] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];
export const isSignInMethod = (value: unknown): value is SignInMethod => typeof value === 'string' && (SIGN_IN_METHODS as readonly string[]).includes(value);

/**
 * Where a sign-in stands, as the panel draws it. idle: none under way; waiting: the CLI waits for the browser (with the
 * page's link once it prints one, and whether it asks for a code); checking: it ended and the CLI is asked whether it is
 * signed in; signed-in; failed: why, in the CLI's last words.
 */
export interface SignInState {
  status: 'idle' | 'waiting' | 'checking' | 'signed-in' | 'failed';
  method: SignInMethod | null;
  url: string | null;
  asksForCode: boolean;
  problem: string | null;
}

export const NO_SIGN_IN: SignInState = { status: 'idle', method: null, url: null, asksForCode: false, problem: null };

/** The CLI's arguments for a sign-in: the method's flag only, never a credential. */
export const signInArgs = (method: SignInMethod) => ['auth', 'login', `--${method}`];

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g;
const LINK = /https:\/\/[^\s"'<>]+/;
const ASKS_FOR_CODE = /\b(paste|enter|type)\b[^\n]*\bcode\b|\bcode\b[^\n]*[:>]\s*$/i;

/** What the CLI printed, read for the panel: the first https link, and whether it asks for a code. */
export function readSignInOutput(text: string): { url: string | null; asksForCode: boolean; lastLine: string | null } {
  const clean = text.replace(ANSI, '').replace(/\r/g, '\n');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
  return {
    url: clean.match(LINK)?.[0] ?? null,
    asksForCode: lines.some((l) => ASKS_FOR_CODE.test(l)),
    lastLine: lines.at(-1) ?? null,
  };
}

type Spawn = (command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => ChildProcessWithoutNullStreams;

export interface ClaudeLoginOptions {
  /** The `claude` executable. */
  command: string;
  env: NodeJS.ProcessEnv;
  /** Asks the CLI whether it is signed in (claudeSessions.ts claudeSignedIn), after the sign-in ends. */
  signedIn: () => Promise<boolean | null>;
  /** Told after every change, with the whole state. */
  onChange: (state: SignInState) => void;
  spawn?: Spawn;
}

/** How much of what the CLI prints is read; a sign-in prints a few lines. */
const OUTPUT_LIMIT = 16 * 1024;
/** How long a canceled sign-in may take to end before it is killed. */
const KILL_AFTER_MS = 3000;
/** The longest code the Owner may paste. */
export const MAX_CODE = 512;

/** One sign-in of the CLI, from start to signed in, failed or canceled. */
export class ClaudeLogin {
  state: SignInState = NO_SIGN_IN;
  private child: ChildProcessWithoutNullStreams | null = null;
  private output = '';
  private readonly options: ClaudeLoginOptions;
  private readonly spawn: Spawn;

  constructor(options: ClaudeLoginOptions) {
    this.options = options;
    this.spawn = options.spawn ?? ((command, args, o) => nodeSpawn(command, args, { ...o, stdio: ['pipe', 'pipe', 'pipe'] }));
  }

  /** Whether the CLI is running a sign-in now. */
  get running(): boolean {
    return this.child !== null;
  }

  private set(state: SignInState) {
    this.state = state;
    this.options.onChange(state);
  }

  /** Starts the CLI's sign-in; false while one runs. */
  start(method: SignInMethod): boolean {
    if (this.child) return false;
    this.output = '';
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.spawn(this.options.command, signInArgs(method), { env: this.options.env });
    } catch (error) {
      this.set({ ...NO_SIGN_IN, status: 'failed', method, problem: `Claude Code did not start: ${error instanceof Error ? error.message : String(error)}` });
      return false;
    }
    this.child = child;
    this.set({ ...NO_SIGN_IN, status: 'waiting', method });
    const read = (chunk: Buffer) => {
      if (this.child !== child) return;
      this.output = (this.output + chunk.toString('utf8')).slice(-OUTPUT_LIMIT);
      const read = readSignInOutput(this.output);
      const url = read.url ?? this.state.url;
      const asksForCode = read.asksForCode || this.state.asksForCode;
      if (url !== this.state.url || asksForCode !== this.state.asksForCode) this.set({ ...this.state, url, asksForCode });
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.stdin.on('error', () => {});
    child.on('error', (error) => this.ended(child, `Claude Code did not start: ${error.message}`));
    child.on('exit', (code, signal) => this.ended(child, code === 0 ? null : readSignInOutput(this.output).lastLine ?? `Claude Code's sign-in ended (${signal ?? `exit ${code}`}).`));
    return true;
  }

  private ended(child: ChildProcessWithoutNullStreams, problem: string | null) {
    if (this.child !== child) return;
    this.child = null;
    const method = this.state.method;
    if (problem) {
      this.set({ ...NO_SIGN_IN, status: 'failed', method, problem });
      return;
    }
    this.set({ ...NO_SIGN_IN, status: 'checking', method });
    void this.options.signedIn().then((signedIn) => {
      if (this.child || this.state.status !== 'checking') return;
      this.set(signedIn === false ? { ...NO_SIGN_IN, status: 'failed', method, problem: 'Claude Code still says it is not signed in.' } : { ...NO_SIGN_IN, status: 'signed-in', method });
    });
  }

  /** Gives the CLI the code the browser showed, on its input; false when it is not running or the code is not one line. */
  giveCode(code: string): boolean {
    const text = code.trim();
    if (!this.child || this.child.stdin.destroyed || !text || text.length > MAX_CODE || /[\r\n]/.test(text)) return false;
    this.child.stdin.write(`${text}\n`);
    // What it printed before is read no more: its request for the code is answered.
    this.output = '';
    this.set({ ...this.state, asksForCode: false });
    return true;
  }

  /** Cancels the sign-in under way: the CLI is stopped and nothing changes. Resolves once it has ended. */
  cancel(): Promise<boolean> {
    const child = this.child;
    if (!child) return Promise.resolve(false);
    this.child = null;
    this.set(NO_SIGN_IN);
    if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => child.kill('SIGKILL'), KILL_AFTER_MS);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve(true);
      });
      child.stdin.end();
      child.kill('SIGTERM');
    });
  }
}

/** How long signing out may take. */
const SIGN_OUT_TIMEOUT_MS = 15_000;

/** Signs the CLI out (`claude auth logout`); resolves whether it said it did. */
export function claudeSignOut(command: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(command, ['auth', 'logout'], { env, timeout: SIGN_OUT_TIMEOUT_MS, maxBuffer: 64 * 1024 }, (error) => resolve(!error));
  });
}
