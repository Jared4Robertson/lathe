// End-of-turn detection for Quick mode (LA-PLT-UC26-R03): whether the Owner has finished their message, judged on the
// Mac from two things: the words (does the message end as a complete thought?) and the voice (did its pitch fall at
// the end, as a statement's does?), the helper reading the pitch (desktop/native/speech). A finished thought sends
// after a short pause, an unfinished one waits longer, and when unsure it waits in between.

/** How the words end: a complete thought, one cut off ("zoom into the"), or no telling. */
export type Completeness = 'finished' | 'unfinished' | 'unsure';
/** How the voice's pitch moved over its last half second; null when it could not tell (a whisper, noise). */
export type Pitch = 'falling' | 'rising' | 'level' | null;

/** The pauses before sending, in ms: after a finished thought, mid-thought, and when unsure. */
export const TURN_DELAY = { finished: 500, unfinished: 3500, unsure: 2000 } as const;

/**
 * Words a complete thought does not end on: articles, prepositions, conjunctions, possessives, auxiliaries and the
 * like. The small model of the words: what the last word says about whether more must come.
 */
const OPEN_ENDINGS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'our', 'their', 'its', 'his', 'her',
  'to', 'of', 'in', 'into', 'on', 'onto', 'at', 'by', 'for', 'from', 'with', 'without', 'about', 'between', 'under', 'over', 'through', 'like', 'than',
  'and', 'or', 'but', 'nor', 'so', 'because', 'if', 'when', 'while', 'whether', 'unless', 'although', 'then',
  'is', 'are', 'was', 'were', 'be', 'been', 'am', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must', 'do', 'does', 'did', 'have', 'has', 'had',
  'which', 'who', 'whose', 'where', 'what', 'how', 'very', 'more', 'most', 'not', 'every', 'each', 'some', 'any', 'all', 'both', 'either', 'neither', 'um', 'uh', 'er',
]);
/** Demonstratives end a thought when pointing ("zoom into this"), but open one before a noun ("this record"): ended only after a verb's object position. */
const POINTING = new Set(['this', 'that', 'these', 'those', 'it', 'them', 'here', 'there']);
const POINTED_AFTER = new Set(['into', 'to', 'at', 'on', 'about', 'with', 'from', 'explain', 'show', 'open', 'zoom', 'change', 'rename', 'remove', 'delete', 'check', 'fix', 'is', 'do', 'see', 'use', 'add']);

const plain = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '');

/** Whether the words end as a complete thought. */
export function completeness(text: string): Completeness {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'unsure';
  const last = plain(words[words.length - 1]);
  const before = words.length > 1 ? plain(words[words.length - 2]) : '';
  if (POINTING.has(last) && POINTED_AFTER.has(before)) return 'finished';
  if (OPEN_ENDINGS.has(last) || /[,;:\-–—]$/.test(words[words.length - 1])) return 'unfinished';
  if (words.length < 2) return 'unsure';
  return 'finished';
}

/**
 * How long a pause sends the message: the words decide when they are cut off; otherwise a falling voice confirms a
 * finished thought, and a rising or level one (a question still being asked, a list), or none heard, makes it unsure.
 */
export function turnDelay(text: string, pitch: Pitch): number {
  const words = completeness(text);
  if (words === 'unfinished') return TURN_DELAY.unfinished;
  return words === 'finished' && pitch === 'falling' ? TURN_DELAY.finished : TURN_DELAY.unsure;
}
