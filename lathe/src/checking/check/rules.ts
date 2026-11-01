// The Check aggregate's rules, written once: each command's handler runs them on the check before it saves or removes
// it, and every load and commit runs them over all data (checkRules, listed in AGGREGATE_RULES).
import { StatementType, type DuckDBConnection } from '@duckdb/node-api';
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

/** The query nodes of a SELECT that only reads; DuckDB serializes an INSERT, UPDATE, DELETE or COPY inside a WITH as a node of another type. */
const READING_NODES = ['SELECT_NODE', 'SET_OPERATION_NODE', 'RECURSIVE_CTE_NODE', 'CTE_NODE'];

/**
 * How DuckDB's own parser reads the query of each row `from` gives (name, query): the reason it is not exactly one
 * SELECT that only reads, or NULL. json_serialize_sql serializes SELECT statements only and lists each, so no quoting
 * DuckDB knows (E'…' escapes, $$…$$, comments) hides a second statement; and its tree names every query node, so no
 * INSERT, UPDATE, DELETE or COPY hides inside a WITH or a subquery. A query DuckDB cannot parse at all is NULL here: it
 * runs no statement, and its check reports that it could not run. The rule (LA-CHK-INV04) and the check run read it.
 */
export const queryReadingSql = (from: string): string => `WITH parsed AS (
  SELECT name, json_serialize_sql(query)::JSON AS tree FROM ${from}
), writes AS (
  SELECT p.name, min(replace(t.value->>'$', '_QUERY_NODE', '')) AS node
  FROM parsed p, json_tree(p.tree) t
  WHERE t.key = 'type' AND json_type(t.value) = 'VARCHAR' AND (t.value->>'$') LIKE '%NODE'
    AND (t.value->>'$') NOT IN (${READING_NODES.map((n) => `'${n}'`).join(', ')})
  GROUP BY p.name
)
SELECT p.name, CASE
  WHEN (p.tree->>'error')::BOOLEAN THEN CASE WHEN p.tree->>'error_type' <> 'parser' THEN 'holds a statement that is not a SELECT' END
  WHEN json_array_length(p.tree->'statements') <> 1 THEN 'holds ' || json_array_length(p.tree->'statements') || ' statements'
  WHEN w.node IS NOT NULL THEN 'holds ' || CASE WHEN w.node IN ('INSERT', 'UPDATE') THEN 'an ' ELSE 'a ' END || w.node || ' inside its SELECT'
END AS reason
FROM parsed p LEFT JOIN writes w ON w.name = p.name`;

// Runs a check's query (LA-CHK-INV04, LA-CHK-INV06): first DuckDB's parser reads it, binding nothing, and a query
// that is not one SELECT that only reads is refused before any of it is bound or run, whatever the rules let through.
// Then it runs as one prepared SELECT inside a transaction that is always rolled back, so no check changes the data
// the next check or coverage reads.
export async function runCheckQuery<T>(connection: DuckDBConnection, sql: string): Promise<T[]> {
  const reading = await connection.prepare(`SELECT reason FROM (${queryReadingSql("(SELECT 'query' AS name, $1::VARCHAR AS query)")})`);
  let reason: string | null;
  try {
    reading.bindVarchar(1, sql);
    reason = ((await reading.runAndReadAll()).getRowObjectsJson()[0]?.reason ?? null) as string | null;
  } finally {
    reading.destroySync();
  }
  if (reason) throw new Error(`its query ${reason}, as DuckDB reads it; a check's query is one SELECT that only reads`);
  await connection.run('BEGIN TRANSACTION');
  try {
    const statement = await connection.prepare(sql);
    try {
      if (statement.statementType !== StatementType.SELECT) throw new Error("its query is not a SELECT; a check's query is one SELECT that only reads");
      return (await statement.runAndReadAll()).getRowObjectsJson() as unknown as T[];
    } finally {
      statement.destroySync();
    }
  } finally {
    await connection.run('ROLLBACK');
  }
}

/** The part of LA-CHK-INV04 only DuckDB can judge, over every check row (queryReadingSql). */
const checkQueries: IntegrityQuery[] = [
  {
    name: 'check-query-select',
    description: "A check's query that DuckDB reads as more than one statement, as one that is not a SELECT, or as a SELECT that changes data.",
    sql: `SELECT 'check' AS table_name, name AS row_key,
  'check ' || name || '''s query ' || reason || ', as DuckDB reads it; a check''s query is one SELECT that only reads' AS message
FROM (${queryReadingSql('"check"')})
WHERE reason IS NOT NULL
ORDER BY name`,
  },
];

// What seals the database against everything outside it (LA-CHK-INV06). DuckDB's settings, global to its instance:
// - temp_directory blanked first: with external access off, DuckDB keeps the temporary folder (.tmp under the working
//   folder) readable to every query; blank, it keeps none, and nothing spills to disk;
// - enable_external_access off: no file or URL is read or written (COPY, read_text, read_csv, glob, ATTACH or EXPORT
//   of a file, INSTALL), and no extension is loaded;
// - the extension settings off, so no extension comes in by any other road (those Lathe uses are linked in);
// - persistent secrets off, so no secret is read from or written to the home folder;
// - the HTTP proxy blanked: DuckDB takes it from HTTP_PROXY, with any password in it, and duckdb_settings() shows it;
// - lock_configuration last, so no SET, RESET or PRAGMA changes any of them again.
const SEALED = [
  "SET temp_directory = ''",
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
