// The Lending domain's value types, its library calendar and the error a broken rule raises.
// Spec: the value types TL-VO01-VT to TL-VO04-VT and the service TL-LEND-DS01-SV (examples/tool-library/data/).
// The aggregates, with their own rules and specifications, are in member.ts, tool.ts and loan.ts.

/** TL-LEND-DS01-SV, TL-LEND-INV04: a loan is due 14 calendar days after it starts. */
export const LOAN_DAYS = 14;

/** TL-LEND-DS01-SV: the library's time zone when none is set. Due dates and overdue loans are counted in it. */
export const DEFAULT_TIME_ZONE = 'America/New_York';

const DAY_MS = 24 * 60 * 60 * 1000;

/** TL-VO03-VT: a condition is good or needs repair, nothing else (TL-VO03-C01). */
export const CONDITIONS = ['good', 'needs_repair'] as const;
export type Condition = (typeof CONDITIONS)[number];

export function isCondition(value: unknown): value is Condition {
  return typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value);
}

/** The trimmed text, or null when the value is not text or is blank. */
function trimmed(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

/** TL-VO01-VT: a name is trimmed and not blank (TL-VO01-C01). Null when there is none. */
export function parseName(value: unknown): string | null {
  return trimmed(value);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * TL-VO02-VT: an email address looks like an address (TL-VO02-C01) and is kept trimmed and in
 * lower case (TL-VO02-C02). Null when the value is not an email address.
 */
export function parseEmail(value: unknown): string | null {
  const text = trimmed(value);
  return text !== null && EMAIL.test(text) ? text.toLowerCase() : null;
}

/** TL-VO04-VT: a note is trimmed and not blank (TL-VO04-C01). Null when there is none. */
export function parseNote(value: unknown): string | null {
  return trimmed(value);
}

/** Library settings. `timeZone` is an IANA name such as `America/New_York`. */
export interface LibrarySettings {
  timeZone: string;
}

/** TL-LEND-DS01-SV: throws a RangeError unless `timeZone` is a time zone this runtime knows. */
export function assertTimeZone(timeZone: string): string {
  new Intl.DateTimeFormat('en-US', { timeZone });
  return timeZone;
}

/** TL-LEND-DS01-SV: the calendar date (YYYY-MM-DD) of `instant` in `timeZone`. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** TL-LEND-DS01-SV: the date `days` calendar days after `date` (both YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** TL-LEND-DS01-SV, TL-LEND-INV04: the due date is LOAN_DAYS calendar days after the borrow date, in the library's time zone. */
export function dueDate(borrowedAt: Date, timeZone: string): string {
  return addDays(localDate(borrowedAt, timeZone), LOAN_DAYS);
}

/** TL-LEND-DS01-SV, TL-LEND-INV04: a renewal moves the due date on LOAN_DAYS calendar days from the current one. */
export function renewedDueDate(currentDueDate: string): string {
  return addDays(currentDueDate, LOAN_DAYS);
}

/** A rule broken by a request. The endpoint handlers turn `status` into the HTTP status. */
export class LendingError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Clock = () => Date;
