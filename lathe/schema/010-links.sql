-- A link table per relation, (source_id, target_id), with real foreign keys. An end that accepts several kinds points
-- at a supertype table; the pairs of kinds each relation allows are in meta_relation_pair. Then the setting values a
-- follower gives the pattern it follows.

CREATE TABLE relates_to (source_id VARCHAR NOT NULL REFERENCES aggregate (id), target_id VARCHAR NOT NULL REFERENCES aggregate (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE relates_to IS 'One aggregate refers to another by ID.';
CREATE TABLE applies (source_id VARCHAR NOT NULL REFERENCES use_case (id), target_id VARCHAR NOT NULL REFERENCES domain_rule (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE applies IS 'The use case relies on the domain rule.';
CREATE TABLE follows (source_id VARCHAR NOT NULL REFERENCES follows_source (id), target_id VARCHAR NOT NULL REFERENCES pattern (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE follows IS 'The use case or domain follows the pattern, and gives a value for each of its settings in setting_value rows.';
CREATE TABLE fulfills (source_id VARCHAR NOT NULL REFERENCES fulfills_source (id), target_id VARCHAR NOT NULL REFERENCES obligation (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE fulfills IS 'The flow, flow step, view, endpoint or interaction requirement carries out the obligation.';
CREATE TABLE uses (source_id VARCHAR NOT NULL REFERENCES uses_source (id), target_id VARCHAR NOT NULL REFERENCES uses_target (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE uses IS 'The flow, step or view passes through, calls or is carried out by the view, endpoint or component.';
CREATE TABLE satisfies (source_id VARCHAR NOT NULL REFERENCES satisfies_source (id), target_id VARCHAR NOT NULL REFERENCES obligation (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE satisfies IS 'The component or technical step designs the obligation; this counts as design.';
CREATE TABLE implements (source_id VARCHAR NOT NULL REFERENCES component (id), target_id VARCHAR NOT NULL REFERENCES implements_target (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE implements IS 'The component serves the endpoint or renders the view.';
CREATE TABLE depends_on (source_id VARCHAR NOT NULL REFERENCES component (id), target_id VARCHAR NOT NULL REFERENCES component (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE depends_on IS 'The component calls or imports the other.';
CREATE TABLE proves (source_id VARCHAR NOT NULL REFERENCES test (id), target_id VARCHAR NOT NULL REFERENCES obligation (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE proves IS 'The test proves the obligation; this counts as proof.';
CREATE TABLE supports (source_id VARCHAR NOT NULL REFERENCES test (id), target_id VARCHAR NOT NULL REFERENCES obligation (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE supports IS 'The test checks a mechanism that backs the obligation, such as a lock or a budget, without proving it; it never counts as proof.';
CREATE TABLE about (source_id VARCHAR NOT NULL REFERENCES question (id), target_id VARCHAR NOT NULL REFERENCES record_id (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE about IS 'The open question concerns the record.';
CREATE TABLE carries_out (source_id VARCHAR NOT NULL REFERENCES flow (id), target_id VARCHAR NOT NULL REFERENCES use_case (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE carries_out IS 'The flow carries out the use case.';
CREATE TABLE runs (source_id VARCHAR NOT NULL REFERENCES test (id), target_id VARCHAR NOT NULL REFERENCES flow (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE runs IS 'The test runs the flow end to end.';
CREATE TABLE covers (source_id VARCHAR NOT NULL REFERENCES test (id), target_id VARCHAR NOT NULL REFERENCES component (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE covers IS 'The test exercises the component.';
CREATE TABLE has_one (source_id VARCHAR NOT NULL REFERENCES entity (id), target_id VARCHAR NOT NULL REFERENCES entity (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE has_one IS 'The entity holds exactly one of the other entity, as a part of it (one to one).';
CREATE TABLE has_many (source_id VARCHAR NOT NULL REFERENCES entity (id), target_id VARCHAR NOT NULL REFERENCES entity (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE has_many IS 'The entity holds any number of the other entity, as parts of it (one to many).';
CREATE TABLE refers_to (source_id VARCHAR NOT NULL REFERENCES entity (id), target_id VARCHAR NOT NULL REFERENCES entity (id), PRIMARY KEY (source_id, target_id), CHECK (source_id <> target_id));
COMMENT ON TABLE refers_to IS 'The entity holds a reference to one of the other entity, which may sit in another aggregate or domain (many to one).';
CREATE TABLE raised_by (source_id VARCHAR NOT NULL REFERENCES domain_event (id), target_id VARCHAR NOT NULL REFERENCES entity (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE raised_by IS 'The event is raised when that entity of its aggregate changes.';
CREATE TABLE reacts_to (source_id VARCHAR NOT NULL REFERENCES reacts_to_source (id), target_id VARCHAR NOT NULL REFERENCES domain_event (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE reacts_to IS 'The aggregate changes, the use case starts or the component handles the event, which may come from another aggregate or domain.';
CREATE TABLE involves (source_id VARCHAR NOT NULL REFERENCES domain_rule (id), target_id VARCHAR NOT NULL REFERENCES aggregate (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE involves IS 'The domain rule, under its domain, holds across this aggregate and the others it names.';
CREATE TABLE deepens (source_id VARCHAR NOT NULL REFERENCES design_flow (id), target_id VARCHAR NOT NULL REFERENCES flow (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE deepens IS 'The technical flow says how the system carries out the flow.';
CREATE TABLE meets (source_id VARCHAR NOT NULL REFERENCES meets_source (id), target_id VARCHAR NOT NULL REFERENCES standard_rule (id), PRIMARY KEY (source_id, target_id));
COMMENT ON TABLE meets IS 'The component, test or technical step follows the standard rule.';

INSERT INTO meta_relation VALUES
  ('relates_to', NULL, 'Relates to', 'Related to by', NULL),
  ('applies', NULL, 'Applies', 'Applied by', NULL),
  ('follows', NULL, 'Follows', 'Followed by', NULL),
  ('fulfills', NULL, 'Carries out', 'Carried out in', NULL),
  ('uses', NULL, 'Uses', 'Used by', NULL),
  ('satisfies', 'design', 'Satisfies', 'Designed by', NULL),
  ('implements', NULL, 'Implements', 'Implemented by', NULL),
  ('depends_on', NULL, 'Depends on', 'Depended on by', NULL),
  ('proves', 'proof', 'Proves', 'Proved by', NULL),
  ('supports', NULL, 'Supports', 'Supported by', NULL),
  ('about', NULL, 'About', 'Questions about this', NULL),
  ('carries_out', NULL, 'Carries out', 'Carried out by flow', NULL),
  ('runs', NULL, 'Runs', 'Run by', NULL),
  ('covers', NULL, 'Covers', 'Covered by', NULL),
  ('has_one', NULL, 'Has one', 'Part of', NULL),
  ('has_many', NULL, 'Has many', 'Part of', NULL),
  ('refers_to', NULL, 'Refers to', 'Referred to by', NULL),
  ('raised_by', NULL, 'Raised by', 'Raises', NULL),
  ('reacts_to', NULL, 'Reacts to', 'Reacted to by', NULL),
  ('involves', NULL, 'Involves', 'Involved in', NULL),
  ('deepens', NULL, 'Deepens', 'Deepened by', NULL),
  ('meets', NULL, 'Meets', 'Met by', NULL);

INSERT INTO meta_relation_pair VALUES
  ('relates_to', 'aggregate', 'aggregate', 'One aggregate refers to another by ID.'),
  ('applies', 'use_case', 'domain_rule', 'The use case relies on the domain rule.'),
  ('follows', 'use_case', 'pattern', 'The use case follows the pattern and gives a value for each of its settings.'),
  ('follows', 'domain', 'pattern', 'The whole domain follows the pattern, and so owes each of its rules.'),
  ('fulfills', 'flow', 'requirement', 'The flow carries out the requirement.'),
  ('fulfills', 'flow', 'domain_rule', 'The flow carries out the domain rule.'),
  ('fulfills', 'flow', 'interaction_requirement', 'The flow carries out the interaction requirement.'),
  ('fulfills', 'view', 'requirement', 'The view carries out the requirement.'),
  ('fulfills', 'endpoint', 'requirement', 'The endpoint carries out the requirement.'),
  ('fulfills', 'interaction_requirement', 'requirement', 'The interaction requirement carries out the use case requirement at a view, endpoint or flow.'),
  ('fulfills', 'interaction_requirement', 'domain_rule', 'The interaction requirement carries out the domain rule at a view, endpoint or flow.'),
  ('fulfills', 'interaction_requirement', 'pattern_rule', 'The interaction requirement carries out the pattern rule at its view, endpoint or flow.'),
  ('fulfills', 'flow_step', 'requirement', 'The step carries out the requirement.'),
  ('fulfills', 'flow_step', 'interaction_requirement', 'The step carries out the interaction requirement.'),
  ('fulfills', 'flow_step', 'domain_rule', 'The step carries out the domain rule.'),
  ('fulfills', 'flow_step', 'pattern_rule', 'The step carries out the pattern rule.'),
  ('uses', 'flow', 'view', 'The flow passes through the view.'),
  ('uses', 'flow', 'endpoint', 'The flow calls the endpoint.'),
  ('uses', 'view', 'endpoint', 'The view calls the endpoint.'),
  ('uses', 'flow_step', 'view', 'The step happens in the view.'),
  ('uses', 'flow_step', 'endpoint', 'The step calls the endpoint.'),
  ('uses', 'flow_step', 'component', 'The step is carried out by the component.'),
  ('uses', 'design_step', 'component', 'The step is carried out by the component.'),
  ('satisfies', 'component', 'requirement', 'The component designs or implements the requirement.'),
  ('satisfies', 'component', 'domain_rule', 'The component enforces the domain rule.'),
  ('satisfies', 'component', 'interaction_requirement', 'The component designs or implements the interaction requirement.'),
  ('satisfies', 'component', 'pattern_rule', 'The component designs or implements the pattern rule, for the domain it sits in.'),
  ('satisfies', 'design_step', 'requirement', 'The step designs the requirement, through the component it uses.'),
  ('satisfies', 'design_step', 'domain_rule', 'The step enforces the domain rule, through the component it uses.'),
  ('satisfies', 'design_step', 'interaction_requirement', 'The step designs the interaction requirement, through the component it uses.'),
  ('satisfies', 'design_step', 'pattern_rule', 'The step designs the pattern rule, for the domain it sits in, through the component it uses.'),
  ('implements', 'component', 'endpoint', 'The component serves the endpoint.'),
  ('implements', 'component', 'view', 'The component renders the view.'),
  ('depends_on', 'component', 'component', 'The component calls or imports the other.'),
  ('proves', 'test', 'requirement', 'The test proves the requirement.'),
  ('proves', 'test', 'domain_rule', 'The test proves the domain rule.'),
  ('proves', 'test', 'interaction_requirement', 'The test proves the interaction requirement.'),
  ('proves', 'test', 'pattern_rule', 'The test proves the pattern rule, for the domain it sits in.'),
  ('supports', 'test', 'requirement', 'The test checks a mechanism that backs the use case requirement without proving it.'),
  ('supports', 'test', 'domain_rule', 'The test checks a mechanism that backs the domain rule without proving it.'),
  ('supports', 'test', 'interaction_requirement', 'The test checks a mechanism that backs the interaction requirement without proving it.'),
  ('supports', 'test', 'pattern_rule', 'The test checks a mechanism that backs the pattern rule without proving it.'),
  ('about', 'question', '*', 'The open question concerns that record.'),
  ('carries_out', 'flow', 'use_case', 'The flow carries out the use case.'),
  ('runs', 'test', 'flow', 'The test runs the flow end to end.'),
  ('covers', 'test', 'component', 'The test exercises the component.'),
  ('has_one', 'entity', 'entity', 'The entity holds exactly one of the other entity, as a part of it (one to one).'),
  ('has_many', 'entity', 'entity', 'The entity holds any number of the other entity, as parts of it (one to many).'),
  ('refers_to', 'entity', 'entity', 'The entity holds a reference to one of the other entity, which may sit in another aggregate or domain (many to one).'),
  ('raised_by', 'domain_event', 'entity', 'The event is raised when that entity of its aggregate changes.'),
  ('reacts_to', 'aggregate', 'domain_event', 'The aggregate changes in response to the event, which may come from another aggregate or domain.'),
  ('reacts_to', 'use_case', 'domain_event', 'The use case starts when the event happens.'),
  ('reacts_to', 'component', 'domain_event', 'The component handles the event.'),
  ('involves', 'domain_rule', 'aggregate', 'The domain rule, under its domain, holds across this aggregate and the others it names.'),
  ('deepens', 'design_flow', 'flow', 'The technical flow says how the system carries out the flow.'),
  ('meets', 'component', 'standard_rule', 'The component follows the standard rule.'),
  ('meets', 'test', 'standard_rule', 'The test follows the standard rule.'),
  ('meets', 'design_step', 'standard_rule', 'The design step follows the standard rule.');

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
