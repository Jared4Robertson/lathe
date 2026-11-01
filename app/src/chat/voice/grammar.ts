// The voice grammar (LA-PLT-UC26-R01): how what the Owner says becomes the chat's message, a wake or a command. The
// recognizer's words come with their times, and the voice activity's pauses beside them (withPauses); then:
//  - waiting (voice activation on, not dictating): the wake phrase after a pause wakes the chat, and the rest of the
//    utterance is the message's first words ("Lathe, zoom into this" → "zoom into this"); a mid-sentence "Lathe" (no
//    pause before it) wakes nothing, and nothing else is kept;
//  - dictating: after a pause, the wake phrase and a command word, ending in a pause or the end of what was heard, is a
//    command (send, cancel, scratch that, new line); anything else is text ("…then send it to the team" stays text).
// Nothing here touches the microphone or the page: dictation.ts drives it, and the tests feed it words.

/** A word as the recognizer heard it, with its times in seconds of audio. */
export interface HeardWord { text: string; start: number; end: number }
/** A stretch of quiet the voice activity heard, in seconds of audio. */
export interface Quiet { from: number; to: number }

/** What the grammar reads: the words, with a pause marked before each one said after a pause. */
export type Token = { kind: 'word'; text: string; start: number; end: number } | { kind: 'pause' };

export type VoiceCommand = 'send' | 'cancel' | 'scratch' | 'newLine';
export const VOICE_COMMANDS: readonly VoiceCommand[] = ['send', 'cancel', 'scratch', 'newLine'];

/** The wake phrase and each command's words, as the Owner set them (platform/voice-settings). */
export interface Phrases { wake: string; commands: Record<VoiceCommand, string> }

/** The quiet before a word that makes it start a new utterance, in seconds. */
export const PAUSE_SECONDS = 0.5;
/** The voice activity hears speech start a little after the word's own start: a pause that ends this soon after a word began still comes before it. */
const ONSET_SLACK = 0.35;

/** A word as compared: lower case, without its punctuation. */
export const normalWord = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');
export const phraseWords = (phrase: string) => phrase.split(/\s+/).map(normalWord).filter(Boolean);

/**
 * How the recognizer writes "Lathe" said alone: it is rarely a word on its own, so it comes out as a sound-alike
 * ("Late,", "Laid,"). Only the default wake word has them; a wake word the Owner chose is matched as written.
 */
const SOUNDS_LIKE: Record<string, readonly string[]> = {
  lathe: ['lathe', 'laith', 'lathes', 'late', 'laid', 'lave'],
  hey: ['hey', 'hay', 'hi', 'heh'],
};
const sameWord = (heard: string, wanted: string) => heard === wanted || (SOUNDS_LIKE[wanted]?.includes(heard) ?? false);

/** How many words at `at` say the phrase (0 when they do not). */
function matchAt(words: readonly string[], at: number, phrase: readonly string[]): number {
  if (phrase.length === 0 || at + phrase.length > words.length) return 0;
  return phrase.every((w, i) => sameWord(words[at + i], w)) ? phrase.length : 0;
}

/**
 * The words with the pauses marked: a word comes after a pause when it is the first since listening began (`after` is
 * null), when the quiet since the word before it is long enough, or when the voice activity heard a long enough
 * quiet end between the word before's start and its own (the recognizer can stretch a word over the quiet after it).
 */
export function withPauses(words: readonly HeardWord[], quiets: readonly Quiet[], after: HeardWord | null): Token[] {
  const tokens: Token[] = [];
  let before = after;
  for (const word of words) {
    const paused = before === null
      || word.start - before.end >= PAUSE_SECONDS
      || quiets.some((q) => q.to - q.from >= PAUSE_SECONDS && q.to > before!.start && q.to <= word.start + ONSET_SLACK);
    if (paused) tokens.push({ kind: 'pause' });
    tokens.push({ kind: 'word', ...word });
    before = word;
  }
  return tokens;
}

/** What one stretch of heard words does. */
export type GrammarStep = { kind: 'wake' } | { kind: 'text'; text: string } | { kind: 'command'; command: VoiceCommand };

