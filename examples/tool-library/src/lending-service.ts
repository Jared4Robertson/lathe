// Lends tools to members and takes them back.
// Spec: TL-LEND-C05 (specs/tool-library/lending/02-design/components/C05-lending-service.md)
import {
  LendingError,
  DEFAULT_TIME_ZONE,
  MAX_ACTIVE_LOANS,
  assertTimeZone,
  dueDate,
  isCondition,
  isLate,
  isOverdue,
  type Clock,
  type Loan,
} from './model.ts';
import type { Store } from './store.ts';

export interface BorrowInput {
  memberId?: unknown;
  toolId?: unknown;
}

export interface ReturnInput {
  condition?: unknown;
  note?: unknown;
}

export interface ReturnedLoan extends Loan {
  late: boolean;
}

function id(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new LendingError(400, 'invalid_request', `${field} must be a positive whole number.`);
}

export class LendingService {
  private readonly store: Store;
  private readonly now: Clock;
  private readonly timeZone: string;

  /** `timeZone` is the library's time zone, in which due dates and overdue loans are counted. */
  constructor(store: Store, now: Clock, timeZone: string = DEFAULT_TIME_ZONE) {
    this.store = store;
    this.now = now;
    this.timeZone = assertTimeZone(timeZone);
  }

  /**
   * TL-LEND-UC03: borrow a tool. Checks run in this order, and the first that fails is
   * the reason given: unknown member, unknown tool, member overdue, member at the loan
   * limit, tool needs repair, tool on loan.
   */
  borrow(input: BorrowInput): Loan {
    const memberId = id(input.memberId, 'memberId');
    const toolId = id(input.toolId, 'toolId');
    const now = this.now();

    return this.store.transaction(() => {
      // TL-LEND-UC03-R04: unknown member or tool.
      if (!this.store.findMember(memberId)) {
        throw new LendingError(404, 'member_not_found', `There is no member ${memberId}.`);
      }
      const tool = this.store.findTool(toolId);
      if (!tool) throw new LendingError(404, 'tool_not_found', `There is no tool ${toolId}.`);

      // TL-LEND-UC03-R03: the member must be able to borrow.
      const active = this.store.activeLoansForMember(memberId);
      if (active.some((loan) => isOverdue(loan, now, this.timeZone))) {
        // TL-LEND-DR03
        throw new LendingError(409, 'member_overdue', 'The member has an overdue loan and cannot borrow until it is returned.');
      }
      if (active.length >= MAX_ACTIVE_LOANS) {
        // TL-LEND-DR02
        throw new LendingError(409, 'loan_limit_reached', `The member already holds ${MAX_ACTIVE_LOANS} active loans.`);
      }

      // TL-LEND-UC03-R02: the tool must be available.
      if (tool.condition === 'needs_repair') {
        // TL-LEND-DR05
        throw new LendingError(409, 'tool_needs_repair', `Tool ${toolId} needs repair and cannot be lent.`);
      }
      if (this.store.activeLoanForTool(toolId)) {
        // TL-LEND-DR06
        throw new LendingError(409, 'tool_on_loan', `Tool ${toolId} is already on loan.`);
      }

      // TL-LEND-DR07 / UC03-R01: the loan is due 14 calendar days after today, in the library's time zone.
      return this.store.insertLoan(memberId, toolId, now.toISOString(), dueDate(now, this.timeZone));
    });
  }

  /** TL-LEND-UC04: return a tool and record its condition. */
  return(loanId: number, input: ReturnInput): ReturnedLoan {
    // TL-LEND-UC04-R01 / DR10: the condition is required and is good or needs repair (DR04).
    if (!isCondition(input.condition)) {
      throw new LendingError(400, 'invalid_condition', 'Record the condition as "good" or "needs_repair".');
    }
    const condition = input.condition;
    const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim() : null;
    const now = this.now();

    return this.store.transaction(() => {
      const loan = this.store.findLoan(loanId);
      if (!loan) throw new LendingError(404, 'loan_not_found', `There is no loan ${loanId}.`);
      // TL-LEND-DR09: a loan is returned once.
      if (loan.returnedAt !== null) {
        throw new LendingError(409, 'already_returned', `Loan ${loanId} was already returned.`);
      }
      const returned = this.store.markReturned(loanId, now.toISOString(), condition, note);

      // TL-LEND-UC04-R02 / R03: the recorded condition decides whether the tool can be lent again.
      // TL-LEND-DR11: a return in good condition does not clear damage reported during the loan,
      // so a return only ever sets the tool's condition to needs repair, never back to good.
      if (condition === 'needs_repair') {
        this.store.setToolCondition(loan.toolId, 'needs_repair', note ?? 'Returned needing repair.');
      }
      // TL-LEND-UC04-R04: a return on a day after the due date is flagged as late.
      return { ...returned, late: isLate(loan, now, this.timeZone) };
    });
  }
}
