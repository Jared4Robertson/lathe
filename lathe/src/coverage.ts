// Coverage as views over the typed tables, and the facts the engine gathers from the code before the checks run.
//
// Every obligation (a member of the obligation supertype: constraints, invariants, specifications, policies, domain
// services, storage requirements, UC requirements, view requirements, API requirements, pattern rules, standard rules
// and a product's own obligation kinds) is counted as:
// - designed: its implementation is specified. A UC requirement is designed once a step of each of its use case's
//   flows (one per interface) fulfills it, a standard rule once a technical record meets it, a product's own
//   obligation once a design or build link targets it; the others by construction (DESIGNED_BY_CONSTRUCTION);
// - built: every one of the specific technical records that implement it names a file that exists, and there is at
//   least one; never any other code near it: an invariant's rule, a constraint's value type, a specification's
//   predicate, a policy's event handler, a domain service's service, a storage requirement's repository (its
//   aggregate's) or reader (its read model's) once that names the data store it is stored in, an API requirement's
//   endpoint handler, the UI
//   components that build a view requirement, a standard rule's meeting records, a product's own obligation's design
//   and build link sources, and for a UC requirement the handler of what a fulfilling step invokes or the adapter of an
//   integration it exchanges with, with the predicates and services of what that handler checks, selects by or calls;
//   a UC requirement also rests on those specifications and domain services, and is built only while each of them is;
// - proved: a test of it exists, automated or manual, at a level its test kind allows (ALLOWED_LEVELS), and an
//   automated test's file exists and names the test's ID.
// A pattern rule asks for proof only: it is owed by each domain that follows its pattern (owed_pattern_rules) and
// proved there by its pattern rule test naming that domain. An obligation something outside the product provides
// (provided_by) is built and proved through its provider, which stands in its proof list.
//
// Besides obligations, coverage reports the records short of a minimum, the "at least one" and "exactly one" rules
// the schema leaves to the checks because records are written stage by stage (GAP_RULES): a use case with no flow, an
// aggregate with no root, a command with no handler; and the accidental debt, each fill: a hand-written technical
// record that fills a pattern's slot (COVERAGE_DEBT_SQL). The checks read the same views and tables.
import { sqlName, sqlString, type SchemaDescription, type Stage } from './platform/data/schema.ts';
import { PACKAGE_FACTS_SQL, PACKAGE_GAP_SQL } from './trace/packages.ts';
import { MEASURE_GAPS } from './trace/measures.ts';
import { ROUTE_GAP_RULES } from './trace/routes.ts';

/**
 * The run by levels each test kind allows, cheapest first: a test at another level is reported by
 * test-level-not-allowed and proves nothing. A level says only how a test runs, automated or by a person.
 */
export const ALLOWED_LEVELS: Readonly<Record<string, readonly string[]>> = {
  constraint_test: ['unit', 'integration'],
  invariant_test: ['unit', 'integration'],
  specification_test: ['unit', 'integration'],
  policy_test: ['integration', 'service', 'system', 'browser'],
  domain_service_test: ['unit'],
  storage_requirement_test: ['integration', 'service', 'system', 'browser'],
  use_case_test: ['service', 'system', 'browser'],
  view_test: ['unit', 'browser'],
  endpoint_test: ['service', 'system'],
  flow_test: ['system', 'browser'],
  journey_test: ['service', 'system', 'browser'],
  integration_test: ['integration', 'service', 'system'],
  pattern_rule_test: ['unit', 'integration', 'service', 'system', 'browser'],
  standard_rule_test: ['unit', 'integration', 'service', 'system', 'browser'],
};

/** The kinds whose records are tests: Lathe's kinds with a run by. */
export const TEST_KINDS = Object.keys(ALLOWED_LEVELS);


/** What designs, builds and proves each of Lathe's obligation kinds, as obligation_impl and obligation_proof count it. */
export const OBLIGATION_COVERAGE: Readonly<Record<string, { designed: string; built: string; proved: string }>> = {
  constraint: { designed: 'By construction, under its value object.', built: "Its value object's value type names a file that exists.", proved: 'Its constraint test.' },
  invariant: {
    designed: 'By construction, under its aggregate.',
    built: 'Its rule names a file that exists.',
    proved: 'Its invariant test.',
  },
  specification: { designed: 'By construction.', built: 'Its predicate names a file that exists.', proved: 'Its specification test.' },
  policy: { designed: 'By construction, under its command.', built: 'Its event handler names a file that exists.', proved: 'Its policy test.' },
  domain_service: { designed: 'By construction, under its domain.', built: 'Its service names a file that exists.', proved: 'One of its domain service tests.' },
  storage_requirement: {
    designed: 'By construction, under its aggregate or read model.',
    built: "Its aggregate's repository, or its read model's reader, names a file that exists and the data store it is stored in.",
    proved: 'One of its storage requirement tests.',
  },
  uc_requirement: {
    designed: 'A step of its use case\'s flow fulfills it.',
    built:
      "Every record that carries out its fulfilling steps names a file that exists, and there is at least one: the handler of each command or query a step invokes, with the predicates and services of what that command or query checks, selects by or calls; and the adapter of each integration a step exchanges with. It also rests on those specifications and domain services, and is built only while each of them is.",
    proved: 'One of its use case tests.',
  },
  view_requirement: { designed: 'By construction, under its view.', built: 'Every UI component that builds it names a file that exists, and there is at least one.', proved: 'One of its view tests.' },
  api_requirement: { designed: 'By construction, under its endpoint.', built: "Its endpoint's handler names a file that exists.", proved: 'One of its endpoint tests.' },
  pattern_rule: {
    designed: 'Wherever it is owed: by each domain that follows its pattern, itself, through a use case, or through an interface that offers one of its use cases.',
    built: 'Not asked: proof only.',
    proved: 'Its pattern rule test naming the owing domain.',
  },
  standard_rule: { designed: 'A technical record meets it, or a record links to it through a relation the product declared with the design role.', built: 'Every technical record that meets it, and every source of a product relation with the build role, names a file that exists, and there is at least one.', proved: 'One of its standard rule tests, or a source of a product relation with the proof role.' },
};