/** Reads the tokens from a state: the steps they make, and whether the chat is dictating after them. */
export function readTokens(tokens: readonly Token[], dictating: boolean, phrases: Phrases): { steps: GrammarStep[]; dictating: boolean } {
  const wake = phraseWords(phrases.wake);
  const commands = VOICE_COMMANDS.map((c) => [c, phraseWords(phrases.commands[c])] as const);
  const words = tokens.filter((t): t is Extract<Token, { kind: 'word' }> => t.kind === 'word');
  const plain = words.map((w) => normalWord(w.text));
  // The position of each word, and whether a pause comes before it, and after it (or the end does).
  const pauseBefore: boolean[] = [];
  let paused = false;
  for (const t of tokens) {
    if (t.kind === 'pause') paused = true;
    else { pauseBefore.push(paused); paused = false; }
  }
  const endsAt = (i: number) => i >= words.length || pauseBefore[i];

  const steps: GrammarStep[] = [];
  let text: string[] = [];
  let state = dictating;
  const flush = () => {
    if (text.length) steps.push({ kind: 'text', text: text.join(' ') });
    text = [];
  };
  for (let i = 0; i < words.length;) {
    const woke = pauseBefore[i] ? matchAt(plain, i, wake) : 0;
    if (!state) {
      // Waiting: only the wake phrase after a pause counts; the rest of its utterance is text.
      if (woke) { steps.push({ kind: 'wake' }); state = true; i += woke; continue; }
      i += 1;
      continue;
    }
    if (woke) {
      const command = commands.find(([, phrase]) => { const n = matchAt(plain, i + woke, phrase); return n > 0 && endsAt(i + woke + n); });
      if (command) {
        flush();
        steps.push({ kind: 'command', command: command[0] });
        i += woke + command[1].length;
        if (command[0] === 'send' || command[0] === 'cancel') state = false;
        continue;
      }
    }
    text.push(words[i].text);
    i += 1;
  }
  flush();
  return { steps, dictating: state };
}

/**
 * What the words heard so far of an utterance would show, before the recognizer settles them: its text without a wake
 * phrase or a command it starts with, and whether it starts with the wake phrase (`pausedBefore`: the voice activity
 * heard a pause before it began).
 */
export function previewWords(text: string, pausedBefore: boolean, dictating: boolean, phrases: Phrases): { wakes: boolean; text: string; command: boolean } {
  const words = text.split(/\s+/).filter(Boolean);
  const plain = words.map(normalWord);
  const woke = pausedBefore ? matchAt(plain, 0, phraseWords(phrases.wake)) : 0;
  if (!dictating) return { wakes: woke > 0, text: woke ? words.slice(woke).join(' ') : '', command: false };
  if (woke) {
    for (const c of VOICE_COMMANDS) {
      const n = matchAt(plain, woke, phraseWords(phrases.commands[c]));
      if (n) return { wakes: false, text: words.slice(woke + n).join(' '), command: true };
    }
    // "Lathe" alone so far may be a command still coming: show nothing until it is settled.
    if (woke === words.length) return { wakes: false, text: '', command: true };
  }
  return { wakes: false, text: words.join(' '), command: false };
}

// ---------- Writing the draft ----------

/** Whether text at the end of the draft starts a sentence: an empty draft, or one ending a sentence or a line. */
const startsSentence = (draft: string) => draft.trim() === '' || /[.!?]\s*$|\n\s*$/.test(draft);

/** The draft with dictated text added: a space between, and a capital at a sentence's start. */
export function appendText(draft: string, text: string): string {
  const words = text.trim();
  if (!words) return draft;
  const capital = startsSentence(draft) ? words[0].toUpperCase() + words.slice(1) : words;
  if (draft === '' || /\s$/.test(draft)) return draft + capital;
  return `${draft} ${capital}`;
}

/** "Scratch that": the draft without its last sentence (or its last line, when that comes later). */
export function scratchLast(draft: string): string {
  const trimmed = draft.replace(/\s+$/, '');
  if (!trimmed) return '';
  const body = trimmed.replace(/[.!?]+$/, '');
  const cut = Math.max(body.search(/[.!?]\s[^.!?]*$/) + 1, body.lastIndexOf('\n') + 1);
  return cut > 0 ? trimmed.slice(0, cut).replace(/[ \t]+$/, '') : '';
}

/** "New line": a new paragraph. */
export const newParagraph = (draft: string) => (draft.trim() === '' ? draft : `${draft.replace(/\s+$/, '')}\n\n`);
