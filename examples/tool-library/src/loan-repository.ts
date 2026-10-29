// Loads and saves the Loan aggregate, whole, in the loans table: its return, a child kept in the loan's row,
// is `returned_at`, `return_condition` and `return_note`.
// Spec: the repository TL-LEND-REPO03 (examples/tool-library/data/).
import type { Database, Row } from './database.ts';
import { Loan, type NewLoan } from './loan.ts';
import { LendingError, type Condition } from './model.ts';

function toLoan(r: Row): Loan {
  return new Loan(Number(r.id), {
    memberId: Number(r.member_id),
    toolId: Number(r.tool_id),
    borrowedAt: String(r.borrowed_at),
    dueDate: String(r.due_date),
    return:
      r.returned_at == null
        ? null
        : { returnedAt: String(r.returned_at), condition: r.return_condition as Condition, note: r.return_note == null ? null : String(r.return_note) },
  });
}

/** TL-LEND-REPO03: the Loan aggregate's repository. */
export class LoanRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Saves a new loan and returns it as stored. The table's unique key backs up TL-LEND-INV03. */
  add(loan: NewLoan): Loan {
    const r = this.db.sqlite
      .prepare(
        'INSERT INTO loans (member_id, tool_id, borrowed_at, due_date, returned_at, return_condition, return_note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
      )
      .get(
        loan.memberId,
        loan.toolId,
        loan.borrowedAt,
        loan.dueDate,
        loan.return?.returnedAt ?? null,
        loan.return?.condition ?? null,
        loan.return?.note ?? null,
      ) as Row;
    return toLoan(r);
  }

  /** The loan with this ID; 404 `loan_not_found` when there is none. */
  get(id: number): Loan {
    const r = this.db.sqlite.prepare('SELECT * FROM loans WHERE id = ?').get(id) as Row | undefined;
    if (!r) throw new LendingError(404, 'loan_not_found', `There is no loan ${id}.`);
    return toLoan(r);
  }

  /** Every loan, in ID order. */
  all(): Loan[] {
    return (this.db.sqlite.prepare('SELECT * FROM loans ORDER BY id').all() as Row[]).map(toLoan);
  }

  /** The member's active loans, in ID order. */
  activeForMember(memberId: number): Loan[] {
    return (
      this.db.sqlite.prepare('SELECT * FROM loans WHERE member_id = ? AND returned_at IS NULL ORDER BY id').all(memberId) as Row[]
    ).map(toLoan);
  }

  /** The tool's active loan, if it is on loan. */
  activeForTool(toolId: number): Loan | undefined {
    const r = this.db.sqlite.prepare('SELECT * FROM loans WHERE tool_id = ? AND returned_at IS NULL').get(toolId) as Row | undefined;
    return r && toLoan(r);
  }

  /** Saves the loan's return, whole, and returns the loan as stored. */
  save(loan: Loan): Loan {
    const r = this.db.sqlite
      .prepare('UPDATE loans SET returned_at = ?, return_condition = ?, return_note = ? WHERE id = ? RETURNING *')
      .get(loan.return?.returnedAt ?? null, loan.return?.condition ?? null, loan.return?.note ?? null, loan.id) as Row;
    return toLoan(r);
  }
}
