// Why the store refused data or a write: each problem with its rule, its message and where it is.
import type { Row } from './rows.ts';

/** Where a row came from: a line of a data file, or a command of the write that made or changed it. */
export type Origin = { file: string; line: number } | { command: number };

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
  /** The command's place in the write, from 0, for a row a write made or changed. */
  command?: number;
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
  const where = p.file ? `${p.file}:${p.line}` : p.command !== undefined ? `command ${p.command + 1}` : p.table ? p.table : 'data';
  return `${where}: ${p.message} [${p.rule}]`;
}

/** The problem placed where its row came from: its file and line, or the command that wrote it. */
export const problemAt = (origins: WeakMap<Row, Origin>, row: Row | undefined, p: StoreProblem): StoreProblem => {
  const origin = row ? origins.get(row) : undefined;
  if (!origin) return p;
  return 'file' in origin ? { ...p, file: origin.file, line: origin.line } : { ...p, command: origin.command };
};
