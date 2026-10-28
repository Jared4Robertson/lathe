// Coverage as views over the typed tables, and the facts the engine gathers from the code before the checks run.
//
// Every obligation (a member of the obligation supertype: constraints, invariants, specifications, policies, domain
// services, UC requirements, view requirements, API requirements, pattern rules, standard rules and a product's own
// obligation kinds) is counted as:
// - designed: its implementation is specified. A UC requirement is designed once a flow step fulfills it, a standard
//   rule once a technical record meets it, a product's own obligation once a design link targets it; the others by
//   construction (DESIGNED_BY_CONSTRUCTION);
// - built: a technical record that implements it names a file that exists;
// - proved: a test of it exists, automated or manual, at a level its test kind allows (ALLOWED_LEVELS), and an
//   automated test's file exists and names the test's ID.
// A pattern rule asks for proof only: it is owed by each domain that follows its pattern (pattern_rule_standing) and
// proved there by its pattern rule test naming that domain.
//
// Besides obligations, coverage reports the records short of a minimum, the "at least one" and "exactly one" rules
// the schema leaves to the checks because records are written stage by stage (GAP_RULES): a use case with no flow, an
// aggregate with no root, a command with no handler. The checks read the same views and tables.
import { sqlName, sqlString, type SchemaDescription, type Stage } from './store/schema.ts';

/** The run by levels each test kind allows: a test at another level is reported by test-level-not-allowed and proves nothing. */
export const ALLOWED_LEVELS: Readonly<Record<string, readonly string[]>> = {
  constraint_test: ['unit', 'database'],
  invariant_test: ['unit', 'database'],
  specification_test: ['unit', 'database'],
  policy_test: ['database', 'api', 'e2e-api', 'e2e-ui', 'manual'],
  domain_service_test: ['unit'],
  use_case_test: ['api', 'e2e-api', 'e2e-ui', 'manual'],
  view_test: ['unit', 'e2e-ui', 'manual'],
  endpoint_test: ['contract', 'api'],
  flow_test: ['e2e-ui', 'e2e-api', 'manual'],
  integration_test: ['contract', 'e2e-api', 'manual'],
  pattern_rule_test: ['unit', 'database', 'api', 'contract', 'e2e-api', 'e2e-ui', 'manual'],
  standard_rule_test: ['unit', 'database', 'api', 'contract', 'e2e-api', 'e2e-ui', 'manual'],
};

/** The kinds whose records are tests: Lathe's kinds with a run by. */
export const TEST_KINDS = Object.keys(ALLOWED_LEVELS);


/** What designs, builds and proves each of Lathe's obligation kinds, as obligation_impl and obligation_proof count it. */
export const OBLIGATION_COVERAGE: Readonly<Record<string, { designed: string; built: string; proved: string }>> = {
  constraint: { designed: 'By construction, under its value object.', built: "Its value object's value type names a file that exists.", proved: 'Its constraint test.' },
  invariant: {
    designed: 'By construction, under its aggregate.',
    built: "A data model of one of its aggregate's entities, or the table whose unique key names it, names a file that exists.",
    proved: 'Its invariant test.',
  },
  specification: { designed: 'By construction.', built: 'Its predicate names a file that exists.', proved: 'Its specification test.' },
  policy: { designed: 'By construction, under its command.', built: 'Its event handler names a file that exists.', proved: 'Its policy test.' },
  domain_service: { designed: 'By construction, under its domain.', built: 'Its service names a file that exists.', proved: 'One of its domain service tests.' },
  uc_requirement: {
    designed: 'A step of its use case\'s flow fulfills it.',
    built:
      "A fulfilling step's command or query handler, a UI component of the view it happens in, or the adapter of an integration it exchanges with or a record of a product's own kind under that integration, names a file that exists.",
    proved: 'One of its use case tests.',
  },
  view_requirement: { designed: 'By construction, under its view.', built: 'A UI component that renders its view names a file that exists.', proved: 'One of its view tests.' },
  api_requirement: { designed: 'By construction, under its endpoint.', built: "Its endpoint's handler names a file that exists.", proved: 'One of its endpoint tests.' },
  pattern_rule: {
    designed: 'Wherever it is owed: by each domain that follows its pattern, itself or through a use case, unless waived there by a setting.',
    built: 'Not asked: proof only.',
    proved: 'Its pattern rule test naming the owing domain.',
  },
  standard_rule: { designed: 'A technical record meets it.', built: 'A technical record that meets it names a file that exists.', proved: 'One of its standard rule tests.' },
};

