// The chat's voice in the shell (src/voice.ts): the front-only rule with a stand-in helper, the helper's lines checked,
// and, on macOS 26 or later, the real helper (native/speech) recognizing recorded audio on the Mac, its words read by
// the app's own dictation (app/src/chat/voice/), as the window would.
import { execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Dictation, type DictationView } from '../../app/src/chat/voice/dictation.ts';
import { DEFAULT_COMMANDS } from '../../app/src/platform/voice-settings/model.ts';
import { parseHelperLine, shouldListen, speechHelperPath, voicePlatform, VoiceListener, type StartHelper, type VoiceEvent } from '../src/voice.ts';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(desktop, 'test', 'fixtures', 'voice');

/** A stand-in for `lathe-speech listen`: its stdout the test writes, its stdin read for "stop". */
function fakeHelper() {
  const started: { stdout: PassThrough; stdin: PassThrough; stopped: () => boolean; exit: () => void }[] = [];
  const start: StartHelper = () => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stdin: PassThrough; exitCode: number | null; kill: () => boolean };
    child.stdout = new PassThrough();
    child.stdin = new PassThrough();
    child.exitCode = null;
    let stop = '';
    child.stdin.on('data', (chunk: Buffer) => { stop += chunk.toString(); });
    const exit = () => { child.exitCode = 0; child.emit('exit', 0); child.stdout.end(); child.emit('close', 0); };
    child.stdin.on('finish', () => { if (stop.includes('stop')) exit(); });
    child.kill = () => { exit(); return true; };
    started.push({ stdout: child.stdout, stdin: child.stdin, stopped: () => stop.includes('stop'), exit });
    return child as unknown as ReturnType<StartHelper>;
  };
  return { start, started };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('LA-PLT-UC20-R03-T01 The chat listens only while its window is in front, and only when the Owner asked', () => {
  it('holds the rule: wanted and in front', () => {
    expect(shouldListen(true, true)).toBe(true);
    expect(shouldListen(true, false)).toBe(false);
    expect(shouldListen(false, true)).toBe(false);
  });

  it('starts the helper in front, stops it behind another window and starts it again in front', async () => {
    const { start, started } = fakeHelper();
    const events: VoiceEvent[] = [];
    const listener = new VoiceListener(start, (e) => events.push(e), false);
    // Asked while behind: nothing listens until the window is in front.
    expect(listener.want(true)).toBe('background');
    expect(started).toHaveLength(0);
    listener.front(true);
    expect(started).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: 'listening', on: true, why: 'started', message: null });
    started[0].stdout.write('{"type":"ready"}\n{"type":"volatile","text":"Zoom","start":0}\n{"type":"speech","at":0.2}\nnot json\n{"type":"final","words":[{"text":"Zoom.","start":0.2,"end":0.6}]}\n');
    await tick();
    expect(events.slice(1)).toEqual([{ type: 'volatile', text: 'Zoom' }, { type: 'speech', at: 0.2 }, { type: 'final', words: [{ text: 'Zoom.', start: 0.2, end: 0.6 }] }]);
    listener.front(false);
    expect(started[0].stopped()).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'listening', on: false, why: 'background', message: null });
    // What it says after being told to stop never reaches the page.
    const count = events.length;
    started[0].stdout.write('{"type":"volatile","text":"late"}\n');
    await tick();
    expect(events).toHaveLength(count);
    listener.front(true);
    expect(started).toHaveLength(2);
    expect(listener.want(false)).toBe('stopped');
    expect(started[1].stopped()).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'listening', on: false, why: 'stopped', message: null });
    listener.front(false);
    listener.front(true);
    expect(started).toHaveLength(2);
    await listener.close();
  });

  it('says why when the helper ends by itself', async () => {
    const { start, started } = fakeHelper();
    const events: VoiceEvent[] = [];
    const listener = new VoiceListener(start, (e) => events.push(e), true);
    listener.want(true);
    started[0].stdout.write('{"type":"error","message":"The microphone could not start."}\n');
    await tick();
    started[0].exit();
    await tick();
    expect(events.at(-1)).toEqual({ type: 'listening', on: false, why: 'failed', message: 'Dictation stopped: The microphone could not start.' });
    expect(listener.listening).toBe(false);
  });

  it('checks the helper\'s lines, and offers dictation only on macOS 26 or later with the helper built', () => {
    expect(parseHelperLine('{"type":"silence","at":1.2,"pitch":"falling"}')).toEqual({ type: 'silence', at: 1.2, pitch: 'falling' });
    expect(parseHelperLine('{"type":"silence","at":1.2,"pitch":"sideways"}')).toBeNull();
    expect(parseHelperLine('{"type":"final","words":[{"text":"x"}]}')).toBeNull();
    expect(parseHelperLine('{"type":"run","command":"rm"}')).toBeNull();
    expect(voicePlatform('darwin', '25.0.0', true)).toEqual({ available: true, reason: null });
    expect(voicePlatform('darwin', '24.6.0', true).reason).toBe('On-device dictation needs macOS 26 or later.');
    expect(voicePlatform('win32', '10.0.0', true).available).toBe(false);
    expect(voicePlatform('darwin', '25.0.0', false).reason).toMatch(/not built/);
    expect(speechHelperPath({ resourcesPath: '/Applications/Lathe.app/Contents/Resources' }, desktop)).toBe('/Applications/Lathe.app/Contents/Resources/lathe-speech');
  });
});

