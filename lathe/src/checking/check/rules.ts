// The Check aggregate's rules, written once: each command's handler runs them on the check before it saves or removes
// it, and every load and commit runs them over all data (checkRules, listed in AGGREGATE_RULES).
import type { DuckDBConnection } from '@duckdb/node-api';
import type { IntegrityQuery } from '../../platform/data/integrity.ts';
import type { AggregateRules, ReadView, RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { CHECK_AGGREGATE, checksFrom, type Check } from './model.ts';

/**
 * The query's code with its plain string literals emptied and one trailing semicolon dropped, for the columns it names.
 * Whether it is one statement is DuckDB's to say (checkQueries): no pattern can follow every way DuckDB quotes text.
 */
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

/**
 * The part of LA-CHK-INV04 only DuckDB can judge: a check's query is exactly one statement, a SELECT, as DuckDB's own
 * parser reads it (json_serialize_sql serializes SELECT statements only, and lists each). So no quoting DuckDB knows
 * (E'…' escapes, $$…$$, comments) hides a second statement. A query DuckDB cannot parse at all runs no statement: its
 * check reports that it could not run.
 */
const checkQueries: IntegrityQuery[] = [
  {
    name: 'check-query-select',
    description: "A check's query that DuckDB reads as more than one statement, or as one that is not a SELECT.",
    sql: `WITH parsed AS (
  SELECT name, json_serialize_sql(query)::JSON AS tree FROM "check"
)
SELECT 'check' AS table_name, name AS row_key,
  'check ' || name || '''s query ' || CASE WHEN (tree->>'error')::BOOLEAN THEN 'holds a statement that is not a SELECT'
    ELSE 'holds ' || json_array_length(tree->'statements') || ' statements' END || ', as DuckDB reads it; a check''s query is one SELECT' AS message
FROM parsed
WHERE CASE WHEN (tree->>'error')::BOOLEAN THEN tree->>'error_type' <> 'parser' ELSE json_array_length(tree->'statements') <> 1 END
ORDER BY name`,
  },
];

// What seals the database against everything outside it (LA-CHK-INV06). DuckDB's settings, global to its instance:
// - enable_external_access off: no file or URL is read or written (COPY, read_text, read_csv, glob, ATTACH or EXPORT
//   of a file, INSTALL), and no extension is loaded;
// - the extension settings off, so no extension comes in by any other road (those Lathe uses are linked in);
// - persistent secrets off, so no secret is read from or written to the home folder;
// - the HTTP proxy blanked: DuckDB takes it from HTTP_PROXY, with any password in it, and duckdb_settings() shows it;
// - lock_configuration last, so no SET, RESET or PRAGMA changes any of them again.
const SEALED = [
  'SET enable_external_access = false',
  'SET allow_community_extensions = false',
  'SET allow_unsigned_extensions = false',
  'SET autoinstall_known_extensions = false',
  'SET autoload_known_extensions = false',
  "SET allow_extension_repositories = 'forbidden'",
  'SET allow_persistent_secrets = false',
  "SET http_proxy = ''",
  "SET http_proxy_username = ''",
  "SET http_proxy_password = ''",
  'SET lock_configuration = true',
].join(';\n');

/**
 * Seals the database the connection is to (LA-CHK-INV06), before any query of a product's data runs: a database that
 * cannot be sealed refuses the load or write that asked, with check-query-sealed, so no query runs on an open one.
 */
export async function sealDatabase(connection: DuckDBConnection): Promise<void> {
  try {
    await connection.run(SEALED);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
    throw new StoreError([{ rule: 'check-query-sealed', message: `the database cannot be sealed against files, URLs, extensions and its settings, so no query of the data runs: ${reason}` }]);
  }
}

/** The rules over all data: every check, Lathe's and the product's. */
export const checkRules: AggregateRules = {
  aggregate: CHECK_AGGREGATE,
  check: (view) => checksFrom((table) => view.rows(table)).flatMap((check) => checkProblems(check, view)),
  queries: checkQueries,
};

/** Refuses the command, with every reason, when the check as it would be saved or removed breaks one of its rules. */
export function holdToRules(tx: Transaction, check: Check): void {
  const problems = checkProblems(check, tx, (row) => tx.isBuiltIn(row));
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