/** The obligation kinds Lathe defines what designs, builds and proves; a product's own obligation kinds go by its design and proof links. */
const LATHE_OBLIGATIONS = Object.keys(OBLIGATION_COVERAGE);

/** The obligation kinds that ask for proof only: designed and built count as their total. */
const PROOF_ONLY = ['pattern_rule'];

/**
 * The obligation kinds designed by construction: the record itself, under its parent, says what implements it (a
 * constraint its value object's value type, a view requirement its view), and a pattern rule is owed only where a
 * domain or use case follows its pattern. A UC requirement, a standard rule and a product's own obligation are designed
 * by links.
 */
const DESIGNED_BY_CONSTRUCTION = ['constraint', 'invariant', 'specification', 'policy', 'domain_service', 'view_requirement', 'api_requirement', 'pattern_rule'];

const list = (items: readonly string[]) => items.map(sqlString).join(', ');

/**
 * The tables the engine fills before the checks run: file_facts, a row for each record that names a file (a technical
 * record, a test, or a product's own kind with a file field), whether it exists and whether it names the record's own
 * ID; test_level_allowed, the levels each test kind allows; and source_file, each of the product's source files and
 * whether a technical record names it or a folder holding it (trace/source-files.ts).
 */
export const FACT_TABLES_SQL = `
CREATE OR REPLACE TABLE file_facts (record VARCHAR NOT NULL, kind VARCHAR NOT NULL, file VARCHAR NOT NULL, file_exists BOOLEAN NOT NULL, contains_id BOOLEAN NOT NULL);
CREATE OR REPLACE TABLE test_level_allowed (kind VARCHAR NOT NULL, level VARCHAR NOT NULL);
CREATE OR REPLACE TABLE source_file (file VARCHAR NOT NULL, traced BOOLEAN NOT NULL);
INSERT INTO test_level_allowed VALUES ${Object.entries(ALLOWED_LEVELS).flatMap(([kind, levels]) => levels.map((l) => `(${sqlString(kind)}, ${sqlString(l)})`)).join(', ')};`;

/** One minimum the schema leaves to coverage: the records that fall short of it, each with a message. */
export interface GapRule {
  /** The gap's name, as a coverage gap's `missing` carries it. */
  name: string;
  stage: Stage;
  /** The kinds it concerns, the record's kind first. */
  kinds: string[];
  /** What it reports, in one sentence. */
  summary: string;
  /**
   * A SELECT returning (id, message) for each record short of the minimum, for the schema it runs on; for a file gap,
   * (product, id, message), the id a file's path from the repo root.
   */
  sql: (schema: SchemaDescription) => string;
  /** The gap is about a file, not a record: it is reported under its product, outside every domain. */
  file?: true;
}

const gap = (name: string, stage: Stage, kinds: string[], summary: string, sql: string | ((schema: SchemaDescription) => string)): GapRule => ({
  name, stage, kinds, summary, sql: typeof sql === 'string' ? () => sql.trim() : sql,
});

/** A record of `kind` with no row in `table` whose `column` names it: a design record missing its technical record. */
const missingImpl = (name: string, kind: string, label: string, table: string, column: string, what: string, extra = ''): GapRule =>
  gap(
    name,
    'technical-specification',
    [kind, table],
    `${/^[AEIOU]/.test(label) ? 'An' : 'A'} ${label.toLowerCase()} with no ${what}.`,
    `SELECT r.id, ${sqlString(`${label} `)} || r.id || ${sqlString(` has no ${what}.`)} AS message FROM ${sqlName(kind)} r
WHERE NOT EXISTS (SELECT 1 FROM ${sqlName(table)} t WHERE t.${sqlName(column)} = r.id)${extra}`,
  );