/** The obligation kinds Lathe defines what designs, builds and proves; a product's own obligation kinds go by its design, build and proof links. */
const LATHE_OBLIGATIONS = Object.keys(OBLIGATION_COVERAGE);

/** The obligation kinds that ask for proof only: designed and built count as their total. */
const PROOF_ONLY = ['pattern_rule'];

/**
 * The obligation kinds designed by construction: the record itself, under its parent, says what implements it (a
 * constraint its value object's value type, a view requirement its view), and a pattern rule is owed only where a
 * domain or use case follows its pattern. A UC requirement, a standard rule and a product's own obligation are designed
 * by links.
 */
const DESIGNED_BY_CONSTRUCTION = ['constraint', 'invariant', 'specification', 'policy', 'domain_service', 'storage_requirement', 'view_requirement', 'api_requirement', 'pattern_rule'];

const list = (items: readonly string[]) => items.map(sqlString).join(', ');

/**
 * The tables the engine fills before the checks run: file_facts, a row for each record that names a file (a technical
 * record, a test, or a product's own kind with a file field), the file as a path from the product root (null outside
 * it), whether it exists and whether it names the record's own ID; test_case, each test case read from the product's
 * test files (its file as a path from the root, its place among the file's test cases, its line, and its name after
 * its describes' names), with test_case_id, each ID it or its describes name; test_level_allowed, the levels each test
 * kind allows (typed by the schema's test_level, so a level it does not know fails the load); source_file, each of
 * the product's source files and whether a technical record names it or a folder holding it (trace/source-files.ts);
 * record_serves, each record a use case or a journey's handoff reaches with each outcome it serves through it (trace/serves.ts);
 * and package_facts, the packages the product's package.json files list (trace/packages.ts).
 */
export const FACT_TABLES_SQL = `
CREATE OR REPLACE TABLE file_facts (record VARCHAR NOT NULL, kind VARCHAR NOT NULL, file VARCHAR NOT NULL, path VARCHAR, file_exists BOOLEAN NOT NULL, contains_id BOOLEAN NOT NULL);
CREATE OR REPLACE TABLE test_case (file VARCHAR NOT NULL, position INTEGER NOT NULL, line INTEGER NOT NULL, name VARCHAR NOT NULL);
CREATE OR REPLACE TABLE test_case_id (file VARCHAR NOT NULL, position INTEGER NOT NULL, id VARCHAR NOT NULL);
CREATE OR REPLACE TABLE test_level_allowed (kind VARCHAR NOT NULL, level test_level NOT NULL);
CREATE OR REPLACE TABLE source_file (file VARCHAR NOT NULL, traced BOOLEAN NOT NULL);
CREATE OR REPLACE TABLE record_serves (record VARCHAR NOT NULL, outcome VARCHAR NOT NULL);
${PACKAGE_FACTS_SQL}
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

/** The kinds the record-untraced gap reports when no obligation's chain reaches a record of them. */
const UNTRACED_KINDS = ['flow_step', 'command', 'query', 'ui_component'] as const;

/** The "at least one" and "exactly one" minimums, by stage, reported as coverage gaps. */
export const GAP_RULES: GapRule[] = [
  // Discovery: the trace runs from a business outcome through the capabilities that serve it.
  // A capability must serve each outcome even when a journey does: capabilities group what the business can do,
  // journeys put it in order.
  gap('outcome-not-served', 'discovery', ['business_outcome', 'capability'], 'A business outcome no capability serves.',
    `SELECT o.id, 'Business outcome ' || o.id || ' is served by no capability.' AS message FROM business_outcome o
