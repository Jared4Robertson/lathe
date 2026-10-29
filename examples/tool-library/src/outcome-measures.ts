// Counts the Tool Library's business outcomes for one month, from records passed in.
// Spec: the service TL-LEND-DS02-SV and the read model's table TL-LEND-RM02-TB (OutcomeMeasures, kept in memory
// only) (examples/tool-library/data/). It uses no repository: the projection in outcomes.ts passes the records in.
// Lateness is the Loan aggregate's specification TL-LEND-SP01 and needing repair the Tool's TL-LEND-SP04.
import type { DamageReported, ToolRepaired } from './events.ts';
import { isLate, isOverdue, type NewLoan } from './loan.ts';
import { addDays, localDate, type Condition } from './model.ts';
import { needsRepair, type NewTool } from './tool.ts';

/** TL-LEND-RM02-TB: one month's outcome measures, kept in memory only. */
export interface OutcomeMeasures {
  month: string;
  /** TL-BO01: loans opened in the month, tools in the catalog at its end, and loans per tool. */
  toolsInUse: { loans: number; tools: number; loansPerTool: number };
  /** TL-BO02: loans due in the month, those late, and the share late. */
  backOnTime: { due: number; late: number; shareLate: number };
  /** TL-BO03: loans opened in the month on a tool that needed repair. */
  damagedLent: number;
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

/** A tool's condition at a moment: good until a damage report, then needing repair until the next repair. */
function conditionAt(changes: LibraryRecords['conditionChanges'], toolId: number, at: string): Condition {
  let condition: Condition = 'good';
  for (const change of changes) {
    const when = change.type === 'DamageReported' ? change.reportedAt : change.repairedAt;
    if (change.toolId !== toolId || when > at) continue;
    condition = change.type === 'DamageReported' ? 'needs_repair' : 'good';
  }
  return condition;
}

/** TL-LEND-DS02-SV: the four outcome measures for `month`, as of `now`, counting dates in `timeZone`. */
export function measureOutcomes(month: string, records: LibraryRecords, now: Date, timeZone: string): OutcomeMeasures {
  const { first, last } = monthDates(month);
  const date = (iso: string) => localDate(new Date(iso), timeZone);
  const inMonth = (day: string) => day >= first && day <= last;

  const opened = records.loans.filter((l) => inMonth(date(l.borrowedAt)));
  const tools = records.tools.filter((t) => date(t.addedAt) <= last).length;

  // TL-LEND-SP01: a loan due in the month is late when returned late or still out and overdue now.
  const due = records.loans.filter((l) => inMonth(l.dueDate));
  const late = due.filter((l) => (l.return === null ? isOverdue(l, now, timeZone) : isLate(l, new Date(l.return.returnedAt), timeZone)));

  // TL-LEND-SP04: the tool needed repair, in its condition when the loan opened.
  const damagedLent = opened.filter((l) => needsRepair({ condition: conditionAt(records.conditionChanges, l.toolId, l.borrowedAt) })).length;

  const since = addDays(last, -(ACTIVE_DAYS - 1));
  const active = new Set(
    records.loans
      .filter((l) => {
        const d = date(l.borrowedAt);
        return d >= since && d <= last;
      })
      .map((l) => l.memberId),
  );

  return {
    month,
    toolsInUse: { loans: opened.length, tools, loansPerTool: tools === 0 ? 0 : opened.length / tools },
    backOnTime: { due: due.length, late: late.length, shareLate: due.length === 0 ? 0 : late.length / due.length },
    damagedLent,
    activeMembers: active.size,
  };
}