/** The "at least one" and "exactly one" minimums, by stage, reported as coverage gaps. */
export const GAP_RULES: GapRule[] = [
  // Discovery: the trace runs from a business outcome through the capabilities that serve it.
  gap('outcome-not-served', 'discovery', ['business_outcome', 'capability'], 'A business outcome no capability serves.',
    `SELECT o.id, 'Business outcome ' || o.id || ' is served by no capability.' AS message FROM business_outcome o WHERE NOT EXISTS (SELECT 1 FROM serves s WHERE s.target_id = o.id)`),
  // Domain model.
  gap('domain-without-aggregate', 'domain-model', ['domain', 'aggregate'], 'A domain with no aggregate.',
    `SELECT d.id, 'Domain ' || d.id || ' has no aggregate.' AS message FROM domain d WHERE NOT EXISTS (SELECT 1 FROM aggregate a WHERE a.domain_id = d.id)`),
  gap('aggregate-without-root', 'domain-model', ['aggregate', 'entity'], 'An aggregate with no root entity.',
    `SELECT a.id, 'Aggregate ' || a.id || ' has no root entity.' AS message FROM aggregate a WHERE NOT EXISTS (SELECT 1 FROM entity e WHERE e.aggregate_id = a.id AND e.role = 'root')`),
  // A command changes its own aggregate, and another of its domain through a recorded exception (command_change).
  gap('aggregate-without-command', 'domain-model', ['aggregate', 'command'], 'An aggregate no command changes, directly or through a recorded exception.',
    `SELECT a.id, 'Aggregate ' || a.id || ' has no command, so nothing changes it.' AS message FROM aggregate a
WHERE NOT EXISTS (SELECT 1 FROM command c WHERE c.aggregate_id = a.id) AND NOT EXISTS (SELECT 1 FROM command_change x WHERE x.aggregate_id = a.id)`),
  gap('entity-without-fields', 'domain-model', ['entity', 'entity_field'], 'An entity with no fields.',
    `SELECT e.id, 'Entity ' || e.id || ' lists no fields.' AS message FROM entity e WHERE NOT EXISTS (SELECT 1 FROM entity_field f WHERE f.entity_id = e.id)`),
  gap('value-object-without-fields', 'domain-model', ['value_object', 'value_object_field'], 'A value object with no fields.',
    `SELECT v.id, 'Value object ' || v.id || ' lists no fields.' AS message FROM value_object v WHERE NOT EXISTS (SELECT 1 FROM value_object_field f WHERE f.value_object_id = v.id)`),
  gap('event-without-fields', 'domain-model', ['domain_event', 'event_field'], 'A domain event that carries no fields.',
    `SELECT e.id, 'Domain event ' || e.id || ' carries no fields.' AS message FROM domain_event e WHERE NOT EXISTS (SELECT 1 FROM event_field f WHERE f.domain_event_id = e.id)`),
  gap('event-not-raised', 'domain-model', ['domain_event', 'command'], 'A domain event no command raises.',
    `SELECT e.id, 'Domain event ' || e.id || ' is raised by no command.' AS message FROM domain_event e WHERE NOT EXISTS (SELECT 1 FROM raises r WHERE r.target_id = e.id)`),
  gap('read-model-without-fields', 'domain-model', ['read_model', 'read_model_field'], 'A read model with no fields.',
    `SELECT m.id, 'Read model ' || m.id || ' lists no fields.' AS message FROM read_model m WHERE NOT EXISTS (SELECT 1 FROM read_model_field f WHERE f.read_model_id = m.id)`),
  // A read model fed by events (fed_by, where the schema has it) may read no aggregate of its own.
  gap('read-model-reads-nothing', 'domain-model', ['read_model', 'aggregate'], 'A read model that reads no aggregate and is fed by no event.', (schema) =>
    `SELECT m.id, 'Read model ' || m.id || ' reads no aggregate${schema.relations.fed_by ? ' and is fed by no event' : ''}.' AS message FROM read_model m
WHERE NOT EXISTS (SELECT 1 FROM reads r WHERE r.source_id = m.id)${schema.relations.fed_by ? '\n  AND NOT EXISTS (SELECT 1 FROM fed_by f WHERE f.source_id = m.id)' : ''}`),
  gap('read-model-without-query', 'domain-model', ['read_model', 'query'], 'A read model no query asks.',
    `SELECT m.id, 'Read model ' || m.id || ' has no query.' AS message FROM read_model m WHERE NOT EXISTS (SELECT 1 FROM query q WHERE q.read_model_id = m.id)`),
  gap('specification-reads-nothing', 'domain-model', ['specification', 'aggregate'], 'A specification that reads no aggregate.',
    `SELECT s.id, 'Specification ' || s.id || ' reads no aggregate.' AS message FROM specification s WHERE NOT EXISTS (SELECT 1 FROM reads r WHERE r.source_id = s.id)`),
  gap('policy-hears-nothing', 'domain-model', ['policy', 'domain_event'], 'A policy that hears no event.',
    `SELECT p.id, 'Policy ' || p.id || ' hears no event.' AS message FROM policy p WHERE NOT EXISTS (SELECT 1 FROM hears h WHERE h.source_id = p.id)`),
  gap('domain-service-not-called', 'domain-model', ['domain_service', 'command', 'query'], 'A domain service no command or query calls.',
    `SELECT s.id, 'Domain service ' || s.id || ' is called by no command or query.' AS message FROM domain_service s WHERE NOT EXISTS (SELECT 1 FROM calls c WHERE c.target_id = s.id)`),
  // Use cases.
  gap('capability-serves-no-outcome', 'use-cases', ['capability', 'business_outcome'], 'A capability that serves no business outcome.',
    `SELECT c.id, 'Capability ' || c.id || ' serves no business outcome.' AS message FROM capability c WHERE NOT EXISTS (SELECT 1 FROM serves s WHERE s.source_id = c.id)`),
  gap('capability-without-use-case', 'use-cases', ['capability', 'use_case'], 'A capability with no use case.',
    `SELECT c.id, 'Capability ' || c.id || ' has no use case.' AS message FROM capability c WHERE NOT EXISTS (SELECT 1 FROM use_case u WHERE u.capability_id = c.id)`),
  gap('use-case-without-actor', 'use-cases', ['use_case', 'use_case_actor'], 'A use case with no actor.',
    `SELECT u.id, 'Use case ' || u.id || ' names no actor.' AS message FROM use_case u WHERE NOT EXISTS (SELECT 1 FROM use_case_actor a WHERE a.use_case_id = u.id)`),
  // A use case that follows a pattern owes the pattern's rules instead of requirements of its own.
  gap('use-case-without-requirement', 'use-cases', ['use_case', 'uc_requirement'], 'A use case with no UC requirement that follows no pattern.',
    `SELECT u.id, 'Use case ' || u.id || ' has no UC requirement and follows no pattern.' AS message FROM use_case u
WHERE NOT EXISTS (SELECT 1 FROM uc_requirement r WHERE r.use_case_id = u.id) AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.source_id = u.id)`),
  gap('pattern-without-rule', 'use-cases', ['pattern', 'pattern_rule'], 'A pattern with no rule.',
    `SELECT p.id, 'Pattern ' || p.id || ' has no rule.' AS message FROM pattern p WHERE NOT EXISTS (SELECT 1 FROM pattern_rule r WHERE r.pattern_id = p.id)`),
  // Interaction design.
  gap('use-case-without-flow', 'interaction-design', ['use_case', 'flow'], 'A use case with no flow.',
    `SELECT u.id, 'Use case ' || u.id || ' has no flow.' AS message FROM use_case u WHERE NOT EXISTS (SELECT 1 FROM flow f WHERE f.use_case_id = u.id)`),
  gap('flow-without-main-path', 'interaction-design', ['flow', 'flow_step'], 'A flow with no step on its main path.',
    `SELECT f.id, 'Flow ' || f.id || ' has no step on its main path.' AS message FROM flow f WHERE NOT EXISTS (SELECT 1 FROM flow_step s WHERE s.flow_id = f.id AND s.path = 'main')`),
  gap('endpoint-without-requirement', 'interaction-design', ['endpoint', 'api_requirement'], 'An endpoint with no API requirement.',
    `SELECT e.id, 'Endpoint ' || e.id || ' has no API requirement.' AS message FROM endpoint e WHERE NOT EXISTS (SELECT 1 FROM api_requirement r WHERE r.endpoint_id = e.id)`),
  // Technical specification: one technical record per design record.
  missingImpl('aggregate-without-repository', 'aggregate', 'Aggregate', 'repository', 'aggregate_id', 'repository'),
  missingImpl('entity-without-data-model', 'entity', 'Entity', 'data_model', 'entity_id', 'data model'),
  missingImpl('entity-without-table', 'entity', 'Entity', 'table', 'entity_id', 'table', ' AND r.in_root_table IS NULL'),
  missingImpl('value-object-without-value-type', 'value_object', 'Value object', 'value_type', 'value_object_id', 'value type'),
  missingImpl('event-without-event-type', 'domain_event', 'Domain event', 'event_type', 'domain_event_id', 'event type'),
  missingImpl('read-model-without-projection', 'read_model', 'Read model', 'projection', 'read_model_id', 'projection'),
  missingImpl('read-model-without-table', 'read_model', 'Read model', 'table', 'read_model_id', 'table'),
  missingImpl('command-without-handler', 'command', 'Command', 'command_handler', 'command_id', 'command handler'),
  missingImpl('query-without-handler', 'query', 'Query', 'query_handler', 'query_id', 'query handler'),
  missingImpl('endpoint-without-handler', 'endpoint', 'Endpoint', 'endpoint_handler', 'endpoint_id', 'endpoint handler'),
  missingImpl('integration-without-adapter', 'integration', 'Integration', 'adapter', 'integration_id', 'adapter'),
  gap('view-without-ui-component', 'technical-specification', ['view', 'ui_component'], 'A view no UI component renders.',
    `SELECT v.id, 'View ' || v.id || ' is rendered by no UI component.' AS message FROM view v WHERE NOT EXISTS (SELECT 1 FROM renders r WHERE r.target_id = v.id)`),
  // Every source file is named by a technical record, or sits in a folder one names. A repo holding several products
  // reports the file once, under the first product by ID.
  {
    ...gap('code-file-untraced', 'technical-specification', [], 'A source file no technical record names, directly or through a folder.',
      `SELECT (SELECT min(id) FROM product) AS product, f.file AS id, 'Source file ' || f.file || ' is named by no technical record, directly or through a folder.' AS message
FROM source_file f WHERE NOT f.traced AND EXISTS (SELECT 1 FROM product)`),
    file: true,
  },
  // Test plan; an obligation's own test is its proof, counted above.
  gap('flow-without-test', 'test-plan', ['flow', 'flow_test'], 'A flow with no flow test of its main path.',
    `SELECT f.id, 'Flow ' || f.id || ' has no flow test.' AS message FROM flow f WHERE NOT EXISTS (SELECT 1 FROM flow_test t WHERE t.flow_id = f.id)`),
];

