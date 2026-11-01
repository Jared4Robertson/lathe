-- A link table per relation, (source_id, target_id), with real foreign keys. An end that accepts several kinds points
-- at a supertype table; the pairs of kinds each relation allows are in meta_relation_pair, and what the two ends must
-- share in meta_relation.scope. A relation with at most one link per source has a unique source_id, and one with at most
-- one per target a unique target_id. Then the setting values a follower gives the pattern it follows.

CREATE TABLE has_one (source_id VARCHAR NOT NULL REFERENCES entity (id), target_id VARCHAR NOT NULL REFERENCES entity (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE has_one IS 'The entity holds exactly one of the other entity, as a part of it (one to one).';
CREATE TABLE has_many (source_id VARCHAR NOT NULL REFERENCES entity (id), target_id VARCHAR NOT NULL REFERENCES entity (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE has_many IS 'The entity holds any number of the other entity, as parts of it (one to many).';
CREATE TABLE raises (source_id VARCHAR NOT NULL REFERENCES command (id), target_id VARCHAR NOT NULL REFERENCES domain_event (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE raises IS 'The command raises the event, of the aggregate it changes.';
CREATE TABLE checks (source_id VARCHAR NOT NULL REFERENCES command (id), target_id VARCHAR NOT NULL REFERENCES specification (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE checks IS 'The command checks the specification, of its own domain, before it acts.';
CREATE TABLE reads (source_id VARCHAR NOT NULL REFERENCES reads_source (id), target_id VARCHAR NOT NULL REFERENCES aggregate (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE reads IS 'The specification or read model reads the aggregate, of its own domain.';
CREATE TABLE selects_by (source_id VARCHAR NOT NULL REFERENCES query (id), target_id VARCHAR NOT NULL REFERENCES specification (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE selects_by IS 'The query selects the records that satisfy the specification, of its own domain.';
CREATE TABLE hears (source_id VARCHAR NOT NULL UNIQUE REFERENCES policy (id), target_id VARCHAR NOT NULL REFERENCES domain_event (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE hears IS 'The policy hears the event: one event per policy, of its own domain or another domain''s published one.';
CREATE TABLE calls (source_id VARCHAR NOT NULL REFERENCES calls_source (id), target_id VARCHAR NOT NULL REFERENCES domain_service (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE calls IS 'The command, query or read model uses the domain service, of its own domain.';
CREATE TABLE fed_by (source_id VARCHAR NOT NULL REFERENCES read_model (id), target_id VARCHAR NOT NULL REFERENCES domain_event (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE fed_by IS 'The read model is kept current from the event: of its own domain, or another domain''s published one, which is how a read model shows another domain''s data.';
CREATE TABLE fulfills (source_id VARCHAR NOT NULL REFERENCES flow_step (id), target_id VARCHAR NOT NULL REFERENCES uc_requirement (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE fulfills IS 'The flow step fulfills the UC requirement, of its own use case; this designs the requirement.';
CREATE TABLE invokes (source_id VARCHAR NOT NULL UNIQUE REFERENCES flow_step (id), target_id VARCHAR NOT NULL REFERENCES operation (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE invokes IS 'The flow step invokes the command or query: at most one per step.';
CREATE TABLE happens_in (source_id VARCHAR NOT NULL UNIQUE REFERENCES flow_step (id), target_id VARCHAR NOT NULL REFERENCES view (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE happens_in IS 'The flow step happens in the view: at most one per step.';
CREATE TABLE exchanges_with (source_id VARCHAR NOT NULL REFERENCES flow_step (id), target_id VARCHAR NOT NULL REFERENCES integration (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE exchanges_with IS 'The flow step exchanges with the integration''s outside system.';
CREATE TABLE renders (source_id VARCHAR NOT NULL REFERENCES ui_component (id), target_id VARCHAR NOT NULL REFERENCES view (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE renders IS 'The UI component renders the view, or part of it.';
CREATE TABLE builds (source_id VARCHAR NOT NULL REFERENCES ui_component (id), target_id VARCHAR NOT NULL REFERENCES view_requirement (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE builds IS 'The UI component builds the view requirement: its code does what the requirement says. A view requirement is built only through the components that build it, never through any component that renders its view.';
CREATE TABLE follows (source_id VARCHAR NOT NULL REFERENCES follows_source (id), target_id VARCHAR NOT NULL REFERENCES pattern (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE follows IS 'The domain or use case follows the pattern, and gives a value for each of its settings in setting_value rows.';
CREATE TABLE meets (source_id VARCHAR NOT NULL REFERENCES technical_record (id), target_id VARCHAR NOT NULL REFERENCES standard_rule (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE meets IS 'The technical record follows the standard rule: it shows where the rule is applied, and designs it.';
CREATE TABLE persists (source_id VARCHAR NOT NULL UNIQUE REFERENCES repository (id), target_id VARCHAR NOT NULL UNIQUE REFERENCES aggregate (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE persists IS 'The repository loads and saves the aggregate, whole: one repository per aggregate, and one aggregate per repository.';
CREATE TABLE stored_in (source_id VARCHAR NOT NULL UNIQUE REFERENCES stored_in_source (id), target_id VARCHAR NOT NULL REFERENCES data_store (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE stored_in IS 'The repository, reader or table is kept in the data store: each names exactly one, where its data actually lives.';
CREATE TABLE provided_by (source_id VARCHAR NOT NULL UNIQUE REFERENCES provided_by_source (id), target_id VARCHAR NOT NULL REFERENCES record_id (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE provided_by IS 'The record is provided by something outside the product, which decides it once for everyone who uses it: a dependency, a platform or a generic subdomain, reached through an integration or named by a record of a product''s own kind (a component of a design system), once the product adds that pair with a product_relation named provided_by. A data store someone else runs, such as a managed database or a bucket, is provided by the integration that reaches it; a store the product owns outright, such as a local file, has none. A provided record counts as accounted for, and a provided obligation as built and proved, through its provider. One provider per record.';
CREATE TABLE fills (source_id VARCHAR NOT NULL REFERENCES accidental_record (id), target_id VARCHAR NOT NULL REFERENCES slot (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE fills IS 'The accidental record (a technical record or an endpoint), written by hand, fills the pattern''s slot against its contract: it is a fill, accidental complexity recorded where it is owed and counted as debt until the pattern can derive it.';
CREATE TABLE generates (source_id VARCHAR NOT NULL REFERENCES tooling (id), target_id VARCHAR NOT NULL REFERENCES accidental_record (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE generates IS 'The tooling record (a generator) writes the accidental record (a technical record''s code, or an endpoint''s route) from the spec: the record is derived, never written by hand.';
CREATE TABLE serves (source_id VARCHAR NOT NULL REFERENCES capability (id), target_id VARCHAR NOT NULL REFERENCES business_outcome (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE serves IS 'The capability serves the business outcome: what it is for. A capability may serve several outcomes, and an outcome be served by several capabilities.';
CREATE TABLE measured_by (source_id VARCHAR NOT NULL REFERENCES business_outcome (id), target_id VARCHAR NOT NULL REFERENCES record_id (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE measured_by IS 'The business outcome is measured by the test or record: a test of any kind, or a record of a product''s own kind (a report, a script, a check row) once the product adds that pair with a product_relation named measured_by. An outcome may be measured by several, and one test or record measure several outcomes.';
CREATE TABLE starts_from (source_id VARCHAR NOT NULL REFERENCES test (id), target_id VARCHAR NOT NULL REFERENCES test_data_set (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE starts_from IS 'The test starts from the test data set: it is prepared before the test and reset after.';
CREATE TABLE about (source_id VARCHAR NOT NULL REFERENCES question (id), target_id VARCHAR NOT NULL REFERENCES record_id (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE about IS 'The open question concerns the record.';
CREATE TABLE builds_on (source_id VARCHAR NOT NULL REFERENCES term (id), target_id VARCHAR NOT NULL REFERENCES term (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE builds_on IS 'The term is defined with the other term: its meaning uses it, so the other term is defined first and never builds on it in turn, through any chain.';

INSERT INTO meta_relation VALUES
  ('has_one', NULL, 'product', 'Has one', 'Part of', NULL),
  ('has_many', NULL, 'product', 'Has many', 'Part of', NULL),
  ('raises', NULL, 'aggregate', 'Raises', 'Raised by', NULL),
  ('checks', NULL, 'domain', 'Checks', 'Checked by', NULL),
  ('reads', NULL, 'domain', 'Reads', 'Read by', NULL),
  ('selects_by', NULL, 'domain', 'Selects by', 'Selects for', NULL),
  ('hears', NULL, 'product', 'Hears', 'Heard by', NULL),
  ('fed_by', NULL, 'product', 'Fed by', 'Feeds', NULL),
  ('calls', NULL, 'domain', 'Calls', 'Called by', NULL),
  ('fulfills', 'design', 'product', 'Fulfills', 'Fulfilled by', NULL),
  ('invokes', NULL, 'product', 'Invokes', 'Invoked by', NULL),
  ('happens_in', NULL, 'product', 'Happens in', 'Hosts', NULL),
  ('exchanges_with', NULL, 'product', 'Exchanges with', 'Exchanged with by', NULL),
  ('renders', NULL, 'product', 'Renders', 'Rendered by', NULL),
  ('builds', 'build', 'product', 'Builds', 'Built by', NULL),
  ('follows', NULL, 'product', 'Follows', 'Followed by', NULL),
  ('meets', NULL, 'product', 'Meets', 'Met by', NULL),
  ('persists', NULL, 'product', 'Persists', 'Persisted by', NULL),
  ('stored_in', NULL, 'product', 'Stored in', 'Stores', NULL),
  ('provided_by', NULL, 'product', 'Provided by', 'Provides', NULL),
  ('fills', NULL, 'product', 'Fills', 'Filled by', NULL),
  ('generates', NULL, 'product', 'Generates', 'Generated by', NULL),
  ('serves', NULL, 'product', 'Serves', 'Served by', NULL),
  ('measured_by', NULL, 'product', 'Measured by', 'Measures', NULL),
  ('starts_from', NULL, 'product', 'Starts from', 'Starting point of', NULL),
  ('about', NULL, 'product', 'About', 'Questions about this', NULL),
  ('builds_on', NULL, 'product', 'Builds on', 'Built on by', NULL);

INSERT INTO meta_relation_pair VALUES
  ('has_one', 'entity', 'entity', 'The entity holds exactly one of the other entity, as a part of it (one to one).'),
  ('has_many', 'entity', 'entity', 'The entity holds any number of the other entity, as parts of it (one to many).'),
  ('raises', 'command', 'domain_event', 'The command raises the event, of the aggregate it changes.'),
  ('checks', 'command', 'specification', 'The command checks the specification before it acts.'),
  ('reads', 'specification', 'aggregate', 'The specification is a predicate over the aggregate.'),
  ('reads', 'read_model', 'aggregate', 'The read model shows the aggregate''s data.'),
  ('selects_by', 'query', 'specification', 'The query selects the records that satisfy the specification.'),
  ('hears', 'policy', 'domain_event', 'Whenever the event happens, the policy sends its command.'),
  ('calls', 'command', 'domain_service', 'The command uses the domain service.'),
  ('calls', 'query', 'domain_service', 'The query uses the domain service.'),
  ('calls', 'read_model', 'domain_service', 'The read model''s projection uses the domain service.'),
  ('fed_by', 'read_model', 'domain_event', 'The read model is kept current from the event.'),
  ('fulfills', 'flow_step', 'uc_requirement', 'The step fulfills the UC requirement of its use case.'),
  ('invokes', 'flow_step', 'command', 'The step sends the command.'),
  ('invokes', 'flow_step', 'query', 'The step asks the query.'),
  ('happens_in', 'flow_step', 'view', 'The step happens in the view.'),
  ('exchanges_with', 'flow_step', 'integration', 'The step exchanges with the outside system.'),
  ('renders', 'ui_component', 'view', 'The UI component renders the view, or part of it.'),
  ('builds', 'ui_component', 'view_requirement', 'The UI component''s code does what the view requirement says.'),
  ('follows', 'domain', 'pattern', 'The whole domain follows the pattern, and so owes each of its rules.'),
  ('follows', 'use_case', 'pattern', 'The use case follows the pattern and gives a value for each of its settings.'),
  ('meets', 'repository', 'standard_rule', 'The repository follows the standard rule.'),
  ('meets', 'data_model', 'standard_rule', 'The data model follows the standard rule.'),
  ('meets', 'table', 'standard_rule', 'The table follows the standard rule.'),
  ('meets', 'value_type', 'standard_rule', 'The value type follows the standard rule.'),
  ('meets', 'rule', 'standard_rule', 'The rule follows the standard rule.'),
  ('meets', 'predicate', 'standard_rule', 'The predicate follows the standard rule.'),
  ('meets', 'event_type', 'standard_rule', 'The event type follows the standard rule.'),
  ('meets', 'projection', 'standard_rule', 'The projection follows the standard rule.'),
  ('meets', 'reader', 'standard_rule', 'The reader follows the standard rule.'),
  ('meets', 'command_handler', 'standard_rule', 'The command handler follows the standard rule.'),
  ('meets', 'query_handler', 'standard_rule', 'The query handler follows the standard rule.'),
  ('meets', 'event_handler', 'standard_rule', 'The event handler follows the standard rule.'),
  ('meets', 'service', 'standard_rule', 'The service follows the standard rule.'),
  ('meets', 'ui_component', 'standard_rule', 'The UI component follows the standard rule.'),
  ('meets', 'endpoint_handler', 'standard_rule', 'The endpoint handler follows the standard rule.'),
  ('meets', 'adapter', 'standard_rule', 'The adapter follows the standard rule.'),
  ('meets', 'entry_point', 'standard_rule', 'The entry point follows the standard rule.'),
  ('meets', 'tooling', 'standard_rule', 'The tooling record follows the standard rule.'),
  ('persists', 'repository', 'aggregate', 'The repository loads and saves the aggregate, whole.'),
  ('stored_in', 'repository', 'data_store', 'The repository loads and saves its aggregate in the data store.'),
  ('stored_in', 'reader', 'data_store', 'The reader reads its read model''s table in the data store.'),
  ('stored_in', 'table', 'data_store', 'The table is kept in the data store.'),
  ('serves', 'capability', 'business_outcome', 'The capability serves the business outcome.'),
  ('measured_by', 'business_outcome', 'constraint_test', 'The business outcome is measured by the constraint test.'),
  ('measured_by', 'business_outcome', 'invariant_test', 'The business outcome is measured by the invariant test.'),
  ('measured_by', 'business_outcome', 'specification_test', 'The business outcome is measured by the specification test.'),
  ('measured_by', 'business_outcome', 'policy_test', 'The business outcome is measured by the policy test.'),
  ('measured_by', 'business_outcome', 'domain_service_test', 'The business outcome is measured by the domain service test.'),
  ('measured_by', 'business_outcome', 'storage_requirement_test', 'The business outcome is measured by the storage requirement test.'),
  ('measured_by', 'business_outcome', 'use_case_test', 'The business outcome is measured by the use case test.'),
  ('measured_by', 'business_outcome', 'view_test', 'The business outcome is measured by the view test.'),
  ('measured_by', 'business_outcome', 'endpoint_test', 'The business outcome is measured by the endpoint test.'),
  ('measured_by', 'business_outcome', 'flow_test', 'The business outcome is measured by the flow test.'),
  ('measured_by', 'business_outcome', 'integration_test', 'The business outcome is measured by the integration test.'),
  ('measured_by', 'business_outcome', 'pattern_rule_test', 'The business outcome is measured by the pattern rule test.'),
  ('measured_by', 'business_outcome', 'standard_rule_test', 'The business outcome is measured by the standard rule test.'),
  ('starts_from', 'constraint_test', 'test_data_set', 'The constraint test starts from the test data set.'),
  ('starts_from', 'invariant_test', 'test_data_set', 'The invariant test starts from the test data set.'),
  ('starts_from', 'specification_test', 'test_data_set', 'The specification test starts from the test data set.'),
  ('starts_from', 'policy_test', 'test_data_set', 'The policy test starts from the test data set.'),
  ('starts_from', 'domain_service_test', 'test_data_set', 'The domain service test starts from the test data set.'),
  ('starts_from', 'storage_requirement_test', 'test_data_set', 'The storage requirement test starts from the test data set.'),
  ('starts_from', 'use_case_test', 'test_data_set', 'The use case test starts from the test data set.'),
  ('starts_from', 'view_test', 'test_data_set', 'The view test starts from the test data set.'),
  ('starts_from', 'endpoint_test', 'test_data_set', 'The endpoint test starts from the test data set.'),
  ('starts_from', 'flow_test', 'test_data_set', 'The flow test starts from the test data set.'),
  ('starts_from', 'integration_test', 'test_data_set', 'The integration test starts from the test data set.'),
  ('starts_from', 'pattern_rule_test', 'test_data_set', 'The pattern rule test starts from the test data set.'),
  ('starts_from', 'standard_rule_test', 'test_data_set', 'The standard rule test starts from the test data set.'),
  ('about', 'question', '*', 'The open question concerns that record.'),
  ('builds_on', 'term', 'term', 'The term''s meaning uses the other term, which is defined before it.');

-- The pairs of provided_by, fills and generates, one per member of the supertype their end accepts, worded by its label.
INSERT INTO meta_relation_pair
  WITH named AS (
    SELECT m.supertype, m.kind, CASE WHEN regexp_matches(k.label, '^[A-Z]{2}') THEN k.label ELSE lower(k.label) END AS label
    FROM meta_supertype_member m JOIN meta_kind k ON k.name = m.kind
  )
  SELECT 'provided_by', kind, 'integration', 'The ' || label || ' is provided by what the integration reaches, outside the product.' FROM named WHERE supertype = 'provided_by_source'
  UNION ALL SELECT 'fills', kind, 'slot', 'The ' || label || ', written by hand, fills the slot.' FROM named WHERE supertype = 'accidental_record'
  UNION ALL SELECT 'generates', 'tooling', kind, 'The tooling record generates the ' || label || '''s code.' FROM named WHERE supertype = 'accidental_record';

INSERT INTO meta_table SELECT name, 'link', NULL FROM meta_relation;

CREATE TABLE setting_value (
  follower_id VARCHAR NOT NULL,
  pattern_id VARCHAR NOT NULL,
  setting VARCHAR NOT NULL,
  value VARCHAR NOT NULL CHECK (trim(value) <> ''),
  PRIMARY KEY (follower_id, pattern_id, setting),
  FOREIGN KEY (follower_id, pattern_id) REFERENCES follows (source_id, target_id),
  FOREIGN KEY (pattern_id, setting) REFERENCES pattern_setting (pattern_id, name)
);
COMMENT ON TABLE setting_value IS 'The value a use case or domain gives one setting of a pattern it follows. A follower owes every rule of the pattern; a value such as No input is a value like any other, never a way out of a rule.';
COMMENT ON COLUMN setting_value.follower_id IS 'The use case or domain that follows the pattern.';
COMMENT ON COLUMN setting_value.pattern_id IS 'The pattern it follows.';
COMMENT ON COLUMN setting_value.setting IS 'The setting, one of the pattern''s.';
COMMENT ON COLUMN setting_value.value IS 'The value it gives the setting.';
INSERT INTO meta_table VALUES ('setting_value', 'part', 'follower_id');
