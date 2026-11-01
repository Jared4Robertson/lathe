// The Lending domain's SQLite database (node:sqlite): its schema and its transactions.
// Spec: the tables TL-LEND-EN01-TB, EN02-TB and EN04-TB and the outbox table TL-LEND-TB01 (examples/tool-library/data/).
// Each aggregate's repository reads and writes only its own table; the outbox in events.ts only the outbox.
// The schema backs up two invariants even if the code forgets them:
// TL-LEND-INV01 (unique email) and TL-LEND-INV03 (one active loan per tool).
// A loan's due date is stored as a date (YYYY-MM-DD), not a time (TL-LEND-INV04).
import { DatabaseSync } from 'node:sqlite';

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
  damage_reported_at TEXT,
  added_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members (id),
  tool_id INTEGER NOT NULL REFERENCES tools (id),
  borrowed_at TEXT NOT NULL,
  due_date TEXT NOT NULL CHECK (due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  renewed_at TEXT,
  reminded_at TEXT,
  returned_at TEXT,
  return_condition TEXT CHECK (return_condition IN ('good', 'needs_repair')),
  return_note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS loans_one_active_per_tool ON loans (tool_id) WHERE returned_at IS NULL;

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  event TEXT NOT NULL,
  raised_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX IF NOT EXISTS outbox_undelivered ON outbox (id) WHERE delivered_at IS NULL;
`;

/** A row as node:sqlite returns it. */
export type Row = Record<string, unknown>;

export class Database {
  readonly sqlite: DatabaseSync;

  /** Opens the database at `path` and creates its tables; the default is a fresh in-memory database. */
  constructor(path = ':memory:') {
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
    this.sqlite.exec(SCHEMA);
  }

  close(): void {
    this.sqlite.close();
  }

  /** Runs `fn` in one transaction, so a check and the write it guards cannot interleave. */
  transaction<T>(fn: () => T): T {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.sqlite.exec('COMMIT');
      return result;
    } catch (err) {
      this.sqlite.exec('ROLLBACK');
      throw err;
    }
  }
}
