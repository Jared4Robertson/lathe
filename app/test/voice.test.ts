import { describe, expect, it } from 'vitest';
import { Dictation, IDLE_MS, type Clock, type DictationSettings, type DictationView } from '../src/chat/voice/dictation';
import { completeness, FALLBACK_DELAY, TURN_DELAY, turnDelay } from '../src/chat/voice/endOfTurn';
import { appendText, newParagraph, readTokens, scratchLast, withPauses, type HeardWord, type Phrases, type Token } from '../src/chat/voice/grammar';
import type { VoiceEvent } from '../src/chat/types';
import { DEFAULT_COMMANDS, DEFAULT_VOICE_SETTINGS, STRICT_WAKE } from '../src/platform/voice-settings/model';
import { voiceSettingsProblems } from '../src/platform/voice-settings/rules';

// The chat's voice (LA-PLT-UC20): the grammar, end-of-turn detection and dictation, fed words as the shell
// sends them, with a fake clock. desktop/test/voice.test.ts runs the real recognizer on recorded audio.

const PHRASES: Phrases = { wake: 'Lathe', commands: DEFAULT_COMMANDS };

/** Words said one after another, `|` marking a pause between them: "Lathe, | send" has a pause after "Lathe,". */
function said(text: string, from = 0): HeardWord[] {
  const words: HeardWord[] = [];
  let at = from;
  for (const part of text.split(/\s+/)) {
    if (part === '|') { at += 0.8; continue; }
    words.push({ text: part, start: at, end: at + 0.3 });
    at += 0.3;
  }
  return words;
}
const tokens = (text: string, after: HeardWord | null = { text: 'before', start: -2, end: -1.5 }) => withPauses(said(text), [], after);
const read = (text: string, dictating: boolean, phrases = PHRASES) => readTokens(tokens(text), dictating, phrases);

describe('LA-PLT-UC20-R02-T01 The voice grammar: a pause before the wake phrase wakes, a pause, the wake phrase and a command word is a command, anything else is text', () => {
  it('marks a pause before a word after a long enough quiet, or one the voice activity heard', () => {
    const marks = (t: Token[]) => t.map((x) => (x.kind === 'pause' ? '|' : x.text)).join(' ');
    expect(marks(withPauses(said('zoom into | this'), [], null))).toBe('| zoom into | this');
    // The recognizer stretched "the" over the quiet after it; the voice activity heard the quiet.
    const stretched: HeardWord[] = [{ text: 'into', start: 0, end: 0.3 }, { text: 'the.', start: 0.3, end: 1.4 }, { text: 'Late,', start: 1.4, end: 1.9 }];
    expect(marks(withPauses(stretched, [{ from: 0.6, to: 1.5 }], null))).toBe('| into the. | Late,');
    expect(marks(withPauses(stretched, [{ from: 0.6, to: 0.9 }], null))).toBe('| into the. Late,');
  });

  it('wakes on the wake phrase after a pause, the rest of the utterance becoming the message', () => {
    expect(read('| Lathe, zoom into this.', false)).toEqual({ steps: [{ kind: 'wake' }, { kind: 'text', text: 'zoom into this.' }], dictating: true });
    // As the recognizer writes "Lathe" said alone.
    expect(read('| Late, zoom into this.', false).steps[0]).toEqual({ kind: 'wake' });
    expect(read('| Lathe', false)).toEqual({ steps: [{ kind: 'wake' }], dictating: true });
  });

  it('does not wake on a mid-sentence "Lathe", and keeps nothing while waiting', () => {
    expect(read('| I use a lathe every day', false)).toEqual({ steps: [], dictating: false });
    expect(read('| I use a | lathe', false).steps).toEqual([{ kind: 'wake' }]);
  });

  it('reads a pause, the wake phrase and a command word as a command while dictating', () => {
    expect(read('then show the policies. | Lathe, send.', true)).toEqual({ steps: [{ kind: 'text', text: 'then show the policies.' }, { kind: 'command', command: 'send' }], dictating: false });
    expect(read('| Lathe, cancel', true).steps).toEqual([{ kind: 'command', command: 'cancel' }]);
    expect(read('| Late, scratch that.', true).steps).toEqual([{ kind: 'command', command: 'scratch' }]);
    expect(read('| Lathe new line', true)).toEqual({ steps: [{ kind: 'command', command: 'newLine' }], dictating: true });
  });

  it('keeps words as text without the wake phrase first, without a pause before it, or with more words after the command', () => {
    expect(read('then send it to the team', true).steps).toEqual([{ kind: 'text', text: 'then send it to the team' }]);
    expect(read('ask Lathe send', true).steps).toEqual([{ kind: 'text', text: 'ask Lathe send' }]);
    expect(read('| Lathe, send it to the team', true).steps).toEqual([{ kind: 'text', text: 'Lathe, send it to the team' }]);
    expect(read('| Lathe is great', true).steps).toEqual([{ kind: 'text', text: 'Lathe is great' }]);
  });

  it('uses the phrases the Owner chose, such as the stricter "Hey Lathe"', () => {
    const strict = { ...PHRASES, wake: STRICT_WAKE };
    expect(read('| Lathe, zoom in', false, strict).steps).toEqual([]);
    expect(read('| Hey, Lathe, zoom in', false, strict).steps).toEqual([{ kind: 'wake' }, { kind: 'text', text: 'zoom in' }]);
    expect(read('| Hey Lathe, ship it', true, { ...strict, commands: { ...DEFAULT_COMMANDS, send: 'ship it' } }).steps).toEqual([{ kind: 'command', command: 'send' }]);
  });

  it('writes the draft: a capital at a sentence start, the last sentence scratched, a new paragraph', () => {
    expect(appendText('', 'zoom into this.')).toBe('Zoom into this.');
    expect(appendText('Zoom into this.', 'then the policies')).toBe('Zoom into this. Then the policies');
    expect(appendText('Zoom into', 'the policies')).toBe('Zoom into the policies');
    expect(scratchLast('Zoom into this. Then the policies.')).toBe('Zoom into this.');
    expect(scratchLast('Only one')).toBe('');
    expect(scratchLast('First.\n\nSecond line')).toBe('First.\n\n');
    expect(newParagraph('Zoom into this. ')).toBe('Zoom into this.\n\n');
  });
});