WHERE NOT EXISTS (SELECT 1 FROM serves s JOIN capability c ON c.id = s.source_id WHERE s.target_id = o.id)`),
  gap('journey-serves-no-outcome', 'discovery', ['journey', 'business_outcome'], 'A journey that serves no business outcome.',
    `SELECT j.id, 'Journey ' || j.id || ' serves no business outcome: link the outcome its result moves.' AS message FROM journey j
WHERE NOT EXISTS (SELECT 1 FROM serves s WHERE s.source_id = j.id)`),
  gap('journey-without-main-path', 'discovery', ['journey', 'journey_step'], 'A journey with no step on its main path.',
    `SELECT j.id, 'Journey ' || j.id || ' has no step on its main path: write the steps from its trigger to its result.' AS message FROM journey j
WHERE NOT EXISTS (SELECT 1 FROM journey_step s WHERE s.journey_id = j.id AND s.path = 'main')`),
  ...MEASURE_GAPS,
  // Domain model.
  gap('domain-without-aggregate', 'domain-model', ['domain', 'aggregate'], 'A domain with no aggregate.',
    `SELECT d.id, 'Domain ' || d.id || ' has no aggregate.' AS message FROM domain d WHERE NOT EXISTS (SELECT 1 FROM aggregate a WHERE a.domain_id = d.id)`),
  gap('aggregate-without-root', 'domain-model', ['aggregate', 'entity'], 'An aggregate with no root entity.',
    `SELECT a.id, 'Aggregate ' || a.id || ' has no root entity.' AS message FROM aggregate a WHERE NOT EXISTS (SELECT 1 FROM entity e WHERE e.aggregate_id = a.id AND e.role = 'root')`),
  // A command changes its own aggregate only.
  gap('aggregate-without-command', 'domain-model', ['aggregate', 'command'], 'An aggregate no command changes.',
    `SELECT a.id, 'Aggregate ' || a.id || ' has no command, so nothing changes it.' AS message FROM aggregate a
WHERE NOT EXISTS (SELECT 1 FROM command c JOIN entity e ON e.id = c.entity_id WHERE e.aggregate_id = a.id)`),
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
  // A journey is written before the use cases it needs: a step that carries out nothing yet is one to write.
  gap('journey-step-unlinked', 'use-cases', ['journey_step', 'use_case', 'policy'], 'A journey step that carries out no use case or policy yet.',
    `SELECT s.id, 'Journey step ' || s.id || ' carries out no use case or policy yet: write the use case (or the policy, for a handoff) and link the step.' AS message FROM journey_step s
WHERE NOT EXISTS (SELECT 1 FROM carries_out c WHERE c.source_id = s.id)`),
  gap('pattern-without-rule', 'use-cases', ['pattern', 'pattern_rule'], 'A pattern with no rule.',
    `SELECT p.id, 'Pattern ' || p.id || ' has no rule.' AS message FROM pattern p WHERE NOT EXISTS (SELECT 1 FROM pattern_rule r WHERE r.pattern_id = p.id)`),
  // Interaction design.
  gap('use-case-without-flow', 'interaction-design', ['use_case', 'flow'], 'A use case with no flow.',
    `SELECT u.id, 'Use case ' || u.id || ' has no flow.' AS message FROM use_case u WHERE NOT EXISTS (SELECT 1 FROM flow f WHERE f.use_case_id = u.id)`),
  gap('interface-offers-nothing', 'interaction-design', ['interface', 'use_case'], 'An interface that offers no use case.',
    `SELECT i.id, 'Interface ' || i.id || ' offers no use case yet.' AS message FROM interface i WHERE NOT EXISTS (SELECT 1 FROM offers o WHERE o.source_id = i.id)`),
  gap('flow-without-main-path', 'interaction-design', ['flow', 'flow_step'], 'A flow with no step on its main path.',
    `SELECT f.id, 'Flow ' || f.id || ' has no step on its main path.' AS message FROM flow f WHERE NOT EXISTS (SELECT 1 FROM flow_step s WHERE s.flow_id = f.id AND s.path = 'main')`),
  // An API requirement is owed only where the product has a public API: an endpoint of a private one (the HTTP API a
  // product's own app calls) is held to its pattern's rules once, not to a requirement of its own (as essential.ts
  // counts an API requirement essential only for a product with a public API).
  gap('endpoint-without-requirement', 'interaction-design', ['endpoint', 'api_requirement', 'interface'], 'An endpoint of a product with a public API, with no API requirement.',
    `SELECT e.id, 'Endpoint ' || e.id || ' has no API requirement, and its product has a public API.' AS message FROM endpoint e
WHERE NOT EXISTS (SELECT 1 FROM api_requirement r WHERE r.endpoint_id = e.id)
  AND EXISTS (SELECT 1 FROM record_scope s JOIN interface i ON i.product_id = s.product_id WHERE s.id = e.id AND i.public AND i.kind = 'API')`),
  // Every route the code serves has an endpoint or a view (trace/routes.ts).
  ...ROUTE_GAP_RULES,
  // Technical specification: one technical record per design record.
  // An aggregate's one repository persists it.
  gap('aggregate-without-repository', 'technical-specification', ['aggregate', 'repository'], 'An aggregate no repository persists.',
    `SELECT a.id, 'Aggregate ' || a.id || ' has no repository: none persists it.' AS message FROM aggregate a