// ---------- The real helper, on recorded audio ----------

const helper = speechHelperPath(null, desktop);
const canRecognize = process.platform === 'darwin' && Number.parseInt(os.release(), 10) >= 25;

beforeAll(() => {
  if (canRecognize) execFileSync(process.execPath, [path.join(desktop, 'scripts', 'speech.ts')], { cwd: desktop, stdio: 'inherit' });
}, 300_000);

/** The helper's lines for an audio file, read as the shell reads them. */
function hearFile(file: string): Promise<VoiceEvent[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(helper, ['file', path.join(fixtures, file)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`lathe-speech exited ${code}: ${out}`));
      resolve(out.split('\n').map(parseHelperLine).filter((e): e is VoiceEvent => !!e && e.type !== 'ready' && e.type !== 'error' && e.type !== 'support'));
    });
  });
}

/**
 * The events in the order they happen when heard live: a file is read faster than it is recognized, so the voice's
 * starts and stops come first; each settled utterance goes after the voice activity up to its first word.
 */
function asHeard(events: VoiceEvent[]): VoiceEvent[] {
  const activity = events.filter((e) => e.type === 'speech' || e.type === 'silence') as Extract<VoiceEvent, { at: number }>[];
  const timeline: VoiceEvent[] = [];
  let guesses: VoiceEvent[] = [];
  for (const e of events) {
    if (e.type === 'volatile') guesses.push(e);
    if (e.type !== 'final') continue;
    while (activity.length && activity[0].at < e.words[0].start + 0.35) timeline.push(activity.shift()!);
    timeline.push(...guesses, e);
    guesses = [];
  }
  return [...timeline, ...activity];
}

function dictate(events: VoiceEvent[], activation: boolean) {
  let draft = '';
  const sent: string[] = [];
  let wakes = 0;
  let view: DictationView = { state: 'off', countdown: null, preparing: false };
  const d = new Dictation({
    readDraft: () => draft,
    writeDraft: (t) => { draft = t; },
    send: (t) => { sent.push(t); draft = ''; },
    wake: () => { wakes++; },
    listen: () => {},
    say: () => {},
    changed: (v) => { view = v; },
  }, { activation, quick: false, phrases: { wake: 'Lathe', commands: DEFAULT_COMMANDS }, endOfTurn: true });
  d.event({ type: 'listening', on: true, why: 'started', message: null });
  for (const e of asHeard(events)) d.event(e);
  d.dispose();
  return { draft, sent, wakes, state: view.state };
}

describe('LA-INT65-T01 On this Mac, recorded speech is recognized on-device and read by the chat\'s grammar', () => {
  it.skipIf(!canRecognize)('wakes on "Lathe" after a pause, takes the words after it as the message, and sends on "Lathe, send"', async () => {
    expect(existsSync(helper)).toBe(true);
    const events = await hearFile('wake-zoom-send.m4a');
    expect(events.filter((e) => e.type === 'final').length).toBeGreaterThanOrEqual(3);
    const heard = dictate(events, true);
    expect(heard.wakes).toBe(1);
    expect(heard.sent).toEqual(['Zoom into this. Then send it to the team.']);
    expect(heard.draft).toBe('');
    expect(heard.state).toBe('waiting');
  }, 60_000);

  it.skipIf(!canRecognize)('does not wake on "lathe" in the middle of a sentence', async () => {
    const heard = dictate(await hearFile('mid-sentence-lathe.m4a'), true);
    expect(heard.wakes).toBe(0);
    expect(heard.draft).toBe('');
  }, 60_000);

  it.skipIf(!canRecognize)('hears a question\'s voice rise and a statement\'s fall, for Quick mode', async () => {
    const stops = (await hearFile('question-then-statement.m4a')).filter((e) => e.type === 'silence');
    expect(stops.map((e) => e.type === 'silence' && e.pitch)).toEqual(['rising', 'falling']);
  }, 60_000);
});
