// Measures the Tool Library's business outcomes for one month, from the library's own records.
// Spec: the report TL-LEND-RP01 (examples/tool-library/data/), which measures TL-BO01 to TL-BO04.
// Usage: DB=library.db node src/outcomes.ts 2026-03
//   TIME_ZONE defaults to America/New_York; dates are counted in the library's time zone (TL-LEND-DS01).
// What it counts, for the month given:
// - TL-BO01 More tools in use: the loans opened in the month, over the tools in the catalog by its end.
// - TL-BO02 Tools back on time: of the loans due in the month, the share returned on a day after their due date,
//   or still out and overdue now.
// - TL-BO03 No damaged tool lent: the loans opened in the month on a tool that needed repair then, from the
//   DamageReported and ToolRepaired events the outbox keeps.
// - TL-BO04 More neighbors borrowing: the members who opened at least one loan in the 90 days up to the month's end.
import { DEFAULT_TIME_ZONE, addDays, assertTimeZone, localDate } from './model.ts';
import { Store } from './store.ts';

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

const ACTIVE_DAYS = 90;

/** The first and last date (YYYY-MM-DD) of a month given as YYYY-MM. */
function monthDates(month: string): { first: string; last: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError(`A month is YYYY-MM, not "${month}".`);
  const first = `${month}-01`;
  const [year, number] = month.split('-').map(Number);
  const next = number === 12 ? `${year + 1}-01-01` : `${year}-${String(number + 1).padStart(2, '0')}-01`;
  return { first, last: addDays(next, -1) };
}

interface LoanRow { member_id: number; tool_id: number; borrowed_at: string; due_date: string; returned_at: string | null }

/** TL-LEND-RP01: the four outcome measures for `month`, as of `now`, counting dates in `timeZone`. */
export function measureOutcomes(store: Store, month: string, now: Date, timeZone: string): OutcomeMeasures {
  const { first, last } = monthDates(month);
  const date = (iso: string) => localDate(new Date(iso), timeZone);
  const inMonth = (day: string) => day >= first && day <= last;
  const loans = store.db.prepare('SELECT member_id, tool_id, borrowed_at, due_date, returned_at FROM loans ORDER BY id').all() as unknown as LoanRow[];
  const toolsAdded = (store.db.prepare('SELECT added_at FROM tools').all() as { added_at: string }[]).map((t) => date(t.added_at));

  const opened = loans.filter((l) => inMonth(date(l.borrowed_at)));
  const tools = toolsAdded.filter((d) => d <= last).length;

  const due = loans.filter((l) => inMonth(l.due_date));
  const today = localDate(now, timeZone);
  const late = due.filter((l) => (l.returned_at === null ? today > l.due_date : date(l.returned_at) > l.due_date));

  // A tool needs repair from a damage report until the next repair: its condition history, from the outbox.
  const events = (store.db.prepare("SELECT event FROM outbox WHERE type IN ('DamageReported', 'ToolRepaired') ORDER BY id").all() as { event: string }[])
    .map((r) => JSON.parse(r.event) as { type: string; toolId: number; reportedAt?: string; repairedAt?: string });
  const neededRepair = (toolId: number, at: string): boolean => {
    let damaged = false;
    for (const e of events) {
      const when = e.type === 'DamageReported' ? e.reportedAt! : e.repairedAt!;
      if (e.toolId !== toolId || when > at) continue;
      damaged = e.type === 'DamageReported';
    }
    return damaged;
  };
  const damagedLent = opened.filter((l) => neededRepair(l.tool_id, l.borrowed_at)).length;

  const since = addDays(last, -(ACTIVE_DAYS - 1));
  const active = new Set(loans.filter((l) => { const d = date(l.borrowed_at); return d >= since && d <= last; }).map((l) => l.member_id));

  return {
    month,
    toolsInUse: { loans: opened.length, tools, loansPerTool: tools === 0 ? 0 : opened.length / tools },
    backOnTime: { due: due.length, late: late.length, shareLate: due.length === 0 ? 0 : late.length / due.length },
    damagedLent,
    activeMembers: active.size,
  };
}

if (import.meta.main) {
  const month = process.argv[2] ?? '';
  const timeZone = process.env.TIME_ZONE || DEFAULT_TIME_ZONE;
  if (!process.env.DB) {
    console.error('Usage: DB=library.db node src/outcomes.ts YYYY-MM');
    process.exit(1);
  }
  assertTimeZone(timeZone);
  const store = new Store(process.env.DB);
  try {
    console.log(JSON.stringify(measureOutcomes(store, month, new Date(), timeZone), null, 2));
  } finally {
    store.close();
  }
}