WHERE NOT EXISTS (SELECT 1 FROM persists p WHERE p.target_id = a.id)`),
  missingImpl('entity-without-data-model', 'entity', 'Entity', 'data_model', 'entity_id', 'data model'),
  missingImpl('entity-without-table', 'entity', 'Entity', 'table', 'entity_id', 'table', ' AND r.in_root_table IS NULL'),
  missingImpl('value-object-without-value-type', 'value_object', 'Value object', 'value_type', 'value_object_id', 'value type'),
  missingImpl('event-without-event-type', 'domain_event', 'Domain event', 'event_type', 'domain_event_id', 'event type'),
  missingImpl('read-model-without-projection', 'read_model', 'Read model', 'projection', 'read_model_id', 'projection'),
  missingImpl('read-model-without-reader', 'read_model', 'Read model', 'reader', 'read_model_id', 'reader'),
  missingImpl('read-model-without-table', 'read_model', 'Read model', 'table', 'read_model_id', 'table'),
  missingImpl('command-without-handler', 'command', 'Command', 'command_handler', 'command_id', 'command handler'),
  missingImpl('query-without-handler', 'query', 'Query', 'query_handler', 'query_id', 'query handler'),
  missingImpl('endpoint-without-handler', 'endpoint', 'Endpoint', 'endpoint_handler', 'endpoint_id', 'endpoint handler'),
  // An integration that only provides records (a platform, a dependency) is reached by nothing, so it needs no adapter.
  missingImpl('integration-without-adapter', 'integration', 'Integration', 'adapter', 'integration_id', 'adapter',
    `\n  AND (EXISTS (SELECT 1 FROM exchanges_with x WHERE x.target_id = r.id) OR NOT EXISTS (SELECT 1 FROM provided_by p WHERE p.target_id = r.id))`),
  // Every repository, reader and table names the data store it is kept in, and every data store keeps something.
  gap('stored-nowhere', 'technical-specification', ['repository', 'reader', 'table', 'data_store'], 'A repository, reader or table that names no data store.',
    `SELECT s.id, k.label || ' ' || s.id || ' names no data store: nothing says where its data lives.' AS message FROM stored_in_source s JOIN meta_kind k ON k.name = s.kind
WHERE NOT EXISTS (SELECT 1 FROM stored_in i WHERE i.source_id = s.id)`),
  gap('data-store-unused', 'technical-specification', ['data_store', 'repository', 'reader', 'table'], 'A data store no repository, reader or table is stored in.',
    `SELECT d.id, 'Data store ' || d.id || ' stores nothing: no repository, reader or table is stored in it.' AS message FROM data_store d WHERE NOT EXISTS (SELECT 1 FROM stored_in i WHERE i.target_id = d.id)`),
  gap('package-not-accounted-for', 'technical-specification', ['product', 'package_use'], 'A product whose package.json files list a package no record of it uses.', PACKAGE_GAP_SQL),
  // A table stored as a table names the file that creates it, which table-schema-mismatch reads (trace/tables.ts).
  gap('table-without-file', 'technical-specification', ['table'], 'A table stored in a database table that names no file creating it.',
    `SELECT t.id, 'Table ' || t.id || ' is stored as a table but names no file that creates it.' AS message FROM "table" t WHERE t.storage = 'table' AND t.file IS NULL`),
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
  // A design or build record a trace relation links that no obligation's chain reaches (trace_link): it serves no
  // requirement or rule. The kinds are those a chain reaches through a trace relation: a step fulfills, a command or
  // query is invoked by a fulfilling step, is presented by a view with a view requirement, is a policy's command,
  // calls a domain service, checks a specification or selects by one, a UI component builds a view requirement. A
  // command or query handler is left out: it serves what its operation serves, so its operation's gap stands for it
  // (reporting both would double each gap). So is a test: one of an obligation sits in its chain by construction, and a flow or integration test
  // proves its flow or integration, never an obligation.
  gap('record-untraced', 'interaction-design', [...UNTRACED_KINDS], 'A flow step, command, query or UI component no obligation\'s chain reaches.',
    `SELECT r.id, k.label || ' ' || r.id || ' is untraced: no obligation''s chain reaches it' || CASE r.kind
    WHEN 'flow_step' THEN ', as it fulfills no UC requirement.'
    WHEN 'command' THEN ', as no step that fulfills a UC requirement invokes it, no view with a view requirement presents it, no policy does, and it calls no domain service and checks no specification.'
    WHEN 'query' THEN ', as no step that fulfills a UC requirement invokes it, no view with a view requirement presents it, and it calls no domain service and selects by no specification.'
    ELSE ', as it builds no view requirement.' END AS message
