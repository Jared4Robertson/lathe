// Counts the Tool Library's business outcomes for one month, from records passed in.
// Spec: the service TL-LEND-DS02-SV and the read model's table TL-LEND-RM02-TB (OutcomeMeasures, kept in memory
// only) (examples/tool-library/data/). It uses no repository: the projection in outcomes.ts passes the records in.
// Lateness is the Loan aggregate's specification TL-LEND-SP01. Each outcome's measure is a function of its own.
import type { DamageReported, ToolRepaired } from './events.ts';
import { isLate, isOverdue, type NewLoan } from './loan.ts';
import { addDays, localDate } from './model.ts';
import type { NewTool } from './tool.ts';

/** TL-LEND-RM02-TB: one month's outcome measures, kept in memory only. */
export interface OutcomeMeasures {
  month: string;
  /** TL-BO01: loans opened in the month, tools in the catalog at its end, and loans per tool. */
  toolsInUse: { loans: number; tools: number; loansPerTool: number };
  /** TL-BO02: loans due in the month, those late, and the share late. */
  backOnTime: { due: number; late: number; shareLate: number };
  /** TL-BO05: repairs made in the month, and the median days from each tool's damage report to its repair. */
  backInService: { repaired: number; medianDays: number | null };
  /** TL-BO04: members who opened a loan in the 90 days up to the month's end. */
  activeMembers: number;
}

/** What the measures are counted from: every loan and tool, and each tool's damage and repair events, oldest first. */
export interface LibraryRecords {
  loans: readonly NewLoan[];
  tools: readonly Pick<NewTool, 'addedAt'>[];
  conditionChanges: readonly (DamageReported | ToolRepaired)[];
}

const ACTIVE_DAYS = 90;

/** The first and last date (YYYY-MM-DD) of a month given as YYYY-MM. */
function monthDates(month: string): { first: string; last: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError(`A month is YYYY-MM, not "${month}".`);
  const first = `${month}-01`;
  const [year, number] = month.split('-').map(Number);
  const next = number === 12 ? `${year + 1}-01-01` : `${year}-${String(number + 1).padStart(2, '0')}-01`;
  return { first, last: addDays(next, -1) };
}

type Day = (iso: string) => string;

/** The median of some numbers, or null when there are none. */
function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The whole days from one date (YYYY-MM-DD) to another. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** TL-BO01: loans opened in the month, over the tools in the catalog by its end. */
function measureToolsInUse(records: LibraryRecords, inMonth: (d: string) => boolean, last: string, day: Day): OutcomeMeasures['toolsInUse'] {
  const loans = records.loans.filter((l) => inMonth(day(l.borrowedAt))).length;
  const tools = records.tools.filter((t) => day(t.addedAt) <= last).length;
  return { loans, tools, loansPerTool: tools === 0 ? 0 : loans / tools };
}

/** TL-BO02, TL-LEND-SP01: of the loans due in the month, those returned late or still out and overdue now. */
function measureBackOnTime(records: LibraryRecords, inMonth: (d: string) => boolean, now: Date, timeZone: string): OutcomeMeasures['backOnTime'] {
  const due = records.loans.filter((l) => inMonth(l.dueDate));
  const late = due.filter((l) => (l.return === null ? isOverdue(l, now, timeZone) : isLate(l, new Date(l.return.returnedAt), timeZone)));
  return { due: due.length, late: late.length, shareLate: due.length === 0 ? 0 : late.length / due.length };
}

/** TL-BO05: for each repair made in the month, the days since the damage report it ended. */
function measureBackInService(records: LibraryRecords, inMonth: (d: string) => boolean, day: Day): OutcomeMeasures['backInService'] {
  const reported = new Map<number, string>();
  const days: number[] = [];
  for (const change of records.conditionChanges) {
    if (change.type === 'DamageReported') {
      if (!reported.has(change.toolId)) reported.set(change.toolId, day(change.reportedAt));
      continue;
    }
    const since = reported.get(change.toolId);
    reported.delete(change.toolId);
    const repairedOn = day(change.repairedAt);
    if (since !== undefined && inMonth(repairedOn)) days.push(daysBetween(since, repairedOn));
  }
  return { repaired: days.length, medianDays: median(days) };
}

/** TL-BO04: members who opened at least one loan in the 90 days up to the month's end. */
function measureActiveMembers(records: LibraryRecords, last: string, day: Day): number {
  const since = addDays(last, -(ACTIVE_DAYS - 1));
  return new Set(records.loans.filter((l) => day(l.borrowedAt) >= since && day(l.borrowedAt) <= last).map((l) => l.memberId)).size;
}

/** TL-LEND-DS02-SV: the four outcome measures for `month`, as of `now`, counting dates in `timeZone`. */
export function measureOutcomes(month: string, records: LibraryRecords, now: Date, timeZone: string): OutcomeMeasures {
  const { first, last } = monthDates(month);
  const day: Day = (iso) => localDate(new Date(iso), timeZone);
  const inMonth = (d: string) => d >= first && d <= last;
  return {
    month,
    toolsInUse: measureToolsInUse(records, inMonth, last, day),
    backOnTime: measureBackOnTime(records, inMonth, now, timeZone),
    backInService: measureBackInService(records, inMonth, day),
    activeMembers: measureActiveMembers(records, last, day),
  };
}
