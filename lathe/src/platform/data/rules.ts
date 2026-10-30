// What an aggregate's rules read and report. Each aggregate writes its rules once, in its own rules.ts: its command
// handlers run them on the instance before saving, and every load and commit runs them over all data (through
// AGGREGATE_RULES), for files changed by git or by hand.
import type { Coverage, Problem, TraceChain } from '../../types.ts';
import type { BaselineAnswer } from '../../server/contract.ts';
import type { Row } from './rows.ts';
import type { SchemaDescription } from './schema.ts';
import { StoreError } from './problems.ts';

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
  /**
   * The data at a baseline commit, when the reader of it was given one: only a query whose definition says it reads a
   * baseline (`baseline`) is given it, read from git for the commit its `since` names, and the query runner refuses
   * such a query without it.
   */
  readonly baseline?: BaselineAnswer;
  /**
   * The read model's reader over this data, kept by the data's holder (the store) until a table its projection read
   * changes; data with no holder (a baseline, every product's read as one) has none, and the runner makes the reader
   * each time.
   */
  readerOf?<D>(make: (view: ReadView) => D): D;
}

/** How a read model's reader is made over the data: a query definition's `reader`. */
export type ReaderFactory = (view: ReadView) => unknown;

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
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