/**
 * The coverage tables and views, for the schema's kinds, made once the file facts are in (a table is worked out once
 * per load, so the checks and the coverage queries that read it share the work):
 * - test_run (id, kind, parent_id, domain_id, level, state, file, level_allowed, backed): every test with its run by;
 *   backed says an automated test's file exists and names the test's ID (true for any other state).
 * - pattern_rule_standing (domain, id, standing): each rule of each pattern a domain follows, and whether the domain
 *   owes it. A domain follows a pattern when the domain itself follows it or one of its use cases does; these are the
 *   pattern's followers there. A following domain owes each rule of the pattern ('owed'), except a rule whose setting
 *   every following use case there marks not applicable, when the domain does not follow the pattern itself
 *   ('not-applicable'), and a rule with an applies-when setting no follower there meets ('waived'). The one answer to
 *   "does this rule apply here", which coverage and the app read.
 * - owed_pattern_rules (domain, id): the rules a domain owes.
 * - obligation_impl (obligation_id, impl_id): the technical records that implement each obligation.
 * - obligation_proof (obligation_id, test_id, domain_id, state, counts): the tests of each obligation; counts when it
 *   is automated or manual, at an allowed level and backed.
 * - coverage_owed (product, domain, id, kind): each obligation a domain, or the product outside every domain, owes.
 * - coverage_proof (product, domain, id, test_id): the tests that count as an owed obligation's proof where it is owed
 *   (a pattern rule's naming the owing domain); the one answer to "proved", which coverage_item and the app read.
 * - coverage_item (product, domain, id, kind, proof_only, designed, built, proved, not_automated): each owed
 *   obligation, judged.
 * - coverage_scope (product, domain): each domain, and each product's place outside every domain (domain null).
 * - coverage_count, coverage_tests and coverage_gap: the counts per scope and obligation kind, the tests by state,
 *   and every gap: obligations not designed, built or proved, records short of a minimum, and source files no
 *   technical record names (a file gap, kind file, under its product).
 */
