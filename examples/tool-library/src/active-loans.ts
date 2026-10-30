// The Active loans read model: each loan still out, as the librarian finds it at the desk, worked out on each request.
// Spec: the read model's table TL-LEND-RM03-TB (ActiveLoans, kept in memory only), its projection TL-LEND-RM03-PJ, its
// reader TL-LEND-RM03-RD and the query handler TL-LEND-QRY03-H (examples/tool-library/data/).
// It reads the Loan aggregate through its repository and stores nothing. The query handler reads it only through its reader.
import type { Loan } from './loan.ts';
import type { LoanRepository } from './loan-repository.ts';
import { LendingError } from './model.ts';

/** TL-LEND-RM03: one loan still out, its read model's fields. */
export interface ActiveLoan {
  id: number;
  memberId: number;
  toolId: number;
  borrowedAt: string;
  dueDate: string;
}

/** TL-LEND-RM03-TB: the active loans, kept in memory only, built on each request. */
export type ActiveLoans = ActiveLoan[];

/** TL-LEND-RM03-PJ: an active loan's entry, from the loan. */
function activeLoanEntry(loan: Loan): ActiveLoan {
  return { id: loan.id, memberId: loan.memberId, toolId: loan.toolId, borrowedAt: loan.borrowedAt, dueDate: loan.dueDate };
}

/**
 * TL-LEND-RM03-RD: the one way the active loans' query handlers read them. They are never stored, so the reader
 * builds the row asked for with the projection on each read, from the Loan repository.
 */
export class ActiveLoansReader {
  private readonly loans: LoanRepository;

  constructor(ctx: { loans: LoanRepository }) {
    this.loans = ctx.loans;
  }

  /** The tool's active loan, or undefined when the tool is not on loan (or there is no such tool). */
  forTool(toolId: number): ActiveLoan | undefined {
    const loan = this.loans.activeForTool(toolId);
    return loan && activeLoanEntry(loan);
  }
}

/** TL-LEND-QRY03-H: the active loan of the tool whose tag the librarian reads; 404 `loan_not_found` when it is not on loan. */
export function findLoan(activeLoans: ActiveLoansReader, toolId: number): ActiveLoan {
  const loan = activeLoans.forTool(toolId);
  if (!loan) throw new LendingError(404, 'loan_not_found', `Tool ${toolId} is not on loan.`);
  return loan;
}