describe('LA-PLT-INV44-T Voice phrases have one to three words, and no two say the same', () => {
  it('accepts the defaults and refuses an empty, long or repeated phrase', () => {
    expect(voiceSettingsProblems(DEFAULT_VOICE_SETTINGS)).toEqual([]);
    const problems = voiceSettingsProblems({ ...DEFAULT_VOICE_SETTINGS, wake: ' ', commands: { send: 'go', cancel: 'Go!', scratch: 'please scratch that now', newLine: 'new line' } });
    expect(problems.map((p) => p.message)).toEqual([
      'The wake phrase needs a word.',
      'The command "Clear the message" has the same words as "Send".',
      'The command "Remove the last sentence" has more than 3 words.',
    ]);
    expect(voiceSettingsProblems({ ...DEFAULT_VOICE_SETTINGS, commands: { ...DEFAULT_COMMANDS, send: 'lathe' } }).map((p) => p.rule)).toEqual(['voice-phrases-distinct']);
  });
});

// ---------- Dictation, with a fake clock ----------

function fakeClock() {
  let now = 0;
  let timers: { at: number; run: () => void; id: number }[] = [];
  let next = 1;
  const clock: Clock = {
    now: () => now,
    setTimeout: (run, ms) => { const id = next++; timers.push({ at: now + ms, run, id }); return id; },
    clearTimeout: (id) => { timers = timers.filter((t) => t.id !== id); },
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      now = due.at;
      due.run();
    }
    now = until;
  };
  return { clock, advance };
}