export function coverageViewsSql(schema: SchemaDescription): string {
  const tests = TEST_KINDS.filter((k) => schema.tables[k]);
  const testRun = tests
    .map((kind) => {
      const parent = schema.kinds[kind].parents[0].column;
      const domain = schema.tables[kind].columns.some((c) => c.name === 'domain_id') ? 'domain_id' : 'NULL';
      return `SELECT id, ${sqlString(kind)} AS kind, ${sqlName(parent)} AS parent_id, ${domain}::VARCHAR AS domain_id, level::VARCHAR AS level, state::VARCHAR AS state, file FROM ${sqlName(kind)}`;
    })
    .join('\nUNION ALL ');
  const lathe = list(LATHE_OBLIGATIONS);
  // A product's own kinds that sit under an integration, each with the column naming it.
  const integrationParts = Object.values(schema.kinds)
    .filter((k) => k.productId !== null)
    .flatMap((k) => k.parents.filter((p) => p.kind === 'integration').map((p) => ({ kind: k.name, column: p.column })))
    .map(({ kind, column }) => `\nUNION ALL SELECT f.target_id, p.id FROM fulfills f JOIN exchanges_with x ON x.source_id = f.source_id JOIN ${sqlName(kind)} p ON p.${sqlName(column)} = x.target_id`)
    .join('');
  return `
CREATE OR REPLACE TABLE test_run AS
SELECT t.*, EXISTS (SELECT 1 FROM test_level_allowed a WHERE a.kind = t.kind AND a.level = t.level) AS level_allowed,
  t.state <> 'automated' OR coalesce(f.file_exists AND f.contains_id, false) AS backed
FROM (${testRun}) t
LEFT JOIN file_facts f ON f.record = t.id;

CREATE OR REPLACE TABLE pattern_rule_standing AS
WITH followers AS (
  SELECT DISTINCT s.domain_id AS domain, f.target_id AS pattern, f.source_id AS follower, false AS by_domain
  FROM follows f JOIN use_case u ON u.id = f.source_id JOIN record_scope s ON s.id = u.id
  UNION
  SELECT DISTINCT d.id AS domain, f.target_id AS pattern, f.source_id AS follower, true AS by_domain
  FROM follows f JOIN domain d ON d.id = f.source_id
),
judged AS (
  SELECT f.domain, r.id,
    -- A domain that follows the pattern itself marks nothing not applicable: one such follower makes this false.
    bool_and(NOT f.by_domain AND r.setting IS NOT NULL AND sv.not_applicable IS NOT NULL) AS not_applicable,
    bool_or(r.applies_when_setting IS NULL
            OR (wv.value IS NOT NULL AND ((lower(trim(wv.value)) = lower(trim(r.applies_when_value))) <> coalesce(r.applies_when_negated, false)))) AS meets
  FROM pattern_rule r
  JOIN followers f ON f.pattern = r.pattern_id
  LEFT JOIN setting_value sv ON sv.follower_id = f.follower AND sv.pattern_id = r.pattern_id AND sv.setting = r.setting
  LEFT JOIN setting_value wv ON wv.follower_id = f.follower AND wv.pattern_id = r.pattern_id AND wv.setting = r.applies_when_setting
  GROUP BY f.domain, r.id
)
SELECT domain, id, CASE WHEN not_applicable THEN 'not-applicable' WHEN NOT meets THEN 'waived' ELSE 'owed' END AS standing FROM judged;

CREATE OR REPLACE VIEW owed_pattern_rules AS
SELECT domain, id FROM pattern_rule_standing WHERE standing = 'owed';

CREATE OR REPLACE TABLE obligation_impl AS
-- A constraint: its value object's value type.
SELECT c.id AS obligation_id, v.id AS impl_id FROM "constraint" c JOIN value_type v ON v.value_object_id = c.value_object_id
-- An invariant: the data models of its aggregate's entities, and a table whose unique key names it.
UNION ALL SELECT i.id, d.id FROM invariant i JOIN entity e ON e.aggregate_id = i.aggregate_id JOIN data_model d ON d.entity_id = e.id
UNION ALL SELECT k.invariant_id, k.table_id FROM table_key k WHERE k.invariant_id IS NOT NULL
UNION ALL SELECT specification_id, id FROM predicate
UNION ALL SELECT policy_id, id FROM event_handler
UNION ALL SELECT domain_service_id, id FROM service
-- A UC requirement: the handlers of what its steps invoke, and the UI components of the views they happen in.
UNION ALL SELECT f.target_id, h.id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN command_handler h ON h.command_id = i.target_id
UNION ALL SELECT f.target_id, h.id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN query_handler h ON h.query_id = i.target_id
UNION ALL SELECT f.target_id, r.source_id FROM fulfills f JOIN happens_in h ON h.source_id = f.source_id JOIN renders r ON r.target_id = h.target_id
-- ... and what carries out the integrations they exchange with: each one's adapter, and the records of a product's
-- own kinds under it (such as a plugin hook).
UNION ALL SELECT f.target_id, a.id FROM fulfills f JOIN exchanges_with x ON x.source_id = f.source_id JOIN adapter a ON a.integration_id = x.target_id${integrationParts}
-- A view requirement: the UI components of its view; an API requirement: its endpoint's handler.
UNION ALL SELECT q.id, r.source_id FROM view_requirement q JOIN renders r ON r.target_id = q.view_id
UNION ALL SELECT q.id, h.id FROM api_requirement q JOIN endpoint_handler h ON h.endpoint_id = q.endpoint_id
-- A standard rule: the technical records that meet it.
UNION ALL SELECT target_id, source_id FROM meets
-- A product's own obligation kind: the sources of its design links.
UNION ALL SELECT l.target_id, l.source_id FROM link l JOIN meta_relation r ON r.name = l.relation AND r.role = 'design'
  JOIN obligation o ON o.id = l.target_id WHERE o.kind NOT IN (${lathe});

CREATE OR REPLACE TABLE obligation_proof AS
WITH proofs AS (
  SELECT t.parent_id AS obligation_id, t.id AS test_id, t.domain_id, t.state, t.level_allowed AND t.backed AS valid
  FROM test_run t JOIN obligation o ON o.id = t.parent_id
  -- A product's own obligation kind: the sources of its proof links. A test is backed as test_run says; a record of a
  -- product kind that names a file is backed only when that file exists and names it, as a test is; one that names
  -- no file counts as it stands.
  UNION ALL SELECT l.target_id, l.source_id, NULL, coalesce(t.state, 'automated'),
    coalesce(t.level_allowed AND t.backed, f.file_exists AND f.contains_id, true)
  FROM link l JOIN meta_relation r ON r.name = l.relation AND r.role = 'proof' JOIN obligation o ON o.id = l.target_id
  LEFT JOIN test_run t ON t.id = l.source_id LEFT JOIN file_facts f ON f.record = l.source_id
  WHERE o.kind NOT IN (${lathe})
)
SELECT *, state IN ('automated', 'manual') AND valid AS counts FROM proofs;

CREATE OR REPLACE VIEW coverage_owed AS
SELECT s.product_id AS product, s.domain_id AS domain, o.id, o.kind FROM obligation o JOIN record_scope s ON s.id = o.id WHERE o.kind <> 'pattern_rule'
UNION ALL
SELECT s.product_id, p.domain, p.id, 'pattern_rule' FROM owed_pattern_rules p JOIN record_scope s ON s.id = p.domain;

-- The tests that count as each owed obligation's proof where it is owed: a pattern rule's only in the owing domain.
CREATE OR REPLACE TABLE coverage_proof AS
SELECT o.product, o.domain, o.id, p.test_id
FROM coverage_owed o JOIN obligation_proof p ON p.obligation_id = o.id AND p.counts AND (o.kind <> 'pattern_rule' OR p.domain_id = o.domain);

CREATE OR REPLACE TABLE coverage_item AS
SELECT o.product, o.domain, o.id, o.kind,
  o.kind IN (${list(PROOF_ONLY)}) AS proof_only,
  o.kind IN (${list(DESIGNED_BY_CONSTRUCTION)})
    OR (o.kind = 'uc_requirement' AND EXISTS (SELECT 1 FROM fulfills f WHERE f.target_id = o.id))
    OR (o.kind NOT IN (${list([...DESIGNED_BY_CONSTRUCTION, 'uc_requirement'])}) AND EXISTS (SELECT 1 FROM obligation_impl i WHERE i.obligation_id = o.id)) AS designed,
  o.kind IN (${list(PROOF_ONLY)})
    OR EXISTS (SELECT 1 FROM obligation_impl i JOIN file_facts f ON f.record = i.impl_id AND f.file_exists WHERE i.obligation_id = o.id) AS built,
  EXISTS (SELECT 1 FROM coverage_proof p WHERE p.id = o.id AND p.domain IS NOT DISTINCT FROM o.domain) AS proved,
  EXISTS (SELECT 1 FROM obligation_proof p WHERE p.obligation_id = o.id AND p.state = 'not automated yet' AND (o.kind <> 'pattern_rule' OR p.domain_id = o.domain)) AS has_not_automated
FROM coverage_owed o;

CREATE OR REPLACE VIEW coverage_scope AS
SELECT product_id AS product, id AS domain FROM domain
UNION ALL
SELECT id, NULL FROM product;

CREATE OR REPLACE VIEW coverage_kind AS
SELECT name AS kind, label, product_id, name IN (${list(PROOF_ONLY)}) AS proof_only, row_number() OVER (ORDER BY position NULLS LAST, name) AS ord
FROM meta_kind WHERE obligation;

CREATE OR REPLACE VIEW coverage_count AS
SELECT s.product, s.domain, k.kind, k.label, k.proof_only,
  count(i.id)::INTEGER AS total,
  count(i.id) FILTER (WHERE i.designed)::INTEGER AS designed,
  count(i.id) FILTER (WHERE i.built)::INTEGER AS built,
  count(i.id) FILTER (WHERE i.proved)::INTEGER AS proved,
  count(i.id) FILTER (WHERE NOT i.proved AND i.has_not_automated)::INTEGER AS not_automated,
  k.ord
FROM coverage_scope s
JOIN coverage_kind k ON k.product_id IS NULL OR k.product_id = s.product
LEFT JOIN coverage_item i ON i.product = s.product AND i.domain IS NOT DISTINCT FROM s.domain AND i.kind = k.kind
GROUP BY s.product, s.domain, k.kind, k.label, k.proof_only, k.ord;

CREATE OR REPLACE VIEW coverage_tests AS
SELECT s.product, s.domain,
  count(t.id) FILTER (WHERE t.state = 'automated')::INTEGER AS automated,
  count(t.id) FILTER (WHERE t.state = 'manual')::INTEGER AS manual,
  count(t.id) FILTER (WHERE t.state = 'not automated yet')::INTEGER AS not_automated
FROM coverage_scope s
LEFT JOIN (SELECT t.id, t.state, r.product_id, coalesce(t.domain_id, r.domain_id) AS domain_id FROM test_run t JOIN record_scope r ON r.id = t.id) t
  ON t.product_id = s.product AND t.domain_id IS NOT DISTINCT FROM s.domain
GROUP BY s.product, s.domain;

CREATE OR REPLACE TABLE coverage_gap AS
WITH missing AS (
  SELECT i.product, i.domain, i.id, i.kind, 'designed' AS missing, 1 AS ord, k.label || ' ' || i.id || ' is not designed yet.' AS message
  FROM coverage_item i JOIN meta_kind k ON k.name = i.kind WHERE NOT i.designed
  UNION ALL
  SELECT i.product, i.domain, i.id, i.kind, 'built', 2, k.label || ' ' || i.id || ' is not built yet: no file of what implements it exists.'
  FROM coverage_item i JOIN meta_kind k ON k.name = i.kind WHERE i.designed AND NOT i.built
  UNION ALL
  SELECT i.product, i.domain, i.id, i.kind, 'proved', 3,
    k.label || ' ' || i.id || ' is not proved yet' || CASE WHEN i.kind = 'pattern_rule' THEN ' in ' || i.domain ELSE '' END
      || CASE WHEN i.has_not_automated THEN ': its test is not automated yet.' ELSE '.' END
  FROM coverage_item i JOIN meta_kind k ON k.name = i.kind WHERE NOT i.proved
  UNION ALL
  SELECT s.product_id, s.domain_id, g.id, r.kind, g.missing, 4, g.message
  FROM (${GAP_RULES.filter((g) => !g.file).map((g) => `SELECT id, ${sqlString(g.name)} AS missing, message FROM (${g.sql(schema)})`).join('\n    UNION ALL ')}) g
  JOIN record_id r ON r.id = g.id JOIN record_scope s ON s.id = g.id
  UNION ALL
  SELECT g.product, NULL, g.id, 'file', g.missing, 4, g.message
  FROM (${GAP_RULES.filter((g) => g.file).map((g) => `SELECT product, id, ${sqlString(g.name)} AS missing, message FROM (${g.sql(schema)})`).join('\n    UNION ALL ')}) g
)
SELECT * FROM missing;`;
}

