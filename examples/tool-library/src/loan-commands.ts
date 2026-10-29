// The Loan aggregate's command handlers, one per command.
// Spec: the command handlers TL-LEND-CMD05-H and CMD06-H (examples/tool-library/data/).
// Each changes only the Loan, through its repository, saves its event to the outbox in the same transaction, and
// runs the relay once it commits. Borrowing reads the member and the tool through their own repositories, and
// the Loan aggregate checks them.
import type { Database } from './database.ts';
import type { Outbox } from './events.ts';
import { Loan } from './loan.ts';
import type { LoanRepository } from './loan-repository.ts';
import type { MemberRepository } from './member-repository.ts';
import { LendingError, isCondition, parseNote, type Clock } from './model.ts';
import type { ToolRepository } from './tool-repository.ts';

export interface BorrowToolInput {
  memberId?: unknown;
  toolId?: unknown;
}

export interface ReturnToolInput {
  condition?: unknown;
  note?: unknown;
}

/** What the Loan aggregate's command handlers need. `timeZone` is the library's, in which days are counted. */
export interface LoanCommandContext {
  db: Database;
  members: MemberRepository;
  tools: ToolRepository;
  loans: LoanRepository;
  outbox: Outbox;
  now: Clock;
  timeZone: string;
}

/** A loan as Return a tool leaves it, and whether the return was late. */
export interface ReturnedLoan {
  loan: Loan;
  late: boolean;
}

function id(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new LendingError(400, 'invalid_request', `${field} must be a positive whole number.`);
}

/**
 * TL-LEND-CMD05-H: borrow a tool. Checks run in this order, and the first that fails is the reason given:
 * unknown member, unknown tool (TL-LEND-UC03-R04), then the Loan aggregate's checks (Loan.open).
 */
export function borrowTool(ctx: LoanCommandContext, input: BorrowToolInput): Loan {
  const memberId = id(input.memberId, 'memberId');
  const toolId = id(input.toolId, 'toolId');
  const now = ctx.now();

  const loan = ctx.db.transaction(() => {
    const member = ctx.members.get(memberId);
    const tool = ctx.tools.get(toolId);
    const opened = Loan.open(
      { member, memberActiveLoans: ctx.loans.activeForMember(memberId), tool, toolOnLoan: ctx.loans.activeForTool(toolId) !== undefined },
      now,
      ctx.timeZone,
    );
    const saved = ctx.loans.add(opened);
    // TL-LEND-EV05
    ctx.outbox.save({
      type: 'LoanOpened',
      loanId: saved.id,
      memberId: saved.memberId,
      toolId: saved.toolId,
      borrowedAt: saved.borrowedAt,
      dueDate: saved.dueDate,
    });
    return saved;
  });
  ctx.outbox.relay();
  return loan;
}

/**
 * TL-LEND-CMD06-H: return a tool and record its condition. It changes only the loan: a tool returned
 * needing repair is taken out of lending by the policy TL-LEND-PO01, which hears Tool returned.
 */
export function returnTool(ctx: LoanCommandContext, loanId: number, input: ReturnToolInput): ReturnedLoan {
  // TL-LEND-INV06: the condition is required and is good or needs repair (TL-VO03-C01).
  // TL-PAT-LIBRARIAN-ACTION-R01: a missing condition is refused before anything is saved.
  if (!isCondition(input.condition)) {
    throw new LendingError(400, 'invalid_condition', 'Record the condition as "good" or "needs_repair".');
  }
  const condition = input.condition;
  // TL-VO04-C01: an optional note; a blank one is none.
  const note = parseNote(input.note);
  const now = ctx.now();

  const returned = ctx.db.transaction(() => {
    const loaded = ctx.loans.get(loanId);
    // TL-LEND-INV05, INV06 and SP01: the aggregate records the return once and says whether it was late.
    const { return: recorded, late } = loaded.recordReturn(now, condition, note, ctx.timeZone);
    const saved = ctx.loans.save(loaded);
    // TL-LEND-EV06, saved to the outbox with the return, so TL-LEND-PO01's reaction is never lost.
    ctx.outbox.save({
      type: 'ToolReturned',
      loanId: saved.id,
      memberId: saved.memberId,
      toolId: saved.toolId,
      returnedAt: recorded.returnedAt,
      condition: recorded.condition,
      note: recorded.note,
      late,
    });
    return { loan: saved, late };
  });
  // The return stands whatever its handlers do; one that fails leaves the event for the next relay run.
  ctx.outbox.relay();
  return returned;
}
