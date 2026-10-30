// The Check aggregate's rules, written once: each command's handler runs them on the check before it saves or removes
// it, and every load and commit runs them over all data (checkRules, listed in AGGREGATE_RULES).
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { CHECK_AGGREGATE, checksFrom, type Check } from './model.ts';

/** The query's code with its string literals emptied and one trailing semicolon dropped: what is left is SQL. */
const codeOf = (query: string) => query.trim().replace(/'(?:[^']|'')*'/g, "''").replace(/;\s*$/, '');

/**
 * Every rule the check breaks (LA-CHK-INV01 a product's check takes a name none of Lathe's has; LA-CHK-INV02 Lathe's
 * own checks are read-only; LA-CHK-INV03 a check documents itself; LA-CHK-INV04 its query is one SELECT that says what
 * it returns). `isLathes` says which rows of the view are Lathe's own: only a transaction knows, from where each row
 * was loaded, so over all data none are, and the first two rules hold by construction there (a load changes nothing,
 * and two checks of one name never load).
 */
export function checkProblems(check: Check, view: ReadView, isLathes: (row: Row) => boolean = () => false): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const row = check.check;
  const problem = ({ rule }: { rule: string }, message: string) => problems.push({ rule, table: 'check', row: row as unknown as Row, message });
  const name = check.root;
  if (!check.lathes && view.rows('check').some((other) => other.name === name && isLathes(other))) {
    problem({ rule: 'check-name-own' }, `check ${name} already exists as one of Lathe's own (lathe/data/check.jsonl); give the check a name of its own`);
  }
  if (check.lathes) problem({ rule: 'check-read-only' }, `check ${name} is Lathe's own (lathe/data/check.jsonl), so it cannot change or be removed`);
  const sentences = String(row.summary ?? '').match(/[.!?](\s|$)/g)?.length ?? 0;
  if (sentences !== 1) problem({ rule: 'check-documented' }, `check ${name}'s summary has ${sentences} sentences; a check says what it reports in one`);
  for (const column of ['explanation', 'query'] as const) {
    if (!String(row[column] ?? '').trim()) problem({ rule: 'check-documented' }, `check ${name} has no ${column}; a check gives its summary, explanation, severity and query`);
  }
  const query = String(row.query ?? '');
  if (query.trim()) {
    const code = codeOf(query);
    if (!/^(SELECT|WITH)\b/i.test(code)) problem({ rule: 'check-query-select' }, `check ${name}'s query starts with neither SELECT nor WITH; a check's query is one SELECT`);
    else if (code.includes(';')) problem({ rule: 'check-query-select' }, `check ${name}'s query holds more than one statement; a check's query is one SELECT`);
    const missing = ['record', 'message'].filter((column) => !new RegExp(`\\b${column}\\b`).test(code));
    if (missing.length) problem({ rule: 'check-query-select' }, `check ${name}'s query returns no ${missing.join(' or ')}; a check's query returns record and message`);
    const returnsSeverity = /\bAS severity\b/.test(code);
    if (returnsSeverity !== (row.severity === 'error_or_warning')) {
      problem({ rule: 'check-query-select' },
        returnsSeverity
          ? `check ${name}'s query returns a severity, but the check's severity is ${row.severity}; only an error_or_warning check returns one`
          : `check ${name}'s severity is error_or_warning, so its query returns each row's severity (AS severity)`,
      );
    }
  }
  return problems;
}

/** The rules over all data: every check, Lathe's and the product's. */
export const checkRules: AggregateRules = {
  aggregate: CHECK_AGGREGATE,
  check: (view) => checksFrom((table) => view.rows(table)).flatMap((check) => checkProblems(check, view)),
};

/** Refuses the command, with every reason, when the check as it would be saved or removed breaks one of its rules. */
export function holdToRules(tx: Transaction, check: Check): void {
  const problems = checkProblems(check, tx, (row) => tx.isBuiltIn(row));
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
