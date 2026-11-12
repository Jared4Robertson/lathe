// The chat's voice in the shell (LA-PLT-UC20): whether this Mac can dictate, and a window's listening, by
// the speech helper (the Swift package native/speech, built to out/lathe-speech), which hears the microphone and
// recognizes speech on the Mac itself with NVIDIA's Parakeet model (macOS's SpeechAnalyzer when that model cannot be
// loaded): audio never leaves it, and nothing is recorded or saved.
// A window listens only while the page wants it to and the window is in front (shouldListen): going behind another
// window or app stops the helper, and coming back in front starts it again. The page reads the events as
// app/src/chat/types.ts's VoiceEvent; this file checks every line the helper writes before passing it on.
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

export type Microphone = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';

export interface VoiceWord { text: string; start: number; end: number }

export type VoiceEvent =
  | { type: 'listening'; on: boolean; why: 'started' | 'stopped' | 'background' | 'ended' | 'denied' | 'failed'; message: string | null }
  | { type: 'preparing' }
  | { type: 'volatile'; text: string }
  | { type: 'final'; words: VoiceWord[] }
  | { type: 'speech'; at: number }
  | { type: 'silence'; at: number; pitch: 'falling' | 'rising' | 'level' | null };

/** What the helper writes beside the events the page gets: ready, an error, or (for probe) whether the Mac can. */
type HelperLine = VoiceEvent | { type: 'ready' } | { type: 'error'; message: string } | { type: 'support'; onDevice: boolean; reason: string | null };

/** The macOS the helper needs, for SpeechAnalyzer, its fallback recognizer: macOS 26 is Darwin 25. */
const FIRST_DARWIN = 25;

/** The helper's path: in the packed app, beside its resources (unpacked, so it can run); otherwise the build's. */
export function speechHelperPath(packed: { resourcesPath: string } | null, desktopDir: string): string {
  return packed ? path.join(packed.resourcesPath, 'lathe-speech') : path.join(desktopDir, 'out', 'lathe-speech');
}

/**
 * Whether this platform can dictate at all, before asking the helper: only macOS 26 or later has the on-device
 * recognizer, and only where the helper was built. Elsewhere the mic button is hidden, and the reason said.
 */
export function voicePlatform(platform: string, darwinRelease: string, helperBuilt: boolean): { available: boolean; reason: string | null } {
  if (platform !== 'darwin') return { available: false, reason: 'Dictation uses macOS\'s on-device speech recognition, which this platform does not have.' };
  if (Number.parseInt(darwinRelease, 10) < FIRST_DARWIN) return { available: false, reason: 'On-device dictation needs macOS 26 or later.' };
  if (!helperBuilt) return { available: false, reason: 'The speech helper is not built: run npm --prefix desktop run build.' };
  return { available: true, reason: null };
}

export const helperBuilt = (file: string) => existsSync(file);

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isWord = (v: unknown): v is VoiceWord => {
  const w = v as VoiceWord;
  return !!w && typeof w === 'object' && typeof w.text === 'string' && isNumber(w.start) && isNumber(w.end);
};

/** A line the helper wrote, checked; null for anything malformed or unknown. */
export function parseHelperLine(line: string): HelperLine | null {
  let raw: unknown;
  try { raw = JSON.parse(line); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'ready': return { type: 'ready' };
    case 'preparing': return { type: 'preparing' };
    case 'volatile': return typeof r.text === 'string' ? { type: 'volatile', text: r.text.slice(0, 10_000) } : null;
    case 'final': return Array.isArray(r.words) && r.words.every(isWord) ? { type: 'final', words: r.words.map((w: VoiceWord) => ({ text: w.text.slice(0, 200), start: w.start, end: w.end })) } : null;
    case 'speech': return isNumber(r.at) ? { type: 'speech', at: r.at } : null;
    case 'silence': return isNumber(r.at) && (r.pitch === null || r.pitch === 'falling' || r.pitch === 'rising' || r.pitch === 'level') ? { type: 'silence', at: r.at, pitch: r.pitch } : null;
    case 'error': return typeof r.message === 'string' ? { type: 'error', message: r.message.slice(0, 500) } : null;
    case 'support': return typeof r.onDevice === 'boolean' ? { type: 'support', onDevice: r.onDevice, reason: typeof r.reason === 'string' ? r.reason : null } : null;
    default: return null;
  }
}

