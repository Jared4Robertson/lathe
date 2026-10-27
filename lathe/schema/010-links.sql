-- A link table per relation, (source_id, target_id), with real foreign keys. An end that accepts several kinds points
-- at a supertype table; the pairs of kinds each relation allows are in meta_relation_pair, and what the two ends must
-- share in meta_relation.scope. A relation with at most one link per source has a unique source_id. Then the setting
-- values a follower gives the pattern it follows.

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
CREATE TABLE calls (source_id VARCHAR NOT NULL REFERENCES operation (id), target_id VARCHAR NOT NULL REFERENCES domain_service (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE calls IS 'The command or query uses the domain service, of its own domain.';
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
CREATE TABLE follows (source_id VARCHAR NOT NULL REFERENCES follows_source (id), target_id VARCHAR NOT NULL REFERENCES pattern (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE follows IS 'The domain or use case follows the pattern, and gives a value for each of its settings in setting_value rows.';
CREATE TABLE meets (source_id VARCHAR NOT NULL REFERENCES meets_source (id), target_id VARCHAR NOT NULL REFERENCES standard_rule (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE meets IS 'The technical record or test follows the standard rule.';
CREATE TABLE about (source_id VARCHAR NOT NULL REFERENCES question (id), target_id VARCHAR NOT NULL REFERENCES record_id (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE about IS 'The open question concerns the record.';

INSERT INTO meta_relation VALUES
  ('has_one', NULL, 'product', 'Has one', 'Part of', NULL),
  ('has_many', NULL, 'product', 'Has many', 'Part of', NULL),
  ('raises', NULL, 'aggregate', 'Raises', 'Raised by', NULL),
  ('checks', NULL, 'domain', 'Checks', 'Checked by', NULL),
  ('reads', NULL, 'domain', 'Reads', 'Read by', NULL),
  ('selects_by', NULL, 'domain', 'Selects by', 'Selects for', NULL),
  ('hears', NULL, 'product', 'Hears', 'Heard by', NULL),
  ('calls', NULL, 'domain', 'Calls', 'Called by', NULL),
  ('fulfills', 'design', 'product', 'Fulfills', 'Fulfilled by', NULL),
  ('invokes', NULL, 'product', 'Invokes', 'Invoked by', NULL),
  ('happens_in', NULL, 'product', 'Happens in', 'Hosts', NULL),
  ('exchanges_with', NULL, 'product', 'Exchanges with', 'Exchanged with by', NULL),
  ('renders', NULL, 'product', 'Renders', 'Rendered by', NULL),
  ('follows', NULL, 'product', 'Follows', 'Followed by', NULL),
  ('meets', NULL, 'product', 'Meets', 'Met by', NULL),
  ('about', NULL, 'product', 'About', 'Questions about this', NULL);

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
  ('fulfills', 'flow_step', 'uc_requirement', 'The step fulfills the UC requirement of its use case.'),
  ('invokes', 'flow_step', 'command', 'The step sends the command.'),
  ('invokes', 'flow_step', 'query', 'The step asks the query.'),
  ('happens_in', 'flow_step', 'view', 'The step happens in the view.'),
  ('exchanges_with', 'flow_step', 'integration', 'The step exchanges with the outside system.'),
  ('renders', 'ui_component', 'view', 'The UI component renders the view, or part of it.'),
  ('follows', 'domain', 'pattern', 'The whole domain follows the pattern, and so owes each of its rules.'),
  ('follows', 'use_case', 'pattern', 'The use case follows the pattern and gives a value for each of its settings.'),
  ('meets', 'repository', 'standard_rule', 'The repository follows the standard rule.'),
  ('meets', 'data_model', 'standard_rule', 'The data model follows the standard rule.'),
  ('meets', 'table', 'standard_rule', 'The table follows the standard rule.'),
  ('meets', 'value_type', 'standard_rule', 'The value type follows the standard rule.'),
  ('meets', 'predicate', 'standard_rule', 'The predicate follows the standard rule.'),
  ('meets', 'event_type', 'standard_rule', 'The event type follows the standard rule.'),
  ('meets', 'projection', 'standard_rule', 'The projection follows the standard rule.'),
  ('meets', 'command_handler', 'standard_rule', 'The command handler follows the standard rule.'),
  ('meets', 'query_handler', 'standard_rule', 'The query handler follows the standard rule.'),
  ('meets', 'event_handler', 'standard_rule', 'The event handler follows the standard rule.'),
  ('meets', 'service', 'standard_rule', 'The service follows the standard rule.'),
  ('meets', 'ui_component', 'standard_rule', 'The UI component follows the standard rule.'),
  ('meets', 'endpoint_handler', 'standard_rule', 'The endpoint handler follows the standard rule.'),
  ('meets', 'adapter', 'standard_rule', 'The adapter follows the standard rule.'),
  ('meets', 'constraint_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'invariant_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'specification_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'policy_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'domain_service_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'use_case_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'view_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'endpoint_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'flow_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'integration_test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'pattern_rule_test', 'standard_rule', 'The test follows the standard rule.'),
  ('about', 'question', '*', 'The open question concerns that record.');

INSERT INTO meta_table SELECT name, 'link', NULL FROM meta_relation;

CREATE TABLE setting_value (
  follower_id VARCHAR NOT NULL,
  pattern_id VARCHAR NOT NULL,
  setting VARCHAR NOT NULL,
  value VARCHAR,
  not_applicable VARCHAR,
  PRIMARY KEY (follower_id, pattern_id, setting),
  FOREIGN KEY (follower_id, pattern_id) REFERENCES follows (source_id, target_id),
  FOREIGN KEY (pattern_id, setting) REFERENCES pattern_setting (pattern_id, name),
  CHECK ((value IS NULL) <> (not_applicable IS NULL))
);
COMMENT ON TABLE setting_value IS 'The value a use case or domain gives one setting of a pattern it follows: a value, or Not applicable with the reason.';
COMMENT ON COLUMN setting_value.follower_id IS 'The use case or domain that follows the pattern.';
COMMENT ON COLUMN setting_value.pattern_id IS 'The pattern it follows.';
COMMENT ON COLUMN setting_value.setting IS 'The setting, one of the pattern''s.';
COMMENT ON COLUMN setting_value.value IS 'The value it gives the setting.';
COMMENT ON COLUMN setting_value.not_applicable IS 'Why the setting does not apply to it, in place of a value.';
INSERT INTO meta_table VALUES ('setting_value', 'part', 'follower_id');
