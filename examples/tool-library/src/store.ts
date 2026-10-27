// Storage for members, tools and loans in SQLite (node:sqlite).
// Spec: the repositories TL-LEND-A1-REPO, A2-REPO and A3-REPO and the tables TL-LEND-EN01-TB, EN02-TB
// and EN04-TB (examples/tool-library/data/).
// The schema backs up two invariants even if a command handler forgets them:
// TL-LEND-INV01 (unique email) and TL-LEND-INV03 (one active loan per tool).
// A loan's due date is stored as a date (YYYY-MM-DD), not a time (TL-LEND-INV04).
import { DatabaseSync } from 'node:sqlite';
import type { Condition, Loan, Member, Tool } from './model.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  joined_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS members_email ON members (email);

CREATE TABLE IF NOT EXISTS tools (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'needs_repair')),
  damage_note TEXT,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members (id),
  tool_id INTEGER NOT NULL REFERENCES tools (id),
  borrowed_at TEXT NOT NULL,
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  returned_at TEXT,
  return_condition TEXT CHECK (return_condition IN ('good', 'needs_repair')),
  return_note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS loans_one_active_per_tool ON loans (tool_id) WHERE returned_at IS NULL;
`;

type Row = Record<string, unknown>;

function toMember(r: Row): Member {
  return { id: Number(r.id), name: String(r.name), email: String(r.email), joinedAt: String(r.joined_at) };
}

function toTool(r: Row): Tool {
  return {
    id: Number(r.id),
    name: String(r.name),
    description: String(r.description),
    condition: r.condition as Condition,
    damageNote: r.damage_note == null ? null : String(r.damage_note),
    addedAt: String(r.added_at),
  };
}

function toLoan(r: Row): Loan {
  return {
    id: Number(r.id),
    memberId: Number(r.member_id),
    toolId: Number(r.tool_id),
    borrowedAt: String(r.borrowed_at),
    dueDate: String(r.due_date),
    returnedAt: r.returned_at == null ? null : String(r.returned_at),
    returnCondition: r.return_condition == null ? null : (r.return_condition as Condition),
    returnNote: r.return_note == null ? null : String(r.return_note),
  };
}

export class Store {
  readonly db: DatabaseSync;

  /** Opens the database at `path`; the default is a fresh in-memory database. */
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  /** Runs `fn` in one transaction, so a check and the write it guards cannot interleave. */
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  insertMember(name: string, email: string, joinedAt: string): Member {
    const r = this.db
      .prepare('INSERT INTO members (name, email, joined_at) VALUES (?, ?, ?) RETURNING *')
      .get(name, email, joinedAt) as Row;
    return toMember(r);
  }

  findMember(id: number): Member | undefined {
    const r = this.db.prepare('SELECT * FROM members WHERE id = ?').get(id) as Row | undefined;
    return r && toMember(r);
  }

  findMemberByEmail(email: string): Member | undefined {
    const r = this.db.prepare('SELECT * FROM members WHERE email = ?').get(email) as Row | undefined;
    return r && toMember(r);
  }

  insertTool(name: string, description: string, addedAt: string): Tool {
    const r = this.db
      .prepare('INSERT INTO tools (name, description, added_at) VALUES (?, ?, ?) RETURNING *')
      .get(name, description, addedAt) as Row;
    return toTool(r);
  }

  findTool(id: number): Tool | undefined {
    const r = this.db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as Row | undefined;
    return r && toTool(r);
  }

  listTools(): Tool[] {
    return (this.db.prepare('SELECT * FROM tools ORDER BY id').all() as Row[]).map(toTool);
  }

  setToolCondition(id: number, condition: Condition, damageNote: string | null): Tool {
    const r = this.db
      .prepare('UPDATE tools SET condition = ?, damage_note = ? WHERE id = ? RETURNING *')
      .get(condition, damageNote, id) as Row;
    return toTool(r);
  }

  insertLoan(memberId: number, toolId: number, borrowedAt: string, dueDate: string): Loan {
    const r = this.db
      .prepare('INSERT INTO loans (member_id, tool_id, borrowed_at, due_date) VALUES (?, ?, ?, ?) RETURNING *')
      .get(memberId, toolId, borrowedAt, dueDate) as Row;
    return toLoan(r);
  }

  findLoan(id: number): Loan | undefined {
    const r = this.db.prepare('SELECT * FROM loans WHERE id = ?').get(id) as Row | undefined;
    return r && toLoan(r);
  }

  activeLoansForMember(memberId: number): Loan[] {
    return (
      this.db
        .prepare('SELECT * FROM loans WHERE member_id = ? AND returned_at IS NULL ORDER BY id')
        .all(memberId) as Row[]
    ).map(toLoan);
  }

  activeLoanForTool(toolId: number): Loan | undefined {
    const r = this.db
      .prepare('SELECT * FROM loans WHERE tool_id = ? AND returned_at IS NULL')
      .get(toolId) as Row | undefined;
    return r && toLoan(r);
  }

  markReturned(id: number, returnedAt: string, condition: Condition, note: string | null): Loan {
    const r = this.db
      .prepare(
        'UPDATE loans SET returned_at = ?, return_condition = ?, return_note = ? WHERE id = ? AND returned_at IS NULL RETURNING *',
      )
      .get(returnedAt, condition, note, id) as Row | undefined;
    if (!r) throw new Error(`Loan ${id} is not active`);
    return toLoan(r);
  }
}
