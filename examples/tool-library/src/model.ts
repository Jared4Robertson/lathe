// The Lending model: records, values and the rules that need no storage.
// Spec: TL-LEND-C01 (specs/tool-library/lending/02-design/components/C01-model.md)

/** TL-LEND-DR07: a loan lasts 14 days. */
export const LOAN_DAYS = 14;
/** TL-LEND-DR02: a member holds at most 3 active loans. */
export const MAX_ACTIVE_LOANS = 3;

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
  dueAt: string;
  returnedAt: string | null;
  returnCondition: Condition | null;
  returnNote: string | null;
}

export function isCondition(value: unknown): value is Condition {
  return typeof value === 'string' && (CONDITIONS as readonly string[]).includes(value);
}

/** TL-LEND-DR07: the due time is exactly LOAN_DAYS after the loan starts. */
export function dueAt(borrowedAt: Date): Date {
  return new Date(borrowedAt.getTime() + LOAN_DAYS * DAY_MS);
}

/** TL-LEND-DR08: a loan is overdue when it is still active after its due time. */
export function isOverdue(loan: Pick<Loan, 'dueAt' | 'returnedAt'>, now: Date): boolean {
  return loan.returnedAt === null && now.getTime() > Date.parse(loan.dueAt);
}

/** A return is late when it happens after the due time. */
export function isLate(loan: Pick<Loan, 'dueAt'>, returnedAt: Date): boolean {
  return returnedAt.getTime() > Date.parse(loan.dueAt);
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
