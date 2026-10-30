// Why the store refused data or a write: each problem with its rule, its message and where it is.
import type { Row } from './rows.ts';

/** Where a row loaded from a file came from: its data file and line. A row a command made has none. */
export type Origin = { file: string; line: number };

/** One reason the store refused data or a write. */
export interface StoreProblem {
  /** The rule broken, such as foreign-key, unique, check, required or relation-pair. */
  rule: string;
  message: string;
  table?: string;
  /** The row's key, such as TL-LEND-UC01. */
  key?: string;
  /** The data file and line, for a row loaded from a file. */
  file?: string;
  line?: number;
}

/** The store refused to load or to write; nothing changed. */
export class StoreError extends Error {
  readonly problems: StoreProblem[];
  constructor(problems: StoreProblem[]) {
    super(problems.map(formatProblem).join('\n'));
    this.name = 'StoreError';
    this.problems = problems;
  }
}

/** A problem as one line: where, then what. */
export function formatProblem(p: StoreProblem): string {
  const where = p.file ? `${p.file}:${p.line}` : p.table ? p.table : 'data';
  return `${where}: ${p.message} [${p.rule}]`;
}

/** The problem placed at its row's data file and line, for a row loaded from a file. */
export const problemAt = (origins: WeakMap<Row, Origin>, row: Row | undefined, p: StoreProblem): StoreProblem => {
  const origin = row ? origins.get(row) : undefined;
  return origin ? { ...p, file: origin.file, line: origin.line } : p;
};
