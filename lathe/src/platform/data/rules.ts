// What an aggregate's rules read and report. Each aggregate writes its rules once, in its own rules.ts: its command
// handlers run them on the instance before saving, and every load and commit runs them over all data (through
// AGGREGATE_RULES), for files changed by git or by hand.
import type { Row } from './rows.ts';
import type { SchemaDescription } from './schema.ts';
import { StoreError } from './problems.ts';

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

/**
 * The rows after the first of each key, in order: the extra ones a rule of "at most one each" refuses. A row whose key
 * is null or undefined has no parent of that kind and is never extra.
 */
export function beyondFirst<R>(rows: readonly R[], keyOf: (row: R) => string | null | undefined): R[] {
  const seen = new Set<string>();
  const extra: R[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null || key === undefined) continue;
    if (seen.has(key)) extra.push(row);
    else seen.add(key);
  }
  return extra;
}

/** Refuses the command with every problem its aggregate's rules found, when they found any. */
export function refuseBroken(problems: readonly RuleProblem[]): void {
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
