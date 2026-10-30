// Measures the Tool Library's business outcomes for one month, from the library's own records.
// Spec: the projection TL-LEND-RM02-PJ, the reader TL-LEND-RM02-RD, the query handler TL-LEND-QRY02-H and the report
// TL-LEND-RP01, which measures TL-BO01, TL-BO02, TL-BO04 and TL-BO05 (examples/tool-library/data/). The counting is
// the service TL-LEND-DS02-SV.
// Usage: DB=library.db node src/outcomes.ts 2026-03
//   TIME_ZONE defaults to America/New_York; dates are counted in the library's time zone (TL-LEND-DS01).
// What it counts, for the month given:
// - TL-BO01 More tools in use: the loans opened in the month, over the tools in the catalog by its end.
// - TL-BO02 Tools back on time: of the loans due in the month, the share returned on a day after their due date,
//   or still out and overdue now.
// - TL-BO05 Damaged tools back in service quickly: the repairs made in the month and the median days from each
//   tool's damage report to its repair, from the DamageReported and ToolRepaired events the outbox keeps.
// - TL-BO04 More neighbors borrowing: the members who opened at least one loan in the 90 days up to the month's end.
import { Database } from './database.ts';
import { Outbox } from './events.ts';
import { LoanRepository } from './loan-repository.ts';
import { DEFAULT_TIME_ZONE, assertTimeZone } from './model.ts';
import { measureOutcomes, type OutcomeMeasures } from './outcome-measures.ts';
import { ToolRepository } from './tool-repository.ts';

/** What the outcome measures are read from: the Tool and Loan aggregates' repositories and the outbox. */
export interface OutcomeContext {
  tools: ToolRepository;
  loans: LoanRepository;
  outbox: Outbox;
}

/**
 * TL-LEND-RM02-PJ: one month's outcome measures, from every loan and tool through their repositories and the
 * damage and repair events the outbox keeps, counted by TL-LEND-DS02-SV. Built on each run; nothing is stored.
 */
function projectOutcomeMeasures(ctx: OutcomeContext, month: string, now: Date, timeZone: string): OutcomeMeasures {
  const records = {
    loans: ctx.loans.all(),
    tools: ctx.tools.all(),
    conditionChanges: ctx.outbox.history('DamageReported', 'ToolRepaired'),
  };
  return measureOutcomes(month, records, now, timeZone);
}

/**
 * TL-LEND-RM02-RD: the one way the outcome measures' query handler reads them. The measures are never stored, so the
 * reader builds the month's row of the table with the projection on each read.
 */
export class OutcomeMeasuresReader {
  private readonly ctx: OutcomeContext;

  constructor(ctx: OutcomeContext) {
    this.ctx = ctx;
  }

  /** The measures for `month`, as of `now`, counting dates in `timeZone`. */
  forMonth(month: string, now: Date, timeZone: string): OutcomeMeasures {
    return projectOutcomeMeasures(this.ctx, month, now, timeZone);
  }
}

/** TL-LEND-QRY02-H: the outcome measures for the month asked for, as of `now`, in the library's time zone. */
export function getOutcomeMeasures(measures: OutcomeMeasuresReader, month: string, now: Date, timeZone: string): OutcomeMeasures {
  return measures.forMonth(month, now, assertTimeZone(timeZone));
}

/** TL-LEND-RP01: prints the month's measures as JSON, from the database `DB`. */
function printOutcomeReport(): void {
  const month = process.argv[2] ?? '';
  const timeZone = process.env.TIME_ZONE || DEFAULT_TIME_ZONE;
  if (!process.env.DB) {
    console.error('Usage: DB=library.db node src/outcomes.ts YYYY-MM');
    process.exit(1);
  }
  const db = new Database(process.env.DB);
  try {
    const ctx = { tools: new ToolRepository(db), loans: new LoanRepository(db), outbox: new Outbox(db, () => new Date()) };
    console.log(JSON.stringify(getOutcomeMeasures(new OutcomeMeasuresReader(ctx), month, new Date(), timeZone), null, 2));
  } finally {
    db.close();
  }
}

if (import.meta.main) printOutcomeReport();