FROM record_id r JOIN meta_kind k ON k.name = r.kind
WHERE r.kind IN (${list(UNTRACED_KINDS)}) AND NOT EXISTS (SELECT 1 FROM trace_link t WHERE t.target_id = r.id)`),
  // Test plan; an obligation's own test is its proof, counted above.
  gap('flow-without-test', 'test-plan', ['flow', 'flow_test'], 'A flow with no flow test of its main path.',
    `SELECT f.id, 'Flow ' || f.id || ' has no flow test.' AS message FROM flow f WHERE NOT EXISTS (SELECT 1 FROM flow_test t WHERE t.flow_id = f.id)`),
  gap('journey-without-test', 'test-plan', ['journey', 'journey_test'], 'A journey with no journey test.',
    `SELECT j.id, 'Journey ' || j.id || ' has no journey test: add the one that drives its main path from its trigger to its result.' AS message FROM journey j
WHERE NOT EXISTS (SELECT 1 FROM journey_test t WHERE t.journey_id = j.id)`),
];

/**
 * The coverage tables and views, for the schema's kinds, made once the file facts are in (a table is worked out once
 * per load, so the checks and the coverage queries that read it share the work):
 * - test_run (id, kind, parent_id, domain_id, level, state, file, level_allowed, backed): every test with its run by;
 *   backed says an automated test's file exists and names the test's ID (true for any other state).
 * - owed_pattern_rules (domain, id): the rules a domain owes. A domain follows a pattern when the domain itself follows
 *   it, one of its use cases does, or an interface that offers one of its use cases does (an interface's pattern says
 *   how each step is carried out through it), and then owes every rule of the pattern, with no exception. The one answer to
 *   "does this rule apply here", which coverage and the app read.
 * - obligation_impl (obligation_id, impl_id, via_id): the technical records that implement each obligation, each one of
 *   the specific records that build it (OBLIGATION_COVERAGE says which), never any code near it; built means every one
 *   names a file that exists, and there is at least one.
 * - obligation_rests_on (obligation_id, needs_id): the specifications and domain services a UC requirement rests on,
 *   through the commands and queries its steps invoke; it is built only while each of them is.
 * - obligation_own_built (id, built): each obligation's own build, before what it rests on.
 * - uc_requirement_flow (id, flow_id, fulfilled): each UC requirement with the flow of its use case, and whether a
 *   step of that flow fulfills it; designed means it does.
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
  return `
CREATE OR REPLACE TABLE test_run AS
SELECT t.*, EXISTS (SELECT 1 FROM test_level_allowed a WHERE a.kind = t.kind AND a.level = t.level) AS level_allowed,
  t.state <> 'automated' OR coalesce(f.file_exists AND f.contains_id, false) AS backed
FROM (${testRun}) t
LEFT JOIN file_facts f ON f.record = t.id;

CREATE OR REPLACE TABLE owed_pattern_rules AS
WITH followers AS (
  SELECT s.domain_id AS domain, f.target_id AS pattern FROM follows f JOIN use_case u ON u.id = f.source_id JOIN record_scope s ON s.id = u.id
  UNION
  SELECT d.id AS domain, f.target_id AS pattern FROM follows f JOIN domain d ON d.id = f.source_id
  UNION
  SELECT s.domain_id AS domain, f.target_id AS pattern FROM follows f JOIN offers o ON o.source_id = f.source_id JOIN record_scope s ON s.id = o.target_id
)
SELECT DISTINCT f.domain, r.id FROM pattern_rule r JOIN followers f ON f.pattern = r.pattern_id;

