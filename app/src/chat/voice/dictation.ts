import type { VoiceEvent } from '../types.ts';
import { turnDelay, type Pitch } from './endOfTurn.ts';
import { appendText, newParagraph, normalWord, PAUSE_SECONDS, previewWords, readTokens, scratchLast, withPauses, type HeardWord, type Phrases, type Quiet } from './grammar.ts';

// Dictation (LA-PLT-UC20): what the window does with what the shell hears. The Owner dictates with the mic
// button or its key, or, with voice activation on, by saying the wake phrase after a pause; the words go into the
// message box as they are heard (the recognizer's guesses shown at the draft's end, then its settled words in their
// place), to edit before sending. Commands said while dictating act on the draft (grammar.ts). With Quick mode on,
// a pause after the message sends it, judged by end-of-turn detection (endOfTurn.ts), with a countdown that any
// sound or key cancels. About 20 seconds of quiet ends dictation and leaves the draft. Nothing here is kept: the
// words go only into the draft.
// With its imports' extensions: the desktop app's tests compile this file too, under Node's resolution.

/** Off (not listening), waiting for the wake phrase, or dictating into the message box. */
export type VoiceState = 'off' | 'waiting' | 'dictating';

export interface DictationSettings {
  /** Voice activation: listen for the wake phrase while the window is in front. */
  activation: boolean;
  /** Quick mode: send a dictated message by itself after the pause end-of-turn detection judges. */
  quick: boolean;
  phrases: Phrases;
  /** Whether end-of-turn detection can read the voice; without it, Quick mode waits a fixed pause. */
  endOfTurn: boolean;
}

export interface DictationView {
  state: VoiceState;
  /** Quick mode's countdown to sending: when it sends, and how long it waits in all, in ms of the clock. */
  countdown: { until: number; total: number } | null;
  /** The on-device speech model is being installed. */
  preparing: boolean;
}

/** What dictation reaches in the window: the message box's draft, sending it, and showing the chat. */
export interface DictationHost {
  readDraft: () => string;
  writeDraft: (text: string) => void;
  /** Sends this text as the message, as the send button does, and empties the draft (or puts it back if it cannot send). */
  send: (text: string) => void;
  /** Shows the chat and puts focus in its message box. */
  wake: () => void;
  /** Asks the shell to listen or to stop. */
  listen: (on: boolean) => void;
  /** Says something to the Owner (a live region). */
  say: (message: string) => void;
  changed: (view: DictationView) => void;
}

