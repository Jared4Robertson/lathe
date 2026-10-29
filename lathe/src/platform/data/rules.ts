// What an aggregate's rules read and report. Each aggregate writes its rules once, in its own rules.ts: its command
// handlers run them on the instance before saving, and every load and commit runs them over all data (through
// AGGREGATE_RULES), for files changed by git or by hand.
import type { Row } from './rows.ts';
import type { SchemaDescription } from './schema.ts';

/** The data as a rule reads it: every table's rows, and any record by its ID. Read only. */
export interface ReadView {
  readonly schema: SchemaDescription;
  /** A table's rows. */
  rows(table: string): Row[];
  /** The record with this ID, with its kind, or undefined. */
  record(id: string): { kind: string; row: Row } | undefined;
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
