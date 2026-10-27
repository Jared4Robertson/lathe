// What the app's server answers, shared by the server (api.ts, history.ts) and the web app, which imports these
// types only. The server reads the product's data through the store and serves the typed rows as they are.
//
//   GET  /api/spec               SpecData: the schema, every stored table's rows, and the checks' problems and coverage
//   POST /api/write              { commands: Command[] } -> WriteAnswer: one transaction through the store's command layer
//   GET  /api/history?id=<ID>    HistoryAnswer: the commits that changed the record's rows (&skip=<n> for older ones)
import type { Command, StoreProblem } from '../store/store.ts';
import type { Row, Value } from '../store/rows.ts';
import type { SchemaDescription } from '../store/schema.ts';
import type { Coverage, Problem } from '../types.ts';

export type { Command, Row, StoreProblem, Value };

/** GET /api/spec. */
export interface SpecData {
  schema: SchemaDescription;
  /** The data folder, relative to the product root and written with /, such as data. */
  dataDir: string;
  /** The rows of every stored table that has any, sorted by key, as the data files hold them. */
  tables: Record<string, Row[]>;
  /** What the checks found. */
  problems: Problem[];
  coverage: Coverage[];
}

/** POST /api/write takes this body. */
export interface WriteRequest {
  commands: Command[];
}

/** One row a write added, changed or removed: its table, its key as the store describes it, and the row before and after. */
export interface RowChange {
  table: string;
  key: string;
  before: Row | null;
  after: Row | null;
}

/** What POST /api/write answers: the changed rows (200), or the store's refusal with every reason (422). */
export type WriteAnswer =
  | { ok: true; tables: string[]; files: string[]; changes: RowChange[] }
  | { ok: false; error: string; problems: StoreProblem[] };

/** One column a commit changed in a row. */
export interface FieldChange {
  name: string;
  /** Absent when the column had no value before. */
  before?: Value;
  /** Absent when the column has no value after. */
  after?: Value;
}

/** One of the record's rows a commit (or the working tree) changed: its own row, a part row it owns, or a link it starts. */
export interface HistoryChange {
  table: string;
  /** The row's key, as the store describes it: TL-LEND-UC01, or entity_id TL-LEND-A1-E1, position 2 for an entity's second field. */
  key: string;
  change: 'added' | 'removed' | 'changed';
  /** The columns that changed; for an added or removed row, every column it has. */
  fields: FieldChange[];
}

export interface HistoryCommit {
  hash: string;
  short: string;
  /** ISO 8601, the author's date. */
  date: string;
  author: string;
  subject: string;
  changes: HistoryChange[];
  /** The commit's diff of the data files was too long to read whole, so its changes may be incomplete. */
  truncated: boolean;
}

/** GET /api/history. */
export type HistoryAnswer =
  | { state: 'no-record'; id: string }
  | { state: 'no-repo'; id: string; files: string[]; message: string }
  | {
      state: 'ok';
      id: string;
      /** The data files that hold the record's rows, relative to the product root. */
      files: string[];
      /** The working tree's changes to its rows that are not committed yet; empty when none. */
      uncommitted: HistoryChange[];
      commits: HistoryCommit[];
      /** Whether older commits are left to load. */
      more: boolean;
    };