export interface Clock {
  now: () => number;
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}
const realClock: Clock = { now: () => Date.now(), setTimeout: (run, ms) => setTimeout(run, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

/** The quiet that ends dictation and leaves the draft, in ms. */
export const IDLE_MS = 20_000;

export class Dictation {
  readonly #host: DictationHost;
  readonly #clock: Clock;
  #settings: DictationSettings;
  #state: VoiceState = 'off';
  /** The grammar's own state: dictating as the settled words say (a wake heard only in the guesses is not yet). */
  #reading = false;
  /** The recognizer's guesses shown at the end of the draft, to be replaced. */
  #shown = '';
  #lastWord: HeardWord | null = null;
  #quiets: Quiet[] = [];
  #silenceAt: number | null = null;
  #pausedBefore = true;
  #utterance: { pausedBefore: boolean } | null = null;
  #pitch: Pitch = null;
  #countdown: { until: number; total: number; since: number; handle: unknown } | null = null;
  #idle: unknown = null;
  #preparing = false;

  constructor(host: DictationHost, settings: DictationSettings, clock: Clock = realClock) {
    this.#host = host;
    this.#settings = settings;
    this.#clock = clock;
    if (settings.activation) this.#become('waiting');
  }

  get state(): VoiceState { return this.#state; }

  /** New settings: voice activation on starts waiting, off stops listening (unless dictating). */
  configure(settings: DictationSettings) {
    const was = this.#settings;
    this.#settings = settings;
    if (settings.activation && !was.activation && this.#state === 'off') this.#become('waiting');
    else if (!settings.activation && was.activation && this.#state === 'waiting') this.#become('off');
    if (!settings.quick) this.#cancelCountdown();
    this.#tell();
  }

  /** The mic button or its key: start dictating, or stop and leave the draft. */
  toggle() {
    if (this.#state === 'dictating') this.stop();
    else this.start();
  }

  start() {
    this.#reading = true;
    this.#become('dictating');
    this.#restartIdle();
  }

  /** Stops dictating and leaves the draft; voice activation goes back to waiting. */
  stop() {
    this.#settle();
    this.#reading = false;
    this.#become(this.#settings.activation ? 'waiting' : 'off');
  }

  /** A key pressed in the window: it cancels Quick mode's countdown. */
  key() {
    if (this.#countdown) { this.#cancelCountdown(); this.#tell(); }
  }

  dispose() {
    this.#cancelCountdown();
    this.#clearIdle();
    if (this.#state !== 'off') this.#host.listen(false);
  }

  event(event: VoiceEvent) {
    switch (event.type) {
      case 'listening':
        if (event.on) { this.#lastWord = null; this.#quiets = []; this.#silenceAt = null; this.#pausedBefore = true; this.#utterance = null; return; }
        this.#preparing = false;
        if (event.why === 'stopped') return;
        // Behind another window: dictation ends and leaves the draft; waiting resumes when the window is in front again.
        if (event.why === 'background') {
          if (this.#state === 'dictating') { this.#settle(); this.#reading = false; this.#state = this.#settings.activation ? 'waiting' : 'off'; this.#cancelCountdown(); this.#clearIdle(); if (this.#state === 'off') this.#host.listen(false); this.#tell(); }
          return;
        }
        this.#settle();
        this.#reading = false;
        this.#state = 'off';
        this.#cancelCountdown();
        this.#clearIdle();
        if (event.message) this.#host.say(event.message);
        this.#tell();
        return;
      case 'preparing':
        this.#preparing = true;
        this.#tell();
        return;
      case 'speech':
        if (this.#silenceAt !== null) {
          const quiet = { from: this.#silenceAt, to: event.at };
          this.#quiets.push(quiet);
          this.#pausedBefore = quiet.to - quiet.from >= PAUSE_SECONDS;
        }
        this.#silenceAt = null;
        if (this.#countdown) { this.#cancelCountdown(); this.#tell(); }
        if (this.#state === 'dictating') this.#restartIdle();
        return;
      case 'silence':
        this.#silenceAt = event.at;
        this.#pitch = event.pitch;
        if (this.#state === 'dictating') {
          this.#restartIdle();
          if (this.#settings.quick) this.#startCountdown();
        }
        return;
      case 'volatile':
        this.#heardSoFar(event.text);
        return;
      case 'final':
        this.#heard(event.words);
        return;
    }
  }

  // ---------- Words ----------

  #heardSoFar(text: string) {
    if (this.#state === 'off') return;
    if (this.#preparing) { this.#preparing = false; this.#tell(); }
    this.#utterance ??= { pausedBefore: this.#pausedBefore };
    const preview = previewWords(text, this.#utterance.pausedBefore, this.#reading, this.#settings.phrases);
    if (!this.#reading && preview.wakes && this.#state === 'waiting') {
      this.#become('dictating');
      this.#host.wake();
      this.#restartIdle();
    }
    if (this.#state === 'dictating') {
      this.#show(preview.text);
      this.#restartIdle();
      this.#recount();
    }
  }

  #heard(heard: readonly HeardWord[]) {
    this.#utterance = null;
    // A recognizer may settle the stop that ends one utterance at the start of the next (". Lathe, send"): it ends the
    // draft so far, and is not the first word after the pause.
    let start = 0;
    while (start < heard.length && normalWord(heard[start].text) === '') start++;
    const carried = heard.slice(0, start).map((w) => w.text.trim()).join('');
    const words = heard.slice(start);
    if (this.#state === 'off' || words.length === 0) return;
    const tokens = withPauses(words, this.#quiets, this.#lastWord);
    this.#lastWord = words[words.length - 1];
    this.#quiets = this.#quiets.filter((q) => q.to > this.#lastWord!.start);
    const wasDictating = this.#state === 'dictating';
    const { steps, dictating } = readTokens(tokens, this.#reading, this.#settings.phrases);
    this.#reading = dictating;
    let draft = this.#base();
    if (carried && draft.trim() && !/[.!?,;:]$/.test(draft.trimEnd())) draft = draft.trimEnd() + carried;
    this.#shown = '';
    let ended = false;
    for (const step of steps) {
      if (step.kind === 'wake') { if (!wasDictating) this.#host.wake(); continue; }
      if (step.kind === 'text') { draft = appendText(draft, step.text); continue; }
      switch (step.command) {
        case 'send':
          if (draft.trim()) this.#host.send(draft);
          draft = '';
          ended = true;
          break;
        case 'cancel':
          draft = '';
          ended = true;
          this.#host.say('Message cleared');
          break;
        case 'scratch':
          draft = scratchLast(draft);
          break;
        case 'newLine':
          draft = newParagraph(draft);
          break;
      }
    }
    if (draft !== this.#host.readDraft()) this.#host.writeDraft(draft);
    if (dictating && this.#state !== 'dictating') this.#become('dictating');
    else if (!dictating && (ended || this.#state === 'dictating')) this.#become(this.#settings.activation ? 'waiting' : 'off');
    if (this.#state === 'dictating') { this.#restartIdle(); this.#recount(); }
  }

  /** The draft without the guesses shown at its end (all of it, when the Owner has edited them). */
  #base(): string {
    const draft = this.#host.readDraft();
    if (this.#shown && draft.endsWith(this.#shown)) return draft.slice(0, draft.length - this.#shown.length);
    this.#shown = '';
    return draft;
  }

  #show(preview: string) {
    const base = this.#base();
    const next = appendText(base, preview);
    this.#shown = next.slice(base.length);
    this.#host.writeDraft(next);
  }

  /** The guesses kept as they are, when dictation ends before the recognizer settles them. */
  #settle() { this.#shown = ''; }

  // ---------- Quick mode ----------

  #startCountdown() {
    if (!this.#host.readDraft().trim()) return;
    this.#cancelCountdown();
    const since = this.#clock.now();
    this.#countdown = { since, until: since, total: 0, handle: null };
    this.#recount();
  }

  /** Sets the countdown from the moment the voice stopped, by what the draft now says (late words can change it). */
  #recount() {
    const c = this.#countdown;
    if (!c) return;
    const total = turnDelay(this.#host.readDraft(), this.#pitch, this.#settings.endOfTurn);
    if (c.handle !== null && c.total === total) return;
    this.#clock.clearTimeout(c.handle);
    const until = c.since + total;
    const handle = this.#clock.setTimeout(() => this.#quickSend(), Math.max(0, until - this.#clock.now()));
    this.#countdown = { since: c.since, until, total, handle };
    this.#tell();
  }

  #quickSend() {
    this.#countdown = null;
    if (this.#state !== 'dictating' || !this.#host.readDraft().trim()) { this.#tell(); return; }
    this.#settle();
    this.#host.send(this.#host.readDraft());
    this.#reading = false;
    this.#become(this.#settings.activation ? 'waiting' : 'off');
  }

  #cancelCountdown() {
    if (!this.#countdown) return;
    this.#clock.clearTimeout(this.#countdown.handle);
    this.#countdown = null;
  }

  // ---------- State ----------

  #restartIdle() {
    this.#clearIdle();
    this.#idle = this.#clock.setTimeout(() => {
      this.#idle = null;
      if (this.#state !== 'dictating') return;
      this.stop();
      this.#host.say('Dictation ended after a long pause; your message is still there.');
    }, IDLE_MS);
  }

  #clearIdle() {
    if (this.#idle !== null) this.#clock.clearTimeout(this.#idle);
    this.#idle = null;
  }

  #become(state: VoiceState) {
    const was = this.#state;
    this.#state = state;
    if (state !== 'dictating') { this.#cancelCountdown(); this.#clearIdle(); }
    if (was === 'off' && state !== 'off') this.#host.listen(true);
    if (was !== 'off' && state === 'off') this.#host.listen(false);
    this.#tell();
  }

  #tell() {
    const c = this.#countdown;
    this.#host.changed({ state: this.#state, countdown: c && c.handle !== null ? { until: c.until, total: c.total } : null, preparing: this.#preparing });
  }
}