/** One row per scope and obligation kind, in scope order then kind order, including empty ones. */
export const COVERAGE_COUNTS_SQL = `SELECT product, domain, kind, label, proof_only, total, designed, built, proved, not_automated FROM coverage_count ORDER BY product, domain NULLS LAST, ord`;

/** Every gap: (product, domain, id, kind, missing, message), by record. */
export const COVERAGE_GAPS_SQL = `SELECT product, domain, id, kind, missing, message FROM coverage_gap ORDER BY product, domain NULLS LAST, id, ord, missing`;

/** One row per scope: its tests by state. */
export const COVERAGE_TESTS_SQL = `SELECT product, domain, automated, manual, not_automated FROM coverage_tests ORDER BY product, domain NULLS LAST`;

/** One row per test that counts as an owed obligation's proof: (product, domain, id, test_id). */
export const COVERAGE_PROOFS_SQL = `SELECT product, domain, id, test_id FROM coverage_proof ORDER BY product, domain NULLS LAST, id, test_id`;

/** One row per rule of each pattern a domain follows, with its standing there: (product, domain, id, standing). */
export const PATTERN_RULE_STANDING_SQL = `SELECT s.product_id AS product, p.domain, p.id, p.standing FROM pattern_rule_standing p JOIN record_scope s ON s.id = p.domain ORDER BY product, p.domain, p.id`;
