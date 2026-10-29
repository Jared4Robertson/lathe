// The Loan aggregate: one member holding one tool, from borrowing to return.
// Spec: the aggregate TL-LEND-A3, its data models TL-LEND-EN04-DM and EN05-DM, its invariants TL-LEND-INV03 to
// INV06 and the predicates TL-LEND-SP01-PR to SP03-PR (examples/tool-library/data/).
// Opening a loan checks the member and the tool as they are passed in; it changes neither.
import { LendingError, dueDate, localDate, type Condition } from './model.ts';
import type { Member } from './member.ts';
import { needsRepair, type Tool } from './tool.ts';

/** TL-LEND-SP03: a member is at the loan limit with 3 active loans. */
export const MAX_ACTIVE_LOANS = 3;

/** TL-LEND-EN05-DM: the end of a loan, recorded once (TL-LEND-INV05, INV06). */
export interface LoanReturn {
  readonly returnedAt: string;
  readonly condition: Condition;
  readonly note: string | null;
}

/** A loan not saved yet, with no ID. */
export interface NewLoan {
  readonly memberId: number;
  readonly toolId: number;
  readonly borrowedAt: string;
  /** The last day of the loan, as YYYY-MM-DD in the library's time zone. */
  readonly dueDate: string;
  readonly return: LoanReturn | null;
}

/**
 * TL-LEND-SP01-PR: a loan is overdue when it is still active and today, in the library's
 * time zone, is after its due date. It is never overdue during its due date.
 */
export function isOverdue(loan: Pick<NewLoan, 'dueDate' | 'return'>, now: Date, timeZone: string): boolean {
  return loan.return === null && localDate(now, timeZone) > loan.dueDate;
}

/** TL-LEND-SP01-PR: a return is late when the loan was overdue at the moment of return. */
export function isLate(loan: Pick<NewLoan, 'dueDate'>, returnedAt: Date, timeZone: string): boolean {
  return localDate(returnedAt, timeZone) > loan.dueDate;
}

/** TL-LEND-SP02-PR: a member has an overdue loan when any of their active loans is overdue. */
export function hasOverdueLoan(activeLoans: readonly Pick<NewLoan, 'dueDate' | 'return'>[], now: Date, timeZone: string): boolean {
  return activeLoans.some((loan) => isOverdue(loan, now, timeZone));
}

/** TL-LEND-SP03-PR: a member is at the loan limit when they hold MAX_ACTIVE_LOANS active loans. */
export function atLoanLimit(activeLoans: readonly unknown[]): boolean {
  return activeLoans.length >= MAX_ACTIVE_LOANS;
}

/** What opening a loan checks: the member and their active loans, the tool and whether it is on loan. */
export interface Borrowing {
  member: Member;
  memberActiveLoans: readonly Loan[];
  tool: Tool;
  toolOnLoan: boolean;
}

/** TL-LEND-EN04-DM: a loan, the Loan aggregate's root. Only its own methods record its return. */
export class Loan {
  readonly id: number;
  readonly memberId: number;
  readonly toolId: number;
  readonly borrowedAt: string;
  readonly dueDate: string;
  #return: LoanReturn | null;

  constructor(id: number, fields: NewLoan) {
    this.id = id;
    this.memberId = fields.memberId;
    this.toolId = fields.toolId;
    this.borrowedAt = fields.borrowedAt;
    this.dueDate = fields.dueDate;
    this.#return = fields.return;
  }

  /** TL-LEND-EN05-DM: the loan's return, once it is returned. */
  get return(): LoanReturn | null {
    return this.#return;
  }

  /**
   * TL-LEND-CMD05: a new loan. Checks run in this order, and the first that fails is the reason given:
   * member overdue (TL-LEND-SP02), member at the loan limit (SP03), tool needs repair (SP04), tool on loan
   * (TL-LEND-INV03). The loan is due 14 calendar days after today, in the library's time zone (TL-LEND-INV04).
   */
  static open(borrowing: Borrowing, now: Date, timeZone: string): NewLoan {
    const { member, memberActiveLoans, tool, toolOnLoan } = borrowing;
    if (hasOverdueLoan(memberActiveLoans, now, timeZone)) {
      throw new LendingError(409, 'member_overdue', 'The member has an overdue loan and cannot borrow until it is returned.');
    }
    if (atLoanLimit(memberActiveLoans)) {
      throw new LendingError(409, 'loan_limit_reached', `The member already holds ${MAX_ACTIVE_LOANS} active loans.`);
    }
    if (needsRepair(tool)) {
      throw new LendingError(409, 'tool_needs_repair', `Tool ${tool.id} needs repair and cannot be lent.`);
    }
    if (toolOnLoan) {
      throw new LendingError(409, 'tool_on_loan', `Tool ${tool.id} is already on loan.`);
    }
    return { memberId: member.id, toolId: tool.id, borrowedAt: now.toISOString(), dueDate: dueDate(now, timeZone), return: null };
  }

  /**
   * TL-LEND-CMD06: records the return with the tool's condition and an optional note (TL-LEND-INV06), once
   * (TL-LEND-INV05), and says whether it was late (TL-LEND-SP01).
   */
  recordReturn(returnedAt: Date, condition: Condition, note: string | null, timeZone: string): { return: LoanReturn; late: boolean } {
    if (this.#return !== null) {
      throw new LendingError(409, 'already_returned', `Loan ${this.id} was already returned.`);
    }
    this.#return = { returnedAt: returnedAt.toISOString(), condition, note };
    return { return: this.#return, late: isLate(this, returnedAt, timeZone) };
  }
}