/** The front-only rule (LA-PLT-UC26-R02): a window listens only while its page wants it to and it is in front. */
export const shouldListen = (wanted: boolean, front: boolean) => wanted && front;

/** How long the helper has to stop after "stop" before it is terminated. */
const STOP_GRACE_MS = 2000;

/** Runs the helper as `lathe-speech listen` (the tests give a stand-in). */
export type StartHelper = () => Pick<ChildProcess, 'stdout' | 'stdin' | 'once' | 'kill' | 'exitCode'>;

/**
 * A window's listening: the helper runs while shouldListen holds, its events go to the page (`send`), and it is
 * stopped as soon as the window goes behind or the page no longer wants it.
 */
export class VoiceListener {
  readonly #start: StartHelper;
  readonly #send: (event: VoiceEvent) => void;
  #wanted = false;
  #front: boolean;
  #helper: ReturnType<StartHelper> | null = null;
  #stopping = new Set<Promise<void>>();

  constructor(start: StartHelper, send: (event: VoiceEvent) => void, front: boolean) {
    this.#start = start;
    this.#send = send;
    this.#front = front;
  }

  get listening() { return this.#helper !== null; }

  /** The page wants to listen, or not: 'listening', 'background' (it will when the window is in front) or 'stopped'. */
  want(on: boolean): 'listening' | 'background' | 'stopped' {
    this.#wanted = on;
    this.#apply(on ? 'background' : 'stopped');
    return !on ? 'stopped' : this.#helper ? 'listening' : 'background';
  }

  /** The window came in front, or went behind. */
  front(front: boolean) {
    this.#front = front;
    this.#apply('background');
  }

  /** Stops listening for good (the window closed); resolves once the helper has exited. */
  close(): Promise<void> {
    this.#wanted = false;
    this.#apply('stopped');
    return Promise.all([...this.#stopping]).then(() => {});
  }

  #apply(why: 'background' | 'stopped') {
    const listen = shouldListen(this.#wanted, this.#front);
    if (listen && !this.#helper) this.#run();
    else if (!listen && this.#helper) {
      this.#stop(this.#helper);
      this.#send({ type: 'listening', on: false, why: this.#wanted ? 'background' : why, message: null });
    }
  }

  #run() {
    let helper: ReturnType<StartHelper>;
    try {
      helper = this.#start();
    } catch (error) {
      this.#wanted = false;
      this.#send({ type: 'listening', on: false, why: 'failed', message: `Dictation could not start: ${error instanceof Error ? error.message : String(error)}` });
      return;
    }
    this.#helper = helper;
    this.#send({ type: 'listening', on: true, why: 'started', message: null });
    let problem: string | null = null;
    if (helper.stdout) {
      createInterface({ input: helper.stdout }).on('line', (line) => {
        if (this.#helper !== helper) return;
        const event = parseHelperLine(line);
        if (!event || event.type === 'ready' || event.type === 'support') return;
        if (event.type === 'error') { problem = event.message; return; }
        this.#send(event);
      });
    }
    helper.stdin?.on('error', () => {});
    // 'close', after its output is read, so an error it wrote last is known.
    helper.once('close', () => {
      if (this.#helper !== helper) return;
      // It ended by itself: a failure (the microphone refused, the model missing), or it was killed.
      this.#helper = null;
      this.#wanted = false;
      this.#send({ type: 'listening', on: false, why: problem ? 'failed' : 'ended', message: problem ? `Dictation stopped: ${problem}` : 'Dictation stopped.' });
    });
  }

  #stop(helper: ReturnType<StartHelper>) {
    this.#helper = null;
    const stopped = new Promise<void>((resolve) => {
      if (helper.exitCode !== null) return resolve();
      const timer = setTimeout(() => helper.kill('SIGTERM'), STOP_GRACE_MS);
      helper.once('exit', () => { clearTimeout(timer); resolve(); });
      helper.stdin?.end('stop\n');
    });
    this.#stopping.add(stopped);
    void stopped.finally(() => this.#stopping.delete(stopped));
  }
}