CREATE OR REPLACE TABLE obligation_impl AS
-- Each row also names via_id, the design record its chain reaches the technical record through (null: the obligation itself).
-- A constraint: its value object's value type.
SELECT c.id AS obligation_id, v.id AS impl_id, c.value_object_id AS via_id FROM "constraint" c JOIN value_type v ON v.value_object_id = c.value_object_id
-- An invariant: its rule.
UNION ALL SELECT invariant_id, id, NULL FROM rule
UNION ALL SELECT specification_id, id, NULL FROM predicate
UNION ALL SELECT policy_id, id, NULL FROM event_handler
-- A policy: also the adapter of each integration it exchanges with as it acts.
UNION ALL SELECT x.source_id, a.id, x.target_id FROM exchanges_with x JOIN policy p ON p.id = x.source_id JOIN adapter a ON a.integration_id = x.target_id
UNION ALL SELECT domain_service_id, id, NULL FROM service
-- A storage requirement: its aggregate's repository, or its read model's reader, once it names its data store.
UNION ALL SELECT s.id, p.source_id, s.aggregate_id FROM storage_requirement s JOIN persists p ON p.target_id = s.aggregate_id JOIN stored_in d ON d.source_id = p.source_id
UNION ALL SELECT s.id, r.id, s.read_model_id FROM storage_requirement s JOIN reader r ON r.read_model_id = s.read_model_id JOIN stored_in d ON d.source_id = r.id
-- A UC requirement: the handler of what a fulfilling step invokes, and the adapter of an integration it exchanges with.
UNION ALL SELECT f.target_id, h.id, i.target_id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN command_handler h ON h.command_id = i.target_id
UNION ALL SELECT f.target_id, h.id, i.target_id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN query_handler h ON h.query_id = i.target_id
-- ... and what those commands and queries rest on: the predicates of the specifications they check or select by, and
-- the services of the domain services they call, each through the command or query.
UNION ALL SELECT f.target_id, p.id, i.target_id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN checks c ON c.source_id = i.target_id JOIN predicate p ON p.specification_id = c.target_id
UNION ALL SELECT f.target_id, p.id, i.target_id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN selects_by c ON c.source_id = i.target_id JOIN predicate p ON p.specification_id = c.target_id
UNION ALL SELECT f.target_id, s.id, i.target_id FROM fulfills f JOIN invokes i ON i.source_id = f.source_id JOIN calls c ON c.source_id = i.target_id JOIN service s ON s.domain_service_id = c.target_id
-- ... and the adapter of each integration they exchange with.
UNION ALL SELECT f.target_id, a.id, x.target_id FROM fulfills f JOIN exchanges_with x ON x.source_id = f.source_id JOIN adapter a ON a.integration_id = x.target_id
-- A view requirement: the UI components that build it; an API requirement: its endpoint's handler.
UNION ALL SELECT target_id, source_id, NULL FROM builds
UNION ALL SELECT q.id, h.id, NULL FROM api_requirement q JOIN endpoint_handler h ON h.endpoint_id = q.endpoint_id
-- A standard rule: the technical records that meet it.
UNION ALL SELECT target_id, source_id, NULL FROM meets
-- A product's own obligation kind: the sources of its design and build links.
UNION ALL SELECT l.target_id, l.source_id, NULL FROM link l JOIN meta_relation r ON r.name = l.relation AND r.role IN ('design', 'build')
  JOIN obligation o ON o.id = l.target_id WHERE o.kind NOT IN (${lathe})
-- One of Lathe's obligation kinds, through a relation the product declared with the build role: its sources build the
-- obligation beside what builds it by its kind. A product's design links on one of Lathe's kinds design it
-- (product_design_link) and build nothing, since the kind says what builds it.
UNION ALL SELECT l.target_id, l.source_id, NULL FROM link l JOIN meta_relation r ON r.name = l.relation AND r.role = 'build' AND r.product_id IS NOT NULL
  JOIN obligation o ON o.id = l.target_id WHERE o.kind IN (${lathe});

-- Each of Lathe's obligations that a relation the product declared with the design role links to, with the source
-- that designs it; a product's own obligation kind takes the same links through obligation_impl.
CREATE OR REPLACE TABLE product_design_link AS
SELECT l.target_id AS obligation_id, l.source_id
FROM link l JOIN meta_relation r ON r.name = l.relation AND r.role = 'design' AND r.product_id IS NOT NULL
JOIN obligation o ON o.id = l.target_id WHERE o.kind IN (${lathe});

-- A UC requirement rests on the specifications the commands and queries its steps invoke check or select by, and
-- on the domain services they call: it is built only while each of them is.
CREATE OR REPLACE TABLE obligation_rests_on AS
SELECT DISTINCT f.target_id AS obligation_id, c.target_id AS needs_id
FROM fulfills f JOIN invokes i ON i.source_id = f.source_id
JOIN (SELECT source_id, target_id FROM checks UNION ALL SELECT source_id, target_id FROM selects_by UNION ALL SELECT source_id, target_id FROM calls) c ON c.source_id = i.target_id;

-- Each obligation's own build: at least one of its specific technical records implements it, and every one names a
-- file that exists (an invariant has one, its rule); or something outside the product provides it (provided_by).
CREATE OR REPLACE TABLE obligation_own_built AS
SELECT o.id,
  EXISTS (SELECT 1 FROM provided_by p WHERE p.source_id = o.id)
  OR (EXISTS (SELECT 1 FROM obligation_impl i WHERE i.obligation_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM obligation_impl i LEFT JOIN file_facts f ON f.record = i.impl_id WHERE i.obligation_id = o.id AND NOT coalesce(f.file_exists, false))) AS built
FROM obligation o;

CREATE OR REPLACE TABLE obligation_proof AS
WITH proofs AS (
  SELECT t.parent_id AS obligation_id, t.id AS test_id, t.domain_id, t.state, t.level_allowed AND t.backed AS valid
  FROM test_run t JOIN obligation o ON o.id = t.parent_id
  -- A product's own obligation kind: the sources of its proof links; one of Lathe's kinds: the sources of the proof
  -- links of relations the product declared. A test is backed as test_run says; a record of a product kind that
  -- names a file is backed only when that file exists and names it, as a test is; one that names no file counts as
  -- it stands.
  UNION ALL SELECT l.target_id, l.source_id, NULL, coalesce(t.state, 'automated'),
    coalesce(t.level_allowed AND t.backed, f.file_exists AND f.contains_id, true)
  FROM link l JOIN meta_relation r ON r.name = l.relation AND r.role = 'proof' JOIN obligation o ON o.id = l.target_id
  LEFT JOIN test_run t ON t.id = l.source_id LEFT JOIN file_facts f ON f.record = l.source_id
  WHERE o.kind NOT IN (${lathe}) OR r.product_id IS NOT NULL
)
SELECT *, state IN ('automated', 'manual') AND valid AS counts FROM proofs;