function setUp(over: Partial<DictationSettings> = {}) {
  const { clock, advance } = fakeClock();
  let draft = '';
  const sent: string[] = [];
  const notes: string[] = [];
  const listens: boolean[] = [];
  let wakes = 0;
  let view: DictationView = { state: 'off', countdown: null, preparing: false };
  const d = new Dictation({
    readDraft: () => draft,
    writeDraft: (t) => { draft = t; },
    send: (t) => { sent.push(t); draft = ''; },
    wake: () => { wakes++; },
    listen: (on) => listens.push(on),
    say: (m) => notes.push(m),
    changed: (v) => { view = v; },
  }, { activation: false, quick: false, phrases: PHRASES, endOfTurn: true, ...over }, clock);
  const hear = (e: VoiceEvent) => d.event(e);
  /** An utterance: the voice starts, the guesses, the settled words, the voice stops. */
  const utter = (text: string, at: number, pitch: 'falling' | 'rising' | 'level' | null = 'falling') => {
    const words = said(text, at);
    hear({ type: 'speech', at });
    hear({ type: 'volatile', text: words.map((w) => w.text).join(' ') });
    hear({ type: 'final', words });
    hear({ type: 'silence', at: words[words.length - 1].end, pitch });
  };
  return { d, hear, utter, advance, sent, notes, listens, wakes: () => wakes, draft: () => draft, setDraft: (t: string) => { draft = t; }, view: () => view };
}

describe('LA-PLT-UC20-R01-T01 Dictation shows the words as they are heard, settles them, and leaves the draft to edit', () => {
  it('shows the guesses at the end of the draft and puts the settled words in their place', () => {
    const v = setUp();
    v.setDraft('Look at the basket.');
    v.d.start();
    expect(v.listens).toEqual([true]);
    expect(v.view().state).toBe('dictating');
    v.hear({ type: 'listening', on: true, why: 'started', message: null });
    v.hear({ type: 'speech', at: 0.1 });
    v.hear({ type: 'volatile', text: 'Then zoom' });
    expect(v.draft()).toBe('Look at the basket. Then zoom');
    v.hear({ type: 'volatile', text: 'Then zoom into this' });
    expect(v.draft()).toBe('Look at the basket. Then zoom into this');
    v.hear({ type: 'final', words: said('then zoom into this.', 0.1) });
    expect(v.draft()).toBe('Look at the basket. Then zoom into this.');
    // Nothing is sent until the Owner sends it.
    expect(v.sent).toEqual([]);
    v.d.toggle();
    expect(v.view().state).toBe('off');
    expect(v.listens).toEqual([true, false]);
    expect(v.draft()).toBe('Look at the basket. Then zoom into this.');
  });

  it('ends after about 20 seconds of quiet, leaving the draft', () => {
    const v = setUp();
    v.d.start();
    v.utter('show the payments', 0.1);
    v.advance(IDLE_MS - 100);
    expect(v.view().state).toBe('dictating');
    v.advance(200);
    expect(v.view().state).toBe('off');
    expect(v.draft()).toBe('Show the payments');
    expect(v.notes.at(-1)).toMatch(/long pause/);
  });

  it('wakes from waiting on the wake phrase, sends on "Lathe, send", and waits again', () => {
    const v = setUp({ activation: true });
    expect(v.view().state).toBe('waiting');
    expect(v.listens).toEqual([true]);
    v.hear({ type: 'listening', on: true, why: 'started', message: null });
    v.hear({ type: 'speech', at: 0.2 });
    v.hear({ type: 'volatile', text: 'Late, zoom' });
    // The guesses already wake it: the chat shows, the words go in.
    expect(v.wakes()).toBe(1);
    expect(v.view().state).toBe('dictating');
    expect(v.draft()).toBe('Zoom');
    v.hear({ type: 'final', words: said('Late, zoom into this.', 0.2) });
    expect(v.draft()).toBe('Zoom into this.');
    expect(v.wakes()).toBe(1);
    v.hear({ type: 'silence', at: 1.4, pitch: 'falling' });
    v.hear({ type: 'speech', at: 2.4 });
    v.hear({ type: 'final', words: said('Lathe, send.', 2.4) });
    expect(v.sent).toEqual(['Zoom into this.']);
    expect(v.view().state).toBe('waiting');
    // Waiting again: words without the wake phrase are not kept.
    v.utter('this is just talk', 4);
    expect(v.draft()).toBe('');
  });

  it('stops when the window goes behind another, keeping the draft; waiting goes on when it is back', () => {
    const v = setUp({ activation: true });
    v.d.start();
    v.utter('show the payments', 0.1);
    v.hear({ type: 'listening', on: false, why: 'background', message: null });
    expect(v.view().state).toBe('waiting');
    expect(v.draft()).toBe('Show the payments');
    // Voice activation off: nothing listens after it.
    const w = setUp();
    w.d.start();
    w.hear({ type: 'listening', on: false, why: 'background', message: null });
    expect(w.view().state).toBe('off');
    expect(w.listens).toEqual([true, false]);
  });

  it('acts on "scratch that", "new line" and "cancel"', () => {
    const v = setUp();
    v.d.start();
    v.utter('Zoom into this. Then the policies.', 0);
    v.utter('| Lathe, scratch that.', 3);
    expect(v.draft()).toBe('Zoom into this.');
    v.utter('| Lathe, new line.', 6);
    v.utter('then the payments', 9);
    expect(v.draft()).toBe('Zoom into this.\n\nThen the payments');
    v.utter('| Lathe, cancel.', 12);
    expect(v.draft()).toBe('');
    expect(v.view().state).toBe('off');
    expect(v.sent).toEqual([]);
  });
});

