// The Lending model: its data models, value types, predicates and the library calendar.
// Spec: the data models TL-LEND-EN01-DM to EN05-DM, the value types TL-VO01-VT to TL-VO04-VT,
// the predicates TL-LEND-SP01-PR to SP04-PR and the service TL-LEND-DS01-SV (examples/tool-library/data/).

/** TL-LEND-DS01-SV, TL-LEND-INV04: a loan is due 14 calendar days after it starts. */
export const LOAN_DAYS = 14;
/** TL-LEND-SP03: a member is at the loan limit with 3 active loans. */
export const MAX_ACTIVE_LOANS = 3;

/** TL-LEND-DS01-SV: the library's time zone when none is set. Due dates and overdue loans are counted in it. */
export const DEFAULT_TIME_ZONE = 'America/New_York';

const DAY_MS = 24 * 60 * 60 * 1000;

/** TL-VO03-VT: a condition is good or needs repair, nothing else (TL-VO03-C01). */
export const CONDITIONS = ['good', 'needs_repair'] as const;
export type Condition = (typeof CONDITIONS)[number];

export type ToolStatus = 'available' | 'on_loan' | 'needs_repair';

/** TL-LEND-EN01-DM: a member. */
export interface Member {
  id: number;
  name: string;
  email: string;
  joinedAt: string;
}

/** TL-LEND-EN02-DM: a tool. */
export interface Tool {
  id: number;
  name: string;
  description: string;
  condition: Condition;
  /** TL-LEND-EN03-DM: the damage report's note, stored on the tool while it needs repair. */
  damageNote: string | null;
  /** TL-LEND-EN03-DM: when the damage was reported, stored on the tool while it needs repair. */
  damageReportedAt: string | null;
  addedAt: string;
}

/** A tool as the catalog, TL-LEND-RM01, lists it. */
export interface CatalogEntry extends Tool {
  status: ToolStatus;
}

/** TL-LEND-EN04-DM: a loan. */
export interface Loan {
  id: number;
  memberId: number;
  toolId: number;
  borrowedAt: string;
  /** The last day of the loan, as YYYY-MM-DD in the library's time zone. */
  dueDate: string;
  /** TL-LEND-EN05-DM: the return, stored on the loan once it is returned. */
  returnedAt: string | null;
  returnCondition: Condition | null;
  returnNote: string | null;
}

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

/**
 * TL-LEND-SP01-PR: a loan is overdue when it is still active and today, in the library's
 * time zone, is after its due date. It is never overdue during its due date.
 */
export function isOverdue(loan: Pick<Loan, 'dueDate' | 'returnedAt'>, now: Date, timeZone: string): boolean {
  return loan.returnedAt === null && localDate(now, timeZone) > loan.dueDate;
}

/** TL-LEND-SP01-PR: a return is late when the loan was overdue at the moment of return. */
export function isLate(loan: Pick<Loan, 'dueDate'>, returnedAt: Date, timeZone: string): boolean {
  return localDate(returnedAt, timeZone) > loan.dueDate;
}

/** TL-LEND-SP02-PR: a member has an overdue loan when any of their active loans is overdue. */
export function hasOverdueLoan(activeLoans: Pick<Loan, 'dueDate' | 'returnedAt'>[], now: Date, timeZone: string): boolean {
  return activeLoans.some((loan) => isOverdue(loan, now, timeZone));
}

/** TL-LEND-SP03-PR: a member is at the loan limit when they hold MAX_ACTIVE_LOANS active loans. */
export function atLoanLimit(activeLoans: unknown[]): boolean {
  return activeLoans.length >= MAX_ACTIVE_LOANS;
}

/** TL-LEND-SP04-PR: a tool needs repair when its condition is needs repair. */
export function needsRepair(tool: Pick<Tool, 'condition'>): boolean {
  return tool.condition === 'needs_repair';
}

/** TL-LEND-RM01's Status: a tool on loan shows as on loan; otherwise a damaged tool shows as needing repair. */
export function toolStatus(tool: Pick<Tool, 'condition'>, onLoan: boolean): ToolStatus {
  if (onLoan) return 'on_loan';
  return needsRepair(tool) ? 'needs_repair' : 'available';
}

/** A rule broken by a request. The router turns `status` into the HTTP status. */
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
