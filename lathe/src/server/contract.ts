// What the app's server answers, shared by the server (api.ts, history.ts) and the web app, which imports these
// types only. The server reads each product's data through its own store; every read is a query's own answer.
//
//   POST /api/<aggregate>/<command>   the command's input -> WriteAnswer: one aggregate command, such as /api/use-case/add-flow-step
//   GET  /api/<slice>/<query>?<field>=<value>   the query's answer, such as a UseCase for /api/use-case/get-use-case?id=<ID>; ReadRefusal otherwise
//   GET  /api/history?id=<ID>    HistoryAnswer: the commits that changed the record's rows (&skip=<n> for older ones)
import type { StoreProblem } from '../platform/data/problems.ts';
import type { Row, Value } from '../platform/data/rows.ts';

export type { Row, StoreProblem, Value };

/** One row a command added, changed or removed: its table, its key as the store describes it, and the row before and after. */
export interface RowChange {
  table: string;
  key: string;
  before: Row | null;
  after: Row | null;
}

/** What each POST /api/<aggregate>/<command> answers: the changed rows (200), or the refusal with every reason (422). */
export type WriteAnswer =
  | { ok: true; tables: string[]; files: string[]; changes: RowChange[] }
  | { ok: false; error: string; problems: StoreProblem[] };

/**
 * What GET /api/<aggregate>/<query> answers when it does not read: 400 when the input is not of the query's shape
 * (an unknown field, a missing one, a value not of its type), 422 with the reasons when the query refuses (no record
 * has the ID, or it is of another aggregate). Answered 200, the body is the query's own answer, typed by its
 * definition (QueryDefinition's R), such as the UseCase of get-use-case.
 */
export interface ReadRefusal {
  error: string;
  problems?: StoreProblem[];
}

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

/** Which baseline the Record changes read (LA-EXP-QRY13) is given: the last commit, the branch's start, or a commit the app noted earlier. */
export type BaselineSince = 'commit' | 'branch' | { commit: string };

/** The product's rows at a baseline, read from git, which the server gives the Record changes read (`ReadView.baseline`). */
export type BaselineAnswer =
  | {
      state: 'ok';
      /** The baseline's commit, its short hash, subject and author's date (ISO 8601). */
      commit: string;
      short: string;
      subject: string;
      date: string;
      /** For `since=branch`, the default branch it is measured from (main, master); otherwise null. */
      base: string | null;
      /** The rows of every table its data files held at that commit. */
      tables: Record<string, Row[]>;
    }
  | { state: 'no-repo' | 'no-commit'; message: string };