describe('LA-PLT-UC20-R04-T01 Quick mode sends after the pause end-of-turn detection judges: short when finished, long mid-thought, between when unsure', () => {
  it('judges the words: a complete thought, one cut off, or no telling', () => {
    expect(completeness('zoom into this')).toBe('finished');
    expect(completeness('zoom into the')).toBe('unfinished');
    expect(completeness('show me the payments and')).toBe('unfinished');
    expect(completeness('rename it to')).toBe('unfinished');
    expect(completeness('payments')).toBe('unsure');
    expect(turnDelay('zoom into this', 'falling', true)).toBe(TURN_DELAY.finished);
    expect(turnDelay('zoom into the', 'falling', true)).toBe(TURN_DELAY.unfinished);
    expect(turnDelay('can you zoom into this', 'rising', true)).toBe(TURN_DELAY.unsure);
    expect(turnDelay('zoom into this', null, true)).toBe(TURN_DELAY.unsure);
    expect([TURN_DELAY.finished, TURN_DELAY.unfinished, TURN_DELAY.unsure]).toEqual([500, 3500, 2000]);
  });

  it('sends a finished thought after half a second', () => {
    const v = setUp({ quick: true });
    v.d.start();
    v.utter('zoom into this.', 0, 'falling');
    expect(v.view().countdown).toEqual({ until: 500, total: 500 });
    v.advance(499);
    expect(v.sent).toEqual([]);
    v.advance(1);
    expect(v.sent).toEqual(['Zoom into this.']);
    expect(v.view().state).toBe('off');
  });

  it('waits 3.5 seconds mid-thought, and 2 when unsure', () => {
    const v = setUp({ quick: true });
    v.d.start();
    v.utter('zoom into the', 0, 'falling');
    v.advance(3400);
    expect(v.sent).toEqual([]);
    v.advance(100);
    expect(v.sent).toEqual(['Zoom into the']);
    const w = setUp({ quick: true });
    w.d.start();
    w.utter('can you zoom into this?', 0, 'rising');
    w.advance(1999);
    expect(w.sent).toEqual([]);
    w.advance(1);
    expect(w.sent).toEqual(['Can you zoom into this?']);
  });

  it('cancels the countdown on any sound or key', () => {
    const v = setUp({ quick: true });
    v.d.start();
    v.utter('zoom into this.', 0, 'falling');
    v.advance(300);
    v.hear({ type: 'speech', at: 1.5 });
    expect(v.view().countdown).toBeNull();
    v.advance(5000);
    expect(v.sent).toEqual([]);
    v.hear({ type: 'silence', at: 2, pitch: 'falling' });
    expect(v.view().countdown).not.toBeNull();
    v.d.key();
    expect(v.view().countdown).toBeNull();
    v.advance(5000);
    expect(v.sent).toEqual([]);
  });

  it('falls back to a fixed 2-second pause where the voice cannot be read, and "Lathe, send" still sends at once', () => {
    const v = setUp({ quick: true, endOfTurn: false });
    v.d.start();
    v.utter('zoom into this.', 0, 'falling');
    expect(v.view().countdown?.total).toBe(FALLBACK_DELAY);
    v.advance(1999);
    expect(v.sent).toEqual([]);
    v.advance(1);
    expect(v.sent).toEqual(['Zoom into this.']);
    const w = setUp({ quick: true, endOfTurn: false });
    w.d.start();
    w.utter('zoom into the', 0, 'falling');
    w.utter('| Lathe, send.', 1.5);
    expect(w.sent).toEqual(['Zoom into the']);
  });
});
