// The Lending model: records, values and the rules that need no storage.
// Spec: TL-LEND-C01 (specs/tool-library/lending/02-design/components/C01-model.md)

/** TL-LEND-DR07: a loan lasts 14 days. */
export const LOAN_DAYS = 14;
/** TL-LEND-DR02: a member holds at most 3 active loans. */
export const MAX_ACTIVE_LOANS = 3;

/** The library's time zone when none is set. Due dates and overdue loans are counted in it. */
export const DEFAULT_TIME_ZONE = 'America/New_York';

const DAY_MS = 24 * 60 * 60 * 1000;

/** TL-LEND-DR04: a tool's condition is good or needs repair, nothing else. */
export const CONDITIONS = ['good', 'needs_repair'] as const;
export type Condition = (typeof CONDITIONS)[number];

export type ToolStatus = 'available' | 'on_loan' | 'needs_repair';

export interface Member {
  id: number;
  name: string;
  email: string;
  joinedAt: string;
}

export interface Tool {
  id: number;
  name: string;
  description: string;
  condition: Condition;
  damageNote: string | null;
  addedAt: string;
}

export interface CatalogEntry extends Tool {
  status: ToolStatus;
}

export interface Loan {
  id: number;
  memberId: number;
  toolId: number;
  borrowedAt: string;
  /** The last day of the loan, as YYYY-MM-DD in the library's time zone. */
  dueDate: string;
  returnedAt: string | null;
  returnCondition: Condition | null;
  returnNote: string | null;
}

export function isCondition(value: unknown): value is Condition {
  return typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value);
}

/** Library settings. `timeZone` is an IANA name such as `America/New_York`. */
export interface LibrarySettings {
  timeZone: string;
}

/** Throws a RangeError unless `timeZone` is a time zone this runtime knows. */
export function assertTimeZone(timeZone: string): string {
  new Intl.DateTimeFormat('en-US', { timeZone });
  return timeZone;
}

/** The calendar date (YYYY-MM-DD) of `instant` in `timeZone`. */
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

/** The date `days` calendar days after `date` (both YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** TL-LEND-DR07: the due date is LOAN_DAYS calendar days after the borrow date, in the library's time zone. */
export function dueDate(borrowedAt: Date, timeZone: string): string {
  return addDays(localDate(borrowedAt, timeZone), LOAN_DAYS);
}

/**
 * TL-LEND-DR08: a loan is overdue when it is still active and today, in the library's
 * time zone, is after its due date. It is never overdue during its due date.
 */
export function isOverdue(loan: Pick<Loan, 'dueDate' | 'returnedAt'>, now: Date, timeZone: string): boolean {
  return loan.returnedAt === null && localDate(now, timeZone) > loan.dueDate;
}

/** A return is late when it happens on a day after the due date, in the library's time zone. */
export function isLate(loan: Pick<Loan, 'dueDate'>, returnedAt: Date, timeZone: string): boolean {
  return localDate(returnedAt, timeZone) > loan.dueDate;
}

/** A tool on loan shows as on loan; otherwise a damaged tool shows as needing repair. */
export function toolStatus(tool: Pick<Tool, 'condition'>, onLoan: boolean): ToolStatus {
  if (onLoan) return 'on_loan';
  return tool.condition === 'needs_repair' ? 'needs_repair' : 'available';
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