-- Each obligation's chain, link by link, each from the record nearer the obligation to the one it leads to (part: the
-- column of its target). Design: a UC requirement's fulfilling steps, their flows, what they invoke and the
-- integrations they exchange with; a view requirement's view's presented commands and queries (the editor forms
-- that reach an aggregate's generated Change, Remove, List and next-ID operations); a constraint's value object, an invariant's aggregate, a policy's
-- command and the integrations it exchanges with, a storage requirement's aggregate or read model; the commands and queries that call a domain service; the
-- commands that check a specification and the queries that select by it. Build: what implements it (obligation_impl),
-- and for a storage requirement the data store its repository or reader is stored in. Tests: its tests
-- (obligation_proof), counting or not.
CREATE OR REPLACE TABLE trace_link AS
SELECT DISTINCT * FROM (
  SELECT f.target_id AS obligation_id, f.target_id AS source_id, s.flow_id AS target_id, 'design' AS part FROM fulfills f JOIN flow_step s ON s.id = f.source_id
  UNION ALL SELECT f.target_id, s.flow_id, s.id, 'design' FROM fulfills f JOIN flow_step s ON s.id = f.source_id
  UNION ALL SELECT f.target_id, f.source_id, i.target_id, 'design' FROM fulfills f JOIN invokes i ON i.source_id = f.source_id
  UNION ALL SELECT f.target_id, f.source_id, x.target_id, 'design' FROM fulfills f JOIN exchanges_with x ON x.source_id = f.source_id
  UNION ALL SELECT id, id, value_object_id, 'design' FROM "constraint"
  UNION ALL SELECT id, id, aggregate_id, 'design' FROM invariant
  UNION ALL SELECT id, id, coalesce(aggregate_id, read_model_id), 'design' FROM storage_requirement
  UNION ALL SELECT id, id, command_id, 'design' FROM policy
  UNION ALL SELECT x.source_id, x.source_id, x.target_id, 'design' FROM exchanges_with x JOIN policy p ON p.id = x.source_id
  UNION ALL SELECT target_id, target_id, source_id, 'design' FROM calls
  UNION ALL SELECT target_id, target_id, source_id, 'design' FROM checks
  UNION ALL SELECT target_id, target_id, source_id, 'design' FROM selects_by
  UNION ALL SELECT q.id, q.id, p.target_id, 'design' FROM view_requirement q JOIN presents p ON p.source_id = q.view_id
  UNION ALL SELECT obligation_id, obligation_id, source_id, 'design' FROM product_design_link
  UNION ALL SELECT obligation_id, coalesce(via_id, obligation_id), impl_id, 'build' FROM obligation_impl
  UNION ALL SELECT i.obligation_id, i.impl_id, d.target_id, 'build' FROM obligation_impl i JOIN storage_requirement s ON s.id = i.obligation_id JOIN stored_in d ON d.source_id = i.impl_id
  UNION ALL SELECT obligation_id, obligation_id, test_id, 'tests' FROM obligation_proof
  UNION ALL SELECT p.source_id, p.source_id, p.target_id, 'build' FROM provided_by p JOIN obligation o ON o.id = p.source_id
);

CREATE OR REPLACE VIEW coverage_owed AS
SELECT s.product_id AS product, s.domain_id AS domain, o.id, o.kind FROM obligation o JOIN record_scope s ON s.id = o.id WHERE o.kind <> 'pattern_rule'
UNION ALL
SELECT s.product_id, p.domain, p.id, 'pattern_rule' FROM owed_pattern_rules p JOIN record_scope s ON s.id = p.domain;

-- The tests that count as each owed obligation's proof where it is owed: a pattern rule's only in the owing domain. A
-- provided obligation is proved through its provider, which stands in its list.
CREATE OR REPLACE TABLE coverage_proof AS
SELECT o.product, o.domain, o.id, p.test_id
FROM coverage_owed o JOIN obligation_proof p ON p.obligation_id = o.id AND p.counts AND (o.kind <> 'pattern_rule' OR p.domain_id = o.domain)
UNION ALL
SELECT o.product, o.domain, o.id, p.target_id FROM coverage_owed o JOIN provided_by p ON p.source_id = o.id;

-- Each UC requirement with the flow of its use case, and whether a step of that flow fulfills it.
CREATE OR REPLACE TABLE uc_requirement_flow AS
SELECT q.id, f.id AS flow_id, EXISTS (SELECT 1 FROM fulfills l JOIN flow_step s ON s.id = l.source_id WHERE l.target_id = q.id AND s.flow_id = f.id) AS fulfilled
FROM uc_requirement q JOIN flow f ON f.use_case_id = q.use_case_id;

CREATE OR REPLACE TABLE coverage_item AS
SELECT o.product, o.domain, o.id, o.kind,
  o.kind IN (${list(PROOF_ONLY)}) AS proof_only,
  o.kind IN (${list(DESIGNED_BY_CONSTRUCTION)})
    OR (o.kind = 'uc_requirement' AND EXISTS (SELECT 1 FROM uc_requirement_flow m WHERE m.id = o.id) AND NOT EXISTS (SELECT 1 FROM uc_requirement_flow m WHERE m.id = o.id AND NOT m.fulfilled))
    OR (o.kind NOT IN (${list([...DESIGNED_BY_CONSTRUCTION, 'uc_requirement'])}) AND EXISTS (SELECT 1 FROM obligation_impl i WHERE i.obligation_id = o.id))
    OR EXISTS (SELECT 1 FROM product_design_link d WHERE d.obligation_id = o.id) AS designed,
  o.kind IN (${list(PROOF_ONLY)})
    OR (coalesce(b.built, false)
      AND NOT EXISTS (SELECT 1 FROM obligation_rests_on r JOIN obligation_own_built n ON n.id = r.needs_id WHERE r.obligation_id = o.id AND NOT n.built)) AS built,
  EXISTS (SELECT 1 FROM coverage_proof p WHERE p.id = o.id AND p.domain IS NOT DISTINCT FROM o.domain) AS proved,
  EXISTS (SELECT 1 FROM obligation_proof p WHERE p.obligation_id = o.id AND p.state = 'not automated yet' AND (o.kind <> 'pattern_rule' OR p.domain_id = o.domain)) AS has_not_automated
FROM coverage_owed o LEFT JOIN obligation_own_built b ON b.id = o.id;

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
  SELECT i.product, i.domain, i.id, i.kind, 'designed' AS missing, 1 AS ord, k.label || ' ' || i.id || ' is not designed yet'
    || coalesce(': no step of ' || (SELECT string_agg(m.flow_id, ', ' ORDER BY m.flow_id) FROM uc_requirement_flow m WHERE m.id = i.id AND NOT m.fulfilled) || ' fulfills it.', '.') AS message
  FROM coverage_item i JOIN meta_kind k ON k.name = i.kind WHERE NOT i.designed
  UNION ALL
  SELECT i.product, i.domain, i.id, i.kind, 'built', 2, k.label || ' ' || i.id || ' is not built yet: not every file of what implements it exists.'
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

/**
 * Every fill, the accidental debt of each scope: (product, domain, id, slot), a hand-written technical record and the
 * slot it fills, by record then slot.
 */
export const COVERAGE_DEBT_SQL = `SELECT s.product_id AS product, s.domain_id AS domain, f.source_id AS id, f.target_id AS slot FROM fills f JOIN record_scope s ON s.id = f.source_id ORDER BY product, domain NULLS LAST, id, slot`;

/** Every gap: (product, domain, id, kind, missing, message), by record. */
export const COVERAGE_GAPS_SQL = `SELECT product, domain, id, kind, missing, message FROM coverage_gap ORDER BY product, domain NULLS LAST, id, ord, missing, message`;

/** One row per scope: its tests by state. The scopes come in the order of the answer: a product's domains by position, then the product itself. */
export const COVERAGE_TESTS_SQL = `SELECT t.product, t.domain, t.automated, t.manual, t.not_automated FROM coverage_tests t LEFT JOIN domain d ON d.id = t.domain ORDER BY t.product, d.position NULLS LAST`;

/** One row per test that counts as an owed obligation's proof: (product, domain, id, test_id). */
export const COVERAGE_PROOFS_SQL = `SELECT product, domain, id, test_id FROM coverage_proof ORDER BY product, domain NULLS LAST, id, test_id`;

/** One row per rule a domain owes, of each pattern it follows: (product, domain, id). */
export const OWED_PATTERN_RULES_SQL = `SELECT s.product_id AS product, p.domain, p.id FROM owed_pattern_rules p JOIN record_scope s ON s.id = p.domain ORDER BY product, p.domain, p.id`;

/** Every link of every obligation's chain: (obligation_id, source_id, target_id, part), part design, build or tests. */
export const TRACE_LINKS_SQL = `SELECT obligation_id, source_id, target_id, part FROM trace_link ORDER BY obligation_id, part, source_id, target_id`;

/** Every obligation, for its chain, empty or not. */
export const TRACE_OBLIGATIONS_SQL = `SELECT id FROM obligation ORDER BY id`;

/** The file each build or test record names, as the record gives it: (record, file). */
export const TRACE_FILES_SQL = `SELECT record, trim(file) AS file FROM file_facts WHERE trim(file) <> '' ORDER BY record`;
