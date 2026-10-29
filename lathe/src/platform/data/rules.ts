// What an aggregate's rules read and report. Each aggregate writes its rules once, in its own rules.ts: its command
// handlers run them on the instance before saving, and every load and commit runs them over all data (through
// AGGREGATE_RULES), for files changed by git or by hand.
import type { Coverage, Problem, TraceChain } from '../../types.ts';
import type { Row } from './rows.ts';
import type { SchemaDescription } from './schema.ts';

/**
 * What a run of the checks over the data found: every problem, coverage by domain, and each obligation's chain. It is
 * worked out from the data, its files and the checks' queries (asynchronously, in the database), never read from rows.
 */
export interface CheckRun {
  problems: readonly Problem[];
  coverage: readonly Coverage[];
  chains: readonly TraceChain[];
}

/** The data as a rule reads it: every table's rows, and any record by its ID. Read only. */
export interface ReadView {
  readonly schema: SchemaDescription;
  /** A table's rows. */
  rows(table: string): Row[];
  /** The record with this ID, with its kind, or undefined. */
  record(id: string): { kind: string; row: Row } | undefined;
  /**
   * The checks' run over this data, when the reader of it was given one: only a query whose definition says it reads
   * the run (`checked`) is given it, and the query runner refuses such a query without it.
   */
  readonly checked?: CheckRun;
}

/** One row that breaks an aggregate's rule. */
export interface RuleProblem {
  /** The rule's name, such as step-fulfills-own-use-case. */
  rule: string;
  /** The row's table, and the row, so the problem names its file and line or its command. */
  table: string;
  row: Row;
  message: string;
}

/** An aggregate's rules over all data, as every load and commit runs them. */
export interface AggregateRules {
  /** The aggregate's record ID, such as LA-AUT-A11. */
  aggregate: string;
  /** Every row of the data that breaks one of the aggregate's rules. */
  check(view: ReadView): RuleProblem[];
}
